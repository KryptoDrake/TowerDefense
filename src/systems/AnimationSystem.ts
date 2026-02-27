import * as THREE from 'three';

// ── Easing Functions ──────────────────────────────────────────────────────

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const p = 0.3;
  const s = p / 4;
  return Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
}

export function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t;
  } else if (t < 2 / 2.75) {
    const t2 = t - 1.5 / 2.75;
    return 7.5625 * t2 * t2 + 0.75;
  } else if (t < 2.5 / 2.75) {
    const t2 = t - 2.25 / 2.75;
    return 7.5625 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / 2.75;
    return 7.5625 * t2 * t2 + 0.984375;
  }
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ── Animation Config ──────────────────────────────────────────────────────

export type AnimationType =
  | 'towerPlace'
  | 'towerUpgrade'
  | 'towerSell'
  | 'enemyDeath'
  | 'enemySpawn'
  | 'waveStart'
  | 'damageFlash';

interface AnimationEntry {
  target: THREE.Object3D;
  type: AnimationType;
  duration: number;
  elapsed: number;
  onComplete?: () => void;
  data: Record<string, unknown>;
}

// ── Helpers to collect and restore material state ─────────────────────────

interface MaterialSnapshot {
  material: THREE.Material;
  originalColor?: THREE.Color;
  originalEmissive?: THREE.Color;
  originalOpacity: number;
  originalTransparent: boolean;
}

function collectMaterials(root: THREE.Object3D): MaterialSnapshot[] {
  const snapshots: MaterialSnapshot[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material;
      if (mat && !Array.isArray(mat)) {
        const m = mat as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
        const snap: MaterialSnapshot = {
          material: m,
          originalOpacity: m.opacity,
          originalTransparent: m.transparent,
        };
        if ('color' in m && m.color) {
          snap.originalColor = m.color.clone();
        }
        if ('emissive' in m && (m as THREE.MeshStandardMaterial).emissive) {
          snap.originalEmissive = (m as THREE.MeshStandardMaterial).emissive.clone();
        }
        snapshots.push(snap);
      }
    }
  });
  return snapshots;
}

function restoreMaterials(snapshots: MaterialSnapshot[]): void {
  for (const snap of snapshots) {
    const m = snap.material as THREE.MeshStandardMaterial & THREE.MeshLambertMaterial;
    if (snap.originalColor && 'color' in m) {
      m.color.copy(snap.originalColor);
    }
    if (snap.originalEmissive && 'emissive' in m) {
      m.emissive.copy(snap.originalEmissive);
    }
    m.opacity = snap.originalOpacity;
    m.transparent = snap.originalTransparent;
  }
}

// ── AnimationSystem ───────────────────────────────────────────────────────

export class AnimationSystem {
  private animations: AnimationEntry[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Start an animation on a target Object3D.
   * Multiple animations of different types can run on the same target.
   */
  animate(
    target: THREE.Object3D,
    type: AnimationType,
    onComplete?: () => void,
  ): void {
    // Cancel any existing animation of the same type on this target
    for (let i = this.animations.length - 1; i >= 0; i--) {
      if (this.animations[i].target === target && this.animations[i].type === type) {
        this.animations.splice(i, 1);
      }
    }

    const durations: Record<AnimationType, number> = {
      towerPlace: 0.6,
      towerUpgrade: 0.5,
      towerSell: 0.3,
      enemyDeath: 0.4,
      enemySpawn: 0.3,
      waveStart: 0.5,
      damageFlash: 0.1,
    };

    const entry: AnimationEntry = {
      target,
      type,
      duration: durations[type],
      elapsed: 0,
      onComplete,
      data: {},
    };

    // Per-type initialization
    this.initAnimation(entry);
    this.animations.push(entry);
  }

  /**
   * Update all running animations. Call each frame with delta time in seconds.
   */
  update(dt: number): void {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i];
      anim.elapsed += dt;
      const t = Math.min(anim.elapsed / anim.duration, 1);

      this.updateAnimation(anim, t);

      if (t >= 1) {
        this.finalizeAnimation(anim);
        const cb = anim.onComplete;
        this.animations.splice(i, 1);
        if (cb) cb();
      }
    }
  }

  /** Cancel all animations on a specific target. */
  cancel(target: THREE.Object3D): void {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      if (this.animations[i].target === target) {
        this.finalizeAnimation(this.animations[i]);
        this.animations.splice(i, 1);
      }
    }
  }

  /** Clear every running animation. */
  clear(): void {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      this.finalizeAnimation(this.animations[i]);
    }
    this.animations.length = 0;
  }

  /** Returns how many animations are currently active. */
  get activeCount(): number {
    return this.animations.length;
  }

  // ── Per-type initialization ───────────────────────────────────────────

  private initAnimation(anim: AnimationEntry): void {
    switch (anim.type) {
      case 'towerPlace':
        this.initTowerPlace(anim);
        break;
      case 'towerUpgrade':
        this.initTowerUpgrade(anim);
        break;
      case 'towerSell':
        this.initTowerSell(anim);
        break;
      case 'enemyDeath':
        this.initEnemyDeath(anim);
        break;
      case 'enemySpawn':
        this.initEnemySpawn(anim);
        break;
      case 'waveStart':
        this.initWaveStart(anim);
        break;
      case 'damageFlash':
        this.initDamageFlash(anim);
        break;
    }
  }

  // ── Per-type update ───────────────────────────────────────────────────

  private updateAnimation(anim: AnimationEntry, t: number): void {
    switch (anim.type) {
      case 'towerPlace':
        this.updateTowerPlace(anim, t);
        break;
      case 'towerUpgrade':
        this.updateTowerUpgrade(anim, t);
        break;
      case 'towerSell':
        this.updateTowerSell(anim, t);
        break;
      case 'enemyDeath':
        this.updateEnemyDeath(anim, t);
        break;
      case 'enemySpawn':
        this.updateEnemySpawn(anim, t);
        break;
      case 'waveStart':
        this.updateWaveStart(anim, t);
        break;
      case 'damageFlash':
        this.updateDamageFlash(anim, t);
        break;
    }
  }

  // ── Per-type finalization (restore state, remove temp objects) ─────────

  private finalizeAnimation(anim: AnimationEntry): void {
    switch (anim.type) {
      case 'towerPlace':
        this.finalizeTowerPlace(anim);
        break;
      case 'towerUpgrade':
        this.finalizeTowerUpgrade(anim);
        break;
      case 'towerSell':
        // No restore needed; target is removed
        break;
      case 'enemyDeath':
        // No restore needed; enemy is removed after death
        break;
      case 'enemySpawn':
        this.finalizeEnemySpawn(anim);
        break;
      case 'waveStart':
        this.finalizeWaveStart(anim);
        break;
      case 'damageFlash':
        this.finalizeDamageFlash(anim);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TOWER PLACE
  //  Scale 0 -> 1.0 elastic bounce (overshoot 1.2), 360deg spin, ground ring
  // ═══════════════════════════════════════════════════════════════════════

  private initTowerPlace(anim: AnimationEntry): void {
    anim.target.scale.setScalar(0.01);
    anim.data['origRotY'] = anim.target.rotation.y;

    // Create expanding ground ring
    const ringGeo = new THREE.RingGeometry(0.2, 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44ffaa,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(anim.target.position.x, 0.05, anim.target.position.z);
    ring.name = '__anim_place_ring';
    this.scene.add(ring);
    anim.data['ring'] = ring;
  }

  private updateTowerPlace(anim: AnimationEntry, t: number): void {
    // Elastic scale: overshoot to ~1.2 then settle to 1.0
    const easedScale = easeOutElastic(t);
    // During overshoot phase, blend towards 1.2 peak
    const overshoot = t < 0.4 ? Math.sin(t / 0.4 * Math.PI) * 0.2 : 0;
    const scale = Math.max(0.01, easedScale + overshoot);
    anim.target.scale.setScalar(scale);

    // Spin 360 degrees
    const origRotY = anim.data['origRotY'] as number;
    anim.target.rotation.y = origRotY + easeOutCubic(t) * Math.PI * 2;

    // Expand and fade the ground ring
    const ring = anim.data['ring'] as THREE.Mesh | undefined;
    if (ring) {
      const ringScale = 1 + easeOutQuad(t) * 2.5;
      ring.scale.setScalar(ringScale);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - easeOutQuad(t));
    }
  }

  private finalizeTowerPlace(anim: AnimationEntry): void {
    anim.target.scale.setScalar(1.0);
    const origRotY = anim.data['origRotY'] as number | undefined;
    if (origRotY !== undefined) {
      anim.target.rotation.y = origRotY;
    }

    // Remove ground ring
    const ring = anim.data['ring'] as THREE.Mesh | undefined;
    if (ring) {
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TOWER UPGRADE
  //  Flash emissive white, scale pulse 1.0 -> 1.3 -> 1.0, rising sparkles
  // ═══════════════════════════════════════════════════════════════════════

  private initTowerUpgrade(anim: AnimationEntry): void {
    anim.data['origScale'] = anim.target.scale.x;
    anim.data['materials'] = collectMaterials(anim.target);

    // Create sparkle particles (small cubes that rise upward)
    const sparkles: THREE.Mesh[] = [];
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 1,
    });
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const sparkle = new THREE.Mesh(geo, sparkleMat.clone());
      sparkle.position.set(
        (Math.random() - 0.5) * 1.2,
        0.5 + Math.random() * 0.5,
        (Math.random() - 0.5) * 1.2,
      );
      sparkle.name = '__anim_sparkle';
      anim.target.add(sparkle);
      sparkles.push(sparkle);
    }
    anim.data['sparkles'] = sparkles;
  }

  private updateTowerUpgrade(anim: AnimationEntry, t: number): void {
    const origScale = anim.data['origScale'] as number;

    // Scale pulse: 1.0 -> 1.3 at t=0.3, then back to 1.0
    let scaleMult: number;
    if (t < 0.3) {
      scaleMult = 1 + 0.3 * easeOutCubic(t / 0.3);
    } else {
      scaleMult = 1.3 - 0.3 * easeOutCubic((t - 0.3) / 0.7);
    }
    anim.target.scale.setScalar(origScale * scaleMult);

    // Flash emissive white during first half
    const flashIntensity = t < 0.3 ? 1 - t / 0.3 : 0;
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    for (const snap of snapshots) {
      const m = snap.material as THREE.MeshStandardMaterial & THREE.MeshLambertMaterial;
      if ('emissive' in m) {
        const origEmissive = snap.originalEmissive ?? new THREE.Color(0x000000);
        m.emissive.copy(origEmissive).lerp(new THREE.Color(0xffffff), flashIntensity);
      }
    }

    // Rising sparkles
    const sparkles = anim.data['sparkles'] as THREE.Mesh[];
    for (const sparkle of sparkles) {
      sparkle.position.y += 3.0 * (1 / 60); // approximate rise per frame at 60fps
      const sMat = sparkle.material as THREE.MeshBasicMaterial;
      sMat.opacity = 1 - easeInCubic(t);
    }
  }

  private finalizeTowerUpgrade(anim: AnimationEntry): void {
    // Restore scale
    const origScale = anim.data['origScale'] as number;
    anim.target.scale.setScalar(origScale);

    // Restore materials
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    restoreMaterials(snapshots);

    // Remove sparkles
    const sparkles = anim.data['sparkles'] as THREE.Mesh[];
    for (const sparkle of sparkles) {
      anim.target.remove(sparkle);
      sparkle.geometry.dispose();
      (sparkle.material as THREE.Material).dispose();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  TOWER SELL
  //  Scale down 1.0 -> 0 with ease-in, spin faster, fade opacity
  // ═══════════════════════════════════════════════════════════════════════

  private initTowerSell(anim: AnimationEntry): void {
    anim.data['origScale'] = anim.target.scale.x;
    anim.data['origRotY'] = anim.target.rotation.y;
    anim.data['materials'] = collectMaterials(anim.target);

    // Enable transparency on all child materials
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    for (const snap of snapshots) {
      (snap.material as THREE.Material).transparent = true;
    }
  }

  private updateTowerSell(anim: AnimationEntry, t: number): void {
    const origScale = anim.data['origScale'] as number;
    const origRotY = anim.data['origRotY'] as number;

    // Scale shrinks with ease-in (slow start, fast end)
    const scale = origScale * (1 - easeInCubic(t));
    anim.target.scale.setScalar(Math.max(0.01, scale));

    // Spin accelerating
    const spinAmount = easeInCubic(t) * Math.PI * 4;
    anim.target.rotation.y = origRotY + spinAmount;

    // Fade opacity
    const opacity = 1 - easeInCubic(t);
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    for (const snap of snapshots) {
      (snap.material as THREE.Material).opacity = opacity;
    }
  }

  // No finalize needed for sell; the target will be removed from the scene externally.

  // ═══════════════════════════════════════════════════════════════════════
  //  ENEMY DEATH
  //  Squash Y, expand XZ, rotate to fall, fade opacity
  // ═══════════════════════════════════════════════════════════════════════

  private initEnemyDeath(anim: AnimationEntry): void {
    anim.data['origScaleX'] = anim.target.scale.x;
    anim.data['origScaleY'] = anim.target.scale.y;
    anim.data['origScaleZ'] = anim.target.scale.z;
    anim.data['origRotZ'] = anim.target.rotation.z;
    anim.data['materials'] = collectMaterials(anim.target);

    // Enable transparency on all child materials
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    for (const snap of snapshots) {
      (snap.material as THREE.Material).transparent = true;
    }
  }

  private updateEnemyDeath(anim: AnimationEntry, t: number): void {
    const origSX = anim.data['origScaleX'] as number;
    const origSY = anim.data['origScaleY'] as number;
    const origSZ = anim.data['origScaleZ'] as number;
    const origRotZ = anim.data['origRotZ'] as number;
    const eased = easeOutCubic(t);

    // Squash Y: 1.0 -> 0.1
    anim.target.scale.y = origSY * (1 - eased * 0.9);

    // Expand XZ: 1.0 -> 1.5
    anim.target.scale.x = origSX * (1 + eased * 0.5);
    anim.target.scale.z = origSZ * (1 + eased * 0.5);

    // Rotate to fall over
    anim.target.rotation.z = origRotZ + eased * (Math.PI / 2);

    // Fade opacity
    const opacity = 1 - easeInCubic(t);
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    for (const snap of snapshots) {
      (snap.material as THREE.Material).opacity = opacity;
    }
  }

  // No finalize needed for enemy death; the mesh is removed from scene externally.

  // ═══════════════════════════════════════════════════════════════════════
  //  ENEMY SPAWN
  //  Rise from y-1, scale from 0.3 -> 1.0
  // ═══════════════════════════════════════════════════════════════════════

  private initEnemySpawn(anim: AnimationEntry): void {
    anim.data['targetY'] = anim.target.position.y;
    anim.data['origScale'] = anim.target.scale.x;
    anim.target.position.y -= 1;
    anim.target.scale.setScalar(0.3);
  }

  private updateEnemySpawn(anim: AnimationEntry, t: number): void {
    const targetY = anim.data['targetY'] as number;
    const origScale = anim.data['origScale'] as number;
    const eased = easeOutCubic(t);

    anim.target.position.y = (targetY - 1) + eased * 1;
    const scale = 0.3 + eased * (origScale - 0.3);
    anim.target.scale.setScalar(scale);
  }

  private finalizeEnemySpawn(anim: AnimationEntry): void {
    const targetY = anim.data['targetY'] as number;
    const origScale = anim.data['origScale'] as number;
    anim.target.position.y = targetY;
    anim.target.scale.setScalar(origScale);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  WAVE START
  //  Screen-edge red flash via HTML overlay div
  // ═══════════════════════════════════════════════════════════════════════

  private initWaveStart(anim: AnimationEntry): void {
    // Create a fullscreen HTML overlay for the red flash
    const overlay = document.createElement('div');
    overlay.id = '__anim_wave_flash';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 9999;
      box-shadow: inset 0 0 120px 40px rgba(255, 30, 30, 0.7);
      opacity: 1;
      transition: none;
    `;
    document.body.appendChild(overlay);
    anim.data['overlay'] = overlay;
  }

  private updateWaveStart(anim: AnimationEntry, t: number): void {
    const overlay = anim.data['overlay'] as HTMLDivElement | undefined;
    if (overlay) {
      // Fade out the red vignette
      const opacity = 1 - easeOutCubic(t);
      overlay.style.opacity = String(opacity);
    }
  }

  private finalizeWaveStart(anim: AnimationEntry): void {
    const overlay = anim.data['overlay'] as HTMLDivElement | undefined;
    if (overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DAMAGE FLASH
  //  Briefly tint mesh red, restore after 0.1s
  // ═══════════════════════════════════════════════════════════════════════

  private initDamageFlash(anim: AnimationEntry): void {
    anim.data['materials'] = collectMaterials(anim.target);
  }

  private updateDamageFlash(anim: AnimationEntry, t: number): void {
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    // Flash red then restore: intensity peaks at t=0 and drops to 0 at t=1
    const flashIntensity = 1 - t;

    for (const snap of snapshots) {
      const m = snap.material as THREE.MeshStandardMaterial & THREE.MeshLambertMaterial & THREE.MeshBasicMaterial;
      if (snap.originalColor && 'color' in m) {
        m.color.copy(snap.originalColor).lerp(new THREE.Color(0xff0000), flashIntensity * 0.7);
      }
      if ('emissive' in m) {
        const origEmissive = snap.originalEmissive ?? new THREE.Color(0x000000);
        m.emissive.copy(origEmissive).lerp(new THREE.Color(0xff0000), flashIntensity * 0.5);
      }
    }
  }

  private finalizeDamageFlash(anim: AnimationEntry): void {
    const snapshots = anim.data['materials'] as MaterialSnapshot[];
    restoreMaterials(snapshots);
  }
}
