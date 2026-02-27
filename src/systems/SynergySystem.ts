import * as THREE from 'three';
import { Weapon, TowerWeapon } from '../weapons/Weapon';
import { WeaponKey } from './BalanceConfig';

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  requires: [WeaponKey, WeaponKey];
  color: number;
  /** Max distance in world units between towers for synergy to activate */
  maxDistance: number;
}

export interface ActiveSynergy {
  def: SynergyDef;
  towers: [Weapon, Weapon];
}

export interface SynergyBuffs {
  damageMult: number;
  fireRateMult: number;
  rangeMult: number;
  splashRadiusMult: number;
  /** Extra chain targets for tesla-like effects */
  extraChain: number;
  /** Apply DoT on hit (from sniper+fire synergy) */
  synergyDot: number;
  synergyDotDuration: number;
  /** Extra slow strength (additive factor reduction) */
  extraSlowFactor: number;
  /** Extra DoT duration multiplier */
  dotDurationMult: number;
}

const DEFAULT_BUFFS: SynergyBuffs = {
  damageMult: 1,
  fireRateMult: 1,
  rangeMult: 1,
  splashRadiusMult: 1,
  extraChain: 0,
  synergyDot: 0,
  synergyDotDuration: 0,
  extraSlowFactor: 0,
  dotDurationMult: 1,
};

/** Synergy-typed colors for connection lines and badges */
const SYNERGY_COLORS: Record<string, number> = {
  frostbrand: 0xff8844,      // orange-ish (ice+fire)
  lightning_rod: 0xffff44,    // yellow (tesla+arrow)
  toxic_fog: 0x44ff88,        // green (poison+ice)
  artillery_net: 0xff6644,    // red-orange (cannon+mortar)
  precision_fire: 0xff4444,   // red (sniper+fire)
  storm_front: 0x44aaff,      // blue (tesla+ice)
};

export const SYNERGY_DEFS: SynergyDef[] = [
  {
    id: 'frostbrand',
    name: 'Frostbrand',
    description: 'Eis + Feuer: +30% Schaden für beide',
    requires: ['iceTower', 'fireTower'],
    color: 0xff8844,
    maxDistance: 10,
  },
  {
    id: 'lightning_rod',
    name: 'Blitzableiter',
    description: 'Tesla + Pfeil: Pfeile erhalten Kettenblitz',
    requires: ['teslaTower', 'arrowTower'],
    color: 0xffff44,
    maxDistance: 10,
  },
  {
    id: 'toxic_fog',
    name: 'Giftiger Nebel',
    description: 'Gift + Eis: Gift verlangsamt, DoT +50% Dauer',
    requires: ['poisonTower', 'iceTower'],
    color: 0x44ff88,
    maxDistance: 10,
  },
  {
    id: 'artillery_net',
    name: 'Artillerie-Netz',
    description: 'Kanone + Mörser: +20% Splash-Radius',
    requires: ['cannonTower', 'mortarTower'],
    color: 0xff6644,
    maxDistance: 10,
  },
  {
    id: 'precision_fire',
    name: 'Präzisionsfeuer',
    description: 'Sniper + Feuer: Sniper entzündet Gegner',
    requires: ['sniperTower', 'fireTower'],
    color: 0xff4444,
    maxDistance: 12,
  },
  {
    id: 'storm_front',
    name: 'Sturmfront',
    description: 'Tesla + Eis: Blitze frieren Gegner ein',
    requires: ['teslaTower', 'iceTower'],
    color: 0x44aaff,
    maxDistance: 10,
  },
];

/** Metadata for a single synergy connection line */
interface SynergyLineInfo {
  line: THREE.Line;
  synergyId: string;
  color: number;
  /** Time remaining for the formation flash (seconds, starts at 0.5) */
  flashTimer: number;
}

/** Metadata for a synergy badge floating above a tower */
interface SynergyBadgeInfo {
  mesh: THREE.Mesh;
  synergyId: string;
  color: number;
  baseY: number;
}

export class SynergySystem {
  private activeSynergies: ActiveSynergy[] = [];
  private weaponBuffs = new Map<Weapon, SynergyBuffs>();
  private lineInfos: SynergyLineInfo[] = [];
  private badgeInfos: SynergyBadgeInfo[] = [];
  private scene: THREE.Scene;
  private pulseTimer = 0;
  private lastWeaponCount = -1;
  private recalcTimer = 0;

  /** Track previously active synergy pair keys to detect new formations */
  private previousSynergyKeys = new Set<string>();

  /** Callback when a new synergy is formed (name) */
  onNewSynergy: ((name: string) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Recalculate synergies based on currently placed weapons */
  update(weapons: Weapon[], dt: number): void {
    this.pulseTimer += dt;
    this.recalcTimer -= dt;

    // Only recalculate when weapon count changes or every 0.5s
    if (weapons.length !== this.lastWeaponCount || this.recalcTimer <= 0) {
      this.lastWeaponCount = weapons.length;
      this.recalcTimer = 0.5;
      this.recalculate(weapons);
    }

    // Animate synergy connection lines (pulse opacity between 0.3 and 0.8)
    const basePulse = 0.55 + Math.sin(this.pulseTimer * 3) * 0.25;
    // basePulse oscillates between 0.3 and 0.8

    for (const info of this.lineInfos) {
      const mat = info.line.material as THREE.LineDashedMaterial;

      // Formation flash: override opacity to 1.0, then fade back over 0.5s
      if (info.flashTimer > 0) {
        info.flashTimer -= dt;
        const flashFactor = Math.max(0, info.flashTimer / 0.5);
        // Blend from 1.0 (full flash) to basePulse
        mat.opacity = basePulse + (1.0 - basePulse) * flashFactor;
      } else {
        mat.opacity = basePulse;
      }
    }

    // Animate synergy badges: gentle float + rotation
    for (const badge of this.badgeInfos) {
      badge.mesh.position.y = badge.baseY + Math.sin(this.pulseTimer * 2) * 0.1;
      badge.mesh.rotation.y = this.pulseTimer * 1.5;
      // Pulse badge opacity in sync with lines
      const badgeMat = badge.mesh.material as THREE.MeshBasicMaterial;
      badgeMat.opacity = basePulse;
    }
  }

  private recalculate(weapons: Weapon[]): void {
    // Clear old buffs
    this.weaponBuffs.clear();

    // Clear old visuals (lines)
    for (const info of this.lineInfos) {
      this.scene.remove(info.line);
      info.line.geometry.dispose();
      (info.line.material as THREE.Material).dispose();
    }
    this.lineInfos = [];

    // Clear old badges
    for (const badge of this.badgeInfos) {
      this.scene.remove(badge.mesh);
      badge.mesh.geometry.dispose();
      (badge.mesh.material as THREE.Material).dispose();
    }
    this.badgeInfos = [];

    this.activeSynergies = [];

    // Build new set of active synergy pair keys
    const newSynergyKeys = new Set<string>();

    // Track which weapons already have a badge for a given synergy to avoid duplicates
    const weaponBadges = new Set<string>();

    // Check each synergy definition
    for (const def of SYNERGY_DEFS) {
      const [typeA, typeB] = def.requires;
      const synergyColor = SYNERGY_COLORS[def.id] ?? def.color;

      // Find all towers matching each type
      const towersA = weapons.filter(w => w.key === typeA);
      const towersB = weapons.filter(w => w.key === typeB);

      for (const a of towersA) {
        for (const b of towersB) {
          const dist = a.mesh.position.distanceTo(b.mesh.position);
          if (dist <= def.maxDistance) {
            this.activeSynergies.push({ def, towers: [a, b] });
            this.applySynergyBuffs(def, a, b);

            // Build unique key for this pair
            const idA = `${a.mesh.position.x},${a.mesh.position.z}`;
            const idB = `${b.mesh.position.x},${b.mesh.position.z}`;
            const pairKey = `${def.id}:${idA}-${idB}`;
            newSynergyKeys.add(pairKey);

            // Determine if this is a newly formed synergy
            const isNew = !this.previousSynergyKeys.has(pairKey);

            // Fire callback for newly formed synergies
            if (isNew && this.onNewSynergy) {
              this.onNewSynergy(def.name);
            }

            // Create visual connection line
            this.createVisualConnection(a, b, synergyColor, def.id, isNew);

            // Create badges on each tower (only once per weapon per synergy type)
            const badgeKeyA = `${def.id}:${idA}`;
            if (!weaponBadges.has(badgeKeyA)) {
              weaponBadges.add(badgeKeyA);
              this.createSynergyBadge(a, synergyColor, def.id);
            }
            const badgeKeyB = `${def.id}:${idB}`;
            if (!weaponBadges.has(badgeKeyB)) {
              weaponBadges.add(badgeKeyB);
              this.createSynergyBadge(b, synergyColor, def.id);
            }
          }
        }
      }
    }

    // Update the previous synergy keys for next recalc
    this.previousSynergyKeys = newSynergyKeys;
  }

  private applySynergyBuffs(def: SynergyDef, a: Weapon, b: Weapon): void {
    const buffsA = this.getOrCreateBuffs(a);
    const buffsB = this.getOrCreateBuffs(b);

    switch (def.id) {
      case 'frostbrand':
        // Ice + Fire: +30% damage for both
        buffsA.damageMult *= 1.3;
        buffsB.damageMult *= 1.3;
        break;

      case 'lightning_rod': {
        // Tesla + Arrow: Arrows get 1 chain target
        // Arrow is type B, Tesla is type A
        const arrowBuff = a.key === 'arrowTower' ? buffsA : buffsB;
        arrowBuff.extraChain += 1;
        break;
      }

      case 'toxic_fog': {
        // Poison + Ice: Poison DoT lasts 50% longer, adds slow
        const poisonBuff = a.key === 'poisonTower' ? buffsA : buffsB;
        poisonBuff.dotDurationMult *= 1.5;
        poisonBuff.extraSlowFactor = 0.2;
        break;
      }

      case 'artillery_net':
        // Cannon + Mortar: +20% splash radius
        buffsA.splashRadiusMult *= 1.2;
        buffsB.splashRadiusMult *= 1.2;
        break;

      case 'precision_fire': {
        // Sniper + Fire: Sniper shots apply DoT
        const sniperBuff = a.key === 'sniperTower' ? buffsA : buffsB;
        sniperBuff.synergyDot = 15;
        sniperBuff.synergyDotDuration = 3;
        break;
      }

      case 'storm_front': {
        // Tesla + Ice: Chain lightning applies strong slow
        const teslaBuff = a.key === 'teslaTower' ? buffsA : buffsB;
        teslaBuff.extraSlowFactor = 0.8; // near-freeze
        break;
      }
    }
  }

  private getOrCreateBuffs(weapon: Weapon): SynergyBuffs {
    let buffs = this.weaponBuffs.get(weapon);
    if (!buffs) {
      buffs = { ...DEFAULT_BUFFS };
      this.weaponBuffs.set(weapon, buffs);
    }
    return buffs;
  }

  private createVisualConnection(a: Weapon, b: Weapon, color: number, synergyId: string, isNew: boolean): void {
    const posA = a.mesh.position.clone();
    posA.y = 1.5;
    const posB = b.mesh.position.clone();
    posB.y = 1.5;

    // Create a curved line between the two towers
    const mid = posA.clone().add(posB).multiplyScalar(0.5);
    mid.y += 1.5; // arc upward

    const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
    const points = curve.getPoints(20);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Use LineDashedMaterial for a stylish dashed glow effect
    const material = new THREE.LineDashedMaterial({
      color,
      transparent: true,
      opacity: isNew ? 1.0 : 0.55,
      linewidth: 1,
      dashSize: 0.4,
      gapSize: 0.15,
    });

    const line = new THREE.Line(geometry, material);
    // computeLineDistances is required for dashed lines to render correctly
    line.computeLineDistances();

    this.scene.add(line);
    this.lineInfos.push({
      line,
      synergyId,
      color,
      flashTimer: isNew ? 0.5 : 0,
    });
  }

  /** Create a small diamond-shaped badge floating above a tower */
  private createSynergyBadge(weapon: Weapon, color: number, synergyId: string): void {
    const badgeGeom = new THREE.OctahedronGeometry(0.15);
    const badgeMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });
    const badge = new THREE.Mesh(badgeGeom, badgeMat);
    badge.name = 'synergy-badge';

    const baseY = weapon.mesh.position.y + 2.5;
    badge.position.set(
      weapon.mesh.position.x,
      baseY,
      weapon.mesh.position.z,
    );

    this.scene.add(badge);
    this.badgeInfos.push({
      mesh: badge,
      synergyId,
      color,
      baseY,
    });
  }

  /** Get the combined synergy buffs for a specific weapon */
  getBuffsForWeapon(weapon: Weapon): SynergyBuffs {
    return this.weaponBuffs.get(weapon) || { ...DEFAULT_BUFFS };
  }

  /** Get all active synergies */
  getActiveSynergies(): ActiveSynergy[] {
    return this.activeSynergies;
  }

  /** Get synergies involving a specific weapon */
  getSynergiesForWeapon(weapon: Weapon): ActiveSynergy[] {
    return this.activeSynergies.filter(
      s => s.towers[0] === weapon || s.towers[1] === weapon
    );
  }

  reset(): void {
    this.activeSynergies = [];
    this.weaponBuffs.clear();

    // Clean up lines
    for (const info of this.lineInfos) {
      this.scene.remove(info.line);
      info.line.geometry.dispose();
      (info.line.material as THREE.Material).dispose();
    }
    this.lineInfos = [];

    // Clean up badges
    for (const badge of this.badgeInfos) {
      this.scene.remove(badge.mesh);
      badge.mesh.geometry.dispose();
      (badge.mesh.material as THREE.Material).dispose();
    }
    this.badgeInfos = [];

    this.previousSynergyKeys.clear();
    this.pulseTimer = 0;
    this.lastWeaponCount = -1;
    this.recalcTimer = 0;
  }
}
