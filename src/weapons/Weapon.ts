import * as THREE from 'three';
import { Enemy } from '../enemies/Enemy';
import { WeaponKey, BALANCE } from '../systems/BalanceConfig';
import { SynergyBuffs } from '../systems/SynergySystem';
import type { SpecModifiers } from '../systems/TowerSpecialization';

export type TargetingMode = 'first' | 'last' | 'strongest' | 'closest';

export const TARGETING_MODE_LABELS: Record<TargetingMode, string> = {
  first: 'Erster',
  last: 'Letzter',
  strongest: 'Stärkster',
  closest: 'Nächster',
};

export const TARGETING_MODES: TargetingMode[] = ['first', 'last', 'strongest', 'closest'];

export interface Projectile {
  mesh: THREE.Mesh;
  target: Enemy;
  speed: number;
  damage: number;
  splashRadius?: number;
  slowFactor?: number;
  slowDuration?: number;
  dotDamage?: number;
  dotDuration?: number;
  sourceWeaponKey: WeaponKey;
  /** Reference to the weapon that created this projectile (for kill/damage attribution) */
  sourceWeapon?: Weapon;
}

export abstract class Weapon {
  readonly mesh: THREE.Group;
  readonly key: WeaponKey;
  readonly gridX: number;
  readonly gridZ: number;
  readonly isPath: boolean;
  protected fireCooldown = 0;

  // Upgrade system
  level = 1;
  totalInvested = 0; // total gold spent (base cost + upgrades)

  // Targeting priority mode
  targetingMode: TargetingMode = 'first';

  // Combat stats tracking
  kills = 0;
  totalDamageDealt = 0;
  /** Elapsed time since placement, used for DPS calculation */
  activeTime = 0;

  // Placement animation
  private placeAnimTimer = 0;
  private placeAnimDuration = 0.5;
  private placeAnimActive = true;

  constructor(key: WeaponKey, gridX: number, gridZ: number) {
    this.key = key;
    this.gridX = gridX;
    this.gridZ = gridZ;
    const config = BALANCE.weapons[key];
    this.isPath = config.isPath;
    this.totalInvested = config.cost;
    this.mesh = this.createMesh();

    // Start with scale 0 for placement animation
    this.mesh.scale.setScalar(0.01);
  }

  /** Call each frame to animate placement build-up */
  updatePlacementAnim(dt: number): void {
    if (!this.placeAnimActive) return;
    this.placeAnimTimer += dt;
    const t = Math.min(this.placeAnimTimer / this.placeAnimDuration, 1);

    // Elastic bounce easing
    const p = 0.3;
    const s = p / 4;
    const eased = t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;

    const targetScale = 1 + (this.level - 1) * 0.08;
    this.mesh.scale.setScalar(eased * targetScale);

    if (t >= 1) {
      this.placeAnimActive = false;
      this.mesh.scale.setScalar(targetScale);
    }
  }

  abstract createMesh(): THREE.Group;
  abstract update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void;

  getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  getUpgradeCost(): number {
    if (this.level >= 3) return 0;
    return Math.floor(BALANCE.weapons[this.key].cost * (0.6 + this.level * 0.4));
  }

  getSellValue(): number {
    return Math.floor(this.totalInvested * 0.5);
  }

  canUpgrade(): boolean {
    return this.level < 3 && !this.isPath;
  }

  upgrade(): void {
    if (!this.canUpgrade()) return;
    const cost = this.getUpgradeCost();
    this.totalInvested += cost;
    this.level++;
    this.applyUpgradeStats();
    this.applyUpgradeVisual();
  }

  protected applyUpgradeStats(): void {
    // Overridden by TowerWeapon
  }

  protected applyUpgradeVisual(): void {
    // Level indicator: scale up slightly
    const s = 1 + (this.level - 1) * 0.08;
    this.mesh.scale.setScalar(s);

    // Remove old decorations
    const oldRing = this.mesh.getObjectByName('level-ring');
    if (oldRing) this.mesh.remove(oldRing);
    const oldStars = this.mesh.getObjectByName('level-stars');
    if (oldStars) this.mesh.remove(oldStars);
    const oldAura = this.mesh.getObjectByName('level-aura');
    if (oldAura) this.mesh.remove(oldAura);

    // Level 2 = silver, Level 3 = gold
    const ringColor = this.level === 2 ? 0x88bbdd : 0xffaa00;
    const emissiveColor = this.level === 2 ? 0x4488aa : 0xcc8800;

    // Add glowing ring at base
    const ringGeo = new THREE.TorusGeometry(0.7, 0.05, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    ring.name = 'level-ring';
    this.mesh.add(ring);

    // Level stars floating above
    const starsGroup = new THREE.Group();
    starsGroup.name = 'level-stars';
    for (let i = 0; i < this.level; i++) {
      const starGeo = new THREE.OctahedronGeometry(0.1, 0);
      const starMat = new THREE.MeshBasicMaterial({ color: ringColor });
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set((i - (this.level - 1) / 2) * 0.25, 2.8, 0);
      starsGroup.add(star);
    }
    this.mesh.add(starsGroup);

    // Level 3: Add golden particle aura
    if (this.level === 3) {
      const auraGeo = new THREE.SphereGeometry(0.9, 12, 8);
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xffcc44,
        transparent: true,
        opacity: 0.08,
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.position.y = 1.5;
      aura.name = 'level-aura';
      this.mesh.add(aura);
    }
  }
}

// Base class for tower weapons that shoot projectiles
export abstract class TowerWeapon extends Weapon {
  protected range: number;
  protected fireRate: number;
  protected damage: number;
  // Note: set by createMesh() in subclasses. Must use 'declare' to prevent
  // useDefineForClassFields from overwriting the value set during super().
  protected declare turretHead: THREE.Mesh | null;

  // Synergy buffs (applied externally by SynergySystem)
  synergyBuffs: SynergyBuffs | null = null;

  // Specialization modifiers (applied when tower reaches level 3 and player picks a spec)
  specModifiers: SpecModifiers | null = null;

  // Boss slam debuff: multiplier applied to fire rate (1 = normal, <1 = slowed)
  bossDebuffFireRate = 1;

  // Current target (exposed for target line visualization)
  currentTarget: Enemy | null = null;

  // Fire recoil animation
  private recoilTimer = 0;
  private recoilDuration = 0.15;
  private recoilIntensity = 0.2; // how far the turret kicks back

  // Muzzle flash light
  private muzzleLight: THREE.PointLight | null = null;
  private muzzleLightTimer = 0;

  // Idle animation state
  private idleTime = Math.random() * 100; // offset so towers don't sync
  private idleScanDir = 1;
  private idleScanAngle = 0;

  constructor(key: WeaponKey, gridX: number, gridZ: number) {
    super(key, gridX, gridZ);
    const config = BALANCE.weapons[key] as any;
    this.range = config.range;
    this.fireRate = config.fireRate;
    this.damage = config.damage;
  }

  protected applyUpgradeStats(): void {
    const config = BALANCE.weapons[this.key] as any;
    const mult = 1 + (this.level - 1) * 0.35; // +35% per level
    this.damage = Math.floor(config.damage * mult);
    this.range = config.range * (1 + (this.level - 1) * 0.15); // +15% range per level
    this.fireRate = config.fireRate * (1 + (this.level - 1) * 0.2); // +20% fire rate per level
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    // Placement animation
    this.updatePlacementAnim(dt);

    // Track active time for DPS calculation
    this.activeTime += dt;

    this.fireCooldown -= dt;

    // Update fire recoil animation
    this.updateRecoil(dt);

    // Always track nearest target (smooth turret rotation)
    const target = this.findTarget(enemies);
    this.currentTarget = target;
    if (target) {
      this.rotateTurret(target, dt);
    } else {
      // Idle animation when no target
      this.updateIdle(dt);
    }

    // Fire when ready (use effective fire rate with synergy buffs)
    if (this.fireCooldown <= 0 && target) {
      this.fireCooldown = 1 / this.getEffectiveFireRate();
      this.triggerRecoil();
      this.fire(target, createProjectile);
    }
  }

  protected findTarget(enemies: Enemy[]): Enemy | null {
    const range = this.getEffectiveRange();

    // Collect all enemies in range
    const inRange: { enemy: Enemy; dist: number }[] = [];
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      // Flyers can only be hit by towers with effective range >= 5
      if (enemy.flyHeight > 0 && range < 5) continue;
      const dist = this.mesh.position.distanceTo(enemy.getPosition());
      if (dist < range) {
        inRange.push({ enemy, dist });
      }
    }

    if (inRange.length === 0) return null;

    switch (this.targetingMode) {
      case 'first':
        // Enemy furthest along the path (highest distanceTraveled)
        return inRange.reduce((best, cur) =>
          cur.enemy.getDistanceTraveled() > best.enemy.getDistanceTraveled() ? cur : best
        ).enemy;

      case 'last':
        // Enemy closest to start (lowest distanceTraveled)
        return inRange.reduce((best, cur) =>
          cur.enemy.getDistanceTraveled() < best.enemy.getDistanceTraveled() ? cur : best
        ).enemy;

      case 'strongest':
        // Enemy with highest current HP
        return inRange.reduce((best, cur) =>
          cur.enemy.hp > best.enemy.hp ? cur : best
        ).enemy;

      case 'closest':
        // Enemy closest to tower (distance-based)
        return inRange.reduce((best, cur) =>
          cur.dist < best.dist ? cur : best
        ).enemy;

      default:
        return inRange[0].enemy;
    }
  }

  protected rotateTurret(target: Enemy, dt: number): void {
    if (!this.turretHead) return;
    const dir = target.getPosition().sub(this.mesh.position);
    const targetAngle = Math.atan2(dir.x, dir.z);

    // Smooth rotation with angle wrapping
    let current = this.turretHead.rotation.y;
    let diff = targetAngle - current;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const rotSpeed = 8; // radians per second
    const maxStep = rotSpeed * dt;
    if (Math.abs(diff) < maxStep) {
      this.turretHead.rotation.y = targetAngle;
    } else {
      this.turretHead.rotation.y += Math.sign(diff) * maxStep;
    }
  }

  /** Gentle idle animation: slow turret scan + subtle body sway */
  private updateIdle(dt: number): void {
    this.idleTime += dt;

    // Slow turret head scan (sweeping left-right)
    if (this.turretHead) {
      this.idleScanAngle += this.idleScanDir * 0.5 * dt; // ~0.5 rad/s
      if (this.idleScanAngle > 0.8) { this.idleScanDir = -1; }
      if (this.idleScanAngle < -0.8) { this.idleScanDir = 1; }
      this.turretHead.rotation.y += this.idleScanDir * 0.5 * dt;
    }

    // Subtle body sway (gentle oscillation)
    const swayX = Math.sin(this.idleTime * 1.2) * 0.006;
    const swayZ = Math.cos(this.idleTime * 0.9) * 0.006;
    this.mesh.rotation.x = swayX;
    this.mesh.rotation.z = swayZ;

    // Subtle "breathing" scale pulse
    const baseLevelScale = 1 + (this.level - 1) * 0.08;
    const pulse = baseLevelScale + Math.sin(this.idleTime * 2.0) * 0.008;
    if (this.recoilTimer <= 0) {
      this.mesh.scale.setScalar(pulse);
    }
  }

  /** Trigger recoil animation when tower fires */
  private triggerRecoil(): void {
    this.recoilTimer = this.recoilDuration;
    // Set intensity based on weapon type
    switch (this.key) {
      case 'cannonTower':
      case 'mortarTower':
        this.recoilIntensity = 0.35;
        this.recoilDuration = 0.2;
        break;
      case 'sniperTower':
        this.recoilIntensity = 0.25;
        this.recoilDuration = 0.15;
        break;
      case 'arrowTower':
        this.recoilIntensity = 0.12;
        this.recoilDuration = 0.1;
        break;
      case 'teslaTower':
      case 'earthquakeTower':
        this.recoilIntensity = 0.15;
        this.recoilDuration = 0.12;
        break;
      default:
        this.recoilIntensity = 0.1;
        this.recoilDuration = 0.1;
        break;
    }
    this.recoilTimer = this.recoilDuration;

    // Trigger muzzle flash light
    this.triggerMuzzleFlash();
  }

  /** Create a brief point light flash when firing */
  private triggerMuzzleFlash(): void {
    // Determine flash color and intensity per weapon type
    let color = 0xffcc44;
    let intensity = 3;
    let distance = 6;

    switch (this.key) {
      case 'fireTower':
      case 'flamethrowerTower':
        color = 0xff6600; intensity = 4; distance = 8; break;
      case 'iceTower':
        color = 0x88ddff; intensity = 3; distance = 6; break;
      case 'teslaTower':
        color = 0xaa44ff; intensity = 5; distance = 8; break;
      case 'cannonTower':
      case 'mortarTower':
        color = 0xff8800; intensity = 5; distance = 10; break;
      case 'poisonTower':
        color = 0x44ff44; intensity = 2; distance = 5; break;
      case 'laserTower':
        color = 0xff4444; intensity = 3; distance = 6; break;
      case 'mageTower':
        color = 0xaa66ff; intensity = 3; distance = 7; break;
      case 'sniperTower':
        color = 0xffffaa; intensity = 6; distance = 8; break;
      default:
        color = 0xffcc44; intensity = 2; distance = 5; break;
    }

    // Reuse existing light or create new one
    if (!this.muzzleLight) {
      this.muzzleLight = new THREE.PointLight(color, 0, distance);
      this.muzzleLight.castShadow = false;
      this.mesh.add(this.muzzleLight);
    }

    this.muzzleLight.color.setHex(color);
    this.muzzleLight.intensity = intensity;
    this.muzzleLight.distance = distance;
    this.muzzleLight.position.set(0, 2.0, 0);
    this.muzzleLightTimer = 0.12; // flash duration
  }

  /** Animate recoil: quick scale punch then return to normal */
  private updateRecoil(dt: number): void {
    // Update muzzle flash light decay
    if (this.muzzleLightTimer > 0 && this.muzzleLight) {
      this.muzzleLightTimer -= dt;
      const t = Math.max(0, this.muzzleLightTimer / 0.12);
      this.muzzleLight.intensity *= t;
      if (this.muzzleLightTimer <= 0) {
        this.muzzleLight.intensity = 0;
      }
    }

    if (this.recoilTimer <= 0) return;
    this.recoilTimer -= dt;

    const t = Math.max(0, this.recoilTimer / this.recoilDuration); // 1→0
    // Elastic-out curve: quick punch up then settle
    const punch = Math.sin(t * Math.PI) * this.recoilIntensity;

    if (this.turretHead) {
      // Turret punches upward and scales slightly
      this.turretHead.position.y = (this.turretHead.userData.baseY ?? this.turretHead.position.y) + punch * 0.3;
      // Store base Y on first recoil so we don't drift
      if (this.turretHead.userData.baseY === undefined) {
        this.turretHead.userData.baseY = this.turretHead.position.y - punch * 0.3;
      }
    }

    // Whole tower scale punch (subtle)
    const baseLevelScale = 1 + (this.level - 1) * 0.08;
    const scalePunch = baseLevelScale + punch * 0.15;
    this.mesh.scale.setScalar(scalePunch);

    // Reset when done
    if (this.recoilTimer <= 0) {
      this.mesh.scale.setScalar(baseLevelScale);
      if (this.turretHead && this.turretHead.userData.baseY !== undefined) {
        this.turretHead.position.y = this.turretHead.userData.baseY;
      }
    }
  }

  protected abstract fire(target: Enemy, createProjectile: (p: Projectile) => void): void;

  /** Get effective damage including synergy buffs and spec modifiers */
  getEffectiveDamage(): number {
    const synMult = this.synergyBuffs?.damageMult ?? 1;
    const specMult = this.specModifiers?.damageMult ?? 1;
    return Math.floor(this.damage * synMult * specMult);
  }

  /** Get effective range including synergy buffs and spec modifiers */
  getEffectiveRange(): number {
    const synMult = this.synergyBuffs?.rangeMult ?? 1;
    const specMult = this.specModifiers?.rangeMult ?? 1;
    return this.range * synMult * specMult;
  }

  /** Get effective fire rate including synergy buffs, boss debuffs and spec modifiers */
  getEffectiveFireRate(): number {
    const synMult = this.synergyBuffs?.fireRateMult ?? 1;
    const specMult = this.specModifiers?.fireRateMult ?? 1;
    return this.fireRate * synMult * specMult * this.bossDebuffFireRate;
  }

  /** Get spec modifier value by key (used by individual tower fire() methods) */
  getSpecModifier<K extends keyof SpecModifiers>(key: K): SpecModifiers[K] | undefined {
    return this.specModifiers?.[key];
  }

  getStatsText(): string {
    const dmg = this.getEffectiveDamage();
    const rng = this.getEffectiveRange();
    const fr = this.getEffectiveFireRate();
    return `Schaden: ${dmg} | Reichweite: ${rng.toFixed(1)} | Feuerrate: ${fr.toFixed(1)}/s`;
  }
}

// Base class for path traps
export abstract class PathWeapon extends Weapon {
  constructor(key: WeaponKey, gridX: number, gridZ: number) {
    super(key, gridX, gridZ);
  }
}
