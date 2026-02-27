import * as THREE from 'three';

// ── Weather configuration per theme ─────────────────────────────────

interface WeatherLayer {
  /** Number of particles in this layer */
  count: number;
  /** Palette of hex colours to randomly pick from */
  colors: number[];
  /** Point size */
  size: number;
  /** Opacity (0-1) */
  opacity: number;
  /** Blending mode */
  blending: THREE.Blending;
  /** Initial position bounds: [minX, maxX, minY, maxY, minZ, maxZ] */
  bounds: [number, number, number, number, number, number];
  /** Per-particle velocity initializer */
  initVelocity: (i: number, vel: Float32Array) => void;
  /** Per-particle update (called every frame) */
  updateParticle: (
    i: number,
    dt: number,
    positions: Float32Array,
    velocities: Float32Array,
    bounds: [number, number, number, number, number, number],
    time: number,
  ) => void;
}

interface WeatherConfig {
  layers: WeatherLayer[];
  /** Optional: periodic lightning flash (interval in seconds, intensity 0-1) */
  lightning?: { interval: number; chance: number; intensity: number; color: number };
}

// ── Helpers ─────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

// Wrap a value into [min, max) range
function wrap(val: number, min: number, max: number): number {
  const range = max - min;
  while (val < min) val += range;
  while (val >= max) val -= range;
  return val;
}

// ── Map bounds (40x40 centered at origin, height 0-15) ──────────────
const MAP_HALF = 22; // slightly larger than 20 so particles don't pop at edges
const Y_MIN = 0;
const Y_MAX = 16;
const DEFAULT_BOUNDS: [number, number, number, number, number, number] = [
  -MAP_HALF, MAP_HALF, Y_MIN, Y_MAX, -MAP_HALF, MAP_HALF,
];

// ── Theme weather definitions ───────────────────────────────────────

function getWeatherConfig(themeName: string): WeatherConfig {
  switch (themeName) {
    // ─── Level 1: Friedhofswiese — Light fog wisps + floating leaves ───
    case 'Friedhofswiese':
      return {
        layers: [
          // Fog wisps: slow drifting translucent dots near ground
          {
            count: 200,
            colors: [0xccddee, 0xbbccdd, 0xaabbcc, 0xddeeff],
            size: 0.8,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.5, 4, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.3, 0.5);
              vel[1] = rand(-0.05, 0.1);
              vel[2] = rand(-0.2, 0.2);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Gentle sine wave drift
              vel[0] += Math.sin(time * 0.3 + i * 0.7) * 0.02 * dt;
              vel[2] += Math.cos(time * 0.4 + i * 0.5) * 0.02 * dt;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              // Wrap
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
          // Floating leaves: small colored particles drifting down slowly
          {
            count: 80,
            colors: [0x886633, 0xaa7722, 0x997744, 0x668822],
            size: 0.3,
            opacity: 0.6,
            blending: THREE.NormalBlending,
            bounds: DEFAULT_BOUNDS,
            initVelocity(_i, vel) {
              vel[0] = rand(-0.5, 0.5);
              vel[1] = rand(-0.8, -0.2);
              vel[2] = rand(-0.3, 0.3);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Flutter side to side
              vel[0] += Math.sin(time * 2 + i * 1.3) * 0.3 * dt;
              vel[2] += Math.cos(time * 1.5 + i * 0.9) * 0.3 * dt;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              // Respawn at top if fallen below ground
              if (pos[i3 + 1] < bounds[2]) {
                pos[i3 + 1] = bounds[3] - 0.5;
                pos[i3] = rand(bounds[0], bounds[1]);
                pos[i3 + 2] = rand(bounds[4], bounds[5]);
              }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };

    // ─── Level 2: Wuestencanyon — Sand particles + heat shimmer ───
    case 'Wuestencanyon':
      return {
        layers: [
          // Sand particles blowing across
          {
            count: 300,
            colors: [0xddbb77, 0xccaa66, 0xeedd99, 0xbbaa55],
            size: 0.2,
            opacity: 0.4,
            blending: THREE.NormalBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.2, 6, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(2, 5); // strong wind direction
              vel[1] = rand(-0.3, 0.3);
              vel[2] = rand(-0.5, 0.5);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Turbulence
              vel[1] += Math.sin(time * 3 + i) * 0.5 * dt;
              vel[2] += Math.cos(time * 2 + i * 0.3) * 0.3 * dt;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
          // Heat shimmer: very faint rising particles
          {
            count: 120,
            colors: [0xffeedd, 0xffddcc, 0xffccbb],
            size: 1.2,
            opacity: 0.06,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.5, 8, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.1, 0.1);
              vel[1] = rand(0.3, 0.8);
              vel[2] = rand(-0.1, 0.1);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Wavy rise
              vel[0] = Math.sin(time + i * 0.5) * 0.3;
              vel[2] = Math.cos(time * 0.7 + i * 0.3) * 0.3;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              if (pos[i3 + 1] > bounds[3]) {
                pos[i3 + 1] = bounds[2];
                pos[i3] = rand(bounds[0], bounds[1]);
                pos[i3 + 2] = rand(bounds[4], bounds[5]);
              }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };

    // ─── Level 3: Sumpfland — Dense fog + fireflies ───
    case 'Sumpfland':
      return {
        layers: [
          // Dense low fog
          {
            count: 300,
            colors: [0x556655, 0x445544, 0x667766, 0x334433],
            size: 1.5,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.2, 3.5, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.2, 0.2);
              vel[1] = rand(-0.05, 0.05);
              vel[2] = rand(-0.2, 0.2);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              vel[0] += Math.sin(time * 0.2 + i * 0.4) * 0.015 * dt;
              vel[2] += Math.cos(time * 0.25 + i * 0.3) * 0.015 * dt;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
          // Fireflies: glowing dots that wander
          {
            count: 60,
            colors: [0xccff44, 0xbbee33, 0xddff66, 0xaadd22],
            size: 0.25,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 1, 6, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.5, 0.5);
              vel[1] = rand(-0.3, 0.3);
              vel[2] = rand(-0.5, 0.5);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Erratic wandering
              vel[0] += (Math.random() - 0.5) * 2 * dt;
              vel[1] += (Math.random() - 0.5) * 1.5 * dt;
              vel[2] += (Math.random() - 0.5) * 2 * dt;
              // Dampen to keep them from flying away
              vel[0] *= 0.98;
              vel[1] *= 0.98;
              vel[2] *= 0.98;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              // Soft bounds (bounce gently)
              if (pos[i3 + 1] < bounds[2]) { pos[i3 + 1] = bounds[2]; vel[1] = Math.abs(vel[1]) * 0.5; }
              if (pos[i3 + 1] > bounds[3]) { pos[i3 + 1] = bounds[3]; vel[1] = -Math.abs(vel[1]) * 0.5; }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };

    // ─── Level 4: Hölle — Falling embers/ash + rising heat ───
    case 'Hölle':
      return {
        layers: [
          // Falling embers and ash
          {
            count: 250,
            colors: [0xff6600, 0xff4400, 0xff8800, 0xffaa00, 0xcc3300],
            size: 0.2,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.5, Y_MAX, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.5, 0.5);
              vel[1] = rand(-2.5, -0.5);
              vel[2] = rand(-0.5, 0.5);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Flicker drift
              vel[0] += Math.sin(time * 3 + i * 2) * 0.5 * dt;
              vel[2] += Math.cos(time * 2.5 + i * 1.5) * 0.5 * dt;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              // Respawn at top
              if (pos[i3 + 1] < bounds[2]) {
                pos[i3 + 1] = bounds[3];
                pos[i3] = rand(bounds[0], bounds[1]);
                pos[i3 + 2] = rand(bounds[4], bounds[5]);
              }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
          // Rising heat particles
          {
            count: 150,
            colors: [0xff2200, 0xff0000, 0xcc0000, 0xff4400],
            size: 0.5,
            opacity: 0.08,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.2, Y_MAX, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.1, 0.1);
              vel[1] = rand(0.5, 1.5);
              vel[2] = rand(-0.1, 0.1);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              vel[0] = Math.sin(time * 0.5 + i) * 0.2;
              vel[2] = Math.cos(time * 0.4 + i * 0.7) * 0.2;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              if (pos[i3 + 1] > bounds[3]) {
                pos[i3 + 1] = bounds[2];
                pos[i3] = rand(bounds[0], bounds[1]);
                pos[i3 + 2] = rand(bounds[4], bounds[5]);
              }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };

    // ─── Level 5: Vulkan-Arena — Purple energy particles + dark mist ───
    case 'Vulkan-Arena':
      return {
        layers: [
          // Purple energy particles floating upward
          {
            count: 200,
            colors: [0xaa44ff, 0xcc66ff, 0x8822ee, 0xdd88ff, 0x6600cc],
            size: 0.25,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.5, Y_MAX, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.3, 0.3);
              vel[1] = rand(0.3, 1.2);
              vel[2] = rand(-0.3, 0.3);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Spiral motion
              const angle = time * 1.5 + i * 0.5;
              vel[0] += Math.sin(angle) * 0.3 * dt;
              vel[2] += Math.cos(angle) * 0.3 * dt;
              // Dampen horizontal
              vel[0] *= 0.995;
              vel[2] *= 0.995;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              if (pos[i3 + 1] > bounds[3]) {
                pos[i3 + 1] = bounds[2];
                pos[i3] = rand(bounds[0], bounds[1]);
                pos[i3 + 2] = rand(bounds[4], bounds[5]);
              }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
          // Dark mist near ground
          {
            count: 180,
            colors: [0x110022, 0x220033, 0x1a0030, 0x0a0015],
            size: 1.8,
            opacity: 0.18,
            blending: THREE.NormalBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.1, 3, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.15, 0.15);
              vel[1] = rand(-0.02, 0.02);
              vel[2] = rand(-0.15, 0.15);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              vel[0] += Math.sin(time * 0.15 + i * 0.3) * 0.01 * dt;
              vel[2] += Math.cos(time * 0.2 + i * 0.2) * 0.01 * dt;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };

    // ─── Level 6: Endzeit — Falling dark particles + lightning flashes ───
    case 'Endzeit':
      return {
        layers: [
          // Falling dark ash/particles
          {
            count: 250,
            colors: [0x222233, 0x333344, 0x111122, 0x2a2a3a],
            size: 0.25,
            opacity: 0.5,
            blending: THREE.NormalBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.5, Y_MAX, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.5, 0.5);
              vel[1] = rand(-1.5, -0.3);
              vel[2] = rand(-0.5, 0.5);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              vel[0] += Math.sin(time + i) * 0.2 * dt;
              vel[2] += Math.cos(time * 0.8 + i * 0.4) * 0.2 * dt;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              if (pos[i3 + 1] < bounds[2]) {
                pos[i3 + 1] = bounds[3];
                pos[i3] = rand(bounds[0], bounds[1]);
                pos[i3 + 2] = rand(bounds[4], bounds[5]);
              }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
          // Faint purple ambient particles
          {
            count: 100,
            colors: [0x6644aa, 0x5533bb, 0x7755cc],
            size: 0.15,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            bounds: DEFAULT_BOUNDS,
            initVelocity(_i, vel) {
              vel[0] = rand(-0.3, 0.3);
              vel[1] = rand(-0.2, 0.2);
              vel[2] = rand(-0.3, 0.3);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              vel[0] += (Math.random() - 0.5) * 0.5 * dt;
              vel[1] += (Math.random() - 0.5) * 0.3 * dt;
              vel[2] += (Math.random() - 0.5) * 0.5 * dt;
              vel[0] *= 0.99;
              vel[1] *= 0.99;
              vel[2] *= 0.99;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
        // Lightning flashes
        lightning: {
          interval: 6,
          chance: 0.3,
          intensity: 0.7,
          color: 0xaa66ff,
        },
      };

    // ─── Level 7: Endboss-Dimension — Red energy + void rifts ───
    case 'Endboss-Dimension':
      return {
        layers: [
          // Red energy particles rising and swirling
          {
            count: 300,
            colors: [0xff0044, 0xff0066, 0xcc0033, 0xff2288, 0xee0055],
            size: 0.2,
            opacity: 0.65,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 0.3, Y_MAX, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.5, 0.5);
              vel[1] = rand(0.2, 1.5);
              vel[2] = rand(-0.5, 0.5);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Chaotic swirl
              const angle = time * 2 + i * 0.8;
              vel[0] += Math.sin(angle) * 0.6 * dt;
              vel[2] += Math.cos(angle) * 0.6 * dt;
              vel[0] *= 0.99;
              vel[2] *= 0.99;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              if (pos[i3 + 1] > bounds[3]) {
                pos[i3 + 1] = bounds[2];
                pos[i3] = rand(bounds[0], bounds[1]);
                pos[i3 + 2] = rand(bounds[4], bounds[5]);
              }
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
          // Void rift particles: dark purple, slow-moving large dots
          {
            count: 80,
            colors: [0x220044, 0x110033, 0x330055, 0x0a0020],
            size: 2.0,
            opacity: 0.2,
            blending: THREE.NormalBlending,
            bounds: [-MAP_HALF, MAP_HALF, 1, 10, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.1, 0.1);
              vel[1] = rand(-0.05, 0.05);
              vel[2] = rand(-0.1, 0.1);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Slow pulsing drift
              vel[0] = Math.sin(time * 0.3 + i * 1.2) * 0.15;
              vel[1] = Math.cos(time * 0.2 + i * 0.8) * 0.05;
              vel[2] = Math.cos(time * 0.35 + i * 1.0) * 0.15;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };

    // ─── Kampfarena — Blue energy motes ───
    case 'Kampfarena':
      return {
        layers: [
          {
            count: 150,
            colors: [0x4466ff, 0x6688ff, 0x88aaff, 0x3355ee, 0x5577ff],
            size: 0.2,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            bounds: [-MAP_HALF, MAP_HALF, 1, 12, -MAP_HALF, MAP_HALF],
            initVelocity(_i, vel) {
              vel[0] = rand(-0.3, 0.3);
              vel[1] = rand(-0.2, 0.4);
              vel[2] = rand(-0.3, 0.3);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              // Gentle floating with random drift
              vel[0] += (Math.random() - 0.5) * 0.8 * dt;
              vel[1] += (Math.random() - 0.5) * 0.5 * dt;
              vel[2] += (Math.random() - 0.5) * 0.8 * dt;
              vel[0] *= 0.98;
              vel[1] *= 0.98;
              vel[2] *= 0.98;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };

    // ─── Default: Light dust motes ───
    default:
      return {
        layers: [
          {
            count: 100,
            colors: [0xddddcc, 0xccccbb, 0xeeeeDD, 0xbbbbaa],
            size: 0.15,
            opacity: 0.3,
            blending: THREE.NormalBlending,
            bounds: DEFAULT_BOUNDS,
            initVelocity(_i, vel) {
              vel[0] = rand(-0.2, 0.2);
              vel[1] = rand(-0.1, 0.1);
              vel[2] = rand(-0.2, 0.2);
            },
            updateParticle(i, dt, pos, vel, bounds, time) {
              const i3 = i * 3;
              vel[0] += (Math.random() - 0.5) * 0.3 * dt;
              vel[1] += (Math.random() - 0.5) * 0.2 * dt;
              vel[2] += (Math.random() - 0.5) * 0.3 * dt;
              vel[0] *= 0.99;
              vel[1] *= 0.99;
              vel[2] *= 0.99;
              pos[i3] += vel[0] * dt;
              pos[i3 + 1] += vel[1] * dt;
              pos[i3 + 2] += vel[2] * dt;
              pos[i3] = wrap(pos[i3], bounds[0], bounds[1]);
              pos[i3 + 1] = wrap(pos[i3 + 1], bounds[2], bounds[3]);
              pos[i3 + 2] = wrap(pos[i3 + 2], bounds[4], bounds[5]);
            },
          },
        ],
      };
  }
}

// ── Active weather layer (runtime data) ─────────────────────────────

interface ActiveLayer {
  config: WeatherLayer;
  points: THREE.Points;
  velocities: Float32Array;
}

// ── WeatherSystem ───────────────────────────────────────────────────

export class WeatherSystem {
  private scene: THREE.Scene;
  private layers: ActiveLayer[] = [];
  private time = 0;
  private lightningConfig: WeatherConfig['lightning'] | undefined;
  private lightningTimer = 0;
  private flashLight: THREE.PointLight | null = null;
  private flashDuration = 0;

  constructor(scene: THREE.Scene, themeName: string) {
    this.scene = scene;
    const config = getWeatherConfig(themeName);
    this.lightningConfig = config.lightning;

    // Build each particle layer
    for (const layerCfg of config.layers) {
      this.createLayer(layerCfg);
    }

    // Set up lightning flash light (hidden by default)
    if (this.lightningConfig) {
      this.lightningTimer = this.lightningConfig.interval;
      this.flashLight = new THREE.PointLight(
        this.lightningConfig.color,
        0,
        100,
      );
      this.flashLight.position.set(0, 20, 0);
      this.scene.add(this.flashLight);
    }
  }

  private createLayer(cfg: WeatherLayer): void {
    const count = cfg.count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Random starting position within bounds
      positions[i3] = rand(cfg.bounds[0], cfg.bounds[1]);
      positions[i3 + 1] = rand(cfg.bounds[2], cfg.bounds[3]);
      positions[i3 + 2] = rand(cfg.bounds[4], cfg.bounds[5]);

      // Random color from palette
      const hex = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
      const rgb = hexToRgb(hex);
      colors[i3] = rgb[0];
      colors[i3 + 1] = rgb[1];
      colors[i3 + 2] = rgb[2];

      // Initialize velocity
      const velSlice = new Float32Array(velocities.buffer, i3 * 4, 3);
      cfg.initVelocity(i, velSlice);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
      size: cfg.size,
      opacity: cfg.opacity,
      blending: cfg.blending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);

    this.layers.push({ config: cfg, points, velocities });
  }

  update(dt: number): void {
    this.time += dt;

    // Update each particle layer
    for (const layer of this.layers) {
      const posAttr = layer.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const count = layer.config.count;

      for (let i = 0; i < count; i++) {
        layer.config.updateParticle(
          i, dt, positions, layer.velocities,
          layer.config.bounds, this.time,
        );
      }

      posAttr.needsUpdate = true;
    }

    // Lightning flash handling
    if (this.lightningConfig && this.flashLight) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = this.lightningConfig.interval;
        if (Math.random() < this.lightningConfig.chance) {
          // Trigger flash
          this.flashLight.intensity = this.lightningConfig.intensity * 5;
          this.flashLight.position.set(
            rand(-MAP_HALF, MAP_HALF),
            18,
            rand(-MAP_HALF, MAP_HALF),
          );
          this.flashDuration = 0.15;
        }
      }

      // Fade out flash
      if (this.flashDuration > 0) {
        this.flashDuration -= dt;
        if (this.flashDuration <= 0) {
          this.flashLight.intensity = 0;
        } else {
          // Quick decay
          this.flashLight.intensity *= 0.85;
        }
      }
    }
  }

  cleanup(): void {
    for (const layer of this.layers) {
      this.scene.remove(layer.points);
      layer.points.geometry.dispose();
      (layer.points.material as THREE.PointsMaterial).dispose();
    }
    this.layers.length = 0;

    if (this.flashLight) {
      this.scene.remove(this.flashLight);
      this.flashLight.dispose();
      this.flashLight = null;
    }
  }
}
