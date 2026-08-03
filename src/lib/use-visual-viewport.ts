"use client";

import { useSyncExternalStore } from "react";

/**
 * Keyboard-aware viewport height for full-screen mobile surfaces.
 *
 * Why this exists: `dvh`/`svh` track the *layout* viewport, which does not
 * change when the software keyboard opens on iOS Safari — a composer pinned
 * to `100dvh` ends up behind the keyboard. `window.visualViewport` is the
 * reliable signal: `height` shrinks by the keyboard height and `offsetTop`
 * reports how far the layout viewport has been scrolled to reveal the
 * focused field.
 *
 * The returned value is the height (px) available below `chromeHeightPx`
 * of always-visible UI (the sticky site header), i.e. the height a chat
 * column must take so its composer sits exactly on the visual viewport's
 * bottom edge — directly above the keyboard — whether or not the browser
 * scrolled the page to reveal the input:
 *
 *   container bottom = chromeHeight + H = vv.offsetTop + vv.height
 *
 * Returns `null` when no text field is focused, so callers fall back to a
 * CSS `dvh` height. Focus (not the shrink delta) drives the override:
 * geometry is always correct while a field is focused, and iOS 26.0 has a
 * WebKit bug where `vv.offsetTop` stays > 0 after the keyboard dismisses,
 * which a delta heuristic misreads as "keyboard still open". The handler
 * also nudges `window.scrollTo(0, 0)` on settle — the standard repair for
 * that stuck viewport pan — and re-notifies after the keyboard animation
 * ends, because iOS delivers intermediate values mid-transition.
 */

/** Site header is h-14 = 3.5rem. */
const DEFAULT_CHROME_PX = 56;

/** Keyboard-dismiss animation grace before the settle re-check. */
const SETTLE_MS = 350;

/** Below this shrinkage the keyboard is considered closed. */
const KEYBOARD_CLOSED_DELTA_PX = 50;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    target.isContentEditable
  );
}

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  const repairStuckPan = () => {
    if (!vv) return;
    // iOS 26.0 WebKit bug: offsetTop can stay > 0 after the keyboard
    // dismisses, leaving the page visually panned (composer "stuck" high).
    if (window.innerHeight - vv.height < KEYBOARD_CLOSED_DELTA_PX && vv.offsetTop > 0) {
      window.scrollTo(0, 0);
    }
  };

  const handleViewportChange = () => {
    repairStuckPan();
    onChange();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      repairStuckPan();
      onChange();
    }, SETTLE_MS);
  };

  const handleFocusOut = (event: FocusEvent) => {
    if (!isEditableTarget(event.target)) return;
    // Blur usually means the keyboard is going away: restore immediately,
    // then repair any residual viewport pan once the animation settles.
    onChange();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      repairStuckPan();
      onChange();
    }, SETTLE_MS);
  };

  const handleFocusIn = (event: FocusEvent) => {
    if (!isEditableTarget(event.target)) return;
    onChange();
  };

  vv?.addEventListener("resize", handleViewportChange);
  vv?.addEventListener("scroll", handleViewportChange);
  window.addEventListener("resize", handleViewportChange);
  document.addEventListener("focusin", handleFocusIn);
  document.addEventListener("focusout", handleFocusOut);
  return () => {
    clearTimeout(settleTimer);
    vv?.removeEventListener("resize", handleViewportChange);
    vv?.removeEventListener("scroll", handleViewportChange);
    window.removeEventListener("resize", handleViewportChange);
    document.removeEventListener("focusin", handleFocusIn);
    document.removeEventListener("focusout", handleFocusOut);
  };
}

export function useVisualViewportHeight(
  chromeHeightPx: number = DEFAULT_CHROME_PX,
): number | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const vv = window.visualViewport;
      if (!vv) return null;
      if (!isEditableTarget(document.activeElement)) return null;
      // No minimum clamp: pinning the composer to the keyboard beats keeping
      // the messages area tall (landscape phones shrink it to near zero).
      return Math.round(vv.height + vv.offsetTop - chromeHeightPx);
    },
    () => null,
  );
}
