import * as THREE from 'three';

// ── Types ────────────────────────────────────────────────────────────

type EffectType =
  | 'explosion'
  | 'ice'
  | 'fire'
  | 'poison'
  | 'heal'
  | 'gold'
  | 'death'
  | 'electric'
  | 'place';

interface ParticleEffect {
  type: EffectType;
  position: THREE.Vector3;
  time: number;
  duration: number;
  points: THREE.Points;
  velocities: Float32Array;
  lifetimes: Float32Array;
  colors?: Float32Array;
}

// ── Effect presets ───────────────────────────────────────────────────

interface EffectPreset {
  count: number;
  duration: number;
  size: number;
  colors: number[];            // palette of hex colours to pick from
  initVelocity: (i: number, count: number, vel: Float32Array) => void;
  updateParticle?: (
    i: number,
    t: number,            // normalised time 0→1
    dt: number,
    positions: Float32Array,
    velocities: Float32Array,
    origin: THREE.Vector3,
  ) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function hexToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

// ── Presets ──────────────────────────────────────────────────────────

const PRESETS: Record<EffectType, EffectPreset> = {
  // 1. Cannon/Mortar hit — burst outward, fall with gravity
  explosion: {
    count: 30,
    duration: 0.8,
    size: 0.3,
    colors: [0xff6600, 0xff3300, 0xff9900, 0xcc2200],
    initVelocity(_i, _count, vel) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = randRange(3, 7);
      vel[0] = Math.sin(phi) * Math.cos(theta) * speed;
      vel[1] = Math.abs(Math.sin(phi) * Math.sin(theta)) * speed + 2;
      vel[2] = Math.cos(phi) * speed;
    },
    updateParticle(_i, _t, dt, pos, vel) {
      // gravity
      vel[1] -= 12 * dt;
    },
  },

  // 2. Ice — burst up slowly, drift down
  ice: {
    count: 15,
    duration: 1.0,
    size: 0.2,
    colors: [0xffffff, 0xaaddff, 0x88ccff, 0xccf0ff],
    initVelocity(_i, _count, vel) {
      const theta = Math.random() * Math.PI * 2;
      const speed = randRange(0.5, 2);
      vel[0] = Math.cos(theta) * speed * 0.5;
      vel[1] = randRange(1, 3);
      vel[2] = Math.sin(theta) * speed * 0.5;
    },
    updateParticle(_i, _t, dt, _pos, vel) {
      // slow deceleration + gentle gravity
      vel[0] *= 1 - 2 * dt;
      vel[1] -= 2 * dt;
      vel[2] *= 1 - 2 * dt;
    },
  },

  // 3. Fire — rise upward with flicker
  fire: {
    count: 20,
    duration: 0.6,
    size: 0.25,
    colors: [0xffff00, 0xffaa00, 0xff6600, 0xff3300],
    initVelocity(_i, _count, vel) {
      const theta = Math.random() * Math.PI * 2;
      const spread = randRange(0.3, 1.2);
      vel[0] = Math.cos(theta) * spread;
      vel[1] = randRange(3, 6);
      vel[2] = Math.sin(theta) * spread;
    },
    updateParticle(_i, _t, dt, _pos, vel) {
      // flicker: random horizontal jitter each frame
      vel[0] += (Math.random() - 0.5) * 8 * dt;
      vel[2] += (Math.random() - 0.5) * 8 * dt;
      // slow upward deceleration
      vel[1] *= 1 - 1.5 * dt;
    },
  },

  // 4. Poison — slow expanding cloud
  poison: {
    count: 20,
    duration: 1.5,
    size: 0.3,
    colors: [0x33cc33, 0x22aa22, 0x55ee55, 0x44bb22],
    initVelocity(_i, _count, vel) {
      const theta = Math.random() * Math.PI * 2;
      const speed = randRange(0.5, 1.5);
      vel[0] = Math.cos(theta) * speed;
      vel[1] = randRange(0.2, 0.8);
      vel[2] = Math.sin(theta) * speed;
    },
    updateParticle(_i, _t, dt, _pos, vel) {
      vel[0] *= 1 - 0.8 * dt;
      vel[1] *= 1 - 0.5 * dt;
      vel[2] *= 1 - 0.8 * dt;
    },
  },

  // 5. Heal — rise upward in spiral
  heal: {
    count: 12,
    duration: 1.0,
    size: 0.2,
    colors: [0x44ff66, 0x88ffaa, 0xffffff, 0x66ff88],
    initVelocity(i, count, vel) {
      const angle = (i / count) * Math.PI * 2;
      vel[0] = Math.cos(angle) * 1.5;
      vel[1] = randRange(2, 4);
      vel[2] = Math.sin(angle) * 1.5;
    },
    updateParticle(i, t, dt, pos, vel, origin) {
      // spiral: rotate horizontal velocity
      const rotSpeed = 4;
      const vx = vel[0];
      const vz = vel[2];
      const cos = Math.cos(rotSpeed * dt);
      const sin = Math.sin(rotSpeed * dt);
      vel[0] = vx * cos - vz * sin;
      vel[2] = vx * sin + vz * cos;
      // shrink radius over time
      const shrink = 1 - 0.5 * dt;
      vel[0] *= shrink;
      vel[2] *= shrink;
    },
  },

  // 6. Gold — fountain upward
  gold: {
    count: 8,
    duration: 0.8,
    size: 0.15,
    colors: [0xffdd00, 0xffcc00, 0xffee44, 0xeebb00],
    initVelocity(_i, _count, vel) {
      const theta = Math.random() * Math.PI * 2;
      const spread = randRange(0.2, 0.6);
      vel[0] = Math.cos(theta) * spread;
      vel[1] = randRange(4, 7);
      vel[2] = Math.sin(theta) * spread;
    },
    updateParticle(_i, _t, dt, _pos, vel) {
      vel[1] -= 9 * dt;
    },
  },

  // 7. Death — burst in all directions
  death: {
    count: 25,
    duration: 0.5,
    size: 0.2,
    colors: [0xff4444, 0xcc2222, 0xff6666, 0xaa0000],
    initVelocity(_i, _count, vel) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = randRange(2, 6);
      vel[0] = Math.sin(phi) * Math.cos(theta) * speed;
      vel[1] = Math.sin(phi) * Math.sin(theta) * speed;
      vel[2] = Math.cos(phi) * speed;
    },
    updateParticle(_i, _t, dt, _pos, vel) {
      // drag
      vel[0] *= 1 - 3 * dt;
      vel[1] -= 5 * dt;
      vel[2] *= 1 - 3 * dt;
    },
  },

  // 8. Electric — zigzag paths
  electric: {
    count: 10,
    duration: 0.4,
    size: 0.15,
    colors: [0xaa44ff, 0xcc88ff, 0xffffff, 0x8822ee],
    initVelocity(_i, _count, vel) {
      const theta = Math.random() * Math.PI * 2;
      const speed = randRange(3, 6);
      vel[0] = Math.cos(theta) * speed;
      vel[1] = randRange(1, 3);
      vel[2] = Math.sin(theta) * speed;
    },
    updateParticle(_i, _t, dt, _pos, vel) {
      // zigzag: random sharp direction changes
      vel[0] += (Math.random() - 0.5) * 30 * dt;
      vel[1] += (Math.random() - 0.5) * 20 * dt;
      vel[2] += (Math.random() - 0.5) * 30 * dt;
    },
  },

  // 9. Place — ring expanding outward from base
  place: {
    count: 15,
    duration: 0.5,
    size: 0.2,
    colors: [0xffffff, 0xffdd88, 0xffeeaa, 0xffcc66],
    initVelocity(i, count, vel) {
      const angle = (i / count) * Math.PI * 2;
      const speed = randRange(2, 4);
      vel[0] = Math.cos(angle) * speed;
      vel[1] = randRange(0.3, 1.0);
      vel[2] = Math.sin(angle) * speed;
    },
    updateParticle(_i, _t, dt, _pos, vel) {
      vel[0] *= 1 - 2 * dt;
      vel[1] -= 2 * dt;
      vel[2] *= 1 - 2 * dt;
    },
  },
};

// ── Shared material (one instance, reused for all effects) ──────────

let sharedMaterial: THREE.PointsMaterial | null = null;

function getSharedMaterial(): THREE.PointsMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
      size: 0.3,        // overridden per-effect via attribute
      blending: THREE.AdditiveBlending,
    });
  }
  return sharedMaterial;
}

// ── ParticleSystem ──────────────────────────────────────────────────

export class ParticleSystem {
  private scene: THREE.Scene;
  private effects: ParticleEffect[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Spawn a particle effect at the given position.
   * @param type   Effect type (explosion, ice, fire, etc.)
   * @param position  World position to emit from
   * @param color  Optional colour override (for 'death' – match enemy colour)
   */
  emit(type: EffectType, position: THREE.Vector3, color?: number): void {
    const preset = PRESETS[type];
    if (!preset) return;

    const count = preset.count;

    // Allocate typed arrays
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const velocities = new Float32Array(count * 3);
    const lifetimes = new Float32Array(count);

    // Build per-particle data
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Initial position: at origin with slight jitter
      positions[i3] = position.x + (Math.random() - 0.5) * 0.2;
      positions[i3 + 1] = position.y + (Math.random() - 0.5) * 0.2;
      positions[i3 + 2] = position.z + (Math.random() - 0.5) * 0.2;

      // Colour
      let rgb: [number, number, number];
      if (color !== undefined) {
        rgb = hexToRgb(color);
        // slight per-particle variation
        rgb[0] = Math.min(1, rgb[0] + (Math.random() - 0.5) * 0.15);
        rgb[1] = Math.min(1, rgb[1] + (Math.random() - 0.5) * 0.15);
        rgb[2] = Math.min(1, rgb[2] + (Math.random() - 0.5) * 0.15);
      } else {
        const palette = preset.colors;
        const hex = palette[Math.floor(Math.random() * palette.length)];
        rgb = hexToRgb(hex);
      }
      colors[i3] = rgb[0];
      colors[i3 + 1] = rgb[1];
      colors[i3 + 2] = rgb[2];

      // Size with slight variation
      sizes[i] = preset.size * randRange(0.7, 1.3);

      // Velocity via preset initializer (pass a 3-element sub-view)
      const velSlice = new Float32Array(velocities.buffer, i3 * 4, 3);
      preset.initVelocity(i, count, velSlice);

      // Lifetime = random fraction of total duration (stagger fade-out)
      lifetimes[i] = randRange(0.6, 1.0);
    }

    // Geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Material clone per effect so we can vary size & opacity independently
    const material = getSharedMaterial().clone();
    material.size = preset.size;

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false; // particles may drift off calculated bounds
    this.scene.add(points);

    this.effects.push({
      type,
      position: position.clone(),
      time: 0,
      duration: preset.duration,
      points,
      velocities,
      lifetimes,
      colors,
    });
  }

  /**
   * Update every active particle effect. Call once per frame.
   */
  update(dt: number): void {
    const finished: ParticleEffect[] = [];

    for (const effect of this.effects) {
      effect.time += dt;

      if (effect.time >= effect.duration) {
        finished.push(effect);
        continue;
      }

      const preset = PRESETS[effect.type];
      const count = preset.count;
      const t = effect.time / effect.duration; // normalised 0→1

      const posAttr = effect.points.geometry.getAttribute('position') as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const colorAttr = effect.points.geometry.getAttribute('color') as THREE.BufferAttribute;
      const colorsArr = colorAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Per-particle lifetime check (fade early)
        if (t > effect.lifetimes[i]) {
          // Make invisible by zeroing size is expensive; instead move far away
          // or just keep still — we fade the whole effect opacity anyway
          continue;
        }

        // Custom per-particle update from preset
        if (preset.updateParticle) {
          const velSlice = new Float32Array(effect.velocities.buffer, i3 * 4, 3);
          preset.updateParticle(i, t, dt, positions, velSlice, effect.position);
        }

        // Integrate velocity → position
        positions[i3] += effect.velocities[i3] * dt;
        positions[i3 + 1] += effect.velocities[i3 + 1] * dt;
        positions[i3 + 2] += effect.velocities[i3 + 2] * dt;

        // Fade colour toward black as lifetime expires
        const particleT = t / effect.lifetimes[i]; // 0→1 within this particle's life
        const fade = Math.max(0, 1 - particleT * particleT); // quadratic fade
        if (effect.colors) {
          colorsArr[i3] = effect.colors[i3] * fade;
          colorsArr[i3 + 1] = effect.colors[i3 + 1] * fade;
          colorsArr[i3 + 2] = effect.colors[i3 + 2] * fade;
        }
      }

      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      // Fade overall opacity over the last 30% of duration
      const mat = effect.points.material as THREE.PointsMaterial;
      if (t > 0.7) {
        mat.opacity = 1 - (t - 0.7) / 0.3;
      } else {
        mat.opacity = 1;
      }
    }

    // Remove finished effects
    for (const effect of finished) {
      this.removeEffect(effect);
    }
    this.effects = this.effects.filter(e => !finished.includes(e));
  }

  /**
   * Immediately remove all active effects.
   */
  clear(): void {
    for (const effect of this.effects) {
      this.removeEffect(effect);
    }
    this.effects.length = 0;
  }

  // ── Internal ─────────────────────────────────────────────────────

  private removeEffect(effect: ParticleEffect): void {
    this.scene.remove(effect.points);
    effect.points.geometry.dispose();
    (effect.points.material as THREE.PointsMaterial).dispose();
  }
}
