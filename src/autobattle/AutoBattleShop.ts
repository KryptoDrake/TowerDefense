// Auto-Battle Shop: TFT-artiger Laden mit 5 Slots, Auffrischen, XP-Kauf,
// Bank-Verwaltung und Stern-Kombinierung.

import { UnitDef } from '../units/UnitConfig';
import { UnitFactory } from '../units/UnitFactory';
import { AutoBattleUnit } from './AutoBattleUnit';

export class AutoBattleShop {
  gold: number = 10;
  playerLevel: number = 1;
  xp: number = 0;
  xpToLevel: number = 2;
  shopSlots: (UnitDef | null)[] = [null, null, null, null, null];
  bench: AutoBattleUnit[] = [];

  readonly MAX_BENCH = 9;
  readonly REFRESH_COST = 2;
  readonly XP_COST = 4;

  /** XP-Schwellen pro Level (kumulativ benötigt für nächstes Level) */
  static readonly XP_PER_LEVEL = [0, 2, 6, 10, 20, 36, 56, 80];

  /** Laden mit neuen zufälligen Einheiten auffüllen (basierend auf Spielerlevel) */
  refreshShop(): void {
    const selection = UnitFactory.generateShopSelection(this.playerLevel);
    for (let i = 0; i < 5; i++) {
      this.shopSlots[i] = selection[i] ?? null;
    }
  }

  /** Einheit aus Laden-Slot kaufen und auf Bank platzieren */
  buyUnit(slotIndex: number): AutoBattleUnit | null {
    if (slotIndex < 0 || slotIndex >= 5) return null;

    const def = this.shopSlots[slotIndex];
    if (!def) return null;

    // Kosten prüfen
    if (this.gold < def.shopCost) return null;

    // Bank-Kapazität prüfen
    if (this.bench.length >= this.MAX_BENCH) return null;

    // Gold abziehen
    this.gold -= def.shopCost;

    // Slot leeren
    this.shopSlots[slotIndex] = null;

    // Einheit erstellen (Stern 1, nicht auf dem Brett → col/row = -1)
    const unit = new AutoBattleUnit(def, 1, true, -1, -1);
    this.bench.push(unit);

    return unit;
  }

  /** Einheit verkaufen (von Bank oder Brett), Gold zurückbekommen */
  sellUnit(unit: AutoBattleUnit): number {
    // Rückgabewert basierend auf Stufe und Sternen
    let goldBack = unit.def.shopCost;
    if (unit.starLevel === 2) goldBack = unit.def.shopCost * 3;
    if (unit.starLevel === 3) goldBack = unit.def.shopCost * 9;

    this.gold += goldBack;

    // Von Bank entfernen falls dort
    const benchIdx = this.bench.indexOf(unit);
    if (benchIdx !== -1) {
      this.bench.splice(benchIdx, 1);
    }

    return goldBack;
  }

  /** XP kaufen (4 Gold = 4 XP) */
  buyXP(): boolean {
    if (this.gold < this.XP_COST) return false;
    if (this.playerLevel >= 8) return false;

    this.gold -= this.XP_COST;
    this.xp += 4;

    // Level-Up prüfen (kann mehrmals passieren)
    while (this.checkLevelUp()) {
      // checkLevelUp handhabt alles intern
    }

    return true;
  }

  /** Gold hinzufügen (Rundenende-Bonus) */
  addGold(amount: number): void {
    this.gold += Math.max(0, Math.floor(amount));
  }

  /**
   * Rundeneinkommen berechnen: Basis 5 + Zinsen (1 pro 10 Gold, max 5) + Streak-Bonus
   * Streak-Bonus: 1 für 2er-Streak, 2 für 3er-Streak, 3 für 4+ Streak
   */
  calculateIncome(winStreak: number, loseStreak: number): number {
    const base = 5;
    const interest = Math.min(5, Math.floor(this.gold / 10));

    let streakBonus = 0;
    const streak = Math.max(winStreak, loseStreak);
    if (streak >= 4) {
      streakBonus = 3;
    } else if (streak >= 3) {
      streakBonus = 2;
    } else if (streak >= 2) {
      streakBonus = 1;
    }

    return base + interest + streakBonus;
  }

  /**
   * Stern-Upgrades prüfen und durchführen.
   * 3 gleiche Einheiten (selbe def.id UND selber starLevel) → kombinieren zu starLevel+1.
   * Prüft Bank + Brett.
   */
  checkStarUpgrades(boardUnits: AutoBattleUnit[]): { upgraded: AutoBattleUnit; consumed: AutoBattleUnit[] }[] {
    const results: { upgraded: AutoBattleUnit; consumed: AutoBattleUnit[] }[] = [];

    // Alle Einheiten sammeln (Bank + Brett)
    const allUnits = [...this.bench, ...boardUnits];

    // Nach def.id + starLevel gruppieren
    const groups = new Map<string, AutoBattleUnit[]>();
    for (const unit of allUnits) {
      if (unit.starLevel >= 3) continue; // Stern 3 kann nicht weiter aufsteigen
      const key = `${unit.def.id}_${unit.starLevel}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(unit);
    }

    // Für jede Gruppe mit 3+ Einheiten: Upgrade durchführen
    for (const [, units] of groups) {
      while (units.length >= 3) {
        // Die ersten 3 nehmen
        const toMerge = units.splice(0, 3);

        // Die erste Einheit upgraden (die anderen 2 werden konsumiert)
        const keeper = toMerge[0];
        const consumed = [toMerge[1], toMerge[2]];

        // Neues Sternlevel
        const newStar = (keeper.starLevel + 1) as 1 | 2 | 3;
        const mult = UnitFactory.getStarMultiplier(newStar);

        // Stats aktualisieren
        keeper.starLevel = newStar;
        keeper.maxHp = Math.round(keeper.def.hp * mult);
        keeper.hp = keeper.maxHp;
        keeper.attack = Math.round(keeper.def.attack * mult);
        keeper.defense = Math.round(keeper.def.defense * mult);

        // Konsumierte Einheiten aus Bank/Brett entfernen
        for (const c of consumed) {
          const benchIdx = this.bench.indexOf(c);
          if (benchIdx !== -1) {
            this.bench.splice(benchIdx, 1);
          }
          // Brett-Einheiten werden vom Controller entfernt
        }

        results.push({ upgraded: keeper, consumed });
      }
    }

    return results;
  }

  /** Level-Up prüfen */
  private checkLevelUp(): boolean {
    if (this.playerLevel >= 8) return false;

    const needed = AutoBattleShop.XP_PER_LEVEL[this.playerLevel] ?? 999;
    if (this.xp >= needed) {
      this.xp -= needed;
      this.playerLevel++;
      // Nächste Schwelle setzen
      this.xpToLevel = AutoBattleShop.XP_PER_LEVEL[this.playerLevel] ?? 999;
      return true;
    }

    return false;
  }

  /** Für neues Spiel zurücksetzen */
  reset(): void {
    this.gold = 10;
    this.playerLevel = 1;
    this.xp = 0;
    this.xpToLevel = AutoBattleShop.XP_PER_LEVEL[1] ?? 2;
    this.shopSlots = [null, null, null, null, null];
    this.bench = [];
  }
}
