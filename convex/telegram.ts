"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Telegram bot delivery. Every send is journaled to notificationLog with
 * status; batch delivery also appends "telegram" to alerts.deliveredVia.
 * MVP fallback: users without a telegramChatId deliver to the env
 * TELEGRAM_CHAT_ID demo chat.
 */

interface TelegramResponse {
  ok?: boolean;
  description?: string;
}

async function postSendMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const data = (await res.json()) as TelegramResponse;
  if (!res.ok || data.ok !== true) {
    return {
      ok: false,
      detail: `HTTP ${res.status}: ${data.description ?? "unknown telegram error"}`,
    };
  }
  return { ok: true };
}

export const send = internalAction({
  args: {
    chatId: v.string(),
    text: v.string(),
    alertId: v.optional(v.id("alerts")),
  },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      await ctx.runMutation(internal.notifications.log, {
        alertId: args.alertId,
        channel: "telegram",
        status: "failed",
        detail: "TELEGRAM_BOT_TOKEN not set on deployment",
      });
      return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
    }
    const result = await postSendMessage(botToken, args.chatId, args.text);
    await ctx.runMutation(internal.notifications.log, {
      alertId: args.alertId,
      channel: "telegram",
      status: result.ok ? "sent" : "failed",
      detail: result.ok ? `chatId ${args.chatId}` : result.detail,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.detail };
  },
});

export const deliverTelegramBatch = internalAction({
  args: {
    deliveries: v.array(
      v.object({
        alertId: v.id("alerts"),
        userId: v.id("users"),
      }),
    ),
    title: v.string(),
    body: v.string(),
  },
  returns: v.object({ sent: v.number(), failed: v.number() }),
  handler: async (ctx, args) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const fallbackChatId = process.env.TELEGRAM_CHAT_ID;
    const text = `${args.title}\n\n${args.body}`;

    let sent = 0;
    let failed = 0;
    for (const delivery of args.deliveries) {
      const user = await ctx.runQuery(internal.users.getById, {
        userId: delivery.userId,
      });
      const chatId = user?.telegramChatId ?? fallbackChatId;
      if (!botToken || !chatId) {
        failed++;
        await ctx.runMutation(internal.notifications.log, {
          alertId: delivery.alertId,
          channel: "telegram",
          status: "failed",
          detail: !botToken
            ? "TELEGRAM_BOT_TOKEN not set"
            : "no chatId for user and no env fallback",
        });
        continue;
      }
      const result = await postSendMessage(botToken, chatId, text);
      if (result.ok) {
        sent++;
        await ctx.runMutation(internal.notifications.appendDeliveredVia, {
          alertId: delivery.alertId,
          channel: "telegram",
        });
      } else {
        failed++;
      }
      await ctx.runMutation(internal.notifications.log, {
        alertId: delivery.alertId,
        channel: "telegram",
        status: result.ok ? "sent" : "failed",
        detail: result.ok ? `chatId ${chatId}` : result.detail,
      });
    }
    console.log(
      JSON.stringify({ fn: "telegram.deliverTelegramBatch", sent, failed }),
    );
    return { sent, failed };
  },
});
