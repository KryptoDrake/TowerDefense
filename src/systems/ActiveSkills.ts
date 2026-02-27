import * as THREE from 'three';

// ─── Skill definitions ──────────────────────────────────────────

export interface SkillDef {
  name: string;
  description: string;
  key: string;         // keyboard key ('1', '2', '3')
  cooldown: number;    // seconds
  iconColor: string;   // CSS color for UI
  borderColor: string; // CSS border color
}

export const SKILL_DEFS: SkillDef[] = [
  {
    name: 'Luftschlag',
    description: '150 Flächenschaden (Radius 4) an Mausposition',
    key: '1',
    cooldown: 30,
    iconColor: '#cc2222',
    borderColor: '#ff4444',
  },
  {
    name: 'Zeitriss',
    description: 'Alle Gegner 5s auf 30% Geschwindigkeit verlangsamt',
    key: '2',
    cooldown: 45,
    iconColor: '#2244cc',
    borderColor: '#4488ff',
  },
  {
    name: 'Heilungswelle',
    description: 'Basis +200 HP, alle Türme +50% Feuerrate für 8s',
    key: '3',
    cooldown: 60,
    iconColor: '#22aa44',
    borderColor: '#44ff66',
  },
];

// ─── Visual effect helpers ──────────────────────────────────────

interface SkillEffect {
  meshes: THREE.Object3D[];
  timer: number;
  duration: number;
  update: (dt: number, t: number) => void;
}

// ─── Main system ────────────────────────────────────────────────

export class ActiveSkillSystem {
  /** Current cooldown remaining per skill (0 = ready) */
  private cooldowns: number[] = [0, 0, 0];
  private effects: SkillEffect[] = [];
  private scene: THREE.Scene | null = null;

  /** Whether the tower fire-rate buff from Heilungswelle is active */
  private towerBuffActive = false;
  private towerBuffTimer = 0;
  readonly towerBuffMult = 1.5; // +50% fire rate

  // ── Callbacks (set by Game.ts during integration) ─────────

  /** Called when Luftschlag fires - (worldPos, radius, damage) */
  onDamageArea: ((pos: THREE.Vector3, radius: number, damage: number) => void) | null = null;

  /** Called when Zeitriss fires - (speedFactor, duration) - apply to ALL enemies */
  onSlowAll: ((speedFactor: number, duration: number) => void) | null = null;

  /** Called when Heilungswelle fires - (healAmount) */
  onHealBase: ((amount: number) => void) | null = null;

  /** Called when tower fire-rate buff starts / stops - (active, multiplier) */
  onBuffTowers: ((active: boolean, mult: number) => void) | null = null;

  // ── UI references ─────────────────────────────────────────

  private uiSlots: HTMLElement[] = [];
  private uiOverlays: HTMLElement[] = [];
  private uiTimers: HTMLElement[] = [];

  constructor() {
    this.buildUI();
  }

  // ─── Public API ───────────────────────────────────────────

  /** Attach the THREE.Scene so visual effects can be spawned */
  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /** Per-frame update */
  update(dt: number): void {
    // Tick cooldowns
    for (let i = 0; i < 3; i++) {
      if (this.cooldowns[i] > 0) {
        this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
      }
    }

    // Tick tower buff
    if (this.towerBuffActive) {
      this.towerBuffTimer -= dt;
      if (this.towerBuffTimer <= 0) {
        this.towerBuffActive = false;
        this.towerBuffTimer = 0;
        this.onBuffTowers?.(false, 1);
      }
    }

    // Tick visual effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.timer += dt;
      const t = Math.min(fx.timer / fx.duration, 1);
      fx.update(dt, t);
      if (t >= 1) {
        // Remove
        for (const m of fx.meshes) {
          this.scene?.remove(m);
          if (m instanceof THREE.Mesh) {
            m.geometry.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach(mat => mat.dispose());
            } else {
              m.material.dispose();
            }
          }
        }
        this.effects.splice(i, 1);
      }
    }

    // Update UI
    this.updateUI();
  }

  /** Try to activate a skill by index (0-2). Returns true if activated. */
  activate(skillIndex: number, mouseWorldPos?: THREE.Vector3): boolean {
    if (skillIndex < 0 || skillIndex > 2) return false;
    if (this.cooldowns[skillIndex] > 0) return false;

    // Start cooldown
    this.cooldowns[skillIndex] = SKILL_DEFS[skillIndex].cooldown;

    switch (skillIndex) {
      case 0:
        this.activateLuftschlag(mouseWorldPos ?? new THREE.Vector3(0, 0, 0));
        break;
      case 1:
        this.activateZeitriss();
        break;
      case 2:
        this.activateHeilungswelle();
        break;
    }

    // Flash the UI slot
    this.flashSlot(skillIndex);
    return true;
  }

  /** Handle keyboard input - returns true if a skill key was consumed */
  handleKey(key: string, mouseWorldPos?: THREE.Vector3): boolean {
    const index = ['1', '2', '3'].indexOf(key);
    if (index === -1) return false;
    return this.activate(index, mouseWorldPos);
  }

  /** Whether the tower fire-rate buff is currently active */
  isTowerBuffActive(): boolean {
    return this.towerBuffActive;
  }

  /** Get remaining cooldown for a skill (for external UI if needed) */
  getCooldown(index: number): number {
    return this.cooldowns[index] ?? 0;
  }

  /** Reset all cooldowns (e.g. on level start) */
  resetCooldowns(): void {
    this.cooldowns = [0, 0, 0];
    this.towerBuffActive = false;
    this.towerBuffTimer = 0;
    this.updateUI();
  }

  /** Clean up all active effects from scene */
  cleanup(): void {
    for (const fx of this.effects) {
      for (const m of fx.meshes) {
        this.scene?.remove(m);
        if (m instanceof THREE.Mesh) {
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      }
    }
    this.effects = [];
    this.towerBuffActive = false;
    this.towerBuffTimer = 0;
  }

  /** Show/hide the skills bar UI */
  setVisible(visible: boolean): void {
    const bar = document.getElementById('skills-bar');
    if (bar) bar.style.display = visible ? 'flex' : 'none';
  }

  // ─── Skill implementations ────────────────────────────────

  private activateLuftschlag(worldPos: THREE.Vector3): void {
    const radius = 4;
    const damage = 150;

    // Callback: deal damage
    this.onDamageArea?.(worldPos.clone(), radius, damage);

    if (!this.scene) return;

    // -- Visual: ground target circle --
    const circleGeo = new THREE.RingGeometry(radius - 0.15, radius, 48);
    const circleMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const circle = new THREE.Mesh(circleGeo, circleMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(worldPos.x, 0.15, worldPos.z);
    this.scene.add(circle);

    // Inner fill
    const fillGeo = new THREE.CircleGeometry(radius, 48);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(worldPos.x, 0.12, worldPos.z);
    this.scene.add(fill);

    // -- Falling projectiles (6 small spheres) --
    const projectiles: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dist = Math.random() * radius * 0.7;
      const px = worldPos.x + Math.cos(angle) * dist;
      const pz = worldPos.z + Math.sin(angle) * dist;

      const pGeo = new THREE.SphereGeometry(0.25, 8, 6);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const proj = new THREE.Mesh(pGeo, pMat);
      proj.position.set(px, 15 + Math.random() * 5, pz);
      this.scene.add(proj);
      projectiles.push(proj);
    }

    // -- Explosion sphere (appears at 0.5s) --
    const explGeo = new THREE.SphereGeometry(radius * 0.8, 16, 12);
    const explMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0,
    });
    const explosion = new THREE.Mesh(explGeo, explMat);
    explosion.position.set(worldPos.x, 1, worldPos.z);
    this.scene.add(explosion);

    const allMeshes: THREE.Object3D[] = [circle, fill, explosion, ...projectiles];

    this.effects.push({
      meshes: allMeshes,
      timer: 0,
      duration: 2.0,
      update: (_dt, t) => {
        // Projectiles fall during first 0.5s (t 0->0.25)
        const fallT = Math.min(t / 0.25, 1);
        for (const p of projectiles) {
          const startY = 15;
          p.position.y = startY * (1 - fallT);
          if (fallT >= 1) p.visible = false;
        }

        // Explosion appears at t=0.25, expands & fades
        if (t >= 0.25) {
          const et = (t - 0.25) / 0.75;
          const scale = 0.3 + et * 1.5;
          explosion.scale.setScalar(scale);
          explosion.material.opacity = Math.max(0, 0.6 * (1 - et));
        }

        // Circle ring fades out
        circleMat.opacity = Math.max(0, 0.7 * (1 - t));
        fillMat.opacity = Math.max(0, 0.15 * (1 - t));
      },
    });
  }

  private activateZeitriss(): void {
    const speedFactor = 0.3;
    const duration = 5;

    // Callback: slow all enemies
    this.onSlowAll?.(speedFactor, duration);

    if (!this.scene) return;

    // -- Visual: Blue pulse wave from map center --
    const pulseGeo = new THREE.RingGeometry(0.1, 1, 64);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(20, 0.2, 20); // Map center (MAP_SIZE/2)
    this.scene.add(pulse);

    // Second inner pulse ring for layered effect
    const pulse2Geo = new THREE.RingGeometry(0.1, 0.6, 64);
    const pulse2Mat = new THREE.MeshBasicMaterial({
      color: 0x88bbff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const pulse2 = new THREE.Mesh(pulse2Geo, pulse2Mat);
    pulse2.rotation.x = -Math.PI / 2;
    pulse2.position.set(20, 0.25, 20);
    this.scene.add(pulse2);

    this.effects.push({
      meshes: [pulse, pulse2],
      timer: 0,
      duration: 2.5,
      update: (_dt, t) => {
        // Expand the ring outward across the map
        const maxRadius = 35;
        const r1 = t * maxRadius;
        const r2 = Math.max(0, t - 0.15) / 0.85 * maxRadius;

        pulse.scale.setScalar(r1 + 0.1);
        pulse2.scale.setScalar(r2 + 0.1);

        pulseMat.opacity = Math.max(0, 0.8 * (1 - t));
        pulse2Mat.opacity = Math.max(0, 0.5 * (1 - t * 1.2));
      },
    });
  }

  private activateHeilungswelle(): void {
    const healAmount = 200;
    const buffDuration = 8;

    // Callbacks
    this.onHealBase?.(healAmount);

    // Start tower buff
    this.towerBuffActive = true;
    this.towerBuffTimer = buffDuration;
    this.onBuffTowers?.(true, this.towerBuffMult);

    if (!this.scene) return;

    // -- Visual: Green expanding ring --
    const ringGeo = new THREE.RingGeometry(0.5, 1.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44ff66,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(20, 0.3, 20);
    this.scene.add(ring);

    // Green particles (rising sparkles)
    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 3 + Math.random() * 10;
      const sparkGeo = new THREE.SphereGeometry(0.2, 6, 4);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0x66ff88,
        transparent: true,
        opacity: 0.8,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.set(
        20 + Math.cos(angle) * dist,
        0.5,
        20 + Math.sin(angle) * dist
      );
      this.scene.add(spark);
      particles.push(spark);
    }

    const allMeshes: THREE.Object3D[] = [ring, ...particles];

    this.effects.push({
      meshes: allMeshes,
      timer: 0,
      duration: 2.5,
      update: (_dt, t) => {
        // Ring expands
        const scale = 1 + t * 25;
        ring.scale.setScalar(scale);
        ringMat.opacity = Math.max(0, 0.8 * (1 - t));

        // Sparkles rise and fade
        for (const spark of particles) {
          spark.position.y = 0.5 + t * 6;
          (spark.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - t));
        }
      },
    });
  }

  // ─── UI ───────────────────────────────────────────────────

  private buildUI(): void {
    const bar = document.getElementById('skills-bar');
    if (!bar) return;

    for (let i = 0; i < SKILL_DEFS.length; i++) {
      const def = SKILL_DEFS[i];

      const slot = document.createElement('div');
      slot.className = 'skill-slot';
      slot.style.borderColor = def.borderColor;
      slot.title = `${def.name} - ${def.description}`;

      // Icon area
      const icon = document.createElement('div');
      icon.className = 'skill-icon';
      icon.style.background = def.iconColor;
      slot.appendChild(icon);

      // Skill name
      const name = document.createElement('div');
      name.className = 'skill-name';
      name.textContent = def.name;
      slot.appendChild(name);

      // Hotkey hint
      const hotkey = document.createElement('div');
      hotkey.className = 'skill-hotkey';
      hotkey.textContent = def.key;
      slot.appendChild(hotkey);

      // Cooldown overlay
      const overlay = document.createElement('div');
      overlay.className = 'skill-cooldown-overlay';
      slot.appendChild(overlay);

      // Cooldown timer text
      const timerText = document.createElement('div');
      timerText.className = 'skill-timer';
      slot.appendChild(timerText);

      bar.appendChild(slot);

      this.uiSlots.push(slot);
      this.uiOverlays.push(overlay);
      this.uiTimers.push(timerText);

      // Click to activate
      slot.addEventListener('click', () => {
        this.activate(i);
      });
    }
  }

  private updateUI(): void {
    for (let i = 0; i < 3; i++) {
      const cd = this.cooldowns[i];
      const maxCd = SKILL_DEFS[i].cooldown;
      const overlay = this.uiOverlays[i];
      const timer = this.uiTimers[i];
      const slot = this.uiSlots[i];

      if (!overlay || !timer || !slot) continue;

      if (cd > 0) {
        const pct = (cd / maxCd) * 100;
        overlay.style.height = `${pct}%`;
        overlay.style.display = 'block';
        timer.textContent = Math.ceil(cd).toString() + 's';
        timer.style.display = 'block';
        slot.classList.remove('skill-ready');
        slot.classList.add('skill-on-cooldown');
      } else {
        overlay.style.display = 'none';
        timer.style.display = 'none';
        slot.classList.remove('skill-on-cooldown');
        slot.classList.add('skill-ready');
      }
    }
  }

  private flashSlot(index: number): void {
    const slot = this.uiSlots[index];
    if (!slot) return;
    slot.classList.add('skill-flash');
    setTimeout(() => slot.classList.remove('skill-flash'), 400);
  }
}
