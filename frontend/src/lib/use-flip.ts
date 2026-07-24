"use client";

import { useLayoutEffect, useRef } from "react";

/** flip-style row animation hook; pass a stable key list and a function returning each key's element, animates old position to new on every render */
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
