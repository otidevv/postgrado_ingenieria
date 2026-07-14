"use client";

import { useEffect } from "react";

/* Efecto de "reveal al hacer scroll" para páginas server-rendered: no pinta
   nada; observa los [data-reveal] bajo `root` y les añade `is-in` al entrar
   en pantalla, con escalonado dentro de cada [data-reveal-group].
   - Respeta prefers-reduced-motion (todo visible de inmediato).
   - El CSS solo oculta bajo `@media (scripting: enabled)`: sin JS nada
     queda invisible. */
export function RevealEffect({ root = "body" }: { root?: string }) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(`${root} [data-reveal]`),
    );
    if (!targets.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    document
      .querySelectorAll<HTMLElement>(`${root} [data-reveal-group]`)
      .forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          (child as HTMLElement).style.transitionDelay = `${i * 0.07}s`;
        });
      });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.classList.add("is-in");
          // El retraso del escalonado solo vale para la entrada; se limpia
          // al terminar para no retrasar las transiciones de hover.
          if (el.style.transitionDelay) {
            el.addEventListener(
              "transitionend",
              () => {
                el.style.transitionDelay = "";
              },
              { once: true },
            );
          }
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);

  return null;
}
