/**
 * SINGLE SOURCE OF TRUTH for the scroll-driven experience.
 *
 * The whole landing page derives from one number: `progress` (0 → 1), the
 * normalised travel of the pinned experience section through the viewport.
 *
 * `progress` is mapped onto a short list of named KEYFRAMES. Every visual
 * channel — camera dolly, camera aim, lens, the stethoscope's position /
 * rotation / scale, every light, fog, background, particles, the ECG signal —
 * is a value on those keyframes. `sampleTimeline(progress)` blends the two
 * surrounding keyframes with an eased local `t`, so transitions are continuous
 * (no section "starts" or "ends") and perfectly reversible.
 *
 * Nothing here is random. Each keyframe is a deliberate shot:
 *
 *   0.00  PRESENCE  wide, cold, the stethoscope small and far, off to the side
 *   0.20  APPROACH  camera dollies in, model swings toward centre, grows
 *   0.42  LISTEN    hard push-in on the chestpiece, world goes dark, pulse peaks
 *   0.55  SIGNAL    camera snaps back wide, particles stream, model travels left
 *   0.70  CONNECT   camera orbits to the far side of the model
 *   0.86  CONNECT²  orbit continues, light warms, motion settles
 *   1.00  CARE      calm, warm, model at rest beside the closing call to action
 */

export type SceneChannels = {
  camPos: [number, number, number];
  camTarget: [number, number, number];
  fov: number;
  /** stethoscope rig transform — the "cinematic" layer, before micro-motion */
  modelPos: [number, number, number];
  modelRot: [number, number, number];
  modelScale: number;
  /** renderer + lighting */
  exposure: number;
  hemi: number;
  key: number;
  fill: number;
  rim: number;
  keyColor: [number, number, number];
  rimColor: [number, number, number];
  /** atmosphere — rgb 0..1 for three, plus css hex for the page background */
  fog: [number, number, number];
  fogDensity: number;
  bgTop: [number, number, number];
  bgBottom: [number, number, number];
  /** effects driven by story position */
  particleOpacity: number;
  /** 0 = drifting ambient, 1 = streaming directional */
  particleDrift: number;
  /** 0 = flat, 1 = full bright ECG pulse */
  signal: number;
  /** css vignette strength 0..1 */
  vignette: number;
};

type Keyframe = { at: number; label: string; name: string } & SceneChannels;

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** The five story beats the scroll indicator and captions read from. */
export const SECTIONS = [
  { name: 'Presence', copy: ['Care that begins', 'before you speak.'] },
  { name: 'Listen', copy: ['Lean in.', 'Every heartbeat', 'is telling a story.'] },
  { name: 'Signal', copy: ['In all the noise,', 'we find the signal.'] },
  { name: 'Connect', copy: ['A pulse becomes a person.', 'A person becomes care.'] },
  { name: 'Care', copy: ['Care that shows up', 'on time, wherever you are.'] },
] as const;

/** progress → which of the 5 sections we are "in" (for captions + indicator). */
export function sectionAt(progress: number): number {
  if (progress < 0.16) return 0;
  if (progress < 0.4) return 1;
  if (progress < 0.62) return 2;
  if (progress < 0.84) return 3;
  return 4;
}

const KEYFRAMES: Keyframe[] = [
  {
    at: 0.0,
    label: '01',
    name: 'Presence',
    camPos: [0.0, 0.35, 12.0],
    camTarget: [1.5, 0.2, 0],
    fov: 34,
    modelPos: [3.3, -0.45, -3.2],
    modelRot: [0.16, -0.85, 0.3],
    modelScale: 0.55,
    exposure: 0.82,
    hemi: 0.32,
    key: 1.5,
    fill: 0.28,
    rim: 0.55,
    keyColor: hex('#dfeeff'),
    rimColor: hex('#49d6c2'),
    fog: hex('#08302e'),
    fogDensity: 0.058,
    bgTop: hex('#0e504c'),
    bgBottom: hex('#072e2c'),
    particleOpacity: 0.22,
    particleDrift: 0.08,
    signal: 0.0,
    vignette: 0.58,
  },
  {
    at: 0.2,
    label: '02',
    name: 'Approach',
    camPos: [-0.5, 0.12, 8.4],
    camTarget: [0.2, 0.0, 0],
    fov: 32,
    modelPos: [0.6, -0.1, -1.1],
    modelRot: [0.1, 0.42, 0.14],
    modelScale: 0.92,
    exposure: 0.95,
    hemi: 0.4,
    key: 2.4,
    fill: 0.4,
    rim: 0.8,
    keyColor: hex('#f2f8ff'),
    rimColor: hex('#45cfd6'),
    fog: hex('#093431'),
    fogDensity: 0.046,
    bgTop: hex('#0f544f'),
    bgBottom: hex('#08302f'),
    particleOpacity: 0.34,
    particleDrift: 0.16,
    signal: 0.16,
    vignette: 0.5,
  },
  {
    at: 0.42,
    label: '03',
    name: 'Listen',
    camPos: [0.08, -0.16, 3.35],
    camTarget: [0.0, -0.2, 0],
    fov: 20,
    modelPos: [0.0, -0.2, 0.0],
    modelRot: [0.05, 1.72, 0.05],
    modelScale: 1.16,
    exposure: 1.0,
    hemi: 0.28,
    key: 3.1,
    fill: 0.18,
    rim: 1.25,
    keyColor: hex('#ffffff'),
    rimColor: hex('#3fc6ff'),
    fog: hex('#041915'),
    fogDensity: 0.095,
    bgTop: hex('#06221f'),
    bgBottom: hex('#020f0d'),
    particleOpacity: 0.18,
    particleDrift: 0.22,
    signal: 1.0,
    vignette: 0.82,
  },
  {
    at: 0.55,
    label: '04',
    name: 'Signal',
    camPos: [-1.3, 0.62, 9.6],
    camTarget: [0.3, 0.1, 0],
    fov: 36,
    modelPos: [-1.7, 0.22, -2.3],
    modelRot: [0.2, 2.62, -0.17],
    modelScale: 0.95,
    exposure: 1.0,
    hemi: 0.44,
    key: 2.0,
    fill: 0.5,
    rim: 1.45,
    keyColor: hex('#eef7ff'),
    rimColor: hex('#3fc6ff'),
    fog: hex('#073236'),
    fogDensity: 0.04,
    bgTop: hex('#0c5054'),
    bgBottom: hex('#063236'),
    particleOpacity: 0.6,
    particleDrift: 1.0,
    signal: 0.55,
    vignette: 0.44,
  },
  {
    at: 0.7,
    label: '05',
    name: 'Connect',
    camPos: [2.3, 0.32, 7.0],
    camTarget: [0.0, 0.0, -0.3],
    fov: 33,
    modelPos: [0.2, 0.0, -1.0],
    modelRot: [0.05, 3.6, 0.1],
    modelScale: 1.05,
    exposure: 1.0,
    hemi: 0.5,
    key: 2.2,
    fill: 0.62,
    rim: 1.0,
    keyColor: hex('#fff3e6'),
    rimColor: hex('#54d8c0'),
    fog: hex('#0a3733'),
    fogDensity: 0.045,
    bgTop: hex('#10564e'),
    bgBottom: hex('#093430'),
    particleOpacity: 0.5,
    particleDrift: 0.5,
    signal: 0.4,
    vignette: 0.44,
  },
  {
    at: 0.86,
    label: '05',
    name: 'Connect',
    camPos: [0.4, 0.5, 8.0],
    camTarget: [0.0, 0.05, 0],
    fov: 32,
    modelPos: [0.0, 0.0, -0.6],
    modelRot: [0.05, 4.4, 0.06],
    modelScale: 1.05,
    exposure: 1.05,
    hemi: 0.55,
    key: 2.2,
    fill: 0.7,
    rim: 0.9,
    keyColor: hex('#ffefdc'),
    rimColor: hex('#5fd7bd'),
    fog: hex('#0b3631'),
    fogDensity: 0.042,
    bgTop: hex('#115349'),
    bgBottom: hex('#0b332c'),
    particleOpacity: 0.38,
    particleDrift: 0.24,
    signal: 0.3,
    vignette: 0.4,
  },
  {
    at: 1.0,
    label: '05',
    name: 'Care',
    camPos: [-0.6, 0.16, 8.8],
    camTarget: [0.1, 0.0, 0],
    fov: 31,
    modelPos: [-1.75, -0.16, -1.4],
    modelRot: [0.12, 5.0, 0.2],
    modelScale: 0.92,
    exposure: 1.1,
    hemi: 0.6,
    key: 2.0,
    fill: 0.8,
    rim: 0.8,
    keyColor: hex('#ffe9d2'),
    rimColor: hex('#ffce9e'),
    fog: hex('#0e3b31'),
    fogDensity: 0.05,
    bgTop: hex('#155a4b'),
    bgBottom: hex('#0d3a30'),
    particleOpacity: 0.3,
    particleDrift: 0.12,
    signal: 0.18,
    vignette: 0.42,
  },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** smootherstep — zero 1st & 2nd derivative at the ends, so keyframes glide */
const ease = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const _out: SceneChannels = {
  camPos: [0, 0, 0],
  camTarget: [0, 0, 0],
  fov: 30,
  modelPos: [0, 0, 0],
  modelRot: [0, 0, 0],
  modelScale: 1,
  exposure: 1,
  hemi: 0,
  key: 0,
  fill: 0,
  rim: 0,
  keyColor: [0, 0, 0],
  rimColor: [0, 0, 0],
  fog: [0, 0, 0],
  fogDensity: 0,
  bgTop: [0, 0, 0],
  bgBottom: [0, 0, 0],
  particleOpacity: 0,
  particleDrift: 0,
  signal: 0,
  vignette: 0,
};

/**
 * Blend the timeline at `progress` (0..1). Mutates and returns a shared object —
 * called every frame, so it never allocates.
 */
export function sampleTimeline(progress: number): SceneChannels {
  const p = Math.max(0, Math.min(1, progress));
  let i = 0;
  while (i < KEYFRAMES.length - 2 && p > KEYFRAMES[i + 1].at) i++;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const span = b.at - a.at || 1;
  const t = ease(Math.max(0, Math.min(1, (p - a.at) / span)));

  _out.camPos = lerp3(a.camPos, b.camPos, t);
  _out.camTarget = lerp3(a.camTarget, b.camTarget, t);
  _out.fov = lerp(a.fov, b.fov, t);
  _out.modelPos = lerp3(a.modelPos, b.modelPos, t);
  _out.modelRot = lerp3(a.modelRot, b.modelRot, t);
  _out.modelScale = lerp(a.modelScale, b.modelScale, t);
  _out.exposure = lerp(a.exposure, b.exposure, t);
  _out.hemi = lerp(a.hemi, b.hemi, t);
  _out.key = lerp(a.key, b.key, t);
  _out.fill = lerp(a.fill, b.fill, t);
  _out.rim = lerp(a.rim, b.rim, t);
  _out.keyColor = lerp3(a.keyColor, b.keyColor, t);
  _out.rimColor = lerp3(a.rimColor, b.rimColor, t);
  _out.fog = lerp3(a.fog, b.fog, t);
  _out.fogDensity = lerp(a.fogDensity, b.fogDensity, t);
  _out.bgTop = lerp3(a.bgTop, b.bgTop, t);
  _out.bgBottom = lerp3(a.bgBottom, b.bgBottom, t);
  _out.particleOpacity = lerp(a.particleOpacity, b.particleOpacity, t);
  _out.particleDrift = lerp(a.particleDrift, b.particleDrift, t);
  _out.signal = lerp(a.signal, b.signal, t);
  _out.vignette = lerp(a.vignette, b.vignette, t);
  return _out;
}

export const rgbCss = (c: [number, number, number]) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
