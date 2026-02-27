/**
 * Tracks game statistics: kills, gold earned, damage dealt, combos.
 * Enhanced combo/kill streak system with milestone bonuses.
 * All UI text in German with proper umlauts.
 */

interface ComboMilestone {
  threshold: number;
  gold: number;
  label: string;
}

const COMBO_MILESTONES: ComboMilestone[] = [
  { threshold: 5,  gold: 5,  label: 'Kombo x5!' },
  { threshold: 10, gold: 15, label: 'Mega Kombo x10!' },
  { threshold: 20, gold: 30, label: 'Ultra Kombo x20!' },
  { threshold: 50, gold: 50, label: 'UNAUFHALTBAR! x50!' },
];

export class StatsTracker {
  kills = 0;
  totalGoldEarned = 0;
  totalDamageDealt = 0;
  wavesCompleted = 0;
  bossKills = 0;
  bestCombo = 0;

  // Combo system
  private comboCount = 0;
  private comboTimer = 0;
  private readonly comboWindow = 2.0; // seconds between kills to maintain combo
  private comboDisplay: HTMLElement;
  private killDisplay: HTMLElement;
  private comboFadeTimer = 0;
  private lastMilestoneHit = 0; // tracks last milestone threshold hit

  // Callback for combo gold bonus (gold amount, label text)
  onComboBonus: ((gold: number, label: string) => void) | null = null;
  // Callback for combo milestone gold popup at screen center
  onComboMilestone: ((gold: number, label: string) => void) | null = null;

  constructor() {
    this.killDisplay = document.getElementById('kill-display')!;
    this.comboDisplay = document.getElementById('combo-display')!;
    this.updateKillDisplay();
  }

  getComboCount(): number {
    return this.comboCount;
  }

  registerKill(isBoss = false): void {
    this.kills++;
    if (isBoss) this.bossKills++;

    // Combo tracking
    this.comboCount++;
    this.comboTimer = this.comboWindow;
    this.comboFadeTimer = 0;

    // Track best combo
    if (this.comboCount > this.bestCombo) {
      this.bestCombo = this.comboCount;
    }

    // Check milestone thresholds
    for (const milestone of COMBO_MILESTONES) {
      if (this.comboCount === milestone.threshold && milestone.threshold > this.lastMilestoneHit) {
        this.lastMilestoneHit = milestone.threshold;
        this.onComboBonus?.(milestone.gold, milestone.label);
        this.onComboMilestone?.(milestone.gold, milestone.label);
        this.showMilestoneEffect(milestone);
        break;
      }
    }

    this.updateKillDisplay();
    this.updateComboDisplay();
  }

  update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;

      // Start fading when timer is low
      if (this.comboTimer < 0.5 && this.comboCount >= 3) {
        this.comboFadeTimer += dt;
        if (this.comboDisplay) {
          const fadeProgress = Math.min(1, this.comboFadeTimer / 0.5);
          this.comboDisplay.style.opacity = `${1 - fadeProgress}`;
        }
      }

      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.lastMilestoneHit = 0;
        this.comboFadeTimer = 0;
        this.hideComboDisplay();
      }
    }
  }

  private updateKillDisplay(): void {
    if (this.killDisplay) {
      this.killDisplay.textContent = `${this.kills}`;
    }
  }

  private updateComboDisplay(): void {
    if (!this.comboDisplay) return;
    if (this.comboCount >= 3) {
      // Determine color tier and size based on combo count
      const { color, glowColor, fontSize, label } = this.getComboTier();

      this.comboDisplay.textContent = `x${this.comboCount} KOMBO`;
      if (label) {
        this.comboDisplay.textContent = `x${this.comboCount} ${label}`;
      }
      this.comboDisplay.style.display = 'block';
      this.comboDisplay.style.opacity = '1';
      this.comboDisplay.style.color = color;
      this.comboDisplay.style.fontSize = `${fontSize}px`;
      this.comboDisplay.style.textShadow = `0 0 12px ${glowColor}, 0 0 24px ${glowColor}, 2px 2px 4px rgba(0,0,0,0.8)`;

      // Pulse animation on each kill
      this.comboDisplay.classList.remove('combo-bump');
      // Force reflow to restart animation
      void this.comboDisplay.offsetWidth;
      this.comboDisplay.classList.add('combo-bump');
    } else {
      this.hideComboDisplay();
    }
  }

  private getComboTier(): { color: string; glowColor: string; fontSize: number; label: string } {
    if (this.comboCount >= 50) {
      return { color: '#ff2222', glowColor: 'rgba(255,34,34,0.8)', fontSize: 42, label: 'UNAUFHALTBAR!' };
    }
    if (this.comboCount >= 20) {
      return { color: '#ff4400', glowColor: 'rgba(255,68,0,0.7)', fontSize: 36, label: 'ULTRA!' };
    }
    if (this.comboCount >= 10) {
      return { color: '#ff8800', glowColor: 'rgba(255,136,0,0.6)', fontSize: 32, label: 'MEGA!' };
    }
    if (this.comboCount >= 5) {
      return { color: '#ffcc00', glowColor: 'rgba(255,204,0,0.5)', fontSize: 28, label: 'KOMBO!' };
    }
    // 3-4 kills
    return { color: '#ffffff', glowColor: 'rgba(255,255,255,0.4)', fontSize: 24, label: 'KOMBO!' };
  }

  private showMilestoneEffect(milestone: ComboMilestone): void {
    if (!this.comboDisplay) return;
    // Trigger the big milestone flash animation
    this.comboDisplay.classList.remove('combo-milestone');
    void this.comboDisplay.offsetWidth;
    this.comboDisplay.classList.add('combo-milestone');
    setTimeout(() => {
      this.comboDisplay.classList.remove('combo-milestone');
    }, 800);
  }

  private hideComboDisplay(): void {
    if (!this.comboDisplay) return;
    this.comboDisplay.style.display = 'none';
    this.comboDisplay.style.opacity = '0';
  }

  reset(): void {
    this.kills = 0;
    this.totalGoldEarned = 0;
    this.totalDamageDealt = 0;
    this.wavesCompleted = 0;
    this.bossKills = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboFadeTimer = 0;
    this.lastMilestoneHit = 0;
    this.bestCombo = 0;
    this.updateKillDisplay();
    this.hideComboDisplay();
  }
}
