import { BackpackManager, ChestReward } from '../systems/BackpackManager';
import { WeaponKey, BALANCE } from '../systems/BalanceConfig';
import { DailyChallenge } from '../systems/DailyChallenge';
import { SaveSystem } from '../systems/SaveSystem';
import { PersistentStats } from '../systems/PersistentStats';
import { AchievementSystem } from '../systems/AchievementSystem';
import { TowerEncyclopedia } from './TowerEncyclopedia';
import { HighScoreSystem } from '../systems/HighScoreSystem';

const WEAPON_ICONS: Record<string, string> = {
  arrowTower: '\u{1F3F9}',
  cannonTower: '\u{1F4A3}',
  iceTower: '\u2744\uFE0F',
  fireTower: '\u{1F525}',
  sniperTower: '\u{1F3AF}',
  teslaTower: '\u26A1',
  mortarTower: '\u{1F4A5}',
  poisonTower: '\u2620\uFE0F',
  laserTower: '\u{1F534}',
  windTower: '\u{1F32C}\uFE0F',
  mageTower: '\u{1F52E}',
  flamethrowerTower: '\u{1F9EF}',
  barrierTower: '\u{1F6E1}\uFE0F',
  necromancerTower: '\u{1F480}',
  earthquakeTower: '\u{1F30B}',
  healTower: '\u{1F49A}',
  landmine: '\u{1F4A3}',
  spikeTrap: '\u{1F529}',
  frostMine: '\u{1F9CA}',
  goldMine: '\u{1FA99}',
};

type PanelType = 'merchant' | 'chest' | 'daily' | 'stats' | 'achievements' | 'save' | 'load' | 'encyclopedia' | 'highscores' | null;

export class BaseHubScreen {
  private overlay: HTMLDivElement;
  private panelContainer: HTMLDivElement;
  private headerBar: HTMLDivElement;
  private backpackPanel: HTMLDivElement;
  private backpackManager: BackpackManager;
  private dailyChallenge: DailyChallenge;
  private saveSystem: SaveSystem;
  private persistentStats: PersistentStats;
  private achievements: AchievementSystem;
  private towerEncyclopedia: TowerEncyclopedia;
  private highScoreSystem: HighScoreSystem;
  private onExpeditionStart: (() => void) | null = null;
  onDailyChallengeStart: (() => void) | null = null;
  private activePanel: PanelType = null;
  private visible = false;

  constructor(backpackManager: BackpackManager) {
    this.backpackManager = backpackManager;
    this.dailyChallenge = new DailyChallenge();
    this.saveSystem = SaveSystem.getInstance();
    this.persistentStats = PersistentStats.getInstance();
    this.achievements = AchievementSystem.getInstance();
    this.towerEncyclopedia = new TowerEncyclopedia(backpackManager);
    this.highScoreSystem = HighScoreSystem.getInstance();

    // Transparent overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'base-hub-overlay';
    this.overlay.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 250;
      pointer-events: none;
    `;
    document.body.appendChild(this.overlay);

    // Top header bar
    this.headerBar = document.createElement('div');
    this.headerBar.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%;
      max-height: 100%;
      overflow-y: auto;
      display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 10px 12px 20px;
      background: rgba(10,10,26,0.92);
      pointer-events: auto;
      box-sizing: border-box;
    `;
    this.overlay.appendChild(this.headerBar);

    // Center panel container (for merchant/chest)
    this.panelContainer = document.createElement('div');
    this.panelContainer.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      display: none;
    `;
    this.overlay.appendChild(this.panelContainer);

    // Backpack panel (popup, opened via nav button)
    this.backpackPanel = document.createElement('div');
    this.backpackPanel.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      display: none;
      z-index: 260;
    `;
    this.overlay.appendChild(this.backpackPanel);
  }

  show(onExpeditionStart: () => void): void {
    this.onExpeditionStart = onExpeditionStart;
    this.visible = true;
    if (this.backpackManager.getEquipped().length === 0) {
      this.backpackManager.autoFillBackpack();
    }
    this.renderHeader();
    this.closePanel();
    this.overlay.style.display = 'block';

    // Show pending chest reward
    const pendingChest = this.backpackManager.consumePendingChest();
    if (pendingChest) {
      this.showChestRewardPopup(pendingChest);
    }
  }

  hide(): void {
    this.visible = false;
    this.closePanel();
    this.backpackPanel.style.display = 'none';
    this.overlay.style.display = 'none';
  }

  isVisible(): boolean {
    return this.visible;
  }

  showPanel(panel: 'merchant' | 'chest' | 'backpack' | 'daily' | 'stats' | 'achievements' | 'save' | 'load' | 'encyclopedia' | 'highscores'): void {
    if (panel === 'backpack') {
      this.closePanel();
      this.renderBackpackPanel();
      this.backpackPanel.style.display = 'block';
      return;
    }
    this.backpackPanel.style.display = 'none';
    this.activePanel = panel;
    this.renderPanel();
    this.panelContainer.style.display = 'block';
  }

  closePanel(): void {
    this.activePanel = null;
    this.panelContainer.style.display = 'none';
    this.panelContainer.innerHTML = '';
    this.backpackPanel.style.display = 'none';
  }

  startExpedition(): void {
    const equipped = this.backpackManager.getEquipped();
    if (equipped.length === 0) return;
    if (this.onExpeditionStart) {
      this.hide();
      this.onExpeditionStart();
    }
  }

  // ─── Header ─────────────────────────────────────
  private renderHeader(): void {
    const crystals = this.backpackManager.getCrystals();
    const equipped = this.backpackManager.getEquipped();
    const bpStats = this.backpackManager.getStats();
    const dailyDone = this.dailyChallenge.isCompleted();

    this.headerBar.innerHTML = `
      <div style="color: #ffcc44; font-size: 22px; font-weight: bold; text-shadow: 0 0 15px rgba(255,204,68,0.5);">
        Hauptquartier
      </div>
      <div style="background: rgba(100,68,255,0.2); border: 1px solid rgba(100,68,255,0.5); border-radius: 8px; padding: 4px 14px;">
        <span style="color: #aa88ff; font-size: 14px; font-weight: bold;">\u{1F48E} ${crystals} Kristalle</span>
      </div>
      <div style="color: #888; font-size: 12px;">
        \u{1F392} ${equipped.length}/${this.backpackManager.getMaxSlots()} | ${bpStats.totalUnlocked}/${bpStats.totalWeapons} freigeschaltet
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="hub-nav-btn" data-panel="daily" style="
          padding: 4px 10px; font-size: 11px; color: ${dailyDone ? '#666' : '#ff8844'};
          background: ${dailyDone ? 'transparent' : 'rgba(255,136,0,0.1)'};
          border: 1px solid ${dailyDone ? '#444' : '#ff6600'}; border-radius: 4px; cursor: pointer;
        " title="T\u00e4gliche Herausforderung">\u{1F525} T\u00e4glich</button>
        <button class="hub-nav-btn" data-panel="stats" style="
          padding: 4px 10px; font-size: 11px; color: #44aaff;
          background: transparent; border: 1px solid #335577; border-radius: 4px; cursor: pointer;
        " title="Statistiken">\u{1F4CA} Stats</button>
        <button class="hub-nav-btn" data-panel="achievements" style="
          padding: 4px 10px; font-size: 11px; color: #ffcc44;
          background: transparent; border: 1px solid #554400; border-radius: 4px; cursor: pointer;
        " title="Erfolge">\u{1F3C6} Erfolge</button>
        <button class="hub-nav-btn" data-panel="save" style="
          padding: 4px 10px; font-size: 11px; color: #44ff88;
          background: transparent; border: 1px solid #225533; border-radius: 4px; cursor: pointer;
        " title="Speichern">\u{1F4BE} Speichern</button>
        <button class="hub-nav-btn" data-panel="load" style="
          padding: 4px 10px; font-size: 11px; color: #88aacc;
          background: transparent; border: 1px solid #334466; border-radius: 4px; cursor: pointer;
        " title="Laden">\u{1F4C2} Laden</button>
        <button class="hub-nav-btn" data-panel="encyclopedia" style="
          padding: 4px 10px; font-size: 11px; color: #ff88cc;
          background: transparent; border: 1px solid #663355; border-radius: 4px; cursor: pointer;
        " title="Turm-Lexikon">\u{1F4D6} Lexikon</button>
        <button class="hub-nav-btn" data-panel="highscores" style="
          padding: 4px 10px; font-size: 11px; color: #ffd700;
          background: rgba(255,215,0,0.08); border: 1px solid #665500; border-radius: 4px; cursor: pointer;
        " title="Bestenliste">&#127942; Bestenliste</button>
        <button class="hub-nav-btn" data-panel="backpack" style="
          padding: 4px 10px; font-size: 11px; color: #44aaff;
          background: rgba(68,170,255,0.1); border: 1px solid #335577; border-radius: 4px; cursor: pointer;
        " title="Rucksack">\u{1F392} Rucksack</button>
      </div>
      <button id="hub-reset-btn" style="
        padding: 3px 10px; font-size: 10px; color: #666;
        background: transparent; border: 1px solid #444; border-radius: 4px; cursor: pointer;
      ">Reset</button>
    `;

    // Header nav buttons
    this.headerBar.querySelectorAll('.hub-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = (btn as HTMLElement).dataset.panel as PanelType;
        if (panel) this.showPanel(panel as any);
      });
    });

    const resetBtn = document.getElementById('hub-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.backpackManager.fullReset();
        this.backpackManager.autoFillBackpack();
        this.renderHeader();
        this.renderBackpackPanel();
        if (this.activePanel) this.renderPanel();
      });
    }
  }

  // ─── Panel Rendering (center) ──────────────────
  private renderPanel(): void {
    switch (this.activePanel) {
      case 'merchant': this.renderMerchantPanel(); break;
      case 'chest': this.renderChestPanel(); break;
      case 'daily': this.renderDailyPanel(); break;
      case 'stats': this.renderStatsPanel(); break;
      case 'achievements': this.renderAchievementsPanel(); break;
      case 'save': this.renderSavePanel(); break;
      case 'load': this.renderLoadPanel(); break;
      case 'encyclopedia': this.renderEncyclopediaPanel(); break;
      case 'highscores': this.renderHighScoresPanel(); break;
    }
  }

  private panelWrapper(title: string, titleColor: string, borderColor: string, content: string): string {
    return `
      <div style="
        background: rgba(10,10,26,0.92);
        border: 2px solid ${borderColor};
        border-radius: 16px;
        padding: 20px;
        min-width: min(380px, 92vw);
        max-width: min(520px, 92vw);
        max-height: 70vh;
        overflow-y: auto;
        box-shadow: 0 0 40px rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h2 style="color: ${titleColor}; font-size: 20px; margin: 0;">${title}</h2>
          <button class="hub-close-btn" style="
            background: none; border: 1px solid #555; color: #888;
            border-radius: 50%; width: 28px; height: 28px; font-size: 16px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
          ">\u2715</button>
        </div>
        ${content}
      </div>
    `;
  }

  // ─── Merchant Panel ────────────────────────────
  private merchantTab: 'shop' | 'upgrades' = 'shop';

  private renderMerchantPanel(): void {
    const crystals = this.backpackManager.getCrystals();

    // Tab bar
    const tabBar = `
      <div style="display: flex; gap: 4px; margin-bottom: 14px;">
        <button class="merchant-tab-btn" data-tab="shop" style="
          flex: 1; padding: 8px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer;
          border: 1px solid ${this.merchantTab === 'shop' ? '#ffaa44' : '#444'};
          background: ${this.merchantTab === 'shop' ? 'rgba(255,170,68,0.2)' : 'transparent'};
          color: ${this.merchantTab === 'shop' ? '#ffaa44' : '#888'};
        ">\uD83D\uDED2 Laden</button>
        <button class="merchant-tab-btn" data-tab="upgrades" style="
          flex: 1; padding: 8px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer;
          border: 1px solid ${this.merchantTab === 'upgrades' ? '#cc44ff' : '#444'};
          background: ${this.merchantTab === 'upgrades' ? 'rgba(204,68,255,0.2)' : 'transparent'};
          color: ${this.merchantTab === 'upgrades' ? '#cc44ff' : '#888'};
        ">\u2B06 Verbesserungen</button>
      </div>
    `;

    let tabContent = '';
    if (this.merchantTab === 'shop') {
      tabContent = this.renderMerchantShopTab(crystals);
    } else {
      tabContent = this.renderMerchantUpgradesTab(crystals);
    }

    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F3EA} H\u00e4ndler', '#ffaa44', 'rgba(255,170,68,0.5)',
      tabBar + tabContent
    );
    this.attachPanelHandlers();

    // Tab switch handlers
    this.panelContainer.querySelectorAll('.merchant-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.merchantTab = (btn as HTMLElement).dataset.tab as 'shop' | 'upgrades';
        this.renderMerchantPanel();
      });
    });
  }

  private renderMerchantShopTab(crystals: number): string {
    const items = this.backpackManager.getMerchantItems();

    // Slot upgrades section
    let slotContent = '';
    const nextUpgrade = this.backpackManager.getNextSlotUpgrade();
    if (nextUpgrade) {
      const canAfford = crystals >= nextUpgrade.cost;
      slotContent = `
        <div style="
          background: rgba(68,170,255,0.08); border: 1px solid rgba(68,170,255,0.3);
          border-radius: 10px; padding: 12px; margin-bottom: 16px;
        ">
          <div style="color: #44aaff; font-size: 13px; font-weight: bold; margin-bottom: 8px;">
            \u{1F392} Rucksack-Upgrade
          </div>
          <div class="slot-upgrade-btn" style="
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; background: rgba(0,0,0,0.3);
            border: 1px solid ${canAfford ? 'rgba(68,170,255,0.5)' : 'rgba(255,255,255,0.1)'};
            border-radius: 8px; cursor: ${canAfford ? 'pointer' : 'not-allowed'};
            opacity: ${canAfford ? '1' : '0.5'}; transition: all 0.15s;
          ">
            <div>
              <div style="color: #fff; font-size: 13px; font-weight: bold;">${nextUpgrade.label}</div>
              <div style="color: #888; font-size: 10px;">Max ${nextUpgrade.maxAfter} Pl\u00e4tze</div>
            </div>
            <div style="color: ${canAfford ? '#aa88ff' : '#555'}; font-size: 13px; font-weight: bold;">
              \u{1F48E} ${nextUpgrade.cost}
            </div>
          </div>
        </div>
      `;
    } else {
      slotContent = `
        <div style="
          background: rgba(68,255,68,0.05); border: 1px solid rgba(68,255,68,0.2);
          border-radius: 10px; padding: 10px; margin-bottom: 16px;
          color: #44ff88; font-size: 12px; text-align: center;
        ">
          \u2714 Alle Rucksack-Upgrades gekauft!
        </div>
      `;
    }

    // Categorize weapons: Türme | Fallen
    const towers = items.filter(i => !BALANCE.weapons[i.weapon].isPath);
    const traps = items.filter(i => BALANCE.weapons[i.weapon].isPath);

    let weaponContent = '';
    if (items.length === 0) {
      weaponContent = '<div style="color: #666; text-align: center; padding: 20px;">Alles freigeschaltet!</div>';
    } else {
      if (towers.length > 0) {
        weaponContent += `<div style="color: #ffaa44; font-size: 11px; font-weight: bold; margin: 8px 0 6px; text-transform: uppercase; letter-spacing: 1px;">T\u00fcrme</div>`;
        weaponContent += this.renderMerchantItems(towers, crystals);
      }
      if (traps.length > 0) {
        weaponContent += `<div style="color: #44ff88; font-size: 11px; font-weight: bold; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 1px;">Fallen</div>`;
        weaponContent += this.renderMerchantItems(traps, crystals);
      }
    }

    return slotContent + weaponContent;
  }

  private renderMerchantUpgradesTab(crystals: number): string {
    const upgrades = this.backpackManager.getPermanentUpgrades();
    let html = `
      <div style="color: #cc44ff; font-size: 11px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
        Dauerhafte Verbesserungen
      </div>
      <div style="color: #888; font-size: 10px; margin-bottom: 12px;">
        Diese Boni gelten f\u00fcr alle zuk\u00fcnftigen Durchl\u00e4ufe.
      </div>
    `;

    for (const upgrade of upgrades) {
      const isMaxed = upgrade.currentLevel >= upgrade.maxLevel;
      const nextCost = isMaxed ? 0 : upgrade.costPerLevel[upgrade.currentLevel];
      const canAfford = !isMaxed && crystals >= nextCost;

      // Calculate current bonus display
      let bonusText = '';
      switch (upgrade.id) {
        case 'towerDamage': bonusText = `+${upgrade.currentLevel * 5}% Schaden`; break;
        case 'goldBonus':   bonusText = `+${upgrade.currentLevel * 8}% Gold`; break;
        case 'baseHP':      bonusText = `+${upgrade.currentLevel * 100} HP`; break;
        case 'startGold':   bonusText = `+${upgrade.currentLevel * 15} Gold`; break;
        case 'fireRate':    bonusText = `+${upgrade.currentLevel * 3}% Feuerrate`; break;
        case 'range':       bonusText = `+${upgrade.currentLevel * 3}% Reichweite`; break;
        case 'crystalFind': bonusText = `+${upgrade.currentLevel * 10}% Kristalle`; break;
      }

      // Level pips
      let pips = '';
      for (let i = 0; i < upgrade.maxLevel; i++) {
        const filled = i < upgrade.currentLevel;
        pips += `<span style="
          display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 2px;
          background: ${filled ? '#cc44ff' : 'rgba(255,255,255,0.1)'};
          border: 1px solid ${filled ? '#dd66ff' : 'rgba(255,255,255,0.15)'};
        "></span>`;
      }

      html += `
        <div class="perm-upgrade-item" data-upgrade-id="${upgrade.id}" style="
          display: flex; align-items: center; gap: 10px;
          padding: 10px; margin-bottom: 6px;
          background: rgba(204,68,255,0.04);
          border: 1px solid ${isMaxed ? 'rgba(68,255,68,0.3)' : canAfford ? 'rgba(204,68,255,0.4)' : 'rgba(255,255,255,0.1)'};
          border-radius: 10px;
          cursor: ${canAfford ? 'pointer' : 'default'};
          opacity: ${isMaxed || canAfford ? '1' : '0.6'};
          transition: all 0.15s;
        ">
          <span style="font-size: 22px; flex-shrink: 0;">${upgrade.icon}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #fff; font-size: 13px; font-weight: bold;">${upgrade.name}</span>
              <span style="color: ${isMaxed ? '#44ff88' : '#888'}; font-size: 11px;">${upgrade.currentLevel}/${upgrade.maxLevel}</span>
            </div>
            <div style="color: #aaa; font-size: 10px; margin-top: 2px;">${upgrade.description}</div>
            <div style="margin-top: 4px;">${pips}</div>
            ${upgrade.currentLevel > 0 ? `<div style="color: #cc88ff; font-size: 10px; margin-top: 2px;">Aktuell: ${bonusText}</div>` : ''}
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            ${isMaxed
              ? '<span style="color: #44ff88; font-size: 12px; font-weight: bold;">MAX</span>'
              : `<div style="color: ${canAfford ? '#aa88ff' : '#555'}; font-size: 13px; font-weight: bold; white-space: nowrap;">
                  \u{1F48E} ${nextCost}
                </div>`
            }
          </div>
        </div>
      `;
    }

    return html;
  }

  private renderMerchantItems(items: { weapon: WeaponKey; cost: number }[], crystals: number): string {
    let html = '';
    for (const item of items) {
      const config = BALANCE.weapons[item.weapon];
      const canAfford = crystals >= item.cost;
      const icon = WEAPON_ICONS[item.weapon] || '\u2753';
      html += `
        <div class="merchant-item" data-weapon="${item.weapon}" style="
          display: flex; align-items: center; gap: 10px;
          padding: 10px; margin-bottom: 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid ${canAfford ? 'rgba(255,170,68,0.4)' : 'rgba(255,255,255,0.1)'};
          border-radius: 10px;
          cursor: ${canAfford ? 'pointer' : 'not-allowed'};
          opacity: ${canAfford ? '1' : '0.5'};
          transition: all 0.15s;
        ">
          <span style="font-size: 24px;">${icon}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="color: #fff; font-size: 13px; font-weight: bold;">${config.name}</div>
            <div style="color: #888; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${config.description}</div>
          </div>
          <div style="color: ${canAfford ? '#aa88ff' : '#555'}; font-size: 13px; font-weight: bold; white-space: nowrap;">
            \u{1F48E} ${item.cost}
          </div>
        </div>
      `;
    }
    return html;
  }

  // ─── Chest Panel (stash) ───────────────────────
  private renderChestPanel(): void {
    const unlocked = this.backpackManager.getUnlockedWeapons();
    const equipped = this.backpackManager.getEquipped();

    // Categorize
    const towers = unlocked.filter(w => !BALANCE.weapons[w].isPath);
    const traps = unlocked.filter(w => BALANCE.weapons[w].isPath);

    let content = `
      <div style="color: #888; font-size: 12px; text-align: center; margin-bottom: 12px;">
        ${unlocked.length} Waffen freigeschaltet — Klicke zum Einpacken/Ablegen
      </div>
    `;

    if (towers.length > 0) {
      content += `<div style="color: #ffaa44; font-size: 11px; font-weight: bold; margin: 8px 0 6px; text-transform: uppercase; letter-spacing: 1px;">T\u00fcrme (${towers.length})</div>`;
      content += '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">';
      content += this.renderChestItems(towers, equipped);
      content += '</div>';
    }
    if (traps.length > 0) {
      content += `<div style="color: #44ff88; font-size: 11px; font-weight: bold; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 1px;">Fallen (${traps.length})</div>`;
      content += '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">';
      content += this.renderChestItems(traps, equipped);
      content += '</div>';
    }

    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F4E6} Truhe', '#44ff88', 'rgba(68,255,68,0.5)', content
    );
    this.attachPanelHandlers();
  }

  private renderChestItems(weapons: WeaponKey[], equipped: WeaponKey[]): string {
    let html = '';
    for (const weapon of weapons) {
      const config = BALANCE.weapons[weapon];
      const isEquipped = equipped.includes(weapon);
      const icon = WEAPON_ICONS[weapon] || '\u2753';
      html += `
        <div class="chest-item" data-weapon="${weapon}" style="
          background: ${isEquipped ? 'rgba(68,170,255,0.15)' : 'rgba(68,255,68,0.05)'};
          border: 1px solid ${isEquipped ? 'rgba(68,170,255,0.4)' : 'rgba(68,255,68,0.2)'};
          border-radius: 10px;
          padding: 10px 4px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s;
        " title="${isEquipped ? 'Klicken zum Ablegen' : 'Klicken zum Einpacken: ' + config.name}">
          <div style="font-size: 22px;">${icon}</div>
          <div style="color: #ccc; font-size: 9px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${config.name}</div>
          ${isEquipped ? '<div style="color: #44aaff; font-size: 8px;">\u2714 Ausger\u00fcstet</div>' : ''}
        </div>
      `;
    }
    return html;
  }

  // ─── Backpack Panel (Popup) ─────────────────────
  private renderBackpackPanel(): void {
    const equipped = this.backpackManager.getEquipped();
    const maxSlots = this.backpackManager.getMaxSlots();
    const stats = this.backpackManager.getStats();

    // Split equipped into towers and traps
    const equippedTowers = equipped.filter(w => !BALANCE.weapons[w].isPath);
    const equippedTraps = equipped.filter(w => BALANCE.weapons[w].isPath);

    let html = `
      <div style="
        background: rgba(10,10,26,0.92);
        border: 2px solid rgba(68,170,255,0.4);
        border-radius: 16px;
        padding: 20px;
        min-width: min(400px, 92vw);
        max-width: min(400px, 92vw);
        max-height: 70vh;
        overflow-y: auto;
        box-shadow: 0 0 40px rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="color: #44aaff; font-size: 20px; margin: 0;">
            \u{1F392} Rucksack
          </h3>
          <button class="bp-close-btn" style="
            background: none; border: 1px solid #555; color: #888;
            border-radius: 50%; width: 28px; height: 28px; font-size: 16px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
          ">\u2715</button>
        </div>

        <!-- Slot Progress -->
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; color: #888; font-size: 11px; margin-bottom: 4px;">
            <span>${equipped.length} / ${maxSlots} belegt</span>
            <span>Max: ${stats.maxCapacity}</span>
          </div>
          <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
            <div style="width: ${(equipped.length / maxSlots) * 100}%; height: 100%; background: #44aaff; border-radius: 3px; transition: width 0.3s;"></div>
          </div>
        </div>

        <!-- Equipped Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 14px;">
    `;

    for (let i = 0; i < maxSlots; i++) {
      const weapon = equipped[i];
      if (weapon) {
        const config = BALANCE.weapons[weapon];
        const icon = WEAPON_ICONS[weapon] || '\u2753';
        const isPath = config.isPath;
        const borderCol = isPath ? 'rgba(68,255,68,0.3)' : 'rgba(68,170,255,0.3)';
        const bgCol = isPath ? 'rgba(68,255,68,0.08)' : 'rgba(68,170,255,0.08)';
        html += `
          <div class="bp-slot" data-weapon="${weapon}" style="
            background: ${bgCol}; border: 1px solid ${borderCol};
            border-radius: 8px; padding: 6px 3px; text-align: center;
            cursor: pointer; transition: all 0.15s;
          " title="Klicken zum Ablegen: ${config.name}">
            <div style="font-size: 18px;">${icon}</div>
            <div style="color: #ccc; font-size: 8px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${config.name}</div>
          </div>
        `;
      } else {
        html += `
          <div style="
            background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);
            border-radius: 8px; padding: 6px 3px; text-align: center;
          ">
            <div style="font-size: 18px; opacity: 0.15;">+</div>
            <div style="color: #333; font-size: 8px; margin-top: 2px;">Leer</div>
          </div>
        `;
      }
    }

    html += '</div>';

    // ─── Stats Section ──────────────────────
    html += `
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-bottom: 10px;">
          <div style="color: #ffcc44; font-size: 11px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
            \u{1F4CA} Statistiken
          </div>
    `;

    // Weapon breakdown
    html += `
          <div style="color: #aaa; font-size: 11px; line-height: 1.8;">
            <div style="display: flex; justify-content: space-between;">
              <span>Waffen freigeschaltet:</span>
              <span style="color: #fff;">${stats.totalUnlocked} / ${stats.totalWeapons}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>T\u00fcrme:</span>
              <span style="color: #ffaa44;">${stats.towersUnlocked}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Fallen:</span>
              <span style="color: #44ff88;">${stats.trapsUnlocked}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>\u{1F48E} Kristalle:</span>
              <span style="color: #aa88ff;">${stats.crystals}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Rucksack-Level:</span>
              <span style="color: #44aaff;">${stats.upgradeLevel} / 3</span>
            </div>
          </div>
    `;

    html += '</div>';

    // ─── Equipped Details ────────────────────
    if (equippedTowers.length > 0) {
      html += `
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-bottom: 8px;">
          <div style="color: #ffaa44; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">
            Ausgr\u00fcstete T\u00fcrme
          </div>
      `;
      for (const w of equippedTowers) {
        html += this.renderWeaponDetail(w);
      }
      html += '</div>';
    }

    if (equippedTraps.length > 0) {
      html += `
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px; margin-bottom: 8px;">
          <div style="color: #44ff88; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">
            Ausgr\u00fcstete Fallen
          </div>
      `;
      for (const w of equippedTraps) {
        html += this.renderWeaponDetail(w);
      }
      html += '</div>';
    }

    // ─── Upgrade Info ────────────────────────
    html += `
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
          <div style="color: #44aaff; font-size: 11px; font-weight: bold; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">
            \u2B06 Upgrade-Info
          </div>
          <div style="color: #888; font-size: 10px; line-height: 1.6;">
            <div>\u2022 Upgrades erh\u00f6hen Schaden um <span style="color: #44ff44;">+50%</span> pro Level</div>
            <div>\u2022 Reichweite steigt um <span style="color: #44ff44;">+10%</span> pro Level</div>
            <div>\u2022 Max Level: <span style="color: #ffcc44;">5</span></div>
            <div>\u2022 Upgrades sind nur <span style="color: #ff8844;">zwischen Wellen</span> m\u00f6glich</div>
            <div style="margin-top: 4px;">\u2022 Kosten: Level\u00d7Grundpreis\u00d70.5</div>
          </div>
        </div>
    `;

    html += '</div>'; // close main container

    this.backpackPanel.innerHTML = html;
    this.attachBackpackHandlers();

    // Close button handler
    const closeBtn = this.backpackPanel.querySelector('.bp-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.backpackPanel.style.display = 'none';
      });
    }
  }

  private renderWeaponDetail(weapon: WeaponKey): string {
    const config = BALANCE.weapons[weapon];
    const icon = WEAPON_ICONS[weapon] || '\u2753';

    // Build stats
    let statsStr = '';
    if ('damage' in config && (config as any).damage > 0) {
      statsStr += `<span style="color: #ff8844;">${(config as any).damage} Schaden</span> `;
    }
    if ('range' in config && (config as any).range > 0) {
      statsStr += `<span style="color: #44aaff;">${(config as any).range} Reichweite</span> `;
    }
    if ('fireRate' in config && (config as any).fireRate > 0) {
      statsStr += `<span style="color: #ffcc44;">${(config as any).fireRate}/s</span> `;
    }
    if ('splashRadius' in config) {
      statsStr += `<span style="color: #ff6666;">Fl\u00e4che ${(config as any).splashRadius}</span> `;
    }
    if ('slowFactor' in config) {
      const slow = Math.round((1 - (config as any).slowFactor) * 100);
      statsStr += `<span style="color: #88ccff;">${slow}% Slow</span> `;
    }
    if ('dotDamage' in config) {
      statsStr += `<span style="color: #ff8844;">+${(config as any).dotDamage} DoT</span> `;
    }
    if ('chainTargets' in config) {
      statsStr += `<span style="color: #cc88ff;">${(config as any).chainTargets} Kette</span> `;
    }

    return `
      <div style="
        display: flex; align-items: flex-start; gap: 8px;
        padding: 6px 8px; margin-bottom: 4px;
        background: rgba(255,255,255,0.02); border-radius: 6px;
      ">
        <span style="font-size: 16px; flex-shrink: 0;">${icon}</span>
        <div style="min-width: 0; flex: 1;">
          <div style="color: #fff; font-size: 11px; font-weight: bold;">${config.name}</div>
          <div style="color: #666; font-size: 9px; margin-top: 1px;">${config.description}</div>
          <div style="font-size: 9px; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 2px 6px;">
            ${statsStr}
          </div>
          <div style="color: #ffcc00; font-size: 9px; margin-top: 2px;">\u{1FA99} ${config.cost} Gold</div>
        </div>
      </div>
    `;
  }

  // ─── Daily Challenge Panel ─────────────────────
  private renderDailyPanel(): void {
    const cardHtml = this.dailyChallenge.renderChallengeCard();
    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F525} T\u00e4gliche Herausforderung', '#ff8844', 'rgba(255,136,0,0.5)',
      cardHtml
    );
    this.attachPanelHandlers();

    // Wire daily challenge start button
    const startBtn = this.panelContainer.querySelector('#daily-challenge-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (this.onDailyChallengeStart) {
          this.closePanel();
          this.hide();
          this.onDailyChallengeStart();
        }
      });
    }
  }

  // ─── Stats Panel ──────────────────────────────
  private renderStatsPanel(): void {
    const statsHtml = this.persistentStats.renderStatsPanel();
    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F4CA} Statistiken', '#44aaff', 'rgba(68,170,255,0.5)',
      statsHtml
    );
    this.attachPanelHandlers();
  }

  // ─── Achievements Panel ───────────────────────
  private renderAchievementsPanel(): void {
    const achieveHtml = this.achievements.renderAchievementPanel();
    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F3C6} Erfolge', '#ffcc44', 'rgba(255,204,68,0.5)',
      achieveHtml
    );
    this.attachPanelHandlers();
  }

  // ─── Encyclopedia Panel (Turm-Lexikon) ────────
  private renderEncyclopediaPanel(): void {
    const content = this.towerEncyclopedia.renderContent();
    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F4D6} Turm-Lexikon', '#ff88cc', 'rgba(255,136,204,0.5)',
      content
    );

    // Make the panel wider for the encyclopedia
    const innerPanel = this.panelContainer.querySelector('div') as HTMLDivElement;
    if (innerPanel) {
      innerPanel.style.minWidth = 'min(460px, 92vw)';
      innerPanel.style.maxWidth = 'min(580px, 92vw)';
    }

    this.attachPanelHandlers();

    // Tab switching
    this.panelContainer.querySelectorAll('.lexikon-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab as 'alle' | 'tuerme' | 'fallen';
        this.towerEncyclopedia.setFilter(tab);
        this.renderEncyclopediaPanel();
      });
    });
  }

  // ─── High Scores Panel (Bestenliste) ──────────
  private renderHighScoresPanel(): void {
    const content = this.highScoreSystem.renderLeaderboardPanel();
    this.panelContainer.innerHTML = this.panelWrapper(
      '&#127942; Bestenliste', '#ffd700', 'rgba(255,215,0,0.5)',
      content
    );

    // Make the panel wider for the leaderboard
    const innerPanel = this.panelContainer.querySelector('div') as HTMLDivElement;
    if (innerPanel) {
      innerPanel.style.minWidth = 'min(420px, 92vw)';
      innerPanel.style.maxWidth = 'min(540px, 92vw)';
    }

    this.attachPanelHandlers();
  }

  // ─── Save Panel ───────────────────────────────
  private renderSavePanel(): void {
    const saveHtml = this.saveSystem.renderSavePanel();
    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F4BE} Spiel speichern', '#44ff88', 'rgba(68,255,136,0.5)',
      saveHtml
    );
    this.attachPanelHandlers();
    this.attachSaveHandlers('save');
  }

  // ─── Load Panel ───────────────────────────────
  private renderLoadPanel(): void {
    const loadHtml = this.saveSystem.renderLoadPanel();
    this.panelContainer.innerHTML = this.panelWrapper(
      '\u{1F4C2} Spiel laden', '#88aacc', 'rgba(136,170,204,0.5)',
      loadHtml
    );
    this.attachPanelHandlers();
    this.attachSaveHandlers('load');
  }

  // ─── Save/Load Handlers ───────────────────────
  private attachSaveHandlers(mode: 'save' | 'load'): void {
    // Slot card clicks
    this.panelContainer.querySelectorAll('.save-slot-card').forEach(card => {
      card.addEventListener('click', () => {
        const slotStr = (card as HTMLElement).dataset.slot!;
        const cardMode = (card as HTMLElement).dataset.mode;

        if (cardMode === 'save') {
          const slotIndex = parseInt(slotStr);
          // Save current run state to this slot
          const saveData = this.buildCurrentSaveData(slotStr === 'auto' ? 'Autospeicherung' : `Platz ${slotIndex + 1}`);
          if (saveData) {
            this.saveSystem.save(slotIndex, saveData);
            this.renderPanel(); // refresh
          }
        } else if (cardMode === 'load') {
          const slotIndex = slotStr === 'auto' ? -1 : parseInt(slotStr);
          const data = slotIndex === -1
            ? this.saveSystem.loadAutoSave()
            : this.saveSystem.load(slotIndex);
          if (data) {
            // TODO: implement load game state callback
            console.log('[SaveSystem] Spielstand geladen:', data);
          }
        }
      });
    });

    // Delete buttons
    this.panelContainer.querySelectorAll('.save-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotStr = (btn as HTMLElement).dataset.slot!;
        if (slotStr === 'auto') {
          this.saveSystem.deleteAutoSave();
        } else {
          this.saveSystem.delete(parseInt(slotStr));
        }
        this.renderPanel();
      });
    });

    // Export buttons
    this.panelContainer.querySelectorAll('.save-export-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotIndex = parseInt((btn as HTMLElement).dataset.slot!);
        const json = this.saveSystem.exportSave(slotIndex);
        if (json) {
          navigator.clipboard.writeText(json).then(() => {
            (btn as HTMLElement).textContent = 'Kopiert!';
            setTimeout(() => { (btn as HTMLElement).textContent = 'Export'; }, 1500);
          }).catch(() => {
            // Fallback: show in a prompt
            prompt('Spielstand (kopieren):', json);
          });
        }
      });
    });

    // Import button
    const importBtn = this.panelContainer.querySelector('#save-import-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        const json = prompt('Spielstand-JSON einf\u00fcgen:');
        if (json) {
          const data = this.saveSystem.importSave(json);
          if (data) {
            // Save to first empty slot
            const saves = this.saveSystem.listSaves();
            const emptySlot = saves.findIndex(s => s === null);
            if (emptySlot >= 0) {
              this.saveSystem.save(emptySlot, data);
            } else {
              this.saveSystem.save(0, data); // overwrite slot 0
            }
            this.renderPanel();
          }
        }
      });
    }
  }

  /** Build a basic SaveData from current hub state (between-levels save) */
  private buildCurrentSaveData(slotName: string): import('../systems/SaveSystem').SaveData {
    return {
      version: 1,
      timestamp: Date.now(),
      slotName,
      currentLevelIndex: 0,
      runModifiers: { chosenRewards: [] },
    };
  }

  // ─── Chest Reward Popup ────────────────────────
  private showChestRewardPopup(reward: ChestReward): void {
    const tierNames: Record<string, string> = { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' };
    const tierColors: Record<string, string> = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700' };
    const tierName = tierNames[reward.tier];
    const tierColor = tierColors[reward.tier];

    let weaponList = '';
    for (const w of reward.weapons) {
      const config = BALANCE.weapons[w];
      const icon = WEAPON_ICONS[w] || '\u2753';
      weaponList += `<div style="margin: 4px 0;">${icon} <strong>${config.name}</strong> <span style="color: #888;">— ${config.description}</span></div>`;
    }

    const popup = document.createElement('div');
    popup.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(10,10,26,0.95); border: 3px solid ${tierColor};
      border-radius: 20px; padding: 30px; min-width: 320px; max-width: 420px;
      text-align: center; z-index: 300; pointer-events: auto;
      box-shadow: 0 0 60px rgba(0,0,0,0.7), 0 0 20px ${tierColor}40;
      animation: chestPop 0.5s ease;
    `;
    popup.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 10px;">\u{1F4E6}</div>
      <div style="font-size: 24px; font-weight: bold; color: ${tierColor}; margin-bottom: 12px;">
        ${tierName}-Truhe!
      </div>
      <div style="text-align: left; color: #ccc; font-size: 13px; margin-bottom: 12px;">
        ${weaponList}
      </div>
      <div style="color: #aa88ff; font-size: 15px; margin-bottom: 6px;">
        +${reward.crystals} \u{1F48E} Kristalle
      </div>
      ${reward.slotUpgrade > 0 ? `<div style="color: #44aaff; font-size: 13px;">+${reward.slotUpgrade} Rucksack-Platz</div>` : ''}
      <button id="chest-popup-close" style="
        margin-top: 18px; padding: 10px 30px; font-size: 14px; font-weight: bold;
        color: #fff; background: linear-gradient(135deg, ${tierColor}, ${tierColor}88);
        border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s;
      ">Einsammeln</button>
    `;
    document.body.appendChild(popup);

    const closeBtn = document.getElementById('chest-popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        popup.remove();
        this.renderHeader();
        this.renderBackpackPanel();
      });
    }
  }

  // ─── Event Handlers ─────────────────────────────
  private attachPanelHandlers(): void {
    // Close button
    const closeBtn = this.panelContainer.querySelector('.hub-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePanel());
    }

    // Slot upgrade
    const slotBtn = this.panelContainer.querySelector('.slot-upgrade-btn');
    if (slotBtn) {
      slotBtn.addEventListener('click', () => {
        if (this.backpackManager.canBuySlotUpgrade()) {
          this.backpackManager.buySlotUpgrade();
          this.renderHeader();
          this.renderBackpackPanel();
          this.renderPanel();
        }
      });
    }

    // Merchant buy
    this.panelContainer.querySelectorAll('.merchant-item').forEach(item => {
      item.addEventListener('click', () => {
        const weapon = (item as HTMLElement).dataset.weapon as WeaponKey;
        if (this.backpackManager.canBuy(weapon)) {
          this.backpackManager.buyWeapon(weapon);
          this.renderHeader();
          this.renderBackpackPanel();
          this.renderPanel();
        }
      });
    });

    // Permanent upgrade buy
    this.panelContainer.querySelectorAll('.perm-upgrade-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.upgradeId;
        if (id && this.backpackManager.buyPermanentUpgrade(id)) {
          this.renderHeader();
          this.renderBackpackPanel();
          this.renderPanel();
        }
      });
    });

    // Chest equip/unequip
    this.panelContainer.querySelectorAll('.chest-item').forEach(item => {
      item.addEventListener('click', () => {
        const weapon = (item as HTMLElement).dataset.weapon as WeaponKey;
        if (this.backpackManager.isEquipped(weapon)) {
          this.backpackManager.unequipWeapon(weapon);
        } else {
          this.backpackManager.equipWeapon(weapon);
        }
        this.renderHeader();
        this.renderBackpackPanel();
        this.renderPanel();
      });
    });
  }

  private attachBackpackHandlers(): void {
    // Backpack slot unequip
    this.backpackPanel.querySelectorAll('.bp-slot').forEach(slot => {
      slot.addEventListener('click', () => {
        const weapon = (slot as HTMLElement).dataset.weapon as WeaponKey;
        this.backpackManager.unequipWeapon(weapon);
        this.renderHeader();
        this.renderBackpackPanel();
        if (this.activePanel) this.renderPanel();
      });
    });
  }
}
