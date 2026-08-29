import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sampleTimeline, rgbCss, type SceneChannels } from './scenes';

const STETHOSCOPE_URL = '/Healthcare/Sthethoscope/doctors_stethoscope.glb';

type Props = {
  /** eased 0→1 scroll progress (single source of truth) */
  progressRef: React.RefObject<number>;
  /** smoothed per-frame delta of progress — the velocity layer */
  velocityRef: React.RefObject<number>;
  /** pointer position, -1..1 from centre */
  pointerRef: React.RefObject<{ x: number; y: number }>;
  reducedMotion: boolean;
  lowPower: boolean;
  /** page background + vignette follow the timeline, emitted only on change */
  onBackground: (top: string, bottom: string, vignette: number) => void;
  onLoadProgress: (v: number) => void;
  onReady: () => void;
};

/* -------------------------------------------------------------------------- */
/*  small procedural assets                                                    */
/* -------------------------------------------------------------------------- */

function softSprite(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(180,240,225,0.35)');
  g.addColorStop(1, 'rgba(180,240,225,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(120,240,210,0.4)');
  g.addColorStop(0.5, 'rgba(60,180,255,0.12)');
  g.addColorStop(1, 'rgba(60,180,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** one ECG beat over u ∈ [0, 2π): flat baseline, P bump, sharp QRS, T wave. */
function ecg(u: number): number {
  u = ((u % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const p = Math.exp(-((u - 1.7) ** 2) * 6) * 0.12;
  const q = Math.exp(-((u - 3.0) ** 2) * 40) * -0.22;
  const r = Math.exp(-((u - 3.2) ** 2) * 55) * 1.0;
  const sw = Math.exp(-((u - 3.42) ** 2) * 40) * -0.34;
  const tw = Math.exp(-((u - 4.6) ** 2) * 5) * 0.2;
  return p + q + r + sw + tw;
}

/* -------------------------------------------------------------------------- */

export function StethoscopeExperience(props: Props) {
  const {
    progressRef,
    velocityRef,
    pointerRef,
    reducedMotion,
    lowPower,
    onBackground,
    onLoadProgress,
    onReady,
  } = props;
  const mountRef = useRef<HTMLDivElement>(null);

  // keep the latest callbacks / flags without re-running the heavy effect
  const cb = useRef({ reducedMotion, onBackground, onLoadProgress, onReady });
  cb.current = { reducedMotion, onBackground, onLoadProgress, onReady };

  useEffect(() => {
    const mount = mountRef.current!;
    let disposed = false;
    let raf = 0;

    /* ---- renderer / scene / camera -------------------------------------- */
    const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.4 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(0x071319, 0.055);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
    camera.position.set(0, 0.35, 12);

    /* ---- environment (reflections for the metal chestpiece) ------------- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    /* ---- lights -------------------------------------------------------- */
    const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x0c1f1e, 0.32);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xdfeeff, 1.5);
    key.position.set(3.5, 5, 5.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe9ff, 0.3);
    fill.position.set(-4.5, 1.5, 2.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x49d6c2, 0.6);
    rim.position.set(-1.5, 2.5, -4.5);
    scene.add(rim);

    /* ---- soft glow behind the model --------------------------------- */
    const glowTex = glowSprite();
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.25 }),
    );
    glow.scale.set(7, 7, 1);
    glow.position.z = -1.5;
    scene.add(glow);

    /* ---- stethoscope rig -------------------------------------------- */
    // rig  = cinematic transform straight off the timeline
    // fx   = micro-motion layer (float / pointer / scroll momentum)
    const rig = new THREE.Group();
    const fx = new THREE.Group();
    rig.add(fx);
    scene.add(rig);

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

        const wrap = new THREE.Group();
        wrap.add(gltf.scene);
        wrap.scale.setScalar(2.7 / (size.y || 1));

        // Enhance, don't replace: keep the model's own colours, just give the
        // metal a crisper spec response and let it pick up the environment.
        gltf.scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (!m || !('isMeshStandardMaterial' in m)) return;
          m.envMapIntensity = 1.15;
          if (m.metalness > 0.5) m.roughness = Math.min(m.roughness, 0.32);
          else m.roughness = Math.max(m.roughness, 0.5);
          m.needsUpdate = true;
        });

        fx.add(wrap);
        cb.current.onReady();
      },
      (e) => {
        if (e.lengthComputable) cb.current.onLoadProgress(e.loaded / e.total);
      },
      () => cb.current.onReady(),
    );

    /* ---- ambient particles --------------------------------------- */
    const PCOUNT = lowPower ? 170 : 460;
    const pPos = new Float32Array(PCOUNT * 3);
    const pSpeed = new Float32Array(PCOUNT);
    const pDir = new Float32Array(PCOUNT);
    for (let i = 0; i < PCOUNT; i++) {
      pPos[i * 3] = (Math.random() * 2 - 1) * 9;
      pPos[i * 3 + 1] = (Math.random() * 2 - 1) * 6;
      pPos[i * 3 + 2] = -8 + Math.random() * 9;
      pSpeed[i] = 0.3 + Math.random() * 0.7;
      pDir[i] = Math.random() < 0.5 ? -1 : 1;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pTex = softSprite();
    const pMat = new THREE.PointsMaterial({
      size: lowPower ? 0.07 : 0.055,
      map: pTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      color: new THREE.Color(0x8fe9dd),
      opacity: 0.2,
    });
    const points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    scene.add(points);

    /* ---- ECG / pulse signal ------------------------------------- */
    const makeLine = (n: number, z: number, col: number, baseOp: number) => {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = -4 + (i / (n - 1)) * 8;
        pos[i * 3 + 2] = z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      scene.add(line);
      return { geo, mat, n, baseOp };
    };
    const SN = lowPower ? 90 : 150;
    const sigA = makeLine(SN, -1.4, 0x5fe6d4, 0.7);
    const sigB = makeLine(SN, -2.2, 0x3fb6ff, 0.28);

    const updateLine = (l: typeof sigA, t: number, intensity: number, ampMul: number, phase: number) => {
      l.mat.opacity = 0.06 + intensity * l.baseOp;
      const amp = (0.12 + intensity * 0.95) * ampMul;
      const arr = l.geo.attributes.position.array as Float32Array;
      for (let i = 0; i < l.n; i++) {
        const x = arr[i * 3];
        arr[i * 3 + 1] = ecg(x * 0.9 - t * 2.4 + phase) * amp;
      }
      l.geo.attributes.position.needsUpdate = true;
    };

    /* ---- pause when tab hidden or section scrolled away ---------- */
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { threshold: 0 });
    io.observe(mount);

    /* ---- background emit throttle ------------------------------- */
    let lastBg = '';
    const emitBg = (s: SceneChannels) => {
      const sig = `${rgbCss(s.bgTop)}|${rgbCss(s.bgBottom)}|${s.vignette.toFixed(2)}`;
      if (sig === lastBg) return;
      lastBg = sig;
      cb.current.onBackground(rgbCss(s.bgTop), rgbCss(s.bgBottom), s.vignette);
    };

    /* ---- main loop -------------------------------------------- */
    const tgt = new THREE.Vector3();
    let momentum = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || !onScreen) {
        prev = now;
        return;
      }
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const t = now / 1000;
      const reduced = cb.current.reducedMotion;

      const s = sampleTimeline(progressRef.current ?? 0);
      emitBg(s);

      const px = pointerRef.current.x;
      const py = pointerRef.current.y;
      const parX = reduced ? 0 : px * 0.35;
      const parY = reduced ? 0 : -py * 0.22;

      /* camera: dolly to camPos, always aimed at camTarget */
      camera.fov += (s.fov - camera.fov) * (1 - Math.exp(-9 * dt));
      camera.position.set(s.camPos[0] + parX, s.camPos[1] + parY, s.camPos[2]);
      tgt.set(s.camTarget[0] + parX * 0.4, s.camTarget[1] + parY * 0.4, s.camTarget[2]);
      camera.lookAt(tgt);
      camera.updateProjectionMatrix();

      /* stethoscope — layer 1: cinematic */
      rig.position.set(s.modelPos[0], s.modelPos[1], s.modelPos[2]);
      rig.rotation.set(s.modelRot[0], s.modelRot[1], s.modelRot[2]);
      rig.scale.setScalar(s.modelScale);

      /* layers 2-5: float, pointer follow, scroll-velocity momentum */
      const targetMomentum = reduced
        ? 0
        : Math.max(-0.5, Math.min(0.5, (velocityRef.current ?? 0) * 7));
      momentum += (targetMomentum - momentum) * (1 - Math.exp(-5 * dt));
      const floatY = reduced ? 0 : Math.sin(t * 0.6) * 0.045;
      const floatRz = reduced ? 0 : Math.sin(t * 0.42) * 0.02;
      const swayY = reduced ? 0 : px * 0.14 + Math.sin(t * 0.22) * 0.035;
      const swayX = reduced ? 0 : -py * 0.09;
      fx.position.set(0, floatY, 0);
      fx.rotation.set(swayX, swayY + momentum, floatRz + momentum * 0.4);

      /* lighting evolution */
      hemi.intensity = s.hemi;
      key.intensity = s.key;
      fill.intensity = s.fill;
      rim.intensity = s.rim;
      key.color.setRGB(s.keyColor[0], s.keyColor[1], s.keyColor[2]);
      rim.color.setRGB(s.rimColor[0], s.rimColor[1], s.rimColor[2]);
      renderer.toneMappingExposure = s.exposure;
      fog.color.setRGB(s.fog[0], s.fog[1], s.fog[2]);
      fog.density = s.fogDensity;

      /* glow */
      glow.material.opacity = 0.22 + s.signal * 0.4;
      if (!reduced) glow.material.rotation = t * 0.03;

      /* particles */
      pMat.opacity = s.particleOpacity;
      if (!reduced) {
        const arr = pGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < PCOUNT; i++) {
          arr[i * 3 + 1] += dt * 0.18 * pSpeed[i] + dt * s.particleDrift * 0.15;
          arr[i * 3] += dt * s.particleDrift * 1.7 * pDir[i];
          if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = -6;
          if (arr[i * 3] > 9) arr[i * 3] = -9;
          else if (arr[i * 3] < -9) arr[i * 3] = 9;
        }
        pGeo.attributes.position.needsUpdate = true;
      }

      /* signal */
      const st = reduced ? 0 : t;
      updateLine(sigA, st, s.signal, 1, 0);
      updateLine(sigB, st, s.signal, 0.6, 1.3);

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    /* ---- resize ---------------------------------------------- */
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.4 : 2));
      renderer.setSize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* ---- teardown ------------------------------------------- */
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      pGeo.dispose();
      pMat.dispose();
      pTex.dispose();
      sigA.geo.dispose();
      sigA.mat.dispose();
      sigB.geo.dispose();
      sigB.mat.dispose();
      glowTex.dispose();
      (glow.material as THREE.SpriteMaterial).dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [progressRef, velocityRef, pointerRef, lowPower]);

  return <div ref={mountRef} className="lp-canvas" aria-hidden="true" />;
}
