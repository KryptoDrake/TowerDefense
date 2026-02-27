/**
 * Dynamische Schwierigkeitsanpassung basierend auf Spielerleistung.
 *
 * - Perfekte Wellen (kein Schaden) erhöhen die Schwierigkeit stufenweise.
 * - Wiederholte Niederlagen senken die Schwierigkeit.
 * - Der Multiplikator beeinflusst gegnerische HP via RunModifiers.
 */
export class DifficultyScaling {
  private difficultyMult = 1.0;
  private perfectWaves = 0;  // consecutive waves completed without damage
  private retries = 0;
  private currentLevelIndex = -1;

  /** Called when a wave is completed. Adjusts difficulty based on damage taken. */
  onWaveComplete(tookDamage: boolean): void {
    if (!tookDamage) {
      this.perfectWaves++;
      if (this.perfectWaves >= 2) {
        this.difficultyMult = Math.min(1.5, this.difficultyMult + 0.05);
      }
    } else {
      this.perfectWaves = 0;
    }
  }

  /** Called when the player's base is destroyed. */
  onPlayerDeath(): void {
    this.retries++;
    if (this.retries >= 2) {
      this.difficultyMult = Math.max(0.7, this.difficultyMult - 0.1);
    }
  }

  /** Called when a new level starts. Resets per-level counters but keeps the multiplier. */
  onLevelChange(levelIndex: number): void {
    if (levelIndex !== this.currentLevelIndex) {
      this.currentLevelIndex = levelIndex;
      this.retries = 0;
      this.perfectWaves = 0;
    }
  }

  /** Returns the current difficulty multiplier (applied to enemy HP). */
  getMultiplier(): number {
    return this.difficultyMult;
  }

  /** Returns a German label describing the current difficulty tier. */
  getDifficultyLabel(): string {
    if (this.difficultyMult <= 0.85) return 'Leicht';
    if (this.difficultyMult >= 1.15) return 'Schwer';
    return 'Normal';
  }

  /** Returns a color for the difficulty indicator. */
  getDifficultyColor(): string {
    if (this.difficultyMult <= 0.85) return '#44ff44';
    if (this.difficultyMult >= 1.15) return '#ff4444';
    return '#ffcc44';
  }

  /** Full reset (e.g. when returning to hub and starting a fresh run). */
  reset(): void {
    this.difficultyMult = 1.0;
    this.perfectWaves = 0;
    this.retries = 0;
  }
}
