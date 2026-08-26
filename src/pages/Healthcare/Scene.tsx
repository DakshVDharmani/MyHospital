import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const DOCTOR_URL = '/Healthcare/doctor.glb';
const NURSE_URL = '/Healthcare/nurse.glb';
const AMBULANCE_URL = '/Healthcare/ambulance.glb';

/** How long (ms) after the last pointer move / keystroke before the staff go back to "usual". */
const ACTIVITY_WINDOW_MS = 1100;
/** How quickly the wave<->usual blend eases per second (higher = snappier). */
const BLEND_SPEED = 3.4;

export type Activity = { lastActivity: number; passwordActive: boolean };

/** Radial-gradient sprite used as a cheap, always-readable contact shadow under each character. */
function makeShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(10, 30, 40, 0.42)');
  gradient.addColorStop(0.6, 'rgba(10, 30, 40, 0.22)');
  gradient.addColorStop(1, 'rgba(10, 30, 40, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A small upturned mustache/mouth-corner accent — drawn as a soft curved line so it reads as a
 * smile line under the beard, and is animated (curling upward) rather than just faded in. */
function makeSmileTexture(): THREE.CanvasTexture {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(60, 42, 32, 0.85)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.16, size * 0.42);
  ctx.quadraticCurveTo(size * 0.5, size * 0.72, size * 0.84, size * 0.42);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addContactShadow(parent: THREE.Object3D, radius: number, tex: THREE.Texture) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.005;
  parent.add(mesh);
  return mesh;
}

/** Fits+centers a loaded model onto the ground (y=0) inside a wrapper group, returns the wrapper + model height. */
function groundAndCenter(model: THREE.Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;

  const scale = targetHeight / (size.y || 1);
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(scale);
  return { wrapper, scale };
}

export type DoctorRig = {
  root: THREE.Group;
  head: THREE.Object3D;
  neck: THREE.Object3D;
  rUpperArm: THREE.Object3D;
  rForearm: THREE.Object3D;
  rHand: THREE.Object3D;
  rFinger0: THREE.Object3D | null;
  rFinger1: THREE.Object3D | null;
  pen: THREE.Object3D | null;
  baseScale: number;
  baseHead: THREE.Quaternion;
  baseNeck: THREE.Quaternion;
  baseRUpperArm: THREE.Quaternion;
  baseRForearm: THREE.Quaternion;
  baseRHand: THREE.Quaternion;
  baseRFinger0: THREE.Quaternion | null;
  baseRFinger1: THREE.Quaternion | null;
};

export function riggedDoctor(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }): DoctorRig | null {
  // Bake the model's single-keyframe pose (arms bent, holding the pad + pen) BEFORE measuring/centering.
  const mixer = new THREE.AnimationMixer(gltf.scene);
  if (gltf.animations[0]) {
    mixer.clipAction(gltf.animations[0]).play();
    mixer.setTime(0.5);
  }
  gltf.scene.updateMatrixWorld(true);

  // GLTFLoader sanitizes node names (spaces -> underscores) via PropertyBinding.sanitizeNodeName.
  const head = gltf.scene.getObjectByName('Bip001_Head_023');
  const neck = gltf.scene.getObjectByName('Bip001_Neck_05');
  const rUpperArm = gltf.scene.getObjectByName('Bip001_R_UpperArm_015');
  const rForearm = gltf.scene.getObjectByName('Bip001_R_Forearm_016');
  const rHand = gltf.scene.getObjectByName('Bip001_R_Hand_017');
  if (!head || !neck || !rUpperArm || !rForearm || !rHand) return null;

  const rFinger0 = gltf.scene.getObjectByName('Bip001_R_Finger0_018') ?? null;
  const rFinger1 = gltf.scene.getObjectByName('Bip001_R_Finger1_020') ?? null;
  const pen = gltf.scene.getObjectByName('pen') ?? null;

  // The baked pose holds the pad up near shoulder height, which stretches the raw bounding box well
  // above the actual head — scaling off that box would shrink the whole figure. Use head-to-feet
  // instead, which stays stable regardless of arm pose.
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const headWorld = new THREE.Vector3();
  head.getWorldPosition(headWorld);
  const standingHeight = headWorld.y - box.min.y;
  // The baked pose holds the pad up near/above head height, so the true silhouette (including
  // hands) ends up taller than the head-height target alone — dial the target down to compensate,
  // aiming for a total standing silhouette just a touch taller than the nurse's.
  const targetHeadHeight = 1.63;
  const scale = targetHeadHeight / (standingHeight || 1);

  const center = new THREE.Vector3();
  box.getCenter(center);
  gltf.scene.position.x -= center.x;
  gltf.scene.position.z -= center.z;
  gltf.scene.position.y -= box.min.y;

  const wrapper = new THREE.Group();
  wrapper.add(gltf.scene);
  wrapper.scale.setScalar(scale);

  return {
    root: wrapper,
    head,
    neck,
    rUpperArm,
    rForearm,
    rHand,
    rFinger0,
    rFinger1,
    pen,
    baseScale: scale,
    baseHead: head.quaternion.clone(),
    baseNeck: neck.quaternion.clone(),
    baseRUpperArm: rUpperArm.quaternion.clone(),
    baseRForearm: rForearm.quaternion.clone(),
    baseRHand: rHand.quaternion.clone(),
    baseRFinger0: rFinger0 ? rFinger0.quaternion.clone() : null,
    baseRFinger1: rFinger1 ? rFinger1.quaternion.clone() : null,
  };
}

const tmpQuatA = new THREE.Quaternion();
const tmpQuatB = new THREE.Quaternion();
const tmpQuatOut = new THREE.Quaternion();

export function applyBlendedOffset(
  bone: THREE.Object3D,
  base: THREE.Quaternion,
  usualEuler: THREE.Euler,
  waveEuler: THREE.Euler,
  blend: number
) {
  tmpQuatA.setFromEuler(usualEuler);
  tmpQuatB.setFromEuler(waveEuler);
  tmpQuatOut.slerpQuaternions(tmpQuatA, tmpQuatB, blend);
  bone.quaternion.copy(base).multiply(tmpQuatOut);
}

/** Soft round dust-puff sprite used for the ambulance's speed trail. */
function makeDustTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(230, 230, 228, 0.65)');
  gradient.addColorStop(0.55, 'rgba(210, 210, 208, 0.32)');
  gradient.addColorStop(1, 'rgba(210, 210, 208, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const DRIVE_OFF_MS = 1900;

export function HealthcareScene({
  activityRef,
  driving,
  onDriveOffDone,
}: {
  activityRef: React.RefObject<Activity>;
  driving: boolean;
  onDriveOffDone: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const drivingRef = useRef(driving);
  useEffect(() => {
    drivingRef.current = driving;
  }, [driving]);

  useEffect(() => {
    const mount = mountRef.current!;
    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);
    camera.position.set(0.0, 1.42, 9.4);
    camera.lookAt(0.0, 0.92, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // Clinical, airy lighting: cool hemisphere + warm key + soft fill + a rim to separate from the backdrop.
    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x1c3b3a, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3.2, 5.5, 4.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe9ff, 0.65);
    fill.position.set(-4, 2.5, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x8fe3d0, 0.9);
    rim.position.set(-1, 3.5, -4);
    scene.add(rim);

    const shadowTex = makeShadowTexture();
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Dust trail for the post-login drive-off — same scene/camera as everything else, so the
    // ambulance leaves from its exact resting spot, size and slant, no separate overlay to align.
    const dustTex = makeDustTexture();
    const DUST_POOL = 22;
    const dustPool: { sprite: THREE.Sprite; life: number; active: boolean }[] = [];
    for (let i = 0; i < DUST_POOL; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, opacity: 0, depthWrite: false }));
      scene.add(sprite);
      dustPool.push({ sprite, life: 0, active: false });
    }
    let dustCursor = 0;
    let dustAccum = 0;
    function spawnDust(x: number, y: number, z: number) {
      const slot = dustPool[dustCursor];
      dustCursor = (dustCursor + 1) % DUST_POOL;
      slot.active = true;
      slot.life = 0;
      slot.sprite.position.set(x, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3);
      slot.sprite.scale.setScalar(0.45 + Math.random() * 0.25);
      slot.sprite.material.opacity = 0.5;
    }

    const loader = new GLTFLoader();
    const load = (url: string) =>
      new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) =>
        loader.load(url, (g) => resolve(g as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), undefined, reject)
      );

    let doctorRig: DoctorRig | null = null;
    let doctorBaseY = 0;
    let doctorBaseRotY = 0;
    let nurseGroup: THREE.Group | null = null;
    let nurseBaseY = 0;
    let nurseBaseRotY = 0;
    let ambulanceRef: THREE.Group | null = null;

    // A small animated smile-line under the mustache — curls upward and fades in while waving.
    const smileTex = makeSmileTexture();
    const smileSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smileTex, transparent: true, opacity: 0, depthWrite: false }));
    smileSprite.scale.set(0.13, 0.07, 1);
    worldGroup.add(smileSprite);
    const doctorForward = new THREE.Vector3();
    const headWorldPos = new THREE.Vector3();

    Promise.all([load(DOCTOR_URL), load(NURSE_URL), load(AMBULANCE_URL)])
      .then(([doctorGltf, nurseGltf, ambulanceGltf]) => {
        if (disposed) return;

        // --- Ambulance: static hero backdrop, parked and perfectly placed, never animated. ---
        const { wrapper: ambulanceWrapper } = groundAndCenter(ambulanceGltf.scene, 2.28);
        ambulanceWrapper.rotation.y = Math.PI * 0.62;
        ambulanceWrapper.position.set(0.3, 0, -3.4);
        worldGroup.add(ambulanceWrapper);
        ambulanceRef = ambulanceWrapper;

        // --- Doctor ---
        const rig = riggedDoctor(doctorGltf);
        if (rig) {
          rig.root.rotation.y = Math.PI * 0.1;
          rig.root.position.set(0.88, 0, -0.05);
          addContactShadow(rig.root, 0.6, shadowTex);
          worldGroup.add(rig.root);
          doctorRig = rig;
          doctorBaseY = rig.root.position.y;
          doctorBaseRotY = rig.root.rotation.y;
          doctorForward.set(0, 0, 1).applyEuler(new THREE.Euler(0, rig.root.rotation.y, 0));
        }

        // --- Nurse (static mesh, animated as a whole body) ---
        const { wrapper: nurseWrapper } = groundAndCenter(nurseGltf.scene, 1.76);
        nurseWrapper.rotation.y = -Math.PI * 0.12;
        nurseWrapper.position.set(0.23, 0, 0.15);
        addContactShadow(nurseWrapper, 0.64, shadowTex);
        worldGroup.add(nurseWrapper);
        nurseGroup = nurseWrapper;
        nurseBaseY = nurseWrapper.position.y;
        nurseBaseRotY = nurseWrapper.rotation.y;

        setReady(true);
      })
      .catch(() => setReady(true));

    // Head, neck, arm and hand are left in the model's own resting pose (see the doctor sway
    // below) — no per-bone offsets needed.
    let blend = 0;
    let prevT = performance.now();
    const start = performance.now();
    let drive: { startX: number; startTime: number } | null = null;
    let driveFired = false;

    function tick(now: number) {
      raf = requestAnimationFrame(now2 => tick(now2));
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      const elapsed = (now - start) / 1000;

      const act = activityRef.current;
      const target = act && !act.passwordActive && now - act.lastActivity < ACTIVITY_WINDOW_MS ? 1 : 0;
      blend += (target - blend) * Math.min(1, BLEND_SPEED * dt);
      if (blend < 0.001) blend = 0;
      if (blend > 0.999) blend = 1;

      if (ambulanceRef) {
        if (drivingRef.current) {
          if (!drive) drive = { startX: ambulanceRef.position.x, startTime: now };
          const p = Math.min(1, (now - drive.startTime) / DRIVE_OFF_MS);
          const eased = 1 - Math.pow(1 - p, 2.2);
          const vFov = (camera.fov * Math.PI) / 180;
          const dist = camera.position.z - ambulanceRef.position.z;
          const h = mount.clientHeight || 1;
          // World-units-per-pixel is set by the vertical FOV alone, independent of aspect — use it
          // to find the true right edge of the (now full-screen) canvas even though the half-page
          // lens-shift in resize() makes the frustum asymmetric rather than centered on-screen.
          const worldPerPixel = (2 * Math.tan(vFov / 2) * dist) / h;
          const rightEdge = worldPerPixel * (mount.clientWidth - baseWidthPx / 2);
          const endX = rightEdge + 3;
          const x = drive.startX + (endX - drive.startX) * eased;
          ambulanceRef.position.x = x;
          ambulanceRef.position.y = Math.sin(now * 0.03) * 0.015;
          ambulanceRef.rotation.z = Math.sin(now * 0.025) * 0.01;

          dustAccum += dt * 1000;
          if (p < 0.94 && dustAccum > 30) {
            dustAccum = 0;
            spawnDust(x - Math.cos(ambulanceRef.rotation.y) * 0.5, -0.25, ambulanceRef.position.z);
          }
          if (p >= 1 && !driveFired) {
            driveFired = true;
            onDriveOffDone();
          }
        }
      }
      for (const d of dustPool) {
        if (!d.active) continue;
        d.life += 16.7;
        const t = d.life / 620;
        if (t >= 1) {
          d.active = false;
          d.sprite.material.opacity = 0;
          continue;
        }
        d.sprite.position.x += 0.045;
        d.sprite.scale.setScalar(0.45 + t * 0.85);
        d.sprite.material.opacity = 0.5 * (1 - t);
      }

      if (doctorRig) {
        // Head, neck, arm and hand stay in the model's own resting pose — no bone rig animation.
        // The "greeting" instead comes from swaying the whole body, mirroring the nurse's motion
        // (see below) but leaning/turning the opposite way, like two people acknowledging each other.
        const idleBobD = Math.sin(elapsed * 0.9 + Math.PI) * 0.0035;
        const waveBobD = Math.abs(Math.sin(elapsed * 3.4)) * 0.045 * blend;
        doctorRig.root.position.y = doctorBaseY + idleBobD + waveBobD;
        doctorRig.root.rotation.y = doctorBaseRotY - Math.sin(elapsed * 1.7) * 0.09 * blend;
        doctorRig.root.rotation.z = -Math.sin(elapsed * 3.4) * 0.05 * blend;

        const breathe = 1 + Math.sin(elapsed * 1.1) * 0.0025;
        doctorRig.root.scale.set(doctorRig.baseScale * breathe, doctorRig.baseScale, doctorRig.baseScale * breathe);

        doctorRig.root.updateMatrixWorld(true);
        doctorRig.head.getWorldPosition(headWorldPos);
        smileSprite.position.copy(headWorldPos).addScaledVector(doctorForward, 0.095);
        // A little upward curl + twitch while greeting, on top of its base mouth-height position.
        const curl = Math.sin(elapsed * 4.2) * 0.009 * blend;
        smileSprite.position.y = headWorldPos.y - 0.078 + curl;
        smileSprite.material.rotation = Math.sin(elapsed * 4.2) * 0.08 * blend;
        const smileOpacity = Math.max(0, (blend - 0.15) / 0.85) * 1.0;
        (smileSprite.material as THREE.SpriteMaterial).opacity = smileOpacity;
      }

      if (nurseGroup) {
        const idleBob = Math.sin(elapsed * 0.9) * 0.0035;
        const waveBob = Math.abs(Math.sin(elapsed * 3.4)) * 0.045 * blend;
        nurseGroup.position.y = nurseBaseY + idleBob + waveBob;
        nurseGroup.rotation.y = nurseBaseRotY + Math.sin(elapsed * 1.7) * 0.09 * blend;
        nurseGroup.rotation.z = Math.sin(elapsed * 3.4) * 0.05 * blend;
      }

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    let baseWidthPx = 0;
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      if (!baseWidthPx) baseWidthPx = w;
      camera.aspect = w / h;
      // Widening the canvas re-centers the view (shifting doctor/nurse right). Use a lens-shift
      // (projection-only offset, no camera movement) so the original half is pixel-identical —
      // physically moving the camera instead causes parallax and makes static models look like
      // they're turning. This keeps the doctor/nurse from jumping when the canvas jumps to
      // full-screen for the drive-off (see the endX math in tick(), which accounts for this
      // same offset so the ambulance's exit point still matches the true edge of the screen).
      if (w > baseWidthPx) {
        camera.setViewOffset(w, h, (w - baseWidthPx) / 2, 0, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
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
  }, [activityRef, onDriveOffDone]);

  return (
    <div ref={mountRef} className={`hc-canvas-mount ${ready ? 'hc-canvas-ready' : ''} ${driving ? 'hc-canvas-driving' : ''}`}>
      <style>{`
        .hc-canvas-mount { position: absolute; inset: 0; opacity: 0; transition: opacity 0.9s ease; }
        .hc-canvas-mount canvas { display: block; width: 100% !important; height: 100% !important; }
        .hc-canvas-mount.hc-canvas-ready { opacity: 1; }
        .hc-canvas-mount.hc-canvas-driving { position: fixed; inset: 0; z-index: 16; transition: none; }
      `}</style>
    </div>
  );
}
