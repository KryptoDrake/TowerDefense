// Unit-Fabrik: Erstellt Einheiten-Instanzen aus UnitDefs
// Keine Three.js-Abhängigkeiten - Meshes werden separat erstellt

import { UnitDef, UNIT_DEFS, UNIT_TIER_POOLS, getUnitDef } from './UnitConfig';

export interface UnitInstance {
  def: UnitDef;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackSpeed: number;
  starLevel: 1 | 2 | 3;
  level: number; // Für Arena-Modus Levelaufstieg
}

// Shop-Stufen-Wahrscheinlichkeiten basierend auf Spielerlevel
// Index = Spielerlevel (1-7+), Werte = [T1%, T2%, T3%, T4%]
const SHOP_TIER_PROBABILITIES: Record<number, [number, number, number, number]> = {
  1: [1.00, 0.00, 0.00, 0.00],
  2: [0.75, 0.25, 0.00, 0.00],
  3: [0.55, 0.30, 0.15, 0.00],
  4: [0.40, 0.30, 0.25, 0.05],
  5: [0.25, 0.30, 0.30, 0.15],
  6: [0.15, 0.25, 0.30, 0.30],
  7: [0.10, 0.20, 0.30, 0.40],
};

export class UnitFactory {
  /**
   * Erstellt eine Einheiten-Instanz auf Sternstufe 1 (oder angegeben).
   * Stats werden mit dem Sternmultiplikator skaliert.
   */
  static create(unitId: string, starLevel: 1 | 2 | 3 = 1): UnitInstance {
    const def = getUnitDef(unitId);
    const mult = UnitFactory.getStarMultiplier(starLevel);

    const maxHp = Math.round(def.hp * mult);

    return {
      def,
      hp: maxHp,
      maxHp,
      attack: Math.round(def.attack * mult),
      defense: Math.round(def.defense * mult),
      speed: def.speed, // Geschwindigkeit skaliert nicht mit Sternen
      attackRange: def.attackRange,
      attackSpeed: def.attackSpeed,
      starLevel,
      level: 1,
    };
  }

  /**
   * Stern-Skalierung:
   * - Stern 1: 1.0x (Basis)
   * - Stern 2: 1.8x (3 gleiche Einheiten kombiniert)
   * - Stern 3: 3.2x (3 Stern-2 Einheiten kombiniert)
   */
  static getStarMultiplier(star: 1 | 2 | 3): number {
    switch (star) {
      case 1: return 1.0;
      case 2: return 1.8;
      case 3: return 3.2;
    }
  }

  /**
   * Gibt zufällige Einheiten aus einer bestimmten Stufe zurück.
   * Kann Duplikate enthalten wenn count > Pool-Größe.
   */
  static getRandomFromTier(tier: 1 | 2 | 3 | 4, count: number): UnitDef[] {
    const pool = UNIT_TIER_POOLS[tier];
    if (pool.length === 0) return [];

    const result: UnitDef[] = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      result.push(getUnitDef(pool[randomIndex]));
    }
    return result;
  }

  /**
   * Generiert eine Shop-Auswahl von 5 Einheiten, gewichtet nach Spielerlevel.
   * Höhere Level haben größere Chance auf seltene Einheiten.
   */
  static generateShopSelection(playerLevel: number): UnitDef[] {
    // Level auf gültige Bereiche begrenzen
    const clampedLevel = Math.max(1, Math.min(playerLevel, 7));
    const probs = SHOP_TIER_PROBABILITIES[clampedLevel];

    const selection: UnitDef[] = [];
    for (let i = 0; i < 5; i++) {
      const tier = UnitFactory.rollTier(probs);
      const pool = UNIT_TIER_POOLS[tier];

      if (pool.length === 0) {
        // Fallback auf nächst niedrigere Stufe mit Einheiten
        const fallbackUnit = UnitFactory.getFallbackUnit(tier);
        if (fallbackUnit) {
          selection.push(fallbackUnit);
        }
        continue;
      }

      const randomIndex = Math.floor(Math.random() * pool.length);
      selection.push(getUnitDef(pool[randomIndex]));
    }

    return selection;
  }

  /**
   * Würfelt eine Stufe basierend auf den Wahrscheinlichkeiten.
   * Verwendet kumulative Wahrscheinlichkeiten für gewichteten Zufall.
   */
  private static rollTier(probs: [number, number, number, number]): 1 | 2 | 3 | 4 {
    const roll = Math.random();
    let cumulative = 0;

    cumulative += probs[0];
    if (roll < cumulative) return 1;

    cumulative += probs[1];
    if (roll < cumulative) return 2;

    cumulative += probs[2];
    if (roll < cumulative) return 3;

    return 4;
  }

  /**
   * Fallback: Findet die nächst niedrigere Stufe mit verfügbaren Einheiten.
   */
  private static getFallbackUnit(startTier: 1 | 2 | 3 | 4): UnitDef | null {
    const tiers: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
    // Suche abwärts ab startTier
    for (let t = startTier; t >= 1; t--) {
      const pool = UNIT_TIER_POOLS[tiers[t - 1]];
      if (pool.length > 0) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        return getUnitDef(pool[randomIndex]);
      }
    }
    // Suche aufwärts falls nichts darunter
    for (let t = startTier + 1; t <= 4; t++) {
      const pool = UNIT_TIER_POOLS[tiers[t - 1]];
      if (pool.length > 0) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        return getUnitDef(pool[randomIndex]);
      }
    }
    return null;
  }
}
