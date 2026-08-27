import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const STETHOSCOPE_URL = '/Healthcare/Sthethoscope/doctors_stethoscope.glb';

/** Soft radial glow used as a floating backdrop behind the model — pure decoration, no shadow. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(110, 240, 200, 0.4)');
  gradient.addColorStop(0.55, 'rgba(44, 127, 242, 0.16)');
  gradient.addColorStop(1, 'rgba(44, 127, 242, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A soft, blurred backdrop model that lives behind the hero text. It never
 * pins or pauses the page — `progressRef` is a plain 0→1 ref that the parent
 * updates every frame from ordinary scroll position, so the model's scale/
 * position/tilt just ride along with normal scrolling the whole time,
 * starting subtle and small and growing bigger + more slanted as the hero
 * section passes through the viewport.
 */
export function StethoscopeScene({ progressRef }: { progressRef: React.RefObject<number> }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current!;
    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x1c3b3a, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 4.5, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe9ff, 0.75);
    fill.position.set(-4, 1.5, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x8fe3d0, 1.2);
    rim.position.set(-1, 2.5, -4);
    scene.add(rim);

    const glowTex = makeGlowTexture();
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
    glowSprite.scale.set(6, 6, 1);
    glowSprite.position.z = -0.8;
    scene.add(glowSprite);

    // The whole model + glow live in one wrapper so scroll-driven position/scale/
    // rotation can be applied as a single transform each frame.
    const rig = new THREE.Group();
    scene.add(rig);

    let modelGroup: THREE.Group | null = null;

    const loader = new GLTFLoader();
    loader.load(
      STETHOSCOPE_URL,
      (gltf) => {
        if (disposed) return;
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        gltf.scene.position.sub(center);

        const targetHeight = 2.7;
        const scale = targetHeight / (size.y || 1);
        const wrapper = new THREE.Group();
        wrapper.add(gltf.scene);
        wrapper.scale.setScalar(scale);
        // The raw model hangs along its own long axis — angle it into a natural,
        // slightly-draped pose rather than a straight vertical line.
        wrapper.rotation.x = Math.PI * 0.04;

        rig.add(wrapper);
        modelGroup = wrapper;
        setReady(true);
      },
      undefined,
      () => setReady(true)
    );

    let prevT = performance.now();
    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      const elapsed = now / 1000;

      const p = Math.max(0, Math.min(1, progressRef.current ?? 0));
      const eased = 1 - Math.pow(1 - p, 2.6); // brisk start, eases to a graceful stop

      // Starts small and roughly centered (a subtle backdrop behind the text)
      // and drifts right while it grows and tilts further, so it reads as
      // "bigger and slanter" without ever fighting the text for space.
      rig.position.x = -0.9 + eased * 3.3;
      rig.position.y = -0.2 + eased * 0.4;
      const scale = 0.42 + eased * 1.05;
      rig.scale.setScalar(scale);
      // A fuller, more dramatic tilt on the way in, landing on a natural
      // resting slant rather than upright.
      rig.rotation.z = eased * Math.PI * 0.32;
      rig.rotation.y = eased * Math.PI * 2.4;

      if (modelGroup) {
        // Gentle continuous idle bob so it never looks static, layered under
        // the scroll-driven transform above — strongest once settled.
        modelGroup.position.y = Math.sin(elapsed * 0.9) * 0.05 * (0.4 + eased * 0.6);
        modelGroup.rotation.y = elapsed * 0.18 * eased;
      }
      glowSprite.material.rotation = elapsed * 0.04;
      // Backdrop reads more softly once it has grown into place.
      glowSprite.material.opacity = 0.5 + eased * 0.3;
      void dt;

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [progressRef]);

  return (
    <div ref={mountRef} className={`lp-stetho-mount ${ready ? 'lp-stetho-ready' : ''}`} aria-hidden="true">
      <style>{`
        .lp-stetho-mount { position: absolute; inset: 0; opacity: 0; transition: opacity 1.2s ease; pointer-events: none; }
        .lp-stetho-mount canvas { display: block; width: 100% !important; height: 100% !important; }
        .lp-stetho-mount.lp-stetho-ready { opacity: 1; }
      `}</style>
    </div>
  );
}