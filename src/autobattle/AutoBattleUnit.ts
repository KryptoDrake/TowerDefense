import * as THREE from 'three';
import { UnitDef } from '../units/UnitConfig';

export type ABUnitState = 'idle' | 'moving' | 'attacking' | 'ability' | 'dead';

let unitIdCounter = 0;

/**
 * Mobile Kampfeinheit die sich auf dem Auto-Kampf-Raster bewegt und kämpft.
 * Erstellt ein prozedurales Humanoiden-Mesh (~1.2 Welteinheiten hoch).
 *
 * ACHTUNG: useDefineForClassFields ist aktiv - `declare` für Felder die
 * im Konstruktor über Methodenaufrufe gesetzt werden.
 */
export class AutoBattleUnit {
  readonly id: string;
  readonly def: UnitDef;
  readonly mesh: THREE.Group;
  readonly isPlayerUnit: boolean;

  // Stats (scaled by star level)
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackSpeed: number;
  starLevel: 1 | 2 | 3;

  // Grid position
  gridCol: number;
  gridRow: number;

  // Combat state
  state: ABUnitState = 'idle';
  target: AutoBattleUnit | null = null;
  attackCooldown: number = 0;
  mana: number = 0;
  maxMana: number;

  // Movement
  moveTarget: THREE.Vector3 | null = null;
  private moveSpeed: number; // world-units per second

  // HP bar
  private hpBarBg: THREE.Mesh;
  private hpBarFill: THREE.Mesh;

  // Animation
  private walkCycle: number = 0;
  private attackAnimTimer: number = 0;
  private bodyMesh: THREE.Mesh | null = null;
  private headMesh: THREE.Mesh | null = null;
  private leftArm: THREE.Mesh | null = null;
  private rightArm: THREE.Mesh | null = null;

  constructor(def: UnitDef, starLevel: 1 | 2 | 3, isPlayerUnit: boolean, gridCol: number, gridRow: number) {
    this.id = `unit_${unitIdCounter++}`;
    this.def = def;
    this.isPlayerUnit = isPlayerUnit;
    this.starLevel = starLevel;
    this.gridCol = gridCol;
    this.gridRow = gridRow;

    // Apply base stats
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.attack = def.attack;
    this.defense = def.defense;
    this.speed = def.speed;
    this.attackRange = def.attackRange;
    this.attackSpeed = def.attackSpeed;
    this.maxMana = 100;
    this.moveSpeed = def.speed * 2; // cells/sec * 2 = world-units/sec (AB_CELL_SIZE=2)

    // Apply star level scaling
    this.applyStarScaling();

    // Create mesh
    this.mesh = this.createMesh();

    // Create HP bar
    const hpBarGroup = new THREE.Group();
    hpBarGroup.name = 'hp-bar-group';

    const bgGeo = new THREE.PlaneGeometry(1.0, 0.12);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
    this.hpBarBg = new THREE.Mesh(bgGeo, bgMat);
    hpBarGroup.add(this.hpBarBg);

    const fillGeo = new THREE.PlaneGeometry(1.0, 0.12);
    const fillMat = new THREE.MeshBasicMaterial({ color: isPlayerUnit ? 0x44ff44 : 0xff4444, side: THREE.DoubleSide });
    this.hpBarFill = new THREE.Mesh(fillGeo, fillMat);
    this.hpBarFill.position.z = 0.001; // slightly in front of bg
    hpBarGroup.add(this.hpBarFill);

    // Position HP bar above head
    hpBarGroup.position.y = 1.8;
    hpBarGroup.rotation.y = Math.PI / 4; // face camera roughly
    this.mesh.add(hpBarGroup);
  }

  /** Update unit each frame */
  update(dt: number): void {
    if (this.state === 'dead') return;

    // Decrease attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // Attack animation timer
    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= dt;
      // Lunge animation on right arm
      if (this.rightArm) {
        const t = this.attackAnimTimer / 0.3;
        this.rightArm.rotation.x = -Math.sin(t * Math.PI) * 1.2;
      }
    }

    // Movement handling
    if (this.state === 'moving' && this.moveTarget) {
      const currentPos = this.mesh.position;
      const dir = this.moveTarget.clone().sub(currentPos);
      dir.y = 0;
      const dist = dir.length();
      const step = this.moveSpeed * dt;

      if (dist <= step) {
        // Arrived at target
        this.mesh.position.set(this.moveTarget.x, 0, this.moveTarget.z);
        this.moveTarget = null;
        this.state = 'idle';
      } else {
        dir.normalize().multiplyScalar(step);
        this.mesh.position.add(dir);

        // Face movement direction
        const angle = Math.atan2(dir.x, dir.z);
        this.mesh.rotation.y = angle;

        // Walk animation
        this.walkCycle += dt * this.moveSpeed * 2;
        const swing = Math.sin(this.walkCycle) * 0.5;
        if (this.leftArm) this.leftArm.rotation.x = -swing * 0.6;
        if (this.rightArm && this.attackAnimTimer <= 0) {
          this.rightArm.rotation.x = swing * 0.6;
        }
      }
    } else if (this.state === 'idle') {
      // Idle breathing animation
      if (this.bodyMesh) {
        this.bodyMesh.scale.y = 1.0 + Math.sin(Date.now() * 0.003) * 0.02;
      }
      // Reset arm positions
      if (this.leftArm && this.attackAnimTimer <= 0) this.leftArm.rotation.x = 0;
      if (this.rightArm && this.attackAnimTimer <= 0) this.rightArm.rotation.x = 0;
    }
  }

  /** Take damage, returns true if unit died */
  takeDamage(amount: number, _element?: string): boolean {
    if (this.state === 'dead') return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dead';
      this.updateHpBar();
      // Death visual: fall over
      this.playDeathAnimation();
      return true;
    }
    this.updateHpBar();

    // Damage flash
    this.flashDamage();
    return false;
  }

  /** Heal unit */
  heal(amount: number): void {
    if (this.state === 'dead') return;
    this.hp = Math.min(this.hp + amount, this.maxHp);
    this.updateHpBar();
  }

  /** Set move target (world position) */
  moveTo(worldPos: THREE.Vector3): void {
    if (this.state === 'dead') return;
    this.moveTarget = worldPos.clone();
    this.state = 'moving';
  }

  /** Check if target is in attack range (in grid cells) */
  isInRange(target: AutoBattleUnit): boolean {
    const dx = Math.abs(this.gridCol - target.gridCol);
    const dz = Math.abs(this.gridRow - target.gridRow);
    // Chebyshev distance for range check (allows diagonal range)
    const dist = Math.max(dx, dz);
    return dist <= this.attackRange;
  }

  /** Get distance to another unit in grid cells (Manhattan) */
  getGridDistance(target: AutoBattleUnit): number {
    return Math.abs(this.gridCol - target.gridCol) + Math.abs(this.gridRow - target.gridRow);
  }

  /** Get world position */
  getWorldPos(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  /** Trigger attack animation (visual only) */
  playAttackAnim(): void {
    this.attackAnimTimer = 0.3;

    // Face target
    if (this.target) {
      const dir = this.target.mesh.position.clone().sub(this.mesh.position);
      const angle = Math.atan2(dir.x, dir.z);
      this.mesh.rotation.y = angle;
    }
  }

  /** Update HP bar visual */
  private updateHpBar(): void {
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBarFill.scale.x = ratio;
    this.hpBarFill.position.x = -(1 - ratio) * 0.5;

    // Color: green -> yellow -> red
    const mat = this.hpBarFill.material as THREE.MeshBasicMaterial;
    if (this.isPlayerUnit) {
      if (ratio > 0.5) {
        mat.color.setHex(0x44ff44);
      } else if (ratio > 0.25) {
        mat.color.setHex(0xffaa00);
      } else {
        mat.color.setHex(0xff4444);
      }
    } else {
      // Enemy HP bar always red tones
      if (ratio > 0.5) {
        mat.color.setHex(0xff4444);
      } else if (ratio > 0.25) {
        mat.color.setHex(0xcc2222);
      } else {
        mat.color.setHex(0x881111);
      }
    }
  }

  /** Apply star level scaling to stats */
  private applyStarScaling(): void {
    let mult: number;
    switch (this.starLevel) {
      case 1: mult = 1.0; break;
      case 2: mult = 1.8; break;
      case 3: mult = 3.2; break;
    }

    this.maxHp = Math.round(this.def.hp * mult);
    this.hp = this.maxHp;
    this.attack = Math.round(this.def.attack * mult);
    this.defense = Math.round(this.def.defense * mult);
    // Speed and attack speed don't scale with stars
  }

  /** Create unit mesh (procedural humanoid ~1.2 world units tall) */
  private createMesh(): THREE.Group {
    const group = new THREE.Group();

    const baseColor = new THREE.Color(this.def.color);
    const mat = new THREE.MeshLambertMaterial({ color: baseColor });
    const darkMat = new THREE.MeshLambertMaterial({
      color: baseColor.clone().offsetHSL(0, 0, -0.15),
    });
    const headMat = new THREE.MeshLambertMaterial({
      color: baseColor.clone().offsetHSL(0, -0.1, 0.1),
    });

    // Determine scale based on star level
    let unitScale = 1.0;
    if (this.starLevel === 2) unitScale = 1.15;
    if (this.starLevel === 3) unitScale = 1.3;

    // Body (0.6 x 0.8 x 0.4)
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.4);
    this.bodyMesh = new THREE.Mesh(bodyGeo, mat);
    this.bodyMesh.position.y = 0.65;
    this.bodyMesh.castShadow = true;
    group.add(this.bodyMesh);

    // Head (sphere, radius 0.25)
    const headGeo = new THREE.SphereGeometry(0.25, 8, 6);
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.3;
    this.headMesh.castShadow = true;
    group.add(this.headMesh);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({
      color: this.isPlayerUnit ? 0x44aaff : 0xff2222,
    });
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.04);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08, 1.35, 0.22);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.08, 1.35, 0.22);
    group.add(rightEye);

    // Arms (thin boxes on sides)
    const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.45, 0.65, 0);
    this.leftArm.castShadow = true;
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.45, 0.65, 0);
    this.rightArm.castShadow = true;
    group.add(this.rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.4, 0.18);
    const leftLeg = new THREE.Mesh(legGeo, darkMat);
    leftLeg.position.set(-0.14, 0.2, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, darkMat);
    rightLeg.position.set(0.14, 0.2, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Star level ring at base
    if (this.starLevel >= 2) {
      const ringColor = this.starLevel === 2 ? 0xccccdd : 0xffcc00;
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.7,
      });
      const ringGeo = new THREE.TorusGeometry(0.5, 0.04, 8, 20);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ring.name = 'star-ring';
      group.add(ring);
    }

    // Star level indicator (small octahedra above head)
    if (this.starLevel >= 1) {
      const starsGroup = new THREE.Group();
      starsGroup.name = 'star-indicators';
      const starColor = this.starLevel === 1 ? 0xaaaaaa : this.starLevel === 2 ? 0xccccdd : 0xffcc00;
      for (let i = 0; i < this.starLevel; i++) {
        const starGeo = new THREE.OctahedronGeometry(0.07, 0);
        const starMat = new THREE.MeshBasicMaterial({ color: starColor });
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(
          (i - (this.starLevel - 1) / 2) * 0.2,
          1.65,
          0
        );
        starsGroup.add(star);
      }
      group.add(starsGroup);
    }

    // Star 3: golden aura
    if (this.starLevel === 3) {
      const auraGeo = new THREE.SphereGeometry(0.7, 10, 6);
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.08,
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.position.y = 0.7;
      aura.name = 'star-aura';
      group.add(aura);
    }

    // Player vs enemy side indicator: small base plate
    const plateMat = new THREE.MeshBasicMaterial({
      color: this.isPlayerUnit ? 0x2244aa : 0xaa2222,
      transparent: true,
      opacity: 0.5,
    });
    const plateGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.04, 12);
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.y = 0.02;
    group.add(plate);

    group.scale.setScalar(unitScale);

    return group;
  }

  /** Flash the unit red briefly when taking damage */
  private flashDamage(): void {
    if (!this.bodyMesh) return;
    const originalMat = this.bodyMesh.material as THREE.MeshLambertMaterial;
    const origColor = originalMat.color.getHex();
    originalMat.color.setHex(0xff0000);
    setTimeout(() => {
      originalMat.color.setHex(origColor);
    }, 100);
  }

  /** Play death animation: fall over and fade */
  private playDeathAnimation(): void {
    // Simple immediate visual: rotate and drop
    const duration = 0.5;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const t = Math.min(elapsed / duration, 1);
      this.mesh.rotation.x = t * (Math.PI / 2.5);
      this.mesh.position.y = -t * 0.5;
      // Fade out materials
      this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
          if (mat.transparent !== undefined) {
            mat.transparent = true;
            mat.opacity = 1 - t * 0.7;
          }
        }
      });
      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  /** Remove from scene */
  cleanup(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    // Dispose all geometries and materials
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m.dispose());
        } else {
          mat.dispose();
        }
      }
    });
  }
}
