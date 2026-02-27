import { UNIT_DEFS, UNIT_TIER_POOLS } from '../units/UnitConfig';
import { AB_COLS, AB_PLAYER_ROWS, AB_ROWS } from './AutoBattleGrid';

export interface EnemyWaveDef {
  units: { unitId: string; starLevel: 1 | 2 | 3; col: number; row: number }[];
  isBoss: boolean;
  bossName?: string;
}

/**
 * Gegner-Team-Generierung für jede Runde im Auto-Kampf-Modus.
 *
 * Rundenskalierung:
 * - Runde 1-3: 2-3 Einheiten, nur Stufe 1, alle Stern 1
 * - Runde 4-6: 3-4 Einheiten, Stufe 1-2, meist Stern 1
 * - Runde 7-9: 4-5 Einheiten, Stufe 1-3, einige Stern 2
 * - Runde 10+: 5-6 Einheiten, alle Stufen, gemischte Sterne
 * - Jede 5. Runde: Boss-Runde (1 Stern-3 + 2-3 Unterstützung)
 *
 * Boss-Namen (Deutsch): "Schattenlord", "Frostkönig", "Flammenkaiser",
 *                        "Blitzhexe", "Giftzauberer"
 */
export class AutoBattleWaves {

  private static readonly BOSS_NAMES = [
    'Schattenlord',
    'Frostkönig',
    'Flammenkaiser',
    'Blitzhexe',
    'Giftzauberer',
  ];

  /** Generate enemy team for a given round */
  static generate(round: number): EnemyWaveDef {
    const isBoss = round > 0 && round % 5 === 0;

    if (isBoss) {
      return AutoBattleWaves.generateBossWave(round);
    }

    return AutoBattleWaves.generateNormalWave(round);
  }

  /** Scale enemy stats based on round number */
  static getRoundScaling(round: number): { hpMult: number; atkMult: number; defMult: number } {
    if (round <= 3) {
      return { hpMult: 1.0, atkMult: 1.0, defMult: 1.0 };
    }
    if (round <= 6) {
      return { hpMult: 1.2, atkMult: 1.1, defMult: 1.05 };
    }
    if (round <= 9) {
      return { hpMult: 1.5, atkMult: 1.3, defMult: 1.15 };
    }
    // Round 10+: progressive scaling
    return {
      hpMult: 1.0 + round * 0.1,
      atkMult: 1.0 + round * 0.05,
      defMult: 1.0 + round * 0.03,
    };
  }

  /** Generate a normal (non-boss) wave */
  private static generateNormalWave(round: number): EnemyWaveDef {
    let unitCount: number;
    let allowedTiers: (1 | 2 | 3 | 4)[];
    let starChances: { star1: number; star2: number; star3: number };

    if (round <= 3) {
      // Early game: few weak units
      unitCount = AutoBattleWaves.randInt(2, 3);
      allowedTiers = [1];
      starChances = { star1: 1.0, star2: 0, star3: 0 };
    } else if (round <= 6) {
      // Mid-early: slightly more, some tier 2
      unitCount = AutoBattleWaves.randInt(3, 4);
      allowedTiers = [1, 2];
      starChances = { star1: 0.85, star2: 0.15, star3: 0 };
    } else if (round <= 9) {
      // Mid: more units, tier 1-3, some upgrades
      unitCount = AutoBattleWaves.randInt(4, 5);
      allowedTiers = [1, 2, 3];
      starChances = { star1: 0.6, star2: 0.35, star3: 0.05 };
    } else {
      // Late: full roster
      unitCount = AutoBattleWaves.randInt(5, 6);
      allowedTiers = [1, 2, 3, 4];
      starChances = { star1: 0.35, star2: 0.45, star3: 0.2 };
    }

    const units: EnemyWaveDef['units'] = [];
    const usedPositions = new Set<string>();

    for (let i = 0; i < unitCount; i++) {
      // Pick random tier (weighted toward lower tiers in early rounds)
      const tier = AutoBattleWaves.pickRandomTier(allowedTiers, round);
      const pool = UNIT_TIER_POOLS[tier];

      if (pool.length === 0) continue;

      // Pick random unit from tier pool
      const unitId = pool[Math.floor(Math.random() * pool.length)];

      // Pick star level
      const starLevel = AutoBattleWaves.rollStarLevel(starChances);

      // Pick position on enemy side (rows 4-7), avoid stacking
      const pos = AutoBattleWaves.findEnemyPosition(usedPositions);
      if (!pos) continue;

      usedPositions.add(`${pos.col},${pos.row}`);
      units.push({ unitId, starLevel, col: pos.col, row: pos.row });
    }

    return { units, isBoss: false };
  }

  /** Generate a boss wave */
  private static generateBossWave(round: number): EnemyWaveDef {
    const usedPositions = new Set<string>();
    const units: EnemyWaveDef['units'] = [];

    // Boss: 1 high-tier unit at star 3
    // Prefer highest available tier
    const bossTierPool = UNIT_TIER_POOLS[4].length > 0 ? UNIT_TIER_POOLS[4] :
                         UNIT_TIER_POOLS[3].length > 0 ? UNIT_TIER_POOLS[3] :
                         UNIT_TIER_POOLS[2];

    if (bossTierPool.length > 0) {
      const bossUnitId = bossTierPool[Math.floor(Math.random() * bossTierPool.length)];
      // Place boss in center of enemy side
      const bossCol = Math.floor(AB_COLS / 2);
      const bossRow = AB_PLAYER_ROWS + 2; // middle of enemy side (row 6)
      usedPositions.add(`${bossCol},${bossRow}`);
      units.push({ unitId: bossUnitId, starLevel: 3, col: bossCol, row: bossRow });
    }

    // Support: 2-3 units around the boss
    const supportCount = AutoBattleWaves.randInt(2, 3);
    // Support tiers depend on round
    const supportTiers: (1 | 2 | 3 | 4)[] = round >= 15 ? [2, 3] : [1, 2];

    for (let i = 0; i < supportCount; i++) {
      const tier = supportTiers[Math.floor(Math.random() * supportTiers.length)];
      const pool = UNIT_TIER_POOLS[tier];
      if (pool.length === 0) continue;

      const unitId = pool[Math.floor(Math.random() * pool.length)];
      const starLevel: 1 | 2 | 3 = round >= 15 ? 2 : 1;
      const pos = AutoBattleWaves.findEnemyPosition(usedPositions);
      if (!pos) continue;

      usedPositions.add(`${pos.col},${pos.row}`);
      units.push({ unitId, starLevel, col: pos.col, row: pos.row });
    }

    // Pick boss name
    const bossIndex = Math.floor((round / 5 - 1) % AutoBattleWaves.BOSS_NAMES.length);
    const bossName = AutoBattleWaves.BOSS_NAMES[bossIndex];

    return { units, isBoss: true, bossName };
  }

  /** Pick a random tier from allowed tiers, weighted by round */
  private static pickRandomTier(allowedTiers: (1 | 2 | 3 | 4)[], round: number): 1 | 2 | 3 | 4 {
    if (allowedTiers.length === 1) return allowedTiers[0];

    // Build weights: higher tiers get more weight in later rounds
    const weights: number[] = allowedTiers.map((tier, _idx) => {
      // Base weight: lower tiers more common
      let w = 1.0;
      if (tier === 1) w = 3.0;
      else if (tier === 2) w = 2.0 + round * 0.1;
      else if (tier === 3) w = 1.0 + round * 0.15;
      else if (tier === 4) w = 0.5 + round * 0.2;
      return w;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < allowedTiers.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return allowedTiers[i];
    }

    return allowedTiers[allowedTiers.length - 1];
  }

  /** Roll star level based on chances */
  private static rollStarLevel(chances: { star1: number; star2: number; star3: number }): 1 | 2 | 3 {
    const roll = Math.random();
    if (roll < chances.star1) return 1;
    if (roll < chances.star1 + chances.star2) return 2;
    return 3;
  }

  /** Find a random position on the enemy side (rows 4-7) not yet used */
  private static findEnemyPosition(usedPositions: Set<string>): { col: number; row: number } | null {
    // Try random placement first (up to 20 attempts)
    for (let attempt = 0; attempt < 20; attempt++) {
      const col = Math.floor(Math.random() * AB_COLS);
      const row = AB_PLAYER_ROWS + Math.floor(Math.random() * (AB_ROWS - AB_PLAYER_ROWS));
      const key = `${col},${row}`;
      if (!usedPositions.has(key)) {
        return { col, row };
      }
    }

    // Fallback: systematic search
    for (let row = AB_PLAYER_ROWS; row < AB_ROWS; row++) {
      for (let col = 0; col < AB_COLS; col++) {
        const key = `${col},${row}`;
        if (!usedPositions.has(key)) {
          return { col, row };
        }
      }
    }

    return null; // All enemy cells are occupied (very unlikely with 32 cells)
  }

  /** Random integer between min and max (inclusive) */
  private static randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
