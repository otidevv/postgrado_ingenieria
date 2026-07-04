import type { CSSProperties } from "react";
import "./sakura.css";

// Lluvia de pétalos de sakura (cerezo) en overlay sobre el contenido.
// CSS puro, sin JS ni imágenes. Los valores son deterministas (no usan
// Math.random) para ser 100% seguros en SSR/hidratación.
//
// Cada pétalo define: posición horizontal (left %), tamaño, duración de la
// caída, retraso (varios negativos para que la pantalla ya salga poblada al
// entrar) y la deriva lateral --drift que le da el vaivén al caer.

type Petal = {
  left: number;
  size: number;
  dur: number;
  delay: number;
  drift: number;
};

const PETALS: Petal[] = [
  { left: 2, size: 15, dur: 11, delay: -1, drift: 46 },
  { left: 8, size: 11, dur: 9, delay: -6, drift: -34 },
  { left: 14, size: 18, dur: 13, delay: -3, drift: 60 },
  { left: 20, size: 12, dur: 10, delay: -8, drift: -28 },
  { left: 26, size: 16, dur: 12, delay: -2, drift: 52 },
  { left: 32, size: 10, dur: 8, delay: -5, drift: -40 },
  { left: 38, size: 14, dur: 11, delay: -9, drift: 36 },
  { left: 44, size: 17, dur: 14, delay: -4, drift: -58 },
  { left: 50, size: 12, dur: 9, delay: -7, drift: 30 },
  { left: 56, size: 15, dur: 12, delay: -1, drift: -48 },
  { left: 62, size: 11, dur: 10, delay: -6, drift: 42 },
  { left: 68, size: 18, dur: 13, delay: -3, drift: -32 },
  { left: 74, size: 13, dur: 9, delay: -8, drift: 56 },
  { left: 80, size: 16, dur: 12, delay: -2, drift: -44 },
  { left: 86, size: 10, dur: 8, delay: -5, drift: 38 },
  { left: 92, size: 14, dur: 11, delay: -9, drift: -52 },
  { left: 97, size: 12, dur: 10, delay: -4, drift: 34 },
  { left: 11, size: 13, dur: 12, delay: -10, drift: -38 },
  { left: 35, size: 11, dur: 9, delay: -11, drift: 50 },
  { left: 59, size: 17, dur: 14, delay: -7, drift: -30 },
  { left: 83, size: 12, dur: 10, delay: -12, drift: 44 },
  { left: 71, size: 15, dur: 13, delay: -2, drift: -54 },
];

export function SakuraPetals() {
  return (
    <div className="sakura" aria-hidden="true">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className={`sakura__petal sakura__petal--${i % 3}`}
          style={
            {
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--drift": `${p.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
