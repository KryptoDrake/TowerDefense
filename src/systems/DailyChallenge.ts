import { LEVELS } from './LevelConfig';
import { BALANCE, WeaponKey, WEAPON_KEYS } from './BalanceConfig';
import type { RunModifiers } from './RunManager';

// ─── Types ──────────────────────────────────────────────

export interface DailyChallengeModifier {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Apply multipliers to RunModifiers */
  applyRunMods?: (mods: RunModifiers) => void;
  /** Special flags consumed by game systems (not expressible via RunModifiers alone) */
  specialFlags?: Partial<DailyChallengeFlags>;
}

export interface DailyChallengeFlags {
  onlyTraps: boolean;
  onlyTowers: boolean;
  noGoldPerKill: boolean;
  healerInvasion: boolean;
  flyerSwarm: boolean;
  autoWaveForced: boolean;
  autoWaveDelay: number;
  maxTowersOverride: number | null;
  splitterRain: boolean;
  bossRush: boolean;
}

export interface DailyChallengeData {
  date: string;           // YYYY-MM-DD (UTC)
  levelIndex: number;     // which level to use (0-6)
  modifiers: string[];    // active modifier IDs
  seed: number;           // deterministic seed
  completed: boolean;     // has player completed today's challenge
  crystalReward: number;  // calculated reward
}

// ─── Modifier Definitions ───────────────────────────────

const ALL_MODIFIERS: DailyChallengeModifier[] = [
  {
    id: 'nur_fallen',
    name: 'Nur Fallen',
    description: 'Nur Fallen erlaubt - keine Türme!',
    icon: '\u26A0',
    specialFlags: { onlyTraps: true },
  },
  {
    id: 'nur_tuerme',
    name: 'Nur Türme',
    description: 'Nur Türme erlaubt - keine Fallen!',
    icon: '\u{1F3F0}',
    specialFlags: { onlyTowers: true },
  },
  {
    id: 'doppelte_hp',
    name: 'Doppelte HP',
    description: 'Alle Gegner haben doppelte Lebenspunkte.',
    icon: '\u2764',
    applyRunMods: (m) => { m.enemyHpMult *= 2.0; },
  },
  {
    id: 'schnelle_horde',
    name: 'Schnelle Horde',
    description: 'Alle Gegner bewegen sich 75% schneller.',
    icon: '\u{1F3C3}',
    applyRunMods: (m) => { m.enemySpeedMult *= 1.75; },
  },
  {
    id: 'knapper_geldbeutel',
    name: 'Knapper Geldbeutel',
    description: 'Du startest mit nur 50% des normalen Goldes.',
    icon: '\u{1F4B0}',
    applyRunMods: (m) => { m.goldMult *= 0.5; },
  },
  {
    id: 'kein_gold_pro_kill',
    name: 'Kein Gold pro Kill',
    description: 'Kein Gold durch getötete Gegner - nur Wellengold.',
    icon: '\u{1F480}',
    specialFlags: { noGoldPerKill: true },
  },
  {
    id: 'heiler_invasion',
    name: 'Heiler-Invasion',
    description: '50% der Gegner werden durch Heiler ersetzt.',
    icon: '\u{1F49A}',
    specialFlags: { healerInvasion: true },
  },
  {
    id: 'flieger_schwarm',
    name: 'Flieger-Schwarm',
    description: '50% der Gegner werden durch Flieger ersetzt.',
    icon: '\u{1F985}',
    specialFlags: { flyerSwarm: true },
  },
  {
    id: 'kurzer_pfad',
    name: 'Kurzer Pfad',
    description: 'Gegner bewegen sich 30% schneller auf dem Pfad.',
    icon: '\u27A1',
    applyRunMods: (m) => { m.enemySpeedMult *= 1.3; },
  },
  {
    id: 'zeitdruck',
    name: 'Zeitdruck',
    description: 'Auto-Welle erzwungen! Nur 3 Sekunden zwischen Wellen.',
    icon: '\u23F1',
    specialFlags: { autoWaveForced: true, autoWaveDelay: 3 },
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Maximal 5 Türme/Fallen gleichzeitig erlaubt.',
    icon: '\u270B',
    specialFlags: { maxTowersOverride: 5 },
  },
  {
    id: 'glaskanone',
    name: 'Glaskanone',
    description: 'Türme verursachen 2x Schaden, aber die Basis hat nur 50% HP.',
    icon: '\u{1F4A5}',
    applyRunMods: (m) => { m.damageMult *= 2.0; m.hpMult *= 0.5; },
  },
  {
    id: 'splitter_regen',
    name: 'Splitter-Regen',
    description: 'Alle getöteten Gegner spalten sich wie Splitter.',
    icon: '\u{1F4A2}',
    specialFlags: { splitterRain: true },
  },
  {
    id: 'boss_rush',
    name: 'Boss-Rush',
    description: 'Jede dritte Welle enthält einen zusätzlichen Boss.',
    icon: '\u{1F451}',
    specialFlags: { bossRush: true },
  },
];

// Modifiers that conflict (cannot both be active)
const CONFLICT_PAIRS: [string, string][] = [
  ['nur_fallen', 'nur_tuerme'],
  ['schnelle_horde', 'kurzer_pfad'],
];

// ─── Helpers ────────────────────────────────────────────

function getTodayUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getModifierById(id: string): DailyChallengeModifier | undefined {
  return ALL_MODIFIERS.find((mod) => mod.id === id);
}

/** Get all weapon keys categorized */
export function getTrapKeys(): WeaponKey[] {
  return WEAPON_KEYS.filter(
    (k) => (BALANCE.weapons[k] as { isPath?: boolean }).isPath === true,
  );
}

export function getTowerKeys(): WeaponKey[] {
  return WEAPON_KEYS.filter(
    (k) => (BALANCE.weapons[k] as { isPath?: boolean }).isPath !== true,
  );
}

// ─── Storage key ────────────────────────────────────────

const STORAGE_KEY = 'td_daily_challenge';

// ─── DailyChallenge Class ───────────────────────────────

export class DailyChallenge {
  private data: DailyChallengeData;

  constructor() {
    this.data = this.loadOrGenerate();
  }

  // ── Public API ──────────────────────────────────────

  /** Get today's challenge data (regenerates if date has changed). */
  getToday(): DailyChallengeData {
    const today = getTodayUTC();
    if (this.data.date !== today) {
      this.data = this.generateChallenge(today);
      this.save();
    }
    return { ...this.data };
  }

  /** Mark today's challenge as completed and return crystal reward. */
  complete(): number {
    if (this.data.completed) return 0;
    this.data.completed = true;
    this.save();
    return this.data.crystalReward;
  }

  /** Check if today's challenge has already been completed. */
  isCompleted(): boolean {
    this.ensureFresh();
    return this.data.completed;
  }

  /** Get the crystal reward for today's challenge. */
  getReward(): number {
    return this.data.crystalReward;
  }

  /** Get active modifier objects for today's challenge. */
  getActiveModifiers(): DailyChallengeModifier[] {
    return this.data.modifiers
      .map((id) => getModifierById(id))
      .filter((m): m is DailyChallengeModifier => m !== undefined);
  }

  /** Get modifier descriptions formatted for UI display. */
  getModifierDescriptions(): { id: string; name: string; description: string; icon: string }[] {
    return this.getActiveModifiers().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      icon: m.icon,
    }));
  }

  /** Get the level definition for today's challenge. */
  getChallengeLevel() {
    this.ensureFresh();
    return LEVELS[this.data.levelIndex];
  }

  /**
   * Build RunModifiers reflecting today's challenge.
   * Start from defaults (all 1.0) and apply each active modifier.
   */
  getRunModifiers(): RunModifiers {
    const mods: RunModifiers = {
      damageMult: 1,
      fireRateMult: 1,
      rangeMult: 1,
      goldMult: 1,
      hpMult: 1,
      costMult: 1,
      enemySpeedMult: 1,
      enemyHpMult: 1,
      splashRadiusMult: 1,
      dotMult: 1,
      slowMult: 1,
    };

    for (const mod of this.getActiveModifiers()) {
      if (mod.applyRunMods) {
        mod.applyRunMods(mods);
      }
    }

    return mods;
  }

  /** Aggregate all special flags from active modifiers. */
  getSpecialFlags(): DailyChallengeFlags {
    const flags: DailyChallengeFlags = {
      onlyTraps: false,
      onlyTowers: false,
      noGoldPerKill: false,
      healerInvasion: false,
      flyerSwarm: false,
      autoWaveForced: false,
      autoWaveDelay: 5,
      maxTowersOverride: null,
      splitterRain: false,
      bossRush: false,
    };

    for (const mod of this.getActiveModifiers()) {
      if (mod.specialFlags) {
        if (mod.specialFlags.onlyTraps) flags.onlyTraps = true;
        if (mod.specialFlags.onlyTowers) flags.onlyTowers = true;
        if (mod.specialFlags.noGoldPerKill) flags.noGoldPerKill = true;
        if (mod.specialFlags.healerInvasion) flags.healerInvasion = true;
        if (mod.specialFlags.flyerSwarm) flags.flyerSwarm = true;
        if (mod.specialFlags.autoWaveForced) flags.autoWaveForced = true;
        if (mod.specialFlags.autoWaveDelay !== undefined) flags.autoWaveDelay = mod.specialFlags.autoWaveDelay;
        if (mod.specialFlags.maxTowersOverride !== undefined && mod.specialFlags.maxTowersOverride !== null) {
          flags.maxTowersOverride = mod.specialFlags.maxTowersOverride;
        }
        if (mod.specialFlags.splitterRain) flags.splitterRain = true;
        if (mod.specialFlags.bossRush) flags.bossRush = true;
      }
    }

    return flags;
  }

  /** Get the list of allowed weapon keys based on challenge modifiers. */
  getAllowedWeapons(): WeaponKey[] {
    const flags = this.getSpecialFlags();
    if (flags.onlyTraps) return getTrapKeys();
    if (flags.onlyTowers) return getTowerKeys();
    return [...WEAPON_KEYS];
  }

  // ── Challenge Card HTML ─────────────────────────────

  /** Render the challenge card HTML for hub/UI display. */
  renderChallengeCard(): string {
    this.ensureFresh();

    const level = LEVELS[this.data.levelIndex];
    const mods = this.getModifierDescriptions();
    const completed = this.data.completed;

    const dateFormatted = this.formatDateGerman(this.data.date);

    const modifiersHTML = mods
      .map(
        (m) => `
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          border-left: 3px solid #ff6600;
        ">
          <span style="font-size: 20px; min-width: 28px; text-align: center;">${m.icon}</span>
          <div>
            <div style="font-weight: bold; color: #ffcc44; font-size: 14px;">${m.name}</div>
            <div style="color: #ccc; font-size: 12px;">${m.description}</div>
          </div>
        </div>`,
      )
      .join('');

    const completedBadge = completed
      ? `<div style="
          position: absolute;
          top: 12px;
          right: 12px;
          background: linear-gradient(135deg, #44cc66, #22aa44);
          color: #fff;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 13px;
          box-shadow: 0 2px 8px rgba(34,170,68,0.4);
        ">Abgeschlossen!</div>`
      : '';

    const buttonHTML = completed
      ? `<div style="
          text-align: center;
          padding: 12px;
          background: rgba(68,204,102,0.15);
          border-radius: 8px;
          color: #44cc66;
          font-weight: bold;
          font-size: 15px;
        ">Bereits abgeschlossen - komm morgen wieder!</div>`
      : `<button id="daily-challenge-start-btn" style="
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #ff8800, #ff5500);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: bold;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 4px 15px rgba(255,85,0,0.4);
          font-family: inherit;
        "
        onmouseover="this.style.transform='scale(1.03)';this.style.boxShadow='0 6px 20px rgba(255,85,0,0.6)'"
        onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 15px rgba(255,85,0,0.4)'"
        >Herausforderung starten</button>`;

    return `
      <div id="daily-challenge-card" style="
        position: relative;
        background: linear-gradient(145deg, #1a1a2e, #16213e);
        border: 2px solid #ff6600;
        border-radius: 14px;
        padding: 24px;
        max-width: 420px;
        color: #eee;
        font-family: 'Segoe UI', Arial, sans-serif;
        box-shadow: 0 8px 32px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05);
      ">
        ${completedBadge}

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #ff8844;
            margin-bottom: 4px;
          ">${dateFormatted}</div>
          <div style="
            font-size: 22px;
            font-weight: bold;
            background: linear-gradient(90deg, #ff8800, #ffcc00);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          ">T\u00e4gliche Herausforderung</div>
        </div>

        <!-- Level Info -->
        <div style="
          text-align: center;
          padding: 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          margin-bottom: 16px;
        ">
          <div style="font-size: 13px; color: #aaa;">Level</div>
          <div style="font-size: 18px; font-weight: bold; color: #fff;">${level.name}</div>
          <div style="font-size: 12px; color: #888; margin-top: 2px;">${level.theme.name}</div>
        </div>

        <!-- Modifiers -->
        <div style="
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        ">
          <div style="
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #ff6600;
            margin-bottom: 2px;
          ">Modifikatoren</div>
          ${modifiersHTML}
        </div>

        <!-- Reward -->
        <div style="
          text-align: center;
          padding: 10px;
          background: linear-gradient(135deg, rgba(255,204,0,0.1), rgba(255,136,0,0.1));
          border: 1px solid rgba(255,204,0,0.3);
          border-radius: 8px;
          margin-bottom: 16px;
        ">
          <div style="font-size: 12px; color: #aaa;">Belohnung</div>
          <div style="font-size: 24px; font-weight: bold; color: #ffcc00;">
            ${this.data.crystalReward} <span style="font-size: 14px;">Kristalle</span>
          </div>
        </div>

        <!-- Button -->
        ${buttonHTML}
      </div>
    `;
  }

  // ── Seeded Random ───────────────────────────────────

  /** Deterministic hash from date string. */
  private seedFromDate(dateStr: string): number {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /** Mulberry32 PRNG returning a function that yields [0, 1) on each call. */
  private seededRandom(seed: number): () => number {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Generation ──────────────────────────────────────

  /** Generate a deterministic challenge for the given UTC date string. */
  private generateChallenge(dateStr: string): DailyChallengeData {
    const seed = this.seedFromDate(dateStr);
    const rng = this.seededRandom(seed);

    // Pick a level (0-6)
    const levelIndex = Math.floor(rng() * LEVELS.length);

    // Pick 2-3 modifiers
    const modCount = rng() < 0.5 ? 2 : 3;

    // Shuffle modifier pool deterministically
    const pool = ALL_MODIFIERS.map((m) => m.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Pick modifiers, respecting conflicts
    const chosen: string[] = [];
    for (const id of pool) {
      if (chosen.length >= modCount) break;

      // Check conflicts with already chosen
      const hasConflict = chosen.some((existingId) =>
        CONFLICT_PAIRS.some(
          ([a, b]) =>
            (a === id && b === existingId) || (b === id && a === existingId),
        ),
      );

      if (!hasConflict) {
        chosen.push(id);
      }
    }

    // Crystal reward: 50 base + 25 per modifier
    const crystalReward = 50 + chosen.length * 25;

    return {
      date: dateStr,
      levelIndex,
      modifiers: chosen,
      seed,
      completed: false,
      crystalReward,
    };
  }

  // ── Persistence ─────────────────────────────────────

  private save(): void {
    try {
      const payload = {
        date: this.data.date,
        completed: this.data.completed,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage may be unavailable - silently ignore
    }
  }

  private load(): { date: string; completed: boolean } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { date?: string; completed?: boolean };
      if (typeof parsed.date === 'string' && typeof parsed.completed === 'boolean') {
        return { date: parsed.date, completed: parsed.completed };
      }
    } catch {
      // Corrupted data - ignore
    }
    return null;
  }

  /** Load from storage or generate fresh. */
  private loadOrGenerate(): DailyChallengeData {
    const today = getTodayUTC();
    const saved = this.load();

    if (saved && saved.date === today) {
      // Same day - restore completion state into generated data
      const challenge = this.generateChallenge(today);
      challenge.completed = saved.completed;
      return challenge;
    }

    // New day or no save
    const challenge = this.generateChallenge(today);
    this.data = challenge;
    this.save();
    return challenge;
  }

  /** Ensure data is for today (handles midnight rollover during session). */
  private ensureFresh(): void {
    const today = getTodayUTC();
    if (this.data.date !== today) {
      this.data = this.generateChallenge(today);
      this.save();
    }
  }

  // ── Formatting helpers ──────────────────────────────

  /** Format YYYY-MM-DD to German-style date. */
  private formatDateGerman(dateStr: string): string {
    const [y, m, d] = dateStr.split('-');
    const months = [
      'Januar', 'Februar', 'M\u00e4rz', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
    ];
    const monthName = months[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)}. ${monthName} ${y}`;
  }
}
