import { WaveDef, LevelDef, PathSegment, TerrainTheme } from './LevelConfig';
import { ZombieType } from './BalanceConfig';

// ─── Endlosmodus: Unendliche, progressiv schwierigere Wellen ─────────

/** Spezial-Wellenmodifikatoren (alle 10 Wellen, zufällig) */
export type EndlessModifier =
  | 'schnelle_horde'   // Alle Gegner +50% Geschwindigkeit
  | 'gepanzert'        // Alle Gegner +100% HP
  | 'heiler_invasion'  // Dreifache Heiler-Anzahl
  | 'splitter_chaos'   // Alle Gegner sind Splitter
  | 'flug_angriff';    // Alle Gegner sind Flieger

const MODIFIER_NAMES: Record<EndlessModifier, string> = {
  schnelle_horde: 'Schnelle Horde',
  gepanzert: 'Gepanzert',
  heiler_invasion: 'Heiler-Invasion',
  splitter_chaos: 'Splitter-Chaos',
  flug_angriff: 'Flug-Angriff',
};

const MODIFIER_DESCRIPTIONS: Record<EndlessModifier, string> = {
  schnelle_horde: 'Alle Gegner sind 50% schneller!',
  gepanzert: 'Alle Gegner haben doppelte Lebenspunkte!',
  heiler_invasion: 'Dreifache Anzahl an Heilern!',
  splitter_chaos: 'Alle Gegner sind Splitter!',
  flug_angriff: 'Alle Gegner sind Flieger!',
};

const ALL_MODIFIERS: EndlessModifier[] = [
  'schnelle_horde',
  'gepanzert',
  'heiler_invasion',
  'splitter_chaos',
  'flug_angriff',
];

const HIGHSCORE_KEY = 'td_endless_highscore';

// ─── Endlosmodus Pfad (lang und gewunden, basiert auf Level 6) ───────
const endlessPath: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    // Long winding path for endless survival
    for (let z = 0; z <= 4; z++) path.push([5, z]);
    for (let x = 6; x <= 15; x++) path.push([x, 4]);
    for (let z = 5; z <= 9; z++) path.push([15, z]);
    for (let x = 14; x >= 3; x--) path.push([x, 9]);
    for (let z = 10; z <= 14; z++) path.push([3, z]);
    for (let x = 4; x <= 17; x++) path.push([x, 14]);
    for (let z = 15; z <= 19; z++) path.push([17, z]);
    return path;
  })(),
  waypoints: [
    [5, 0], [5, 4], [15, 4], [15, 9], [3, 9], [3, 14], [17, 14], [17, 19],
  ],
};

// ─── Dunkles/apokalyptisches Thema ───────────────────────────────────
const endlessTheme: TerrainTheme = {
  name: 'Ewige Nacht',
  skyColor: 0x020208,
  fogColor: 0x050510,
  fogDensity: 0.01,
  groundColor: 0x0e0e1a,
  groundTextureBase: '#080812',
  groundTextureVariation: { r: [5, 20], g: [5, 15], b: [15, 40] },
  pathColor: 0x2a1a35,
  pathTextureBase: '#1a0a25',
  trunkColor: 0x0a0510,
  leafColors: [0x1a0030, 0x220040, 0x100020],
  rockColor: 0x1a1a2a,
  bushColors: [0x150028, 0x1e0038, 0x0c0018],
  spawnTheme: 'portal',
  ambientColor: 0x8833cc,
  ambientIntensity: 0.25,
  sunColor: 0xcc44ff,
  sunIntensity: 0.4,
};

// ─── Wellenkompositions-Typen je Phase ───────────────────────────────

/** Gegnertypen die in jeder Phase verfuegbar sind */
const PHASE_ENEMY_POOLS: Record<string, ZombieType[]> = {
  early:    ['normal', 'fast'],                                       // Wellen 1-5
  mid:      ['normal', 'fast', 'tank'],                               // Wellen 6-10
  advanced: ['normal', 'fast', 'tank', 'flyer', 'healer'],            // Wellen 11-15
  late:     ['normal', 'fast', 'tank', 'flyer', 'healer', 'splitter'], // Wellen 16+
};

function getPhasePool(waveNumber: number): ZombieType[] {
  if (waveNumber <= 5) return PHASE_ENEMY_POOLS.early;
  if (waveNumber <= 10) return PHASE_ENEMY_POOLS.mid;
  if (waveNumber <= 15) return PHASE_ENEMY_POOLS.advanced;
  return PHASE_ENEMY_POOLS.late;
}

/** Basis-Anzahl fuer jeden Gegnertyp in einer Welle */
function getBaseCount(type: ZombieType, waveNumber: number): number {
  switch (type) {
    case 'normal':  return 5 + waveNumber * 2;
    case 'fast':    return 3 + Math.floor(waveNumber * 1.5);
    case 'tank':    return Math.max(1, Math.floor(waveNumber * 0.6));
    case 'flyer':   return Math.max(1, Math.floor(waveNumber * 0.4));
    case 'healer':  return Math.max(1, Math.floor(waveNumber * 0.3));
    case 'splitter': return Math.max(1, Math.floor(waveNumber * 0.35));
    case 'boss':    return 1;
    default:        return 3;
  }
}

// ─── EndlessMode Klasse ──────────────────────────────────────────────

export class EndlessMode {
  private currentWave: number = 0;
  private highScore: number = 0;
  private activeModifier: EndlessModifier | null = null;

  /** Alle generierten Wellen (wachsendes Array) */
  private generatedWaves: WaveDef[][] = [];

  constructor() {
    this.loadHighScore();
  }

  // ── Wellengeneration ───────────────────────────────────────────────

  /**
   * Generiert die naechste Welle und fuegt sie dem internen Array hinzu.
   * Gibt die WaveDef[] der neuen Welle zurueck.
   */
  generateNextWave(): WaveDef[] {
    this.currentWave++;
    const wave = this.buildWave(this.currentWave);
    this.generatedWaves.push(wave);

    // Highscore aktualisieren
    if (this.currentWave > this.highScore) {
      this.highScore = this.currentWave;
      this.saveHighScore();
    }

    return wave;
  }

  /**
   * Baut eine einzelne Welle basierend auf Wellennummer.
   */
  private buildWave(waveNumber: number): WaveDef[] {
    const isBossWave5 = waveNumber % 5 === 0;
    const isBossWave10 = waveNumber % 10 === 0;

    // Spezialmodifikator alle 10 Wellen
    if (isBossWave10) {
      this.activeModifier = ALL_MODIFIERS[Math.floor(Math.random() * ALL_MODIFIERS.length)];
    } else {
      this.activeModifier = null;
    }

    // Bei Spezialmodifikatoren die ganze Welle ersetzen
    if (this.activeModifier === 'splitter_chaos') {
      return this.buildModifiedWave_SplitterChaos(waveNumber, isBossWave10);
    }
    if (this.activeModifier === 'flug_angriff') {
      return this.buildModifiedWave_FlugAngriff(waveNumber, isBossWave10);
    }

    // Normale Wellenkomposition
    const pool = getPhasePool(waveNumber);
    const countScale = this.getCountScale(waveNumber);
    const wave: WaveDef[] = [];

    for (const type of pool) {
      let count = Math.floor(getBaseCount(type, waveNumber) * countScale);

      // Heiler-Invasion: dreifache Heiler
      if (this.activeModifier === 'heiler_invasion' && type === 'healer') {
        count *= 3;
      }

      if (count > 0) {
        wave.push({ type, count });
      }
    }

    // Mini-Boss alle 5 Wellen
    if (isBossWave5 && !isBossWave10) {
      wave.push({ type: 'boss', count: 1 });
    }

    // Voller Boss + extra alle 10 Wellen
    if (isBossWave10) {
      const bossCount = Math.max(2, Math.floor(waveNumber / 10));
      wave.push({ type: 'boss', count: bossCount });
    }

    return wave;
  }

  /** Splitter-Chaos: Alle Gegner werden zu Splittern */
  private buildModifiedWave_SplitterChaos(waveNumber: number, addBoss: boolean): WaveDef[] {
    const totalCount = Math.floor((10 + waveNumber * 2) * this.getCountScale(waveNumber));
    const wave: WaveDef[] = [{ type: 'splitter', count: totalCount }];
    if (addBoss) {
      wave.push({ type: 'boss', count: Math.max(2, Math.floor(waveNumber / 10)) });
    }
    return wave;
  }

  /** Flug-Angriff: Alle Gegner werden zu Fliegern */
  private buildModifiedWave_FlugAngriff(waveNumber: number, addBoss: boolean): WaveDef[] {
    const totalCount = Math.floor((12 + waveNumber * 2.5) * this.getCountScale(waveNumber));
    const wave: WaveDef[] = [{ type: 'flyer', count: totalCount }];
    if (addBoss) {
      wave.push({ type: 'boss', count: Math.max(2, Math.floor(waveNumber / 10)) });
    }
    return wave;
  }

  // ── Skalierungsmultiplikatoren ─────────────────────────────────────

  /** Set the effective wave for scaling (synced from WaveManager) */
  setEffectiveWave(wave: number): void {
    this.effectiveWave = wave;
  }

  private effectiveWave = 0;

  /** HP-Skalierung: +10% pro Welle (exponentiell) */
  getHpScale(): number {
    const wave = this.effectiveWave || this.currentWave;
    return Math.pow(1.10, wave);
  }

  /** Geschwindigkeitsskalierung: +2% pro Welle, gedeckelt bei +100% */
  getSpeedScale(): number {
    const wave = this.effectiveWave || this.currentWave;
    const base = 1.0 + wave * 0.02;
    // Gepanzert-Modifikator beeinflusst nicht Speed, aber schnelle_horde schon
    const modBonus = this.activeModifier === 'schnelle_horde' ? 1.5 : 1.0;
    return Math.min(base * modBonus, 3.0); // max 3x Geschwindigkeit
  }

  /** HP-Modifikator-Bonus (zusaetzlich zur Skalierung) */
  getHpModifierBonus(): number {
    return this.activeModifier === 'gepanzert' ? 2.0 : 1.0;
  }

  /** Gold-Skalierung: +5% pro Welle */
  getGoldScale(): number {
    const wave = this.effectiveWave || this.currentWave;
    return 1.0 + wave * 0.05;
  }

  /** Gegner-Anzahl-Skalierung: +5% pro Welle */
  private getCountScale(waveNumber: number): number {
    return 1.0 + (waveNumber - 1) * 0.05;
  }

  // ── Wellenstatus ───────────────────────────────────────────────────

  /** Aktuelle Wellennummer (1-basiert) */
  getWave(): number {
    return this.currentWave;
  }

  /** Aktiver Spezialmodifikator (oder null) */
  getActiveModifier(): EndlessModifier | null {
    return this.activeModifier;
  }

  /** Name des aktiven Modifikators */
  getActiveModifierName(): string | null {
    return this.activeModifier ? MODIFIER_NAMES[this.activeModifier] : null;
  }

  /** Beschreibung des aktiven Modifikators */
  getActiveModifierDescription(): string | null {
    return this.activeModifier ? MODIFIER_DESCRIPTIONS[this.activeModifier] : null;
  }

  /** Ob die aktuelle Welle eine Bosswelle ist */
  isBossWave(): boolean {
    return this.currentWave % 5 === 0;
  }

  // ── Highscore ──────────────────────────────────────────────────────

  getHighScore(): number {
    return this.highScore;
  }

  saveHighScore(): void {
    try {
      localStorage.setItem(HIGHSCORE_KEY, this.highScore.toString());
    } catch {
      // localStorage nicht verfuegbar
    }
  }

  loadHighScore(): void {
    try {
      const stored = localStorage.getItem(HIGHSCORE_KEY);
      if (stored) {
        this.highScore = parseInt(stored, 10) || 0;
      }
    } catch {
      this.highScore = 0;
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────

  /** Setzt den Modus fuer einen neuen Durchlauf zurueck */
  reset(): void {
    this.currentWave = 0;
    this.activeModifier = null;
    this.generatedWaves = [];
  }

  // ── Alle generierten Wellen abrufen ────────────────────────────────

  /** Gibt alle bisher generierten Wellen zurueck */
  getGeneratedWaves(): WaveDef[][] {
    return this.generatedWaves;
  }

  // ── Statische LevelDef-Erstellung ──────────────────────────────────

  /**
   * Erstellt eine LevelDef die mit dem bestehenden System kompatibel ist.
   * Generiert initial 20 Wellen; weitere koennen dynamisch hinzugefuegt werden.
   */
  static createEndlessLevelDef(): LevelDef {
    const mode = new EndlessMode();
    const initialWaves: WaveDef[][] = [];

    // 20 initiale Wellen generieren
    for (let i = 0; i < 20; i++) {
      initialWaves.push(mode.generateNextWave());
    }

    return {
      id: 99,
      name: 'Endlosmodus',
      description: 'Unendliche Wellen mit steigender Schwierigkeit. Wie weit kommst du?',
      gridSize: 20,
      path: endlessPath,
      waves: initialWaves,
      theme: endlessTheme,
      startGold: 150,
      baseHP: 2000,
      gameMode: 'survival',
    };
  }

  /**
   * Erweitert eine bestehende LevelDef um zusaetzliche Wellen.
   * Nuetzlich wenn der Spieler ueber die initialen 20 Wellen hinauskommt.
   */
  extendLevelWaves(levelDef: LevelDef, count: number = 10): void {
    for (let i = 0; i < count; i++) {
      levelDef.waves.push(this.generateNextWave());
    }
  }
}

// ─── Hilfsfunktionen fuer externe Nutzung ────────────────────────────

/** Modifikator-Name fuer UI-Anzeige */
export function getModifierDisplayName(mod: EndlessModifier): string {
  return MODIFIER_NAMES[mod];
}

/** Modifikator-Beschreibung fuer UI-Anzeige */
export function getModifierDisplayDescription(mod: EndlessModifier): string {
  return MODIFIER_DESCRIPTIONS[mod];
}

/** Alle verfuegbaren Modifikatoren */
export function getAllModifiers(): EndlessModifier[] {
  return [...ALL_MODIFIERS];
}
