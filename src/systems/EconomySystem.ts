import { BALANCE } from './BalanceConfig';

export class EconomySystem {
  private gold: number;
  private goldDisplay: HTMLElement;

  /** Called whenever gold is earned (amount). Used for achievement tracking. */
  onGoldEarned: ((amount: number) => void) | null = null;
  /** Called whenever gold is spent (amount). Used for post-game statistics. */
  onGoldSpent: ((amount: number) => void) | null = null;

  constructor(startGold?: number) {
    this.gold = startGold ?? BALANCE.startGold;
    this.goldDisplay = document.getElementById('gold-display')!;
    this.updateDisplay();
  }

  getGold(): number {
    return this.gold;
  }

  canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  spend(amount: number): boolean {
    if (this.gold >= amount) {
      this.gold -= amount;
      this.updateDisplay();
      this.onGoldSpent?.(amount);
      return true;
    }
    return false;
  }

  earn(amount: number): void {
    this.gold += amount;
    this.updateDisplay();
    this.flashGold();
    this.onGoldEarned?.(amount);
  }

  private flashGold(): void {
    this.goldDisplay.style.color = '#ffff44';
    this.goldDisplay.style.transform = 'scale(1.2)';
    this.goldDisplay.style.transition = 'all 0.1s ease';
    setTimeout(() => {
      this.goldDisplay.style.color = '';
      this.goldDisplay.style.transform = '';
      this.goldDisplay.style.transition = 'all 0.3s ease';
    }, 150);
  }

  /** Calculate interest earned: 1 gold per 20 saved, max 5. */
  calculateInterest(currentGold: number): number {
    const raw = Math.floor(currentGold / 20);
    return Math.min(raw, 5);
  }

  /** Preview-only: returns interest that would be earned (same formula). */
  getInterestPreview(currentGold: number): number {
    return this.calculateInterest(currentGold);
  }

  reset(startGold?: number): void {
    this.gold = startGold ?? BALANCE.startGold;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    this.goldDisplay.textContent = this.gold.toString();
  }
}
