// Tower Specialization / Skill-Tree System
// When a tower reaches max level (3), the player can choose one of 2 specializations.

import { Weapon } from '../weapons/Weapon';
import { WeaponKey } from './BalanceConfig';

// ─── Modifier interface ────────────────────────────────────────────────────────

export interface SpecModifiers {
  damageMult?: number;
  fireRateMult?: number;
  rangeMult?: number;
  splashRadiusMult?: number;
  extraProjectiles?: number;
  pierceCount?: number;
  critChance?: number;
  critMult?: number;
  chainTargets?: number;
  slowFactor?: number;
  slowDuration?: number;
  dotDamageMult?: number;
  dotDurationMult?: number;
  stunDurationMult?: number;
  coneSizeMult?: number;
  minionCount?: number;
  healRateMult?: number;
  /** Identifier for special abilities that need custom logic in tower update */
  special?: string;
}

// ─── Specialization definition ─────────────────────────────────────────────────

export interface Specialization {
  id: string;
  name: string;         // German UI name
  description: string;  // German description
  weaponKey: WeaponKey;
  modifiers: SpecModifiers;
}

// ─── All specialization definitions (2 per tower type) ─────────────────────────

const SPEC_DEFINITIONS: Record<string, [Specialization, Specialization]> = {
  // 1. ArrowTower
  arrowTower: [
    {
      id: 'arrow_multi',
      name: 'Mehrfachschuss',
      description: 'Feuert 3 Pfeile pro Schuss in Fächerform.',
      weaponKey: 'arrowTower',
      modifiers: { extraProjectiles: 2, special: 'fan_spread' },
    },
    {
      id: 'arrow_pierce',
      name: 'Durchschuss',
      description: 'Pfeile durchbohren 2 Gegner.',
      weaponKey: 'arrowTower',
      modifiers: { pierceCount: 2 },
    },
  ],

  // 2. CannonTower
  cannonTower: [
    {
      id: 'cannon_mega',
      name: 'Megabombe',
      description: '+100% Explosionsradius, +50% Schaden.',
      weaponKey: 'cannonTower',
      modifiers: { splashRadiusMult: 2.0, damageMult: 1.5 },
    },
    {
      id: 'cannon_rapid',
      name: 'Schnellfeuer',
      description: '+200% Feuerrate, -30% Schaden.',
      weaponKey: 'cannonTower',
      modifiers: { fireRateMult: 3.0, damageMult: 0.7 },
    },
  ],

  // 3. IceTower
  iceTower: [
    {
      id: 'ice_freeze',
      name: 'Tiefkühlung',
      description: 'Friert Gegner 2s komplett ein statt Verlangsamung.',
      weaponKey: 'iceTower',
      modifiers: { slowFactor: 0.0, slowDuration: 2.0, special: 'freeze' },
    },
    {
      id: 'ice_field',
      name: 'Frostfeld',
      description: 'Verlangsamungszone wird dauerhaft (3×3 Zellen).',
      weaponKey: 'iceTower',
      modifiers: { special: 'frost_field' },
    },
  ],

  // 4. FireTower
  fireTower: [
    {
      id: 'fire_inferno',
      name: 'Inferno',
      description: 'Brandschaden breitet sich auf nahe Gegner aus.',
      weaponKey: 'fireTower',
      modifiers: { special: 'dot_spread' },
    },
    {
      id: 'fire_storm',
      name: 'Feuersturm',
      description: '+300% Feuerrate – massiver Flammenhagel.',
      weaponKey: 'fireTower',
      modifiers: { fireRateMult: 4.0 },
    },
  ],

  // 5. SniperTower
  sniperTower: [
    {
      id: 'sniper_crit',
      name: 'Kopfschuss',
      description: '30% Chance auf 3-fachen kritischen Schaden.',
      weaponKey: 'sniperTower',
      modifiers: { critChance: 0.3, critMult: 3.0 },
    },
    {
      id: 'sniper_true',
      name: 'Durchdringung',
      description: 'Ignoriert 50% der gegnerischen HP (wahrer Schaden).',
      weaponKey: 'sniperTower',
      modifiers: { special: 'true_damage_50' },
    },
  ],

  // 6. TeslaTower
  teslaTower: [
    {
      id: 'tesla_chain',
      name: 'Blitzkette',
      description: 'Kettenblitz trifft bis zu 6 Ziele (statt 3).',
      weaponKey: 'teslaTower',
      modifiers: { chainTargets: 6 },
    },
    {
      id: 'tesla_aura',
      name: 'Energiefeld',
      description: 'Konstante AoE-Schadensaura – keine Projektile nötig.',
      weaponKey: 'teslaTower',
      modifiers: { special: 'damage_aura' },
    },
  ],

  // 7. MortarTower
  mortarTower: [
    {
      id: 'mortar_napalm',
      name: 'Napalm',
      description: 'Hinterlässt brennenden Boden für 5s (Flächenschaden).',
      weaponKey: 'mortarTower',
      modifiers: { special: 'napalm_zone', dotDamageMult: 1.0, dotDurationMult: 5.0 },
    },
    {
      id: 'mortar_scatter',
      name: 'Streufeuer',
      description: 'Feuert 3 Geschosse gleichzeitig an verschiedene Positionen.',
      weaponKey: 'mortarTower',
      modifiers: { extraProjectiles: 2, special: 'scatter_fire' },
    },
  ],

  // 8. PoisonTower
  poisonTower: [
    {
      id: 'poison_plague',
      name: 'Seuche',
      description: 'Gift breitet sich zwischen Gegnern aus.',
      weaponKey: 'poisonTower',
      modifiers: { special: 'poison_spread' },
    },
    {
      id: 'poison_paralyze',
      name: 'Lähmung',
      description: 'Gift verlangsamt Gegner stark (20% Geschwindigkeit).',
      weaponKey: 'poisonTower',
      modifiers: { slowFactor: 0.2, slowDuration: 4.0 },
    },
  ],

  // 9. LaserTower
  laserTower: [
    {
      id: 'laser_ramp',
      name: 'Steigerung',
      description: 'Schaden steigt +20%/s auf dasselbe Ziel.',
      weaponKey: 'laserTower',
      modifiers: { special: 'damage_ramp' },
    },
    {
      id: 'laser_split',
      name: 'Spaltung',
      description: 'Strahl spaltet sich und trifft 2 zusätzliche Gegner.',
      weaponKey: 'laserTower',
      modifiers: { special: 'beam_split', extraProjectiles: 2 },
    },
  ],

  // 10. WindTower
  windTower: [
    {
      id: 'wind_tornado',
      name: 'Tornado',
      description: 'Erzeugt Wirbel, der Gegner rückwärts zieht.',
      weaponKey: 'windTower',
      modifiers: { special: 'tornado_pull' },
    },
    {
      id: 'wind_storm_shield',
      name: 'Sturmschild',
      description: 'Nahegelegene Türme erhalten +30% Reichweite.',
      weaponKey: 'windTower',
      modifiers: { rangeMult: 1.3, special: 'aura_range' },
    },
  ],

  // 11. MageTower
  mageTower: [
    {
      id: 'mage_arcane',
      name: 'Arkanbombe',
      description: 'Projektile explodieren beim Aufprall (Splash 2.0).',
      weaponKey: 'mageTower',
      modifiers: { splashRadiusMult: 2.0, special: 'arcane_splash' },
    },
    {
      id: 'mage_teleport',
      name: 'Teleport',
      description: 'Teleportiert getroffene Gegner auf dem Pfad zurück.',
      weaponKey: 'mageTower',
      modifiers: { special: 'teleport_back' },
    },
  ],

  // 12. FlamethrowerTower
  flamethrowerTower: [
    {
      id: 'flame_dragon',
      name: 'Drachenatem',
      description: '+100% Reichweite, breiterer Flammenkegel.',
      weaponKey: 'flamethrowerTower',
      modifiers: { rangeMult: 2.0, coneSizeMult: 1.5 },
    },
    {
      id: 'flame_wall',
      name: 'Brandmauer',
      description: 'Erzeugt Feuerwand quer über den Pfad.',
      weaponKey: 'flamethrowerTower',
      modifiers: { special: 'fire_wall' },
    },
  ],

  // 13. BarrierTower
  barrierTower: [
    {
      id: 'barrier_time',
      name: 'Zeitblase',
      description: 'Gegner in der Zone bewegen sich mit 10% Geschwindigkeit.',
      weaponKey: 'barrierTower',
      modifiers: { slowFactor: 0.1, special: 'time_bubble' },
    },
    {
      id: 'barrier_shield',
      name: 'Schutzschild',
      description: 'Reduziert Schaden an der Basis durch nahe Gegner um 30%.',
      weaponKey: 'barrierTower',
      modifiers: { special: 'base_shield_30' },
    },
  ],

  // 14. NecromancerTower
  necromancerTower: [
    {
      id: 'necro_army',
      name: 'Armee',
      description: 'Beschwört 5 Skelette gleichzeitig.',
      weaponKey: 'necromancerTower',
      modifiers: { minionCount: 5 },
    },
    {
      id: 'necro_soul',
      name: 'Seelenraub',
      description: 'Getötete Gegner verkürzen Abklingzeiten nahgelegener Türme.',
      weaponKey: 'necromancerTower',
      modifiers: { special: 'soul_steal' },
    },
  ],

  // 15. EarthquakeTower
  earthquakeTower: [
    {
      id: 'quake_tectonic',
      name: 'Tektonik',
      description: 'Doppelte Stun-Dauer, +50% Schaden.',
      weaponKey: 'earthquakeTower',
      modifiers: { stunDurationMult: 2.0, damageMult: 1.5 },
    },
    {
      id: 'quake_chain',
      name: 'Erdstoß',
      description: 'Erdbeben löst Kettenreaktion mit reduzierter Stärke aus.',
      weaponKey: 'earthquakeTower',
      modifiers: { special: 'quake_chain' },
    },
  ],

  // 16. HealTower
  healTower: [
    {
      id: 'heal_overcharge',
      name: 'Überladung',
      description: 'Doppelte Heilrate, heilt auch HP nahgelegener Türme (visuell).',
      weaponKey: 'healTower',
      modifiers: { healRateMult: 2.0, special: 'heal_towers' },
    },
    {
      id: 'heal_aura',
      name: 'Aura',
      description: 'Alle Türme in Reichweite erhalten permanent +20% Feuerrate.',
      weaponKey: 'healTower',
      modifiers: { fireRateMult: 1.2, special: 'aura_fire_rate' },
    },
  ],
};

// ─── Tower Specialization System ───────────────────────────────────────────────

export class TowerSpecialization {
  /** Definitions keyed by weaponKey */
  private specializations: Map<string, [Specialization, Specialization]>;
  /** Track which towers have been specialized (keyed by tower instance) */
  private applied: Map<Weapon, Specialization>;

  constructor() {
    this.specializations = new Map();
    this.applied = new Map();

    // Load all definitions
    for (const [weaponKey, specs] of Object.entries(SPEC_DEFINITIONS)) {
      this.specializations.set(weaponKey, specs);
    }
  }

  // ─── Query Methods ─────────────────────────────────────────────────────

  /** Get specialization options for a weapon type. Returns null if weapon has no specs. */
  getOptions(weaponKey: string): [Specialization, Specialization] | null {
    return this.specializations.get(weaponKey) ?? null;
  }

  /** Check whether a tower can be specialized (must be level 3 and not yet specialized) */
  canSpecialize(tower: Weapon): boolean {
    if (tower.level < 3) return false;
    if (this.applied.has(tower)) return false;
    const opts = this.specializations.get(tower.key);
    return opts !== undefined;
  }

  /** Check if a tower is already specialized */
  isSpecialized(tower: Weapon): boolean {
    return this.applied.has(tower);
  }

  /** Get the applied specialization (or null) */
  getApplied(tower: Weapon): Specialization | null {
    return this.applied.get(tower) ?? null;
  }

  // ─── Apply / Remove ────────────────────────────────────────────────────

  /** Apply a specialization to a tower (0 = option A, 1 = option B) */
  apply(tower: Weapon, specIndex: 0 | 1): void {
    if (this.applied.has(tower)) return; // already specialized

    const opts = this.specializations.get(tower.key);
    if (!opts) return;

    const spec = opts[specIndex];
    this.applied.set(tower, spec);
  }

  /** Remove specialization tracking for a tower (e.g. when sold) */
  remove(tower: Weapon): void {
    this.applied.delete(tower);
  }

  /** Clear all tracked specializations (e.g. level reset) */
  reset(): void {
    this.applied.clear();
  }

  // ─── UI: Choice Dialog ─────────────────────────────────────────────────

  /**
   * Render HTML for a modal dialog showing 2 specialization choices side by side.
   * Returns an HTML string ready to be injected into the DOM.
   */
  renderChoiceDialog(weaponKey: string): string {
    const opts = this.specializations.get(weaponKey);
    if (!opts) return '';

    const [specA, specB] = opts;

    return `
<div id="spec-dialog-overlay" style="
  position:fixed; inset:0; z-index:10000;
  background:rgba(0,0,0,0.75);
  display:flex; align-items:center; justify-content:center;
  font-family:'Segoe UI',Tahoma,sans-serif;
">
  <div style="
    background:#1a1a2e; border-radius:12px; padding:24px 28px;
    max-width:720px; width:90%;
    box-shadow:0 8px 32px rgba(0,0,0,0.6);
    color:#e0e0e0;
  ">
    <h2 style="
      text-align:center; margin:0 0 8px 0; font-size:22px;
      color:#ffd700; text-shadow:0 0 8px rgba(255,215,0,0.4);
    ">Spezialisierung wählen</h2>
    <p style="text-align:center; margin:0 0 20px 0; font-size:14px; color:#aaa;">
      Dein Turm hat Stufe 3 erreicht! Wähle eine Spezialisierung:
    </p>
    <div style="display:flex; gap:16px;">
      ${this.renderSpecCard(specA, 0, '#4488ff', '#223366')}
      ${this.renderSpecCard(specB, 1, '#ff4444', '#662222')}
    </div>
    <div style="text-align:center; margin-top:16px;">
      <button id="spec-cancel-btn" style="
        background:#333; color:#aaa; border:1px solid #555;
        padding:8px 20px; border-radius:6px; cursor:pointer;
        font-size:13px;
      ">Abbrechen</button>
    </div>
  </div>
</div>`;
  }

  /** Render a single specialization card */
  private renderSpecCard(spec: Specialization, index: number, borderColor: string, bgColor: string): string {
    const modLines = this.formatModifiers(spec.modifiers);
    return `
<div class="spec-card" data-spec-index="${index}" style="
  flex:1; background:${bgColor}; border:2px solid ${borderColor};
  border-radius:10px; padding:18px; cursor:pointer;
  transition:transform 0.15s, box-shadow 0.15s;
  position:relative; overflow:hidden;
" onmouseover="this.style.transform='scale(1.03)';this.style.boxShadow='0 4px 20px ${borderColor}66';"
   onmouseout="this.style.transform='';this.style.boxShadow='';">
  <h3 style="margin:0 0 8px 0; font-size:18px; color:${borderColor};">
    ${spec.name}
  </h3>
  <p style="margin:0 0 12px 0; font-size:13px; color:#ccc; line-height:1.5;">
    ${spec.description}
  </p>
  ${modLines.length > 0 ? `
  <div style="
    background:rgba(0,0,0,0.3); border-radius:6px; padding:8px 10px;
    font-size:12px; line-height:1.7;
  ">
    ${modLines.join('<br>')}
  </div>` : ''}
  <div style="
    position:absolute; bottom:8px; right:12px;
    font-size:11px; color:${borderColor}88;
  ">Option ${index === 0 ? 'A' : 'B'}</div>
</div>`;
  }

  /** Format modifiers into human-readable German stat lines */
  private formatModifiers(mods: SpecModifiers): string[] {
    const lines: string[] = [];

    if (mods.damageMult !== undefined && mods.damageMult !== 1.0) {
      const pct = Math.round((mods.damageMult - 1) * 100);
      const sign = pct >= 0 ? '+' : '';
      lines.push(`<span style="color:${pct >= 0 ? '#88ff88' : '#ff8888'}">⚔ Schaden: ${sign}${pct}%</span>`);
    }

    if (mods.fireRateMult !== undefined && mods.fireRateMult !== 1.0) {
      const pct = Math.round((mods.fireRateMult - 1) * 100);
      lines.push(`<span style="color:#88ff88">⚡ Feuerrate: +${pct}%</span>`);
    }

    if (mods.rangeMult !== undefined && mods.rangeMult !== 1.0) {
      const pct = Math.round((mods.rangeMult - 1) * 100);
      lines.push(`<span style="color:#88ff88">🎯 Reichweite: +${pct}%</span>`);
    }

    if (mods.splashRadiusMult !== undefined && mods.splashRadiusMult !== 1.0) {
      const pct = Math.round((mods.splashRadiusMult - 1) * 100);
      lines.push(`<span style="color:#88ff88">💥 Splash-Radius: +${pct}%</span>`);
    }

    if (mods.extraProjectiles !== undefined && mods.extraProjectiles > 0) {
      lines.push(`<span style="color:#88ddff">🏹 +${mods.extraProjectiles} zusätzliche Projektile</span>`);
    }

    if (mods.pierceCount !== undefined && mods.pierceCount > 0) {
      lines.push(`<span style="color:#88ddff">➤ Durchbohrt ${mods.pierceCount} Gegner</span>`);
    }

    if (mods.critChance !== undefined && mods.critChance > 0) {
      const critPct = Math.round(mods.critChance * 100);
      const critMultPct = mods.critMult !== undefined ? `${mods.critMult}x` : '';
      lines.push(`<span style="color:#ffdd44">★ ${critPct}% Kritische Treffer ${critMultPct}</span>`);
    }

    if (mods.chainTargets !== undefined && mods.chainTargets > 0) {
      lines.push(`<span style="color:#cc88ff">⚡ Kettenblitz: ${mods.chainTargets} Ziele</span>`);
    }

    if (mods.slowFactor !== undefined) {
      if (mods.slowFactor === 0) {
        lines.push(`<span style="color:#88ccff">❄ Einfrieren statt Verlangsamung</span>`);
      } else {
        const speedPct = Math.round(mods.slowFactor * 100);
        lines.push(`<span style="color:#88ccff">❄ Gegner-Geschwindigkeit: ${speedPct}%</span>`);
      }
    }

    if (mods.stunDurationMult !== undefined && mods.stunDurationMult > 1.0) {
      const pct = Math.round((mods.stunDurationMult - 1) * 100);
      lines.push(`<span style="color:#ffaa44">⏱ Stun-Dauer: +${pct}%</span>`);
    }

    if (mods.coneSizeMult !== undefined && mods.coneSizeMult > 1.0) {
      const pct = Math.round((mods.coneSizeMult - 1) * 100);
      lines.push(`<span style="color:#ff8844">🔥 Flammenkegel: +${pct}% breiter</span>`);
    }

    if (mods.minionCount !== undefined && mods.minionCount > 0) {
      lines.push(`<span style="color:#aa88ff">💀 Beschwört ${mods.minionCount} Skelette</span>`);
    }

    if (mods.healRateMult !== undefined && mods.healRateMult > 1.0) {
      const pct = Math.round((mods.healRateMult - 1) * 100);
      lines.push(`<span style="color:#44ff88">💚 Heilrate: +${pct}%</span>`);
    }

    return lines;
  }
}
