"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * FLIP-style row animation hook. Pass a stable key list (in the order they
 * appear in the DOM) and a function that returns the element for each key.
 * On every render, the hook compares the new positions to the previous ones
 * and animates each row from its old position to the new one.
 */
export function useFlipRows<K extends string>(
  keys: readonly K[],
  getNode: (key: K) => HTMLElement | null,
  durationMs = 400,
) {
  const prev = useRef<Map<K, number>>(new Map());

  useLayoutEffect(() => {
    const next = new Map<K, number>();
    for (const k of keys) {
      const node = getNode(k);
      if (node) next.set(k, node.getBoundingClientRect().top);
    }

    for (const [k, oldTop] of prev.current.entries()) {
      const node = getNode(k);
      if (!node) continue;
      const newTop = next.get(k);
      if (newTop === undefined) continue;
      const delta = oldTop - newTop;
      if (Math.abs(delta) < 1) continue;
      node.animate(
        [
          { transform: `translateY(${delta}px)` },
          { transform: "translateY(0)" },
        ],
        {
          duration: durationMs,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    }

    prev.current = next;
  });
}
