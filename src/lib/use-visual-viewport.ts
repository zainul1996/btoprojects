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
 * Returns `null` when no keyboard-sized shrink is detected, so callers fall
 * back to a CSS `dvh` height. That keeps desktop untouched (resizing a
 * browser window moves `innerHeight` and `vv.height` together) and lets
 * Android Chrome handle the keyboard natively via the
 * `interactive-widget=resizes-content` viewport meta (there `innerHeight`
 * shrinks with the keyboard, so the delta stays below the threshold).
 */

/** Site header is h-14 = 3.5rem. */
const DEFAULT_CHROME_PX = 56;

/** Smaller shrinkages are browser chrome or the floating keyboard — ignore. */
const KEYBOARD_THRESHOLD_PX = 150;

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
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
      const keyboardOpen =
        window.innerHeight - vv.height > KEYBOARD_THRESHOLD_PX;
      if (!keyboardOpen) return null;
      // No minimum clamp: pinning the composer to the keyboard beats keeping
      // the messages area tall (landscape phones shrink it to near zero).
      return Math.round(vv.height + vv.offsetTop - chromeHeightPx);
    },
    () => null,
  );
}
