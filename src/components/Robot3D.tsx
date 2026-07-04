"use client";

import { useEffect, useRef } from "react";
import "./robot3d.css";

// Ejemplo de three.js "webgl_animation_skinning_morph": modelo RobotExpressive
// con animación de skinning + morph targets. Se monta como decoración flotante.
// three se importa dinámicamente (solo en el navegador) para no tocar el SSR.
//
// Componente compartido: se usa tanto en la landing (`/`) como en el detalle
// del diplomado. El posicionamiento lo define la clase que se le pase por
// `className` (por defecto `dp-robot`); así cada página controla su ubicación.

const CLIP = "Walking"; // Idle | Walking | Running | Dance | Wave | ...

export function Robot3D({
  className = "dp-robot",
  label = "¡Especialízate!",
}: {
  className?: string;
  /** Texto del bocadillo que aparece sobre el robot. `null` lo oculta. */
  label?: string | null;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      if (disposed || !mount) return;

      const width = mount.clientWidth || 240;
      const height = mount.clientHeight || 300;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0); // fondo transparente
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(1.1, 1.35, 5.2);
      camera.lookAt(0, 1.05, 0);

      const hemi = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 3);
      hemi.position.set(0, 20, 0);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 3);
      dir.position.set(3, 10, 6);
      scene.add(dir);

      let mixer: import("three").AnimationMixer | null = null;

      new GLTFLoader().load(
        "/models/RobotExpressive.glb",
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;
          model.rotation.y = -0.4; // vista 3/4
          scene.add(model);

          // Auto-encuadre: coloca la cámara a la distancia justa para que el
          // modelo completo quepa en el contenedor, con un margen de holgura.
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const fov = (camera.fov * Math.PI) / 180;
          const fitHeight = size.y / 2 / Math.tan(fov / 2);
          const fitWidth = size.x / 2 / Math.tan(fov / 2) / camera.aspect;
          const dist = 1.25 * Math.max(fitHeight, fitWidth);
          camera.position.set(center.x, center.y + size.y * 0.04, center.z + dist);
          camera.near = Math.max(dist / 100, 0.01);
          camera.far = dist * 100;
          camera.updateProjectionMatrix();
          camera.lookAt(center.x, center.y, center.z);

          mixer = new THREE.AnimationMixer(model);
          const clip =
            THREE.AnimationClip.findByName(gltf.animations, CLIP) ??
            gltf.animations[0];
          if (clip) mixer.clipAction(clip).play();
        },
        undefined,
        (err) => console.error("Robot3D: no se pudo cargar el modelo", err),
      );

      let prev = performance.now();
      let raf = requestAnimationFrame(function animate(now: number) {
        raf = requestAnimationFrame(animate);
        const delta = (now - prev) / 1000;
        prev = now;
        if (mixer) mixer.update(delta);
        renderer.render(scene, camera);
      });

      const ro = new ResizeObserver(() => {
        const w = mount.clientWidth || width;
        const h = mount.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      ro.observe(mount);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        scene.traverse((obj) => {
          const mesh = obj as { geometry?: { dispose?: () => void }; material?: unknown };
          mesh.geometry?.dispose?.();
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : mesh.material
              ? [mesh.material]
              : [];
          for (const m of mats as Array<Record<string, unknown> & { dispose?: () => void }>) {
            for (const key in m) {
              const val = m[key] as { isTexture?: boolean; dispose?: () => void };
              if (val && val.isTexture) val.dispose?.();
            }
            m.dispose?.();
          }
        });
        renderer.dispose();
        renderer.forceContextLoss?.();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className={className} aria-hidden="true">
      {label ? (
        <span className="r3d-bubble">
          {label}
          <span className="r3d-bubble__tail" />
        </span>
      ) : null}
      <div ref={mountRef} className="r3d-canvas" />
    </div>
  );
}
