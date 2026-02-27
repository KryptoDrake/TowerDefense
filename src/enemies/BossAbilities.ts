import * as THREE from 'three';
import { Enemy } from './Enemy';

// ─── Types ───────────────────────────────────────────────────────────

interface BossAbility {
  name: string;
  cooldown: number;
  currentCooldown: number;
  trigger: 'timer' | 'hp_threshold';
  hpThreshold?: number; // 0-1 range
  triggered?: boolean;  // for one-time threshold triggers
}

interface BossAbilityState {
  abilities: BossAbility[];
  // Shield
  shieldTimer: number;
  shieldMesh: THREE.Mesh | null;
  // Summon portal
  portalMesh: THREE.Mesh | null;
  portalTimer: number;
  // AOE slam
  slamPaused: number;
  slamRings: { mesh: THREE.Mesh; age: number }[];
  // Enrage
  enraged: boolean;
  originalSpeed: number;
  originalDamage: number;
  originalScale: number;
  trailTimer: number;
  trailParticles: { mesh: THREE.Mesh; life: number }[];
}

// ─── BossAbilities System ────────────────────────────────────────────

export class BossAbilities {
  private scene: THREE.Scene;
  private stateMap = new WeakMap<Enemy, BossAbilityState>();
  private activeBosses: Set<Enemy> = new Set();

  // Callbacks for Game.ts integration
  onSpawnMinions: ((pos: THREE.Vector3, count: number, hpMult: number) => void) | null = null;
  onDebuffTowers: ((pos: THREE.Vector3, radius: number, duration: number, fireRateReduction: number) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Assign the full set of boss abilities to an enemy */
  assignAbilities(enemy: Enemy): void {
    if (enemy.type !== 'boss') return;
    if (this.stateMap.has(enemy)) return;

    const abilities: BossAbility[] = [
      // Shield Phase: triggered at 75%, 50%, 25% HP
      { name: 'Schildphase', cooldown: 0, currentCooldown: 0, trigger: 'hp_threshold', hpThreshold: 0.75, triggered: false },
      { name: 'Schildphase', cooldown: 0, currentCooldown: 0, trigger: 'hp_threshold', hpThreshold: 0.50, triggered: false },
      { name: 'Schildphase', cooldown: 0, currentCooldown: 0, trigger: 'hp_threshold', hpThreshold: 0.25, triggered: false },

      // Summon Minions: triggered at 75%, 50%, 25% HP
      { name: 'Beschwörung', cooldown: 0, currentCooldown: 0, trigger: 'hp_threshold', hpThreshold: 0.75, triggered: false },
      { name: 'Beschwörung', cooldown: 0, currentCooldown: 0, trigger: 'hp_threshold', hpThreshold: 0.50, triggered: false },
      { name: 'Beschwörung', cooldown: 0, currentCooldown: 0, trigger: 'hp_threshold', hpThreshold: 0.25, triggered: false },

      // AOE Slam: timer-based, every 8 seconds
      { name: 'Bodenschlag', cooldown: 8, currentCooldown: 4, trigger: 'timer' },

      // Enrage: below 30% HP (one-time)
      { name: 'Raserei', cooldown: 0, currentCooldown: 0, trigger: 'hp_threshold', hpThreshold: 0.30, triggered: false },
    ];

    const state: BossAbilityState = {
      abilities,
      shieldTimer: 0,
      shieldMesh: null,
      portalMesh: null,
      portalTimer: 0,
      slamPaused: 0,
      slamRings: [],
      enraged: false,
      originalSpeed: enemy.baseSpeed,
      originalDamage: enemy.damage,
      originalScale: enemy.mesh.scale.x,
      trailTimer: 0,
      trailParticles: [],
    };

    this.stateMap.set(enemy, state);
    this.activeBosses.add(enemy);
  }

  /** Update all active boss abilities each frame */
  update(dt: number, allEnemies: Enemy[]): void {
    for (const boss of this.activeBosses) {
      if (!boss.alive) {
        this.cleanupBoss(boss);
        this.activeBosses.delete(boss);
        continue;
      }

      const state = this.stateMap.get(boss);
      if (!state) continue;

      // Skip if boss is still in spawn phase
      if (boss.isInSpawnPhase()) continue;

      const hpRatio = boss.hp / boss.maxHp;

      // ─── Process abilities ─────────────────────────
      for (const ability of state.abilities) {
        if (ability.trigger === 'hp_threshold' && !ability.triggered) {
          if (hpRatio <= ability.hpThreshold!) {
            ability.triggered = true;
            this.triggerAbility(boss, state, ability);
          }
        } else if (ability.trigger === 'timer') {
          ability.currentCooldown -= dt;
          if (ability.currentCooldown <= 0) {
            ability.currentCooldown = ability.cooldown;
            this.triggerAbility(boss, state, ability);
          }
        }
      }

      // ─── Update active effects ─────────────────────

      // Shield timer
      if (state.shieldTimer > 0) {
        state.shieldTimer -= dt;
        boss.shielded = true;

        // Regenerate 5% of max HP over the 3s shield duration
        const regenPerSec = (boss.maxHp * 0.05) / 3;
        boss.heal(regenPerSec * dt);

        // Pulse shield visual
        if (state.shieldMesh) {
          const pulse = 1.0 + Math.sin(state.shieldTimer * 6) * 0.15;
          state.shieldMesh.scale.setScalar(pulse);
          const mat = state.shieldMesh.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.2 + Math.sin(state.shieldTimer * 8) * 0.1;
        }

        if (state.shieldTimer <= 0) {
          boss.shielded = false;
          this.removeShield(boss, state);
          this.spawnShieldBreakParticles(boss);
        }
      }

      // Slam pause (boss pauses movement briefly)
      if (state.slamPaused > 0) {
        state.slamPaused -= dt;
        boss.speed = 0;
        if (state.slamPaused <= 0) {
          boss.speed = state.enraged
            ? state.originalSpeed * 1.5
            : state.originalSpeed;
        }
      }

      // Update expanding slam rings
      for (let i = state.slamRings.length - 1; i >= 0; i--) {
        const ring = state.slamRings[i];
        ring.age += dt;
        const maxAge = 1.0;
        const t = ring.age / maxAge;
        const scale = 1 + t * 8; // expand from 1 to 9 units
        ring.mesh.scale.set(scale, 1, scale);
        const mat = ring.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.6 * (1 - t);
        if (ring.age >= maxAge) {
          this.scene.remove(ring.mesh);
          ring.mesh.geometry.dispose();
          (ring.mesh.material as THREE.Material).dispose();
          state.slamRings.splice(i, 1);
        }
      }

      // Portal effect fade-out
      if (state.portalTimer > 0) {
        state.portalTimer -= dt;
        if (state.portalMesh) {
          const mat = state.portalMesh.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.5 * Math.max(0, state.portalTimer / 1.5);
          state.portalMesh.rotation.y += dt * 3;
          if (state.portalTimer <= 0) {
            this.scene.remove(state.portalMesh);
            state.portalMesh.geometry.dispose();
            (state.portalMesh.material as THREE.Material).dispose();
            state.portalMesh = null;
          }
        }
      }

      // Enrage trail particles
      if (state.enraged) {
        state.trailTimer -= dt;
        if (state.trailTimer <= 0) {
          state.trailTimer = 0.1;
          this.spawnEnrageTrailParticle(boss, state);
        }
        // Update existing trail particles
        for (let i = state.trailParticles.length - 1; i >= 0; i--) {
          const p = state.trailParticles[i];
          p.life -= dt;
          p.mesh.position.y += dt * 1.5;
          const mat = p.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, p.life / 0.8);
          p.mesh.scale.multiplyScalar(0.97);
          if (p.life <= 0) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            (p.mesh.material as THREE.Material).dispose();
            state.trailParticles.splice(i, 1);
          }
        }
      }
    }
  }

  // ─── Ability Triggers ──────────────────────────────────────────────

  private triggerAbility(boss: Enemy, state: BossAbilityState, ability: BossAbility): void {
    switch (ability.name) {
      case 'Schildphase':
        this.activateShield(boss, state);
        break;
      case 'Beschwörung':
        this.activateSummon(boss, state);
        break;
      case 'Bodenschlag':
        this.activateSlam(boss, state);
        break;
      case 'Raserei':
        this.activateEnrage(boss, state);
        break;
    }
  }

  // ─── Shield Phase ──────────────────────────────────────────────────

  private activateShield(boss: Enemy, state: BossAbilityState): void {
    state.shieldTimer = 3.0;
    boss.shielded = true;

    // Create/show shield sphere
    if (state.shieldMesh) {
      this.scene.remove(state.shieldMesh);
      state.shieldMesh.geometry.dispose();
      (state.shieldMesh.material as THREE.Material).dispose();
    }

    const geo = new THREE.SphereGeometry(2.2, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      wireframe: false,
    });
    state.shieldMesh = new THREE.Mesh(geo, mat);
    state.shieldMesh.position.y = 1.2;
    boss.mesh.add(state.shieldMesh);
  }

  private removeShield(boss: Enemy, state: BossAbilityState): void {
    if (state.shieldMesh) {
      boss.mesh.remove(state.shieldMesh);
      state.shieldMesh.geometry.dispose();
      (state.shieldMesh.material as THREE.Material).dispose();
      state.shieldMesh = null;
    }
  }

  private spawnShieldBreakParticles(boss: Enemy): void {
    const pos = boss.getPosition();
    const count = 12;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.8,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      p.position.y = 1.5 + Math.random() * 1.5;
      this.scene.add(p);

      const angle = (i / count) * Math.PI * 2;
      const speed = 3 + Math.random() * 2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        1 + Math.random() * 2,
        Math.sin(angle) * speed
      );

      const animate = () => {
        vel.y -= 9.8 * 0.016;
        p.position.add(vel.clone().multiplyScalar(0.016));
        p.rotation.x += 0.15;
        p.rotation.z += 0.1;
        const m = p.material as THREE.MeshBasicMaterial;
        m.opacity *= 0.95;
        if (m.opacity > 0.02) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ─── Summon Minions ────────────────────────────────────────────────

  private activateSummon(boss: Enemy, state: BossAbilityState): void {
    const pos = boss.getPosition();

    // Create dark portal effect on ground
    if (state.portalMesh) {
      this.scene.remove(state.portalMesh);
      state.portalMesh.geometry.dispose();
      (state.portalMesh.material as THREE.Material).dispose();
    }

    const portalGeo = new THREE.RingGeometry(0.5, 2.0, 16);
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0x440066,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    state.portalMesh = new THREE.Mesh(portalGeo, portalMat);
    state.portalMesh.position.copy(pos);
    state.portalMesh.position.y = 0.05;
    state.portalMesh.rotation.x = -Math.PI / 2;
    this.scene.add(state.portalMesh);
    state.portalTimer = 1.5;

    // Callback to Game.ts to spawn 3 minions at boss position
    // hpMult = 0.5 for 50% normal HP
    this.onSpawnMinions?.(pos, 3, 0.5);
  }

  // ─── AOE Slam ──────────────────────────────────────────────────────

  private activateSlam(boss: Enemy, state: BossAbilityState): void {
    const pos = boss.getPosition();

    // Pause boss movement
    state.slamPaused = 0.5;

    // Create expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.position.y = 0.1;
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    state.slamRings.push({ mesh: ring, age: 0 });

    // Second ring (slightly delayed visual)
    const ringGeo2 = new THREE.RingGeometry(0.2, 0.4, 24);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.position.copy(pos);
    ring2.position.y = 0.12;
    ring2.rotation.x = -Math.PI / 2;
    this.scene.add(ring2);
    state.slamRings.push({ mesh: ring2, age: -0.15 });

    // Callback to debuff towers: radius 4, duration 3s, 50% fire rate reduction
    this.onDebuffTowers?.(pos, 4, 3, 0.5);
  }

  // ─── Enrage ────────────────────────────────────────────────────────

  private activateEnrage(boss: Enemy, state: BossAbilityState): void {
    if (state.enraged) return;
    state.enraged = true;
    boss.enraged = true;

    // +50% speed, +100% damage
    boss.speed = state.originalSpeed * 1.5;
    boss.baseSpeed = state.originalSpeed * 1.5;
    boss.damage = Math.floor(state.originalDamage * 2);

    // Grow +20%
    const newScale = state.originalScale * 1.2;
    boss.mesh.scale.setScalar(newScale);

    // Turn boss mesh red with emissive glow
    boss.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material = child.material.clone();
        child.material.color.lerp(new THREE.Color(0xff0000), 0.6);
        child.material.emissive = new THREE.Color(0x660000);
        child.material.emissiveIntensity = 0.8;
      }
    });

    state.trailTimer = 0;
  }

  private spawnEnrageTrailParticle(boss: Enemy, state: BossAbilityState): void {
    const pos = boss.getPosition();
    const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff2200,
      transparent: true,
      opacity: 0.7,
    });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(
      pos.x + (Math.random() - 0.5) * 0.8,
      0.3 + Math.random() * 0.5,
      pos.z + (Math.random() - 0.5) * 0.8
    );
    this.scene.add(p);
    state.trailParticles.push({ mesh: p, life: 0.8 });
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  private cleanupBoss(boss: Enemy): void {
    const state = this.stateMap.get(boss);
    if (!state) return;

    // Shield
    if (state.shieldMesh) {
      boss.mesh.remove(state.shieldMesh);
      state.shieldMesh.geometry.dispose();
      (state.shieldMesh.material as THREE.Material).dispose();
    }

    // Portal
    if (state.portalMesh) {
      this.scene.remove(state.portalMesh);
      state.portalMesh.geometry.dispose();
      (state.portalMesh.material as THREE.Material).dispose();
    }

    // Slam rings
    for (const ring of state.slamRings) {
      this.scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      (ring.mesh.material as THREE.Material).dispose();
    }

    // Trail particles
    for (const p of state.trailParticles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }

    boss.shielded = false;
  }

  /** Clear all boss ability state and visuals */
  clear(): void {
    for (const boss of this.activeBosses) {
      this.cleanupBoss(boss);
    }
    this.activeBosses.clear();
  }
}
