/**
 * Achievement / Erfolge System
 * Tracks player accomplishments, persists to localStorage, shows unlock popups.
 * All UI text in German with proper umlauts.
 */

const STORAGE_KEY = 'td_achievements';

export interface Achievement {
  id: string;
  name: string;        // German display name
  description: string; // German description
  icon: string;        // emoji
  crystalReward: number;
  unlocked: boolean;
  progress: number;    // current progress toward target
  target: number;      // target value to unlock
  category: 'combat' | 'economy' | 'defense' | 'strategy' | 'progression';
}

interface AchievementSaveData {
  [achievementId: string]: { unlocked: boolean; progress: number };
}

// ─── Achievement Definitions ──────────────────────────────
function createAchievements(): Map<string, Achievement> {
  const defs: Omit<Achievement, 'unlocked' | 'progress'>[] = [
    // Combat
    {
      id: 'first_blood',
      name: 'Erster Kill',
      description: 'Töte deinen ersten Zombie.',
      icon: '\u{1F5E1}',
      crystalReward: 5,
      target: 1,
      category: 'combat',
    },
    {
      id: 'century',
      name: 'Hundertschaft',
      description: 'Töte insgesamt 100 Zombies.',
      icon: '\u{1F480}',
      crystalReward: 15,
      target: 100,
      category: 'combat',
    },
    {
      id: 'thousand',
      name: 'Vernichter',
      description: 'Töte insgesamt 1000 Zombies.',
      icon: '\u{2620}',
      crystalReward: 50,
      target: 1000,
      category: 'combat',
    },
    {
      id: 'boss_slayer',
      name: 'Bossvernichter',
      description: 'Töte deinen ersten Boss.',
      icon: '\u{1F451}',
      crystalReward: 20,
      target: 1,
      category: 'combat',
    },
    {
      id: 'boss_master',
      name: 'Boss-Meister',
      description: 'Töte insgesamt 10 Bosse.',
      icon: '\u{1F525}',
      crystalReward: 40,
      target: 10,
      category: 'combat',
    },
    {
      id: 'combo_king',
      name: 'Combo-König',
      description: 'Erreiche eine 25x Combo.',
      icon: '\u{26A1}',
      crystalReward: 25,
      target: 25,
      category: 'combat',
    },

    // Economy
    {
      id: 'rich',
      name: 'Goldsammler',
      description: 'Verdiene 500 Gold in einem Level.',
      icon: '\u{1FA99}',
      crystalReward: 10,
      target: 500,
      category: 'economy',
    },
    {
      id: 'millionaire',
      name: 'Millionär',
      description: 'Verdiene insgesamt 5000 Gold über alle Runs.',
      icon: '\u{1F4B0}',
      crystalReward: 30,
      target: 5000,
      category: 'economy',
    },

    // Defense
    {
      id: 'perfect_wave',
      name: 'Perfekte Welle',
      description: 'Schließe eine Welle ohne Schaden ab.',
      icon: '\u{1F30A}',
      crystalReward: 15,
      target: 1,
      category: 'defense',
    },
    {
      id: 'untouchable',
      name: 'Unberührbar',
      description: 'Schließe ein Level ohne Schaden ab.',
      icon: '\u{1F6E1}',
      crystalReward: 50,
      target: 1,
      category: 'defense',
    },
    {
      id: 'survivor',
      name: 'Überlebender',
      description: 'Gewinne mit weniger als 10% HP.',
      icon: '\u{1F9E1}',
      crystalReward: 20,
      target: 1,
      category: 'defense',
    },

    // Strategy
    {
      id: 'builder',
      name: 'Baumeister',
      description: 'Platziere insgesamt 50 Türme.',
      icon: '\u{1F3D7}',
      crystalReward: 10,
      target: 50,
      category: 'strategy',
    },
    {
      id: 'diverse',
      name: 'Vielfältig',
      description: 'Nutze 10 verschiedene Waffentypen in einem Level.',
      icon: '\u{1F308}',
      crystalReward: 25,
      target: 10,
      category: 'strategy',
    },
    {
      id: 'maxed',
      name: 'Maximiert',
      description: 'Upgrade einen Turm auf maximale Stufe.',
      icon: '\u{2B50}',
      crystalReward: 10,
      target: 1,
      category: 'strategy',
    },

    // Progression
    {
      id: 'champion',
      name: 'Champion',
      description: 'Schließe alle 7 Level ab.',
      icon: '\u{1F3C6}',
      crystalReward: 100,
      target: 7,
      category: 'progression',
    },
  ];

  const map = new Map<string, Achievement>();
  for (const d of defs) {
    map.set(d.id, { ...d, unlocked: false, progress: 0 });
  }
  return map;
}

// ─── Achievement System ───────────────────────────────────
export class AchievementSystem {
  private achievements: Map<string, Achievement>;
  private static instance: AchievementSystem | null = null;

  // Persistent accumulators (saved alongside achievement state)
  private totalKills = 0;
  private totalBossKills = 0;
  private totalGoldAllRuns = 0;
  private totalTowersPlaced = 0;
  private levelsBeaten: Set<number> = new Set();

  // Per-level tracking (reset each level)
  private levelGold = 0;

  // Callback for granting crystals
  onCrystalReward: ((amount: number) => void) | null = null;

  constructor() {
    this.achievements = createAchievements();
    this.load();
    AchievementSystem.instance = this;
  }

  static getInstance(): AchievementSystem {
    if (!AchievementSystem.instance) {
      AchievementSystem.instance = new AchievementSystem();
    }
    return AchievementSystem.instance;
  }

  // ─── Tracking Methods ────────────────────────────────

  /** Called when a zombie is killed. */
  trackKill(isBoss: boolean): void {
    this.totalKills++;

    // first_blood
    this.updateProgress('first_blood', this.totalKills);
    // century
    this.updateProgress('century', this.totalKills);
    // thousand
    this.updateProgress('thousand', this.totalKills);

    if (isBoss) {
      this.totalBossKills++;
      this.updateProgress('boss_slayer', this.totalBossKills);
      this.updateProgress('boss_master', this.totalBossKills);
    }

    this.save();
  }

  /** Called when gold is earned. `amount` is the gold earned in this event. */
  trackGoldEarned(amount: number): void {
    this.levelGold += amount;
    this.totalGoldAllRuns += amount;

    this.updateProgress('rich', this.levelGold);
    this.updateProgress('millionaire', this.totalGoldAllRuns);

    this.save();
  }

  /** Called when a wave is completed. `damageTaken` is the damage taken during that wave. */
  trackWaveComplete(damageTaken: number): void {
    if (damageTaken <= 0) {
      this.updateProgress('perfect_wave', 1);
      this.save();
    }
  }

  /** Called when a level is completed successfully. */
  trackLevelComplete(levelId: number, damageTaken: number, hpPercent: number): void {
    // untouchable
    if (damageTaken <= 0) {
      this.updateProgress('untouchable', 1);
    }

    // survivor (less than 10% HP)
    if (hpPercent > 0 && hpPercent < 10) {
      this.updateProgress('survivor', 1);
    }

    // champion tracking
    this.levelsBeaten.add(levelId);
    this.updateProgress('champion', this.levelsBeaten.size);

    // Reset per-level gold tracking
    this.levelGold = 0;

    this.save();
  }

  /** Called when a tower/trap is placed. `weaponTypes` is the set of all weapon types placed this level. */
  trackTowerPlaced(weaponTypes: Set<string>): void {
    this.totalTowersPlaced++;
    this.updateProgress('builder', this.totalTowersPlaced);
    this.updateProgress('diverse', weaponTypes.size);
    this.save();
  }

  /** Called when a tower is upgraded. `level` is the new level of the tower (max is typically 3). */
  trackTowerUpgraded(level: number): void {
    if (level >= 3) {
      this.updateProgress('maxed', 1);
      this.save();
    }
  }

  /** Called when combo count changes. */
  trackCombo(count: number): void {
    this.updateProgress('combo_king', count);
    // No save here to avoid thrashing - combo is transient, saved on next kill/event
  }

  /** Reset per-level tracking (call at level start). */
  resetLevelTracking(): void {
    this.levelGold = 0;
    // Reset diverse progress (per-level achievement)
    const diverse = this.achievements.get('diverse');
    if (diverse && !diverse.unlocked) {
      diverse.progress = 0;
    }
    // Reset rich progress (per-level achievement)
    const rich = this.achievements.get('rich');
    if (rich && !rich.unlocked) {
      rich.progress = 0;
    }
  }

  // ─── Internal Progress Update ────────────────────────

  private updateProgress(id: string, value: number): void {
    const ach = this.achievements.get(id);
    if (!ach || ach.unlocked) return;

    ach.progress = Math.max(ach.progress, value);

    if (ach.progress >= ach.target) {
      ach.unlocked = true;
      ach.progress = ach.target;
      this.onUnlock(ach);
    }
  }

  private onUnlock(ach: Achievement): void {
    // Grant crystal reward
    if (this.onCrystalReward) {
      this.onCrystalReward(ach.crystalReward);
    }

    // Show popup notification
    this.showUnlockPopup(ach);
  }

  // ─── Popup Notification ──────────────────────────────

  private showUnlockPopup(ach: Achievement): void {
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 2px solid #ffd700;
      border-radius: 12px;
      padding: 16px 24px;
      min-width: 320px;
      max-width: 450px;
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), 0 4px 20px rgba(0, 0, 0, 0.6);
      font-family: 'Segoe UI', Arial, sans-serif;
      text-align: center;
      transition: top 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
      opacity: 0;
      pointer-events: none;
    `;

    popup.innerHTML = `
      <div style="font-size: 12px; color: #ffd700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">
        Erfolg freigeschaltet!
      </div>
      <div style="font-size: 28px; margin-bottom: 4px;">${ach.icon}</div>
      <div style="font-size: 18px; font-weight: bold; color: #ffffff; margin-bottom: 4px;">
        ${ach.name}
      </div>
      <div style="font-size: 13px; color: #aabbcc; margin-bottom: 8px;">
        ${ach.description}
      </div>
      <div style="font-size: 14px; color: #bb88ff; font-weight: bold;">
        +${ach.crystalReward} Kristalle
      </div>
    `;

    document.body.appendChild(popup);

    // Slide in
    requestAnimationFrame(() => {
      popup.style.top = '80px';
      popup.style.opacity = '1';
    });

    // Fade out after 3 seconds
    setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.top = '-100px';
      setTimeout(() => {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
      }, 500);
    }, 3000);
  }

  // ─── Getters ─────────────────────────────────────────

  getAll(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  getUnlocked(): Achievement[] {
    return this.getAll().filter(a => a.unlocked);
  }

  getProgress(): { unlocked: number; total: number } {
    const all = this.getAll();
    return {
      unlocked: all.filter(a => a.unlocked).length,
      total: all.length,
    };
  }

  getAchievement(id: string): Achievement | undefined {
    return this.achievements.get(id);
  }

  // ─── Persistence ─────────────────────────────────────

  save(): void {
    try {
      const achData: AchievementSaveData = {};
      for (const [id, ach] of this.achievements) {
        achData[id] = { unlocked: ach.unlocked, progress: ach.progress };
      }

      const saveObj = {
        achievements: achData,
        totalKills: this.totalKills,
        totalBossKills: this.totalBossKills,
        totalGoldAllRuns: this.totalGoldAllRuns,
        totalTowersPlaced: this.totalTowersPlaced,
        levelsBeaten: Array.from(this.levelsBeaten),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveObj));
    } catch (_) {
      /* ignore storage errors */
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);

      // Restore accumulators
      if (typeof data.totalKills === 'number') this.totalKills = data.totalKills;
      if (typeof data.totalBossKills === 'number') this.totalBossKills = data.totalBossKills;
      if (typeof data.totalGoldAllRuns === 'number') this.totalGoldAllRuns = data.totalGoldAllRuns;
      if (typeof data.totalTowersPlaced === 'number') this.totalTowersPlaced = data.totalTowersPlaced;
      if (Array.isArray(data.levelsBeaten)) {
        this.levelsBeaten = new Set(data.levelsBeaten as number[]);
      }

      // Restore achievement state
      const achData = data.achievements as AchievementSaveData | undefined;
      if (achData) {
        for (const [id, saved] of Object.entries(achData)) {
          const ach = this.achievements.get(id);
          if (ach) {
            if (typeof saved.unlocked === 'boolean') ach.unlocked = saved.unlocked;
            if (typeof saved.progress === 'number') ach.progress = saved.progress;
          }
        }
      }
    } catch (_) {
      /* ignore parse errors */
    }
  }

  /** Full reset (debug / new game). */
  fullReset(): void {
    this.achievements = createAchievements();
    this.totalKills = 0;
    this.totalBossKills = 0;
    this.totalGoldAllRuns = 0;
    this.totalTowersPlaced = 0;
    this.levelsBeaten.clear();
    this.levelGold = 0;
    this.save();
  }

  // ─── Hub Panel Rendering ─────────────────────────────

  /** Returns HTML string for displaying all achievements in a grid panel. */
  renderAchievementPanel(): string {
    const { unlocked, total } = this.getProgress();
    const categories: { key: Achievement['category']; label: string }[] = [
      { key: 'combat', label: 'Kampf' },
      { key: 'economy', label: 'Wirtschaft' },
      { key: 'defense', label: 'Verteidigung' },
      { key: 'strategy', label: 'Strategie' },
      { key: 'progression', label: 'Fortschritt' },
    ];

    let html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #e0e0e0; padding: 8px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="font-size: 22px; font-weight: bold; color: #ffd700; margin-bottom: 4px;">
            Erfolge
          </div>
          <div style="font-size: 14px; color: #aabbcc;">
            ${unlocked} / ${total} freigeschaltet
          </div>
          <div style="
            width: 100%;
            height: 6px;
            background: #1a1a2e;
            border-radius: 3px;
            margin-top: 8px;
            overflow: hidden;
          ">
            <div style="
              width: ${total > 0 ? (unlocked / total) * 100 : 0}%;
              height: 100%;
              background: linear-gradient(90deg, #ffd700, #ffaa00);
              border-radius: 3px;
              transition: width 0.3s ease;
            "></div>
          </div>
        </div>
    `;

    for (const cat of categories) {
      const achs = this.getAll().filter(a => a.category === cat.key);
      if (achs.length === 0) continue;

      html += `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 13px; font-weight: bold; color: #88aacc; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 4px;">
            ${cat.label}
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
      `;

      for (const ach of achs) {
        const isUnlocked = ach.unlocked;
        const borderColor = isUnlocked ? '#ffd700' : '#333';
        const bgColor = isUnlocked ? 'rgba(255, 215, 0, 0.08)' : 'rgba(30, 30, 50, 0.6)';
        const opacity = isUnlocked ? '1' : '0.65';
        const progressPct = ach.target > 0 ? Math.min((ach.progress / ach.target) * 100, 100) : 0;
        const progressBarColor = isUnlocked ? '#ffd700' : '#4488aa';

        html += `
          <div style="
            border: 1px solid ${borderColor};
            border-radius: 8px;
            padding: 10px 8px;
            background: ${bgColor};
            opacity: ${opacity};
            text-align: center;
            transition: opacity 0.2s;
          ">
            <div style="font-size: 24px; margin-bottom: 4px;">${ach.icon}</div>
            <div style="font-size: 13px; font-weight: bold; color: ${isUnlocked ? '#ffd700' : '#cccccc'}; margin-bottom: 2px;">
              ${ach.name}
            </div>
            <div style="font-size: 11px; color: #8899aa; margin-bottom: 6px; line-height: 1.3;">
              ${ach.description}
            </div>
            <div style="
              width: 100%;
              height: 4px;
              background: #1a1a2e;
              border-radius: 2px;
              overflow: hidden;
              margin-bottom: 4px;
            ">
              <div style="
                width: ${progressPct}%;
                height: 100%;
                background: ${progressBarColor};
                border-radius: 2px;
                transition: width 0.3s ease;
              "></div>
            </div>
            <div style="font-size: 11px; color: ${isUnlocked ? '#88dd88' : '#8899aa'};">
              ${isUnlocked ? 'Abgeschlossen!' : `${ach.progress} / ${ach.target}`}
            </div>
            <div style="font-size: 11px; color: #bb88ff; margin-top: 2px;">
              ${isUnlocked ? '' : `+${ach.crystalReward} Kristalle`}
            </div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }
}
