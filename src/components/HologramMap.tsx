"use client";

import { useEffect, useRef } from "react";
import {
  HOLOMAP_COLS,
  HOLOMAP_ROWS,
  HOLOMAP_ROWS_N,
} from "./hologram-map-data";

/* Mapamundi "holograma": matriz de puntos dibujada en canvas a partir de
   una rejilla generada de un mapa equirectangular de dominio público
   (ver hologram-map-data.ts). Con brillo ondulante sutil y un marcador
   pulsante sobre Puerto Maldonado (sede UNAMAD).
   - Decorativo: aria-hidden, sin eventos.
   - Rinde solo cuando está en pantalla y la pestaña visible.
   - prefers-reduced-motion → dibujo estático, sin bucle. */

const MARKER = { lat: -12.593, lon: -69.189 }; // Puerto Maldonado, Madre de Dios

export function HologramMap({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let running = false;
    let tabVisible = true;
    let onScreen = true;
    let W = 0;
    let H = 0;

    type Dot = { x: number; y: number; phase: number };
    const dots: Dot[] = [];
    const marker = { x: 0, y: 0 };

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // El mapa (2:1) se escala al ancho y se centra en vertical: los
      // polos quedan recortados, el ecuador (y Perú) siempre visible.
      dots.length = 0;
      const s = W / HOLOMAP_COLS;
      const mapH = s * HOLOMAP_ROWS_N;
      const oy = (H - mapH) / 2;
      for (let gy = 0; gy < HOLOMAP_ROWS_N; gy++) {
        const row = HOLOMAP_ROWS[gy];
        for (let gx = 0; gx < HOLOMAP_COLS; gx++) {
          if (row.charCodeAt(gx) === 49 /* '1' */) {
            dots.push({
              x: gx * s + s / 2,
              y: oy + gy * s + s / 2,
              phase: ((gx * 7 + gy * 13) % 628) / 100, // 0..2π estable
            });
          }
        }
      }
      marker.x = ((MARKER.lon + 180) / 360) * W;
      marker.y = oy + ((90 - MARKER.lat) / 180) * mapH;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const s = W / HOLOMAP_COLS;
      const r = Math.max(0.8, s * 0.17);
      ctx.fillStyle = "#ffffff";
      for (const d of dots) {
        ctx.globalAlpha = reduce
          ? 0.18
          : 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t / 1400 + d.phase));
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, 6.2832);
        ctx.fill();
      }
      // Marcador: Puerto Maldonado
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffc24b";
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 3.2, 0, 6.2832);
      ctx.fill();
      if (!reduce) {
        const k = (t % 2400) / 2400; // anillo expansivo
        ctx.strokeStyle = "#ffc24b";
        ctx.globalAlpha = (1 - k) * 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 3 + k * 16, 0, 6.2832);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      draw(t);
    };
    const start = () => {
      if (running || reduce) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const sync = () => {
      if (tabVisible && onScreen) start();
      else stop();
    };

    build();
    draw(0);

    const ro = new ResizeObserver(() => {
      build();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    io.observe(canvas);
    const onVis = () => {
      tabVisible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    sync();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
