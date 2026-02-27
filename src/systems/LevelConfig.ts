import { ZombieType } from './BalanceConfig';

export interface WaveDef {
  type: ZombieType;
  count: number;
}

export interface PathSegment {
  /** Grid coordinates forming the path */
  cells: [number, number][];
  /** Waypoints (turning points) in grid coordinates */
  waypoints: [number, number][];
}

export interface TerrainTheme {
  /** Name of the theme */
  name: string;
  /** Sky/background color */
  skyColor: number;
  /** Fog color and density */
  fogColor: number;
  fogDensity: number;
  /** Ground texture colors */
  groundColor: number;
  groundTextureBase: string; // hex CSS color for canvas texture base
  groundTextureVariation: { r: [number, number]; g: [number, number]; b: [number, number] };
  /** Path texture colors */
  pathColor: number;
  pathTextureBase: string;
  /** Tree trunk and leaf colors */
  trunkColor: number;
  leafColors: number[];
  /** Rock color */
  rockColor: number;
  /** Bush colors */
  bushColors: number[];
  /** Spawn area settings */
  spawnTheme: 'graveyard' | 'portal' | 'swamp';
  /** Ambient light color & intensity */
  ambientColor: number;
  ambientIntensity: number;
  /** Sun color & intensity */
  sunColor: number;
  sunIntensity: number;
}

export type GameMode = 'tower_defense' | 'auto_battle' | 'arena' | 'survival' | 'auto_battle_tft' | 'arena_turnbased';

export interface LevelDef {
  id: number;
  name: string;
  description: string;
  gridSize: number;
  path: PathSegment;
  waves: WaveDef[][];
  theme: TerrainTheme;
  /** Starting gold for this level */
  startGold: number;
  /** Base HP for this level */
  baseHP: number;
  /** Game mode for this level (defaults to tower_defense) */
  gameMode?: GameMode;
  /** For arena mode: max towers allowed */
  maxTowers?: number;
  /** Is this the final boss level? */
  isFinalBoss?: boolean;
  /** Mode phases for final boss (cycles through modes) */
  bossPhases?: GameMode[];
}

// ─── Level 1: Friedhofswiese ───────────────────────────
const level1Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    for (let z = 0; z <= 5; z++) path.push([3, z]);
    for (let x = 4; x <= 9; x++) path.push([x, 5]);
    for (let z = 6; z <= 10; z++) path.push([9, z]);
    for (let x = 8; x >= 3; x--) path.push([x, 10]);
    for (let z = 11; z <= 15; z++) path.push([3, z]);
    for (let x = 4; x <= 16; x++) path.push([x, 15]);
    for (let z = 16; z <= 19; z++) path.push([16, z]);
    return path;
  })(),
  waypoints: [
    [3, 0], [3, 5], [9, 5], [9, 10], [3, 10], [3, 15], [16, 15], [16, 19],
  ],
};

const level1Theme: TerrainTheme = {
  name: 'Friedhofswiese',
  skyColor: 0x78b8e0,
  fogColor: 0xa8d8ea,
  fogDensity: 0.008,
  groundColor: 0x5a9a35,
  groundTextureBase: '#4a9030',
  groundTextureVariation: { r: [40, 80], g: [100, 180], b: [20, 50] },
  pathColor: 0x9a7530,
  pathTextureBase: '#8a6520',
  trunkColor: 0x6b4226,
  leafColors: [0x2d7a1e, 0x358222, 0x2a6b18, 0x3d8a28],
  rockColor: 0x888880,
  bushColors: [0x3a8825, 0x4a9a30, 0x2d7520],
  spawnTheme: 'graveyard',
  ambientColor: 0xc8d8f0,
  ambientIntensity: 0.5,
  sunColor: 0xffeedd,
  sunIntensity: 1.4,
};

const level1Waves: WaveDef[][] = [
  [{ type: 'normal', count: 8 }],
  [{ type: 'normal', count: 12 }],
  [{ type: 'normal', count: 10 }, { type: 'fast', count: 5 }],
  [{ type: 'fast', count: 15 }],
  [{ type: 'normal', count: 10 }, { type: 'tank', count: 3 }],
  [{ type: 'fast', count: 12 }, { type: 'tank', count: 5 }],
  [{ type: 'normal', count: 15 }, { type: 'fast', count: 10 }, { type: 'tank', count: 3 }],
  [{ type: 'tank', count: 10 }, { type: 'fast', count: 8 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 15 }, { type: 'tank', count: 8 }],
  [{ type: 'normal', count: 10 }, { type: 'fast', count: 10 }, { type: 'tank', count: 5 }, { type: 'boss', count: 1 }],
];

// ─── Level 2: Wuestencanyon ────────────────────────────
const level2Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    // Zigzag through canyon
    for (let z = 0; z <= 4; z++) path.push([10, z]);
    for (let x = 9; x >= 3; x--) path.push([x, 4]);
    for (let z = 5; z <= 8; z++) path.push([3, z]);
    for (let x = 4; x <= 16; x++) path.push([x, 8]);
    for (let z = 9; z <= 12; z++) path.push([16, z]);
    for (let x = 15; x >= 6; x--) path.push([x, 12]);
    for (let z = 13; z <= 16; z++) path.push([6, z]);
    for (let x = 7; x <= 13; x++) path.push([x, 16]);
    for (let z = 17; z <= 19; z++) path.push([13, z]);
    return path;
  })(),
  waypoints: [
    [10, 0], [10, 4], [3, 4], [3, 8], [16, 8], [16, 12], [6, 12], [6, 16], [13, 16], [13, 19],
  ],
};

const level2Theme: TerrainTheme = {
  name: 'Wuestencanyon',
  skyColor: 0xe8c88a,
  fogColor: 0xd8b87a,
  fogDensity: 0.006,
  groundColor: 0xc4a050,
  groundTextureBase: '#b89040',
  groundTextureVariation: { r: [150, 200], g: [120, 160], b: [50, 90] },
  pathColor: 0xa08040,
  pathTextureBase: '#907030',
  trunkColor: 0x8a6a3a,
  leafColors: [0x6a8a30, 0x7a9a38, 0x5a7a28],
  rockColor: 0xaa8866,
  bushColors: [0x808040, 0x909048, 0x707030],
  spawnTheme: 'portal',
  ambientColor: 0xffe8c0,
  ambientIntensity: 0.6,
  sunColor: 0xffcc88,
  sunIntensity: 1.6,
};

const level2Waves: WaveDef[][] = [
  [{ type: 'normal', count: 12 }],
  [{ type: 'normal', count: 10 }, { type: 'fast', count: 8 }],
  [{ type: 'fast', count: 18 }],
  [{ type: 'normal', count: 12 }, { type: 'tank', count: 5 }],
  [{ type: 'fast', count: 15 }, { type: 'tank', count: 5 }, { type: 'flyer', count: 3 }],
  [{ type: 'tank', count: 12 }, { type: 'fast', count: 10 }, { type: 'flyer', count: 5 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 12 }, { type: 'tank', count: 5 }, { type: 'flyer', count: 4 }],
  [{ type: 'tank', count: 15 }, { type: 'fast', count: 12 }, { type: 'flyer', count: 6 }],
  [{ type: 'normal', count: 15 }, { type: 'fast', count: 20 }, { type: 'tank', count: 10 }, { type: 'flyer', count: 5 }],
  [{ type: 'fast', count: 15 }, { type: 'tank', count: 8 }, { type: 'flyer', count: 8 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 20 }, { type: 'tank', count: 12 }, { type: 'flyer', count: 6 }],
  [{ type: 'tank', count: 10 }, { type: 'flyer', count: 10 }, { type: 'boss', count: 2 }],
];

// ─── Level 3: Sumpfland ────────────────────────────────
const level3Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    // Spiral inward
    for (let z = 0; z <= 3; z++) path.push([2, z]);
    for (let x = 3; x <= 17; x++) path.push([x, 3]);
    for (let z = 4; z <= 16; z++) path.push([17, z]);
    for (let x = 16; x >= 5; x--) path.push([x, 16]);
    for (let z = 15; z >= 7; z--) path.push([5, z]);
    for (let x = 6; x <= 14; x++) path.push([x, 7]);
    for (let z = 8; z <= 13; z++) path.push([14, z]);
    for (let x = 13; x >= 8; x--) path.push([x, 13]);
    for (let z = 12; z >= 10; z--) path.push([8, z]);
    for (let x = 9; x <= 11; x++) path.push([x, 10]);
    return path;
  })(),
  waypoints: [
    [2, 0], [2, 3], [17, 3], [17, 16], [5, 16], [5, 7], [14, 7], [14, 13], [8, 13], [8, 10], [11, 10],
  ],
};

const level3Theme: TerrainTheme = {
  name: 'Sumpfland',
  skyColor: 0x556655,
  fogColor: 0x445544,
  fogDensity: 0.015,
  groundColor: 0x3a5530,
  groundTextureBase: '#2a4520',
  groundTextureVariation: { r: [20, 60], g: [50, 100], b: [20, 50] },
  pathColor: 0x5a4a30,
  pathTextureBase: '#4a3a20',
  trunkColor: 0x3a3020,
  leafColors: [0x2a4a1a, 0x325222, 0x224218],
  rockColor: 0x556655,
  bushColors: [0x2a5520, 0x3a6528, 0x1a4518],
  spawnTheme: 'swamp',
  ambientColor: 0x88aa88,
  ambientIntensity: 0.4,
  sunColor: 0xaaccaa,
  sunIntensity: 0.9,
};

const level3Waves: WaveDef[][] = [
  [{ type: 'normal', count: 15 }],
  [{ type: 'fast', count: 20 }],
  [{ type: 'normal', count: 15 }, { type: 'fast', count: 10 }, { type: 'tank', count: 3 }, { type: 'healer', count: 2 }],
  [{ type: 'tank', count: 12 }, { type: 'healer', count: 3 }],
  [{ type: 'fast', count: 25 }, { type: 'tank', count: 5 }, { type: 'flyer', count: 5 }, { type: 'healer', count: 2 }],
  [{ type: 'normal', count: 20 }, { type: 'tank', count: 10 }, { type: 'healer', count: 4 }],
  [{ type: 'fast', count: 20 }, { type: 'tank', count: 10 }, { type: 'flyer', count: 6 }, { type: 'healer', count: 3 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 15 }, { type: 'tank', count: 8 }, { type: 'healer', count: 4 }],
  [{ type: 'tank', count: 15 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 3 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 25 }, { type: 'tank', count: 12 }, { type: 'flyer', count: 6 }, { type: 'healer', count: 5 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 25 }, { type: 'tank', count: 15 }, { type: 'healer', count: 4 }],
  [{ type: 'tank', count: 20 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 5 }, { type: 'boss', count: 2 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 25 }, { type: 'tank', count: 15 }, { type: 'healer', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 30 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 5 }, { type: 'boss', count: 2 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 20 }, { type: 'tank', count: 20 }, { type: 'healer', count: 6 }, { type: 'boss', count: 3 }],
];

// ─── Level 4: Hölle ──────────────────────────────────
const level4Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    // Descending zigzag through hell
    for (let z = 0; z <= 6; z++) path.push([1, z]);
    for (let x = 2; x <= 18; x++) path.push([x, 6]);
    for (let z = 7; z <= 10; z++) path.push([18, z]);
    for (let x = 17; x >= 1; x--) path.push([x, 10]);
    for (let z = 11; z <= 14; z++) path.push([1, z]);
    for (let x = 2; x <= 18; x++) path.push([x, 14]);
    for (let z = 15; z <= 19; z++) path.push([18, z]);
    return path;
  })(),
  waypoints: [
    [1, 0], [1, 6], [18, 6], [18, 10], [1, 10], [1, 14], [18, 14], [18, 19],
  ],
};

const level4Theme: TerrainTheme = {
  name: 'Hölle',
  skyColor: 0x1a0000,
  fogColor: 0x330000,
  fogDensity: 0.012,
  groundColor: 0x2a1510,
  groundTextureBase: '#1a0a05',
  groundTextureVariation: { r: [30, 80], g: [5, 20], b: [0, 15] },
  pathColor: 0x553320,
  pathTextureBase: '#442210',
  trunkColor: 0x1a1010,
  leafColors: [0x551100, 0x661500, 0x440800],
  rockColor: 0x443322,
  bushColors: [0x441100, 0x551500, 0x330800],
  spawnTheme: 'portal',
  ambientColor: 0xff4400,
  ambientIntensity: 0.4,
  sunColor: 0xff6622,
  sunIntensity: 0.8,
};

const level4Waves: WaveDef[][] = [
  [{ type: 'fast', count: 20 }],
  [{ type: 'normal', count: 15 }, { type: 'fast', count: 15 }, { type: 'flyer', count: 4 }],
  [{ type: 'tank', count: 10 }, { type: 'fast', count: 10 }, { type: 'healer', count: 3 }],
  [{ type: 'normal', count: 25 }, { type: 'tank', count: 8 }, { type: 'flyer', count: 6 }],
  [{ type: 'fast', count: 30 }, { type: 'tank', count: 10 }, { type: 'healer', count: 4 }, { type: 'splitter', count: 3 }],
  [{ type: 'tank', count: 15 }, { type: 'flyer', count: 8 }, { type: 'splitter', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 20 }, { type: 'tank', count: 10 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 5 }],
  [{ type: 'fast', count: 25 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 10 }, { type: 'splitter', count: 6 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 25 }, { type: 'tank', count: 20 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 4 }],
  [{ type: 'tank', count: 15 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 8 }, { type: 'boss', count: 3 }],
];

// ─── Level 5: Vulkan-Arena (Arena Mode: nur 3 Tuerme) ──
const level5Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    // Short direct path through center for arena mode
    for (let z = 0; z <= 5; z++) path.push([10, z]);
    for (let x = 9; x >= 5; x--) path.push([x, 5]);
    for (let z = 6; z <= 12; z++) path.push([5, z]);
    for (let x = 6; x <= 14; x++) path.push([x, 12]);
    for (let z = 13; z <= 19; z++) path.push([14, z]);
    return path;
  })(),
  waypoints: [
    [10, 0], [10, 5], [5, 5], [5, 12], [14, 12], [14, 19],
  ],
};

const level5Theme: TerrainTheme = {
  name: 'Vulkan-Arena',
  skyColor: 0x0a0008,
  fogColor: 0x220011,
  fogDensity: 0.01,
  groundColor: 0x1a1020,
  groundTextureBase: '#0a0818',
  groundTextureVariation: { r: [15, 40], g: [10, 25], b: [20, 50] },
  pathColor: 0x442255,
  pathTextureBase: '#331144',
  trunkColor: 0x1a0a20,
  leafColors: [0x440066, 0x550077, 0x330055],
  rockColor: 0x332244,
  bushColors: [0x330055, 0x440066, 0x220044],
  spawnTheme: 'portal',
  ambientColor: 0xaa44ff,
  ambientIntensity: 0.35,
  sunColor: 0xff44aa,
  sunIntensity: 0.7,
};

const level5Waves: WaveDef[][] = [
  [{ type: 'tank', count: 8 }, { type: 'flyer', count: 4 }],
  [{ type: 'fast', count: 25 }, { type: 'tank', count: 5 }, { type: 'healer', count: 3 }],
  [{ type: 'normal', count: 20 }, { type: 'tank', count: 10 }, { type: 'splitter', count: 4 }],
  [{ type: 'fast', count: 20 }, { type: 'tank', count: 12 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 20 }, { type: 'tank', count: 15 }, { type: 'splitter', count: 6 }],
  [{ type: 'tank', count: 20 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 5 }, { type: 'boss', count: 2 }],
];

// ─── Level 6: Endzeit (Survival Mode) ──────────────────
const level6Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    // Long winding path for survival
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

const level6Theme: TerrainTheme = {
  name: 'Endzeit',
  skyColor: 0x050510,
  fogColor: 0x0a0a20,
  fogDensity: 0.008,
  groundColor: 0x151525,
  groundTextureBase: '#0a0a15',
  groundTextureVariation: { r: [10, 30], g: [10, 30], b: [20, 50] },
  pathColor: 0x332244,
  pathTextureBase: '#221133',
  trunkColor: 0x0a0a15,
  leafColors: [0x110022, 0x1a0033, 0x0a0015],
  rockColor: 0x222233,
  bushColors: [0x110022, 0x1a0033, 0x0a0015],
  spawnTheme: 'portal',
  ambientColor: 0x6644aa,
  ambientIntensity: 0.3,
  sunColor: 0xaa66ff,
  sunIntensity: 0.6,
};

const level6Waves: WaveDef[][] = [
  [{ type: 'fast', count: 30 }, { type: 'tank', count: 10 }, { type: 'flyer', count: 6 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 20 }, { type: 'tank', count: 10 }, { type: 'healer', count: 4 }],
  [{ type: 'tank', count: 20 }, { type: 'splitter', count: 5 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 35 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 5 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 30 }, { type: 'tank', count: 20 }, { type: 'splitter', count: 6 }],
  [{ type: 'tank', count: 25 }, { type: 'flyer', count: 12 }, { type: 'healer', count: 6 }, { type: 'splitter', count: 5 }, { type: 'boss', count: 2 }],
  [{ type: 'fast', count: 40 }, { type: 'tank', count: 20 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 8 }, { type: 'boss', count: 2 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 30 }, { type: 'tank', count: 25 }, { type: 'flyer', count: 12 }, { type: 'healer', count: 6 }, { type: 'splitter', count: 8 }, { type: 'boss', count: 3 }],
];

// ─── Level 7: Ultra Endboss ─────────────────────────────
const level7Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    // Straight march with side branches - boss arena
    for (let z = 0; z <= 8; z++) path.push([10, z]);
    for (let x = 9; x >= 4; x--) path.push([x, 8]);
    for (let z = 9; z <= 12; z++) path.push([4, z]);
    for (let x = 5; x <= 15; x++) path.push([x, 12]);
    for (let z = 13; z <= 19; z++) path.push([15, z]);
    return path;
  })(),
  waypoints: [
    [10, 0], [10, 8], [4, 8], [4, 12], [15, 12], [15, 19],
  ],
};

const level7Theme: TerrainTheme = {
  name: 'Endboss-Dimension',
  skyColor: 0x000000,
  fogColor: 0x110022,
  fogDensity: 0.005,
  groundColor: 0x0a0515,
  groundTextureBase: '#050210',
  groundTextureVariation: { r: [5, 20], g: [0, 10], b: [15, 40] },
  pathColor: 0x442266,
  pathTextureBase: '#331155',
  trunkColor: 0x110022,
  leafColors: [0xff0044, 0xff0066, 0xcc0033],
  rockColor: 0x1a0a30,
  bushColors: [0x220044, 0x330055, 0x110033],
  spawnTheme: 'portal',
  ambientColor: 0xff0066,
  ambientIntensity: 0.35,
  sunColor: 0xff2288,
  sunIntensity: 0.5,
};

const level7Waves: WaveDef[][] = [
  // Phase 1: Tower Defense (waves 1-2)
  [{ type: 'fast', count: 20 }, { type: 'tank', count: 10 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 4 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 25 }, { type: 'tank', count: 15 }, { type: 'splitter', count: 6 }],
  // Phase 2: Auto-Battle (waves 3-4)
  [{ type: 'tank', count: 25 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 5 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 35 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 12 }, { type: 'healer', count: 6 }],
  // Phase 3: Arena (waves 5-6)
  [{ type: 'fast', count: 40 }, { type: 'tank', count: 20 }, { type: 'splitter', count: 8 }, { type: 'healer', count: 5 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 25 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 10 }, { type: 'splitter', count: 6 }, { type: 'boss', count: 1 }],
  // Phase 4: Survival (waves 7-8) - ULTRA BOSS
  [{ type: 'normal', count: 35 }, { type: 'fast', count: 30 }, { type: 'tank', count: 20 }, { type: 'flyer', count: 12 }, { type: 'healer', count: 6 }, { type: 'splitter', count: 8 }, { type: 'boss', count: 2 }],
  [{ type: 'flyer', count: 15 }, { type: 'healer', count: 8 }, { type: 'splitter', count: 10 }, { type: 'boss', count: 5 }],
];

// ─── Level 10: Eiskristallhöhle ─────────────────────────
const level10Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    for (let z = 0; z <= 6; z++) path.push([2, z]);
    for (let x = 3; x <= 12; x++) path.push([x, 6]);
    for (let z = 5; z >= 2; z--) path.push([12, z]);
    for (let x = 13; x <= 17; x++) path.push([x, 2]);
    for (let z = 3; z <= 10; z++) path.push([17, z]);
    for (let x = 16; x >= 7; x--) path.push([x, 10]);
    for (let z = 11; z <= 15; z++) path.push([7, z]);
    for (let x = 8; x <= 17; x++) path.push([x, 15]);
    for (let z = 16; z <= 19; z++) path.push([17, z]);
    return path;
  })(),
  waypoints: [
    [2, 0], [2, 6], [12, 6], [12, 2], [17, 2], [17, 10], [7, 10], [7, 15], [17, 15], [17, 19],
  ],
};

const level10Theme: TerrainTheme = {
  name: 'Eiskristallhöhle',
  skyColor: 0xc0d8ee,
  fogColor: 0xb8d0e8,
  fogDensity: 0.01,
  groundColor: 0xd0e8f0,
  groundTextureBase: '#c0d8e8',
  groundTextureVariation: { r: [170, 220], g: [200, 240], b: [220, 255] },
  pathColor: 0x8ab0cc,
  pathTextureBase: '#7aa0bc',
  trunkColor: 0x667788,
  leafColors: [0x88ccee, 0x99ddff, 0x77bbdd, 0xaaeeff],
  rockColor: 0x9ab8cc,
  bushColors: [0x88bbdd, 0x99ccee, 0x77aacc],
  spawnTheme: 'portal',
  ambientColor: 0xccddff,
  ambientIntensity: 0.7,
  sunColor: 0xddeeff,
  sunIntensity: 1.0,
};

const level10Waves: WaveDef[][] = [
  [{ type: 'normal', count: 12 }, { type: 'fast', count: 6 }],
  [{ type: 'fast', count: 18 }, { type: 'tank', count: 3 }],
  [{ type: 'normal', count: 15 }, { type: 'tank', count: 6 }, { type: 'healer', count: 2 }],
  [{ type: 'fast', count: 20 }, { type: 'flyer', count: 5 }, { type: 'healer', count: 3 }],
  [{ type: 'tank', count: 10 }, { type: 'fast', count: 15 }, { type: 'healer', count: 3 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 15 }, { type: 'tank', count: 8 }, { type: 'flyer', count: 4 }],
  [{ type: 'fast', count: 25 }, { type: 'tank', count: 10 }, { type: 'healer', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 20 }, { type: 'tank', count: 10 }, { type: 'flyer', count: 6 }, { type: 'healer', count: 3 }],
];

// ─── Level 11: Dunkelwald ───────────────────────────────
const level11Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    for (let z = 0; z <= 4; z++) path.push([8, z]);
    for (let x = 7; x >= 2; x--) path.push([x, 4]);
    for (let z = 5; z <= 9; z++) path.push([2, z]);
    for (let x = 3; x <= 10; x++) path.push([x, 9]);
    for (let z = 10; z <= 13; z++) path.push([10, z]);
    for (let x = 11; x <= 17; x++) path.push([x, 13]);
    for (let z = 12; z >= 6; z--) path.push([17, z]);
    for (let x = 16; x >= 13; x--) path.push([x, 6]);
    for (let z = 7; z <= 11; z++) path.push([13, z]);
    for (let x = 12; x >= 6; x--) path.push([x, 11]);
    for (let z = 12; z <= 19; z++) path.push([6, z]);
    return path;
  })(),
  waypoints: [
    [8, 0], [8, 4], [2, 4], [2, 9], [10, 9], [10, 13], [17, 13], [17, 6], [13, 6], [13, 11], [6, 11], [6, 19],
  ],
};

const level11Theme: TerrainTheme = {
  name: 'Dunkelwald',
  skyColor: 0x0a1510,
  fogColor: 0x0a2015,
  fogDensity: 0.018,
  groundColor: 0x1a2a18,
  groundTextureBase: '#101a0e',
  groundTextureVariation: { r: [10, 35], g: [20, 50], b: [10, 25] },
  pathColor: 0x3a3020,
  pathTextureBase: '#2a2018',
  trunkColor: 0x1a1008,
  leafColors: [0x0a2a08, 0x0e3510, 0x082208, 0x0a2510],
  rockColor: 0x2a3028,
  bushColors: [0x0a2508, 0x0e300a, 0x081e06],
  spawnTheme: 'swamp',
  ambientColor: 0x44aa55,
  ambientIntensity: 0.25,
  sunColor: 0x88cc88,
  sunIntensity: 0.4,
};

const level11Waves: WaveDef[][] = [
  [{ type: 'fast', count: 22 }],
  [{ type: 'normal', count: 18 }, { type: 'fast', count: 12 }, { type: 'healer', count: 3 }],
  [{ type: 'tank', count: 10 }, { type: 'fast', count: 15 }, { type: 'flyer', count: 4 }],
  [{ type: 'normal', count: 20 }, { type: 'tank', count: 8 }, { type: 'splitter', count: 3 }, { type: 'healer', count: 3 }],
  [{ type: 'fast', count: 25 }, { type: 'tank', count: 10 }, { type: 'flyer', count: 6 }, { type: 'healer', count: 4 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 20 }, { type: 'tank', count: 12 }, { type: 'splitter', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'tank', count: 15 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 5 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 25 }, { type: 'tank', count: 12 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 30 }, { type: 'tank', count: 15 }, { type: 'splitter', count: 6 }, { type: 'boss', count: 2 }],
];

// ─── Level 12: Geisterstadt ─────────────────────────────
const level12Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    for (let z = 0; z <= 3; z++) path.push([16, z]);
    for (let x = 15; x >= 4; x--) path.push([x, 3]);
    for (let z = 4; z <= 7; z++) path.push([4, z]);
    for (let x = 5; x <= 16; x++) path.push([x, 7]);
    for (let z = 8; z <= 11; z++) path.push([16, z]);
    for (let x = 15; x >= 8; x--) path.push([x, 11]);
    for (let z = 12; z <= 15; z++) path.push([8, z]);
    for (let x = 9; x <= 15; x++) path.push([x, 15]);
    for (let z = 16; z <= 19; z++) path.push([15, z]);
    return path;
  })(),
  waypoints: [
    [16, 0], [16, 3], [4, 3], [4, 7], [16, 7], [16, 11], [8, 11], [8, 15], [15, 15], [15, 19],
  ],
};

const level12Theme: TerrainTheme = {
  name: 'Geisterstadt',
  skyColor: 0x2a2530,
  fogColor: 0x3a3540,
  fogDensity: 0.012,
  groundColor: 0x4a4550,
  groundTextureBase: '#3a3540',
  groundTextureVariation: { r: [40, 70], g: [35, 65], b: [50, 80] },
  pathColor: 0x6a6570,
  pathTextureBase: '#5a5560',
  trunkColor: 0x3a3530,
  leafColors: [0x4a4540, 0x555048, 0x3a3530],
  rockColor: 0x5a5560,
  bushColors: [0x3a3530, 0x454040, 0x303028],
  spawnTheme: 'graveyard',
  ambientColor: 0x8888aa,
  ambientIntensity: 0.4,
  sunColor: 0xaaaacc,
  sunIntensity: 0.6,
};

const level12Waves: WaveDef[][] = [
  [{ type: 'fast', count: 25 }, { type: 'flyer', count: 5 }],
  [{ type: 'normal', count: 20 }, { type: 'tank', count: 8 }, { type: 'healer', count: 4 }],
  [{ type: 'fast', count: 20 }, { type: 'tank', count: 10 }, { type: 'splitter', count: 4 }, { type: 'flyer', count: 5 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 18 }, { type: 'tank', count: 12 }, { type: 'healer', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'tank', count: 15 }, { type: 'flyer', count: 10 }, { type: 'splitter', count: 6 }, { type: 'healer', count: 5 }],
  [{ type: 'fast', count: 30 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 4 }, { type: 'splitter', count: 5 }, { type: 'boss', count: 1 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 25 }, { type: 'tank', count: 15 }, { type: 'splitter', count: 8 }, { type: 'healer', count: 5 }, { type: 'boss', count: 2 }],
];

// ─── Level 13: Vulkanschlucht ───────────────────────────
const level13Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    for (let z = 0; z <= 5; z++) path.push([5, z]);
    for (let x = 6; x <= 14; x++) path.push([x, 5]);
    for (let z = 4; z >= 1; z--) path.push([14, z]);
    for (let x = 15; x <= 18; x++) path.push([x, 1]);
    for (let z = 2; z <= 9; z++) path.push([18, z]);
    for (let x = 17; x >= 10; x--) path.push([x, 9]);
    for (let z = 10; z <= 14; z++) path.push([10, z]);
    for (let x = 9; x >= 2; x--) path.push([x, 14]);
    for (let z = 15; z <= 19; z++) path.push([2, z]);
    return path;
  })(),
  waypoints: [
    [5, 0], [5, 5], [14, 5], [14, 1], [18, 1], [18, 9], [10, 9], [10, 14], [2, 14], [2, 19],
  ],
};

const level13Theme: TerrainTheme = {
  name: 'Vulkanschlucht',
  skyColor: 0x1a0500,
  fogColor: 0x2a0a00,
  fogDensity: 0.01,
  groundColor: 0x2a1a10,
  groundTextureBase: '#1a0a05',
  groundTextureVariation: { r: [30, 80], g: [10, 30], b: [0, 10] },
  pathColor: 0x443020,
  pathTextureBase: '#332010',
  trunkColor: 0x1a0a08,
  leafColors: [0x881100, 0xaa2200, 0x660800, 0xcc3300],
  rockColor: 0x332218,
  bushColors: [0x551100, 0x661800, 0x440800],
  spawnTheme: 'portal',
  ambientColor: 0xff4400,
  ambientIntensity: 0.35,
  sunColor: 0xff5522,
  sunIntensity: 0.9,
};

const level13Waves: WaveDef[][] = [
  [{ type: 'tank', count: 12 }, { type: 'fast', count: 15 }],
  [{ type: 'normal', count: 20 }, { type: 'fast', count: 20 }, { type: 'flyer', count: 6 }],
  [{ type: 'tank', count: 15 }, { type: 'healer', count: 5 }, { type: 'splitter', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 30 }, { type: 'tank', count: 12 }, { type: 'flyer', count: 8 }, { type: 'healer', count: 4 }],
  [{ type: 'normal', count: 25 }, { type: 'tank', count: 18 }, { type: 'splitter', count: 6 }, { type: 'healer', count: 5 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 35 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 10 }, { type: 'splitter', count: 8 }, { type: 'healer', count: 5 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 25 }, { type: 'tank', count: 20 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 6 }, { type: 'splitter', count: 6 }, { type: 'boss', count: 2 }],
];

// ─── Level 14: Kristallmine ─────────────────────────────
const level14Path: PathSegment = {
  cells: (() => {
    const path: [number, number][] = [];
    for (let z = 0; z <= 2; z++) path.push([10, z]);
    for (let x = 9; x >= 1; x--) path.push([x, 2]);
    for (let z = 3; z <= 6; z++) path.push([1, z]);
    for (let x = 2; x <= 8; x++) path.push([x, 6]);
    for (let z = 7; z <= 10; z++) path.push([8, z]);
    for (let x = 9; x <= 18; x++) path.push([x, 10]);
    for (let z = 9; z >= 4; z--) path.push([18, z]);
    for (let x = 17; x >= 12; x--) path.push([x, 4]);
    for (let z = 5; z <= 14; z++) path.push([12, z]);
    for (let x = 11; x >= 4; x--) path.push([x, 14]);
    for (let z = 15; z <= 19; z++) path.push([4, z]);
    return path;
  })(),
  waypoints: [
    [10, 0], [10, 2], [1, 2], [1, 6], [8, 6], [8, 10], [18, 10], [18, 4], [12, 4], [12, 14], [4, 14], [4, 19],
  ],
};

const level14Theme: TerrainTheme = {
  name: 'Kristallmine',
  skyColor: 0x0a0a18,
  fogColor: 0x151528,
  fogDensity: 0.014,
  groundColor: 0x1a1a28,
  groundTextureBase: '#10101e',
  groundTextureVariation: { r: [15, 35], g: [15, 35], b: [25, 55] },
  pathColor: 0x2a2a40,
  pathTextureBase: '#1a1a30',
  trunkColor: 0x151520,
  leafColors: [0x4466cc, 0x5577dd, 0x3355bb, 0x66aaff],
  rockColor: 0x2a2a3a,
  bushColors: [0x3344aa, 0x4455bb, 0x223399],
  spawnTheme: 'portal',
  ambientColor: 0x4466cc,
  ambientIntensity: 0.4,
  sunColor: 0x6688ee,
  sunIntensity: 0.5,
};

const level14Waves: WaveDef[][] = [
  [{ type: 'fast', count: 25 }, { type: 'tank', count: 8 }],
  [{ type: 'normal', count: 22 }, { type: 'fast', count: 18 }, { type: 'tank', count: 10 }, { type: 'healer', count: 3 }],
  [{ type: 'tank', count: 18 }, { type: 'flyer', count: 8 }, { type: 'splitter', count: 5 }, { type: 'healer', count: 4 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 30 }, { type: 'tank', count: 15 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 5 }],
  [{ type: 'normal', count: 30 }, { type: 'fast', count: 25 }, { type: 'tank', count: 18 }, { type: 'splitter', count: 8 }, { type: 'healer', count: 5 }, { type: 'boss', count: 1 }],
  [{ type: 'fast', count: 35 }, { type: 'tank', count: 20 }, { type: 'flyer', count: 12 }, { type: 'splitter', count: 8 }, { type: 'healer', count: 6 }],
  [{ type: 'normal', count: 25 }, { type: 'fast', count: 30 }, { type: 'tank', count: 20 }, { type: 'flyer', count: 10 }, { type: 'healer', count: 6 }, { type: 'splitter', count: 10 }, { type: 'boss', count: 3 }],
  [{ type: 'tank', count: 25 }, { type: 'flyer', count: 15 }, { type: 'healer', count: 8 }, { type: 'splitter', count: 10 }, { type: 'boss', count: 4 }],
];

// ─── Auto-Kampf Arena Thema ─────────────────────────────
const autoBattleTheme: TerrainTheme = {
  name: 'Kampfarena',
  skyColor: 0x0a0a2a,
  fogColor: 0x111133,
  fogDensity: 0.008,
  groundColor: 0x1a1a2e,
  groundTextureBase: '#121228',
  groundTextureVariation: { r: [10, 30], g: [10, 30], b: [30, 60] },
  pathColor: 0x2a2a44,
  pathTextureBase: '#1a1a35',
  trunkColor: 0x1a1025,
  leafColors: [0x2a1a50, 0x331a60, 0x1a1040],
  rockColor: 0x2a2a3a,
  bushColors: [0x1a1a40, 0x221a50, 0x141030],
  spawnTheme: 'portal',
  ambientColor: 0x6644aa,
  ambientIntensity: 0.5,
  sunColor: 0x8866cc,
  sunIntensity: 0.6,
};

// ─── All Levels ─────────────────────────────────────────
export const LEVELS: LevelDef[] = [
  // --- Kapitel 1: Anfang ---
  {
    id: 1,
    name: 'Friedhofswiese',
    description: 'Eine ruhige Wiese mit einem alten Friedhof. Die Toten erheben sich...',
    gridSize: 20,
    path: level1Path,
    waves: level1Waves,
    theme: level1Theme,
    startGold: 100,
    baseHP: 1000,
    gameMode: 'tower_defense',
  },
  {
    id: 2,
    name: 'Wüstencanyon',
    description: 'Ein heißer Canyon in der Wüste. Schnelle Gegner nähern sich aus allen Richtungen.',
    gridSize: 20,
    path: level2Path,
    waves: level2Waves,
    theme: level2Theme,
    startGold: 130,
    baseHP: 1200,
    gameMode: 'tower_defense',
  },
  {
    id: 10,
    name: 'Eiskristallhöhle',
    description: 'Eine gefrorene Höhle voller Eiskristalle. Der verschlungene Pfad erfordert kluge Platzierung.',
    gridSize: 20,
    path: level10Path,
    waves: level10Waves,
    theme: level10Theme,
    startGold: 140,
    baseHP: 1300,
    gameMode: 'tower_defense',
  },
  // --- Kapitel 2: Aufstieg ---
  {
    id: 3,
    name: 'Sumpfland',
    description: 'Ein dunkler Sumpf voller Nebel. Der spiralförmige Pfad lässt wenig Raum...',
    gridSize: 20,
    path: level3Path,
    waves: level3Waves,
    theme: level3Theme,
    startGold: 170,
    baseHP: 1500,
    gameMode: 'tower_defense',
  },
  {
    id: 11,
    name: 'Dunkelwald',
    description: 'Ein uralter, finsterer Wald. Zwischen den Bäumen lauern unsichtbare Gefahren.',
    gridSize: 20,
    path: level11Path,
    waves: level11Waves,
    theme: level11Theme,
    startGold: 180,
    baseHP: 1600,
    gameMode: 'tower_defense',
  },
  // --- Spielmodus-Wechsel: Auto-Kampf ---
  {
    id: 8,
    name: 'Kampfarena',
    description: 'TFT-Stil! Kaufe Einheiten, platziere sie auf dem Schlachtfeld und sieh dem Kampf zu.',
    gridSize: 8,
    path: { cells: [], waypoints: [] },
    waves: [],
    theme: autoBattleTheme,
    startGold: 10,
    baseHP: 100,
    gameMode: 'auto_battle_tft' as GameMode,
  },
  // --- Kapitel 3: Härte ---
  {
    id: 12,
    name: 'Geisterstadt',
    description: 'Eine verlassene Stadt. Die Geister vergangener Bewohner helfen den Untoten...',
    gridSize: 20,
    path: level12Path,
    waves: level12Waves,
    theme: level12Theme,
    startGold: 200,
    baseHP: 1800,
    gameMode: 'tower_defense',
  },
  {
    id: 4,
    name: 'Hölle',
    description: 'Die Tore der Hölle haben sich geöffnet. Feuer und Lava soweit das Auge reicht.',
    gridSize: 20,
    path: level4Path,
    waves: level4Waves,
    theme: level4Theme,
    startGold: 200,
    baseHP: 1800,
    gameMode: 'tower_defense',
  },
  {
    id: 5,
    name: 'Vulkan-Arena',
    description: 'Nur 3 Türme erlaubt! Deine Türme kämpfen in einer Arena gegen die Horden.',
    gridSize: 20,
    path: level5Path,
    waves: level5Waves,
    theme: level5Theme,
    startGold: 250,
    baseHP: 2000,
    gameMode: 'arena',
    maxTowers: 3,
  },
  // --- Spielmodus-Wechsel: Arena-Kampf ---
  {
    id: 9,
    name: 'Arena der Helden',
    description: 'Rundenbasierter Kampf! Stelle dein Team zusammen und besiege alle Gegner.',
    gridSize: 0,
    path: { cells: [], waypoints: [] },
    waves: [],
    theme: autoBattleTheme,
    startGold: 0,
    baseHP: 100,
    gameMode: 'arena_turnbased' as GameMode,
  },
  // --- Kapitel 4: Endkampf ---
  {
    id: 13,
    name: 'Vulkanschlucht',
    description: 'Glühende Lava strömt durch die Schlucht. Ein tödlicher Marsch über die Felsbrücken.',
    gridSize: 20,
    path: level13Path,
    waves: level13Waves,
    theme: level13Theme,
    startGold: 230,
    baseHP: 2200,
    gameMode: 'tower_defense',
  },
  {
    id: 14,
    name: 'Kristallmine',
    description: 'Tief unter der Erde leuchten Kristalle in der Dunkelheit. Der Pfad windet sich durch enge Tunnel.',
    gridSize: 20,
    path: level14Path,
    waves: level14Waves,
    theme: level14Theme,
    startGold: 240,
    baseHP: 2400,
    gameMode: 'tower_defense',
  },
  {
    id: 6,
    name: 'Endzeit',
    description: 'Überlebe so lange wie möglich! Die Wellen werden immer stärker.',
    gridSize: 20,
    path: level6Path,
    waves: level6Waves,
    theme: level6Theme,
    startGold: 250,
    baseHP: 2500,
    gameMode: 'survival',
  },
  {
    id: 7,
    name: 'Ultra Endboss',
    description: 'Der finale Kampf! Alle Spielmodi werden durchlaufen. Besiege den Endgegner!',
    gridSize: 20,
    path: level7Path,
    waves: level7Waves,
    theme: level7Theme,
    startGold: 300,
    baseHP: 3000,
    isFinalBoss: true,
    bossPhases: ['tower_defense', 'auto_battle', 'arena', 'survival'],
  },
];
