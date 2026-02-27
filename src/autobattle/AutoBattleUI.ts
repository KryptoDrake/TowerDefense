// Auto-Battle UI: HTML-Overlay für den Auto-Kampf-Modus.
// TFT-artiges Interface mit Laden, Bank, Info-Leiste und Phasen-Banner.

import { AutoBattleShop } from './AutoBattleShop';
import { AutoBattleUnit } from './AutoBattleUnit';

export type ABPhase = 'planning' | 'combat' | 'result';

// Rollen-Bezeichnungen auf Deutsch
const ROLE_LABELS: Record<string, string> = {
  tank: 'Panzer',
  dps_melee: 'Nahkampf',
  dps_ranged: 'Fernkampf',
  support: 'Unterstützung',
  specialist: 'Spezialist',
};

// Element-Farben
const ELEMENT_COLORS: Record<string, string> = {
  physical: '#aaaaaa',
  fire: '#ff4400',
  ice: '#88ccff',
  lightning: '#ffcc00',
  poison: '#27ae60',
  arcane: '#aa44ff',
  nature: '#44dd66',
  dark: '#9944cc',
};

// Stern-Symbole
function starString(level: number): string {
  if (level === 1) return '\u2605';
  if (level === 2) return '\u2605\u2605';
  if (level === 3) return '\u2605\u2605\u2605';
  return '';
}

// Stern-Farben
function starColor(level: number): string {
  if (level === 1) return '#cccccc';
  if (level === 2) return '#44aaff';
  if (level === 3) return '#ffcc00';
  return '#cccccc';
}

export class AutoBattleUI {
  private container: HTMLDivElement;
  private infoBar: HTMLDivElement;
  private shopPanel: HTMLDivElement;
  private benchPanel: HTMLDivElement;
  private actionBar: HTMLDivElement;
  private phaseBanner: HTMLDivElement;
  private resultPanel: HTMLDivElement;
  private combatLabel: HTMLDivElement;
  private timerLabel: HTMLSpanElement;
  private visible = false;

  // Callbacks
  onBuyUnit: ((slotIndex: number) => void) | null = null;
  onSellUnit: ((unitId: string) => void) | null = null;
  onRefreshShop: (() => void) | null = null;
  onBuyXP: (() => void) | null = null;
  onStartCombat: (() => void) | null = null;
  onBenchToBoard: ((unitId: string) => void) | null = null;

  // Statisches Instanz-Pattern gegen Event-Listener-Stacking
  private static instance: AutoBattleUI | null = null;
  private static listenersAttached = false;

  constructor() {
    AutoBattleUI.instance = this;

    // Haupt-Container
    this.container = document.createElement('div');
    this.container.id = 'ab-ui-container';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 300;
      pointer-events: none;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #e0e0e0;
    `;

    // Info-Leiste (oben)
    this.infoBar = document.createElement('div');
    this.infoBar.id = 'ab-info-bar';
    this.infoBar.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%;
      display: flex; justify-content: center; align-items: center; gap: 24px;
      padding: 10px 20px;
      background: linear-gradient(180deg, rgba(8,8,20,0.92) 0%, rgba(8,8,20,0.7) 80%, rgba(8,8,20,0) 100%);
      pointer-events: auto;
      box-sizing: border-box;
      font-size: 15px;
      flex-wrap: wrap;
    `;
    this.container.appendChild(this.infoBar);

    // Timer-Label (unter Info-Leiste)
    this.timerLabel = document.createElement('span');
    this.timerLabel.id = 'ab-timer';
    this.timerLabel.style.cssText = `
      position: absolute;
      top: 52px; left: 50%;
      transform: translateX(-50%);
      font-size: 20px; font-weight: bold;
      color: #ffcc44;
      text-shadow: 0 0 8px rgba(255,200,0,0.5);
      pointer-events: none;
    `;
    this.container.appendChild(this.timerLabel);

    // Kampf-Label (während Kampfphase)
    this.combatLabel = document.createElement('div');
    this.combatLabel.id = 'ab-combat-label';
    this.combatLabel.style.cssText = `
      display: none;
      position: absolute;
      bottom: 20px; left: 50%;
      transform: translateX(-50%);
      padding: 10px 30px;
      background: rgba(120,30,30,0.85);
      border: 1px solid rgba(255,80,80,0.4);
      border-radius: 8px;
      font-size: 18px; font-weight: bold;
      color: #ff8888;
      text-shadow: 0 0 6px rgba(255,0,0,0.4);
      pointer-events: none;
    `;
    this.combatLabel.textContent = 'Kampfphase...';
    this.container.appendChild(this.combatLabel);

    // Bank-Panel (über dem Laden)
    this.benchPanel = document.createElement('div');
    this.benchPanel.id = 'ab-bench-panel';
    this.benchPanel.style.cssText = `
      position: absolute;
      bottom: 130px; left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      background: rgba(8,8,20,0.88);
      border: 1px solid rgba(100,100,160,0.3);
      border-radius: 8px;
      pointer-events: auto;
      min-height: 52px;
    `;
    this.container.appendChild(this.benchPanel);

    // Laden-Panel (unten)
    this.shopPanel = document.createElement('div');
    this.shopPanel.id = 'ab-shop-panel';
    this.shopPanel.style.cssText = `
      position: absolute;
      bottom: 60px; left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      background: rgba(8,8,20,0.92);
      border: 1px solid rgba(100,100,160,0.35);
      border-radius: 8px;
      pointer-events: auto;
    `;
    this.container.appendChild(this.shopPanel);

    // Aktions-Leiste (ganz unten)
    this.actionBar = document.createElement('div');
    this.actionBar.id = 'ab-action-bar';
    this.actionBar.style.cssText = `
      position: absolute;
      bottom: 8px; left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 10px;
      padding: 6px 14px;
      pointer-events: auto;
    `;
    this.container.appendChild(this.actionBar);

    // Phasen-Banner (groß, zentriert, blendet aus)
    this.phaseBanner = document.createElement('div');
    this.phaseBanner.id = 'ab-phase-banner';
    this.phaseBanner.style.cssText = `
      display: none;
      position: absolute;
      top: 40%; left: 50%;
      transform: translate(-50%, -50%);
      padding: 20px 60px;
      background: rgba(0,0,0,0.8);
      border: 2px solid rgba(200,180,100,0.5);
      border-radius: 12px;
      font-size: 32px; font-weight: bold;
      color: #ffd866;
      text-shadow: 0 0 12px rgba(255,200,0,0.4);
      text-align: center;
      pointer-events: none;
      transition: opacity 0.5s ease;
    `;
    this.container.appendChild(this.phaseBanner);

    // Ergebnis-Panel (nach Kampf)
    this.resultPanel = document.createElement('div');
    this.resultPanel.id = 'ab-result-panel';
    this.resultPanel.style.cssText = `
      display: none;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      padding: 24px 40px;
      background: rgba(8,8,20,0.95);
      border: 2px solid rgba(200,180,100,0.5);
      border-radius: 12px;
      font-size: 18px;
      text-align: center;
      pointer-events: none;
      min-width: 280px;
    `;
    this.container.appendChild(this.resultPanel);

    document.body.appendChild(this.container);
  }

  /** Auto-Battle UI anzeigen */
  show(): void {
    this.visible = true;
    this.container.style.display = 'block';
  }

  /** UI verstecken und alle Elemente entfernen */
  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  /** Nur Timer-Anzeige aktualisieren (kein DOM-Rebuild) */
  updateTimer(planTimer: number): void {
    if (planTimer > 0) {
      this.timerLabel.style.display = 'block';
      this.timerLabel.textContent = `\u23F1 ${Math.ceil(planTimer)}s`;
    } else {
      this.timerLabel.style.display = 'none';
    }
  }

  /** Alle UI-Elemente aktualisieren */
  updateUI(
    shop: AutoBattleShop,
    phase: ABPhase,
    round: number,
    playerHP: number,
    boardCount: number,
    maxBoard: number,
    planTimer?: number
  ): void {
    this.updateInfoBar(shop, round, playerHP, boardCount, maxBoard);

    if (phase === 'planning') {
      this.shopPanel.style.display = 'flex';
      this.benchPanel.style.display = 'flex';
      this.actionBar.style.display = 'flex';
      this.combatLabel.style.display = 'none';
      this.resultPanel.style.display = 'none';
      this.updateShop(shop);
      this.updateBench(shop.bench);
      this.updateActionBar(shop);

      // Timer anzeigen
      if (planTimer !== undefined && planTimer > 0) {
        this.timerLabel.style.display = 'block';
        this.timerLabel.textContent = `\u23F1 ${Math.ceil(planTimer)}s`;
      } else {
        this.timerLabel.style.display = 'none';
      }
    } else if (phase === 'combat') {
      this.shopPanel.style.display = 'none';
      this.benchPanel.style.display = 'none';
      this.actionBar.style.display = 'none';
      this.combatLabel.style.display = 'block';
      this.resultPanel.style.display = 'none';
      this.timerLabel.style.display = 'none';
    } else {
      // result
      this.shopPanel.style.display = 'none';
      this.benchPanel.style.display = 'none';
      this.actionBar.style.display = 'none';
      this.combatLabel.style.display = 'none';
      this.timerLabel.style.display = 'none';
      // resultPanel wird separat über showResult gesteuert
    }
  }

  /** Laden-Slots aktualisieren */
  private updateShop(shop: AutoBattleShop): void {
    this.shopPanel.innerHTML = '';

    // Label
    const label = document.createElement('span');
    label.style.cssText = `
      font-size: 12px; color: #888; margin-right: 6px;
      writing-mode: vertical-rl; text-orientation: mixed;
      letter-spacing: 2px;
    `;
    label.textContent = 'LADEN';
    this.shopPanel.appendChild(label);

    for (let i = 0; i < 5; i++) {
      const def = shop.shopSlots[i];
      const slot = document.createElement('div');

      if (def) {
        const canAfford = shop.gold >= def.shopCost;
        const benchFull = shop.bench.length >= shop.MAX_BENCH;
        const disabled = !canAfford || benchFull;

        const elColor = ELEMENT_COLORS[def.element] || '#aaa';
        const tierBg = this.getTierBackground(def.tier);

        slot.style.cssText = `
          width: 110px; height: 68px;
          background: ${tierBg};
          border: 1px solid ${disabled ? 'rgba(80,80,80,0.4)' : elColor};
          border-radius: 6px;
          padding: 5px 7px;
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          opacity: ${disabled ? '0.5' : '1'};
          transition: transform 0.1s, box-shadow 0.15s;
          display: flex; flex-direction: column; justify-content: space-between;
          position: relative;
          overflow: hidden;
        `;

        // Element-Farbstreifen oben
        const stripe = document.createElement('div');
        stripe.style.cssText = `
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: ${elColor};
        `;
        slot.appendChild(stripe);

        // Name
        const nameEl = document.createElement('div');
        nameEl.style.cssText = `
          font-size: 11px; font-weight: bold; color: #eee;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-top: 2px;
        `;
        nameEl.textContent = def.name;
        slot.appendChild(nameEl);

        // Rolle
        const roleEl = document.createElement('div');
        roleEl.style.cssText = `font-size: 9px; color: #999;`;
        roleEl.textContent = ROLE_LABELS[def.role] || def.role;
        slot.appendChild(roleEl);

        // Kosten
        const costEl = document.createElement('div');
        costEl.style.cssText = `
          font-size: 12px; font-weight: bold;
          color: ${canAfford ? '#ffcc44' : '#ff6666'};
        `;
        costEl.textContent = `${def.shopCost} Gold`;
        slot.appendChild(costEl);

        // Stufe-Badge
        const tierBadge = document.createElement('div');
        tierBadge.style.cssText = `
          position: absolute; top: 5px; right: 5px;
          font-size: 9px; color: #aaa;
          background: rgba(0,0,0,0.5);
          padding: 1px 4px; border-radius: 3px;
        `;
        tierBadge.textContent = `S${def.tier}`;
        slot.appendChild(tierBadge);

        if (!disabled) {
          const slotIndex = i;
          slot.addEventListener('mouseenter', () => {
            slot.style.transform = 'scale(1.04)';
            slot.style.boxShadow = `0 0 10px ${elColor}44`;
          });
          slot.addEventListener('mouseleave', () => {
            slot.style.transform = 'scale(1)';
            slot.style.boxShadow = 'none';
          });
          slot.addEventListener('click', () => {
            AutoBattleUI.instance?.onBuyUnit?.(slotIndex);
          });
        }
      } else {
        // Leerer Slot
        slot.style.cssText = `
          width: 110px; height: 68px;
          background: rgba(30,30,50,0.4);
          border: 1px dashed rgba(80,80,100,0.3);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: #444; font-size: 12px;
        `;
        slot.textContent = 'Leer';
      }

      this.shopPanel.appendChild(slot);
    }
  }

  /** Bank-Einheiten anzeigen */
  private updateBench(bench: AutoBattleUnit[]): void {
    this.benchPanel.innerHTML = '';

    // Label
    const label = document.createElement('span');
    label.style.cssText = `
      font-size: 12px; color: #888; margin-right: 6px;
      writing-mode: vertical-rl; text-orientation: mixed;
      letter-spacing: 2px;
    `;
    label.textContent = 'BANK';
    this.benchPanel.appendChild(label);

    for (let i = 0; i < 9; i++) {
      const unit = bench[i];
      const slot = document.createElement('div');

      if (unit) {
        const elColor = ELEMENT_COLORS[unit.def.element] || '#aaa';
        const sColor = starColor(unit.starLevel);

        slot.style.cssText = `
          width: 52px; height: 52px;
          background: rgba(20,20,40,0.8);
          border: 1px solid ${elColor}88;
          border-radius: 6px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          cursor: pointer;
          position: relative;
          transition: transform 0.1s;
        `;

        // Farbpunkt (Unit-Farbe)
        const dot = document.createElement('div');
        dot.style.cssText = `
          width: 18px; height: 18px;
          background: #${unit.def.color.toString(16).padStart(6, '0')};
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.2);
          margin-bottom: 2px;
        `;
        slot.appendChild(dot);

        // Sterne
        const stars = document.createElement('div');
        stars.style.cssText = `font-size: 8px; color: ${sColor};`;
        stars.textContent = starString(unit.starLevel);
        slot.appendChild(stars);

        // Name-Tooltip
        slot.title = `${unit.def.name} ${starString(unit.starLevel)}\n${ROLE_LABELS[unit.def.role] || unit.def.role}\nRechtsklick: Verkaufen`;

        // Klick: auf Brett setzen
        const unitId = unit.id;
        slot.addEventListener('click', () => {
          AutoBattleUI.instance?.onBenchToBoard?.(unitId);
        });
        // Rechtsklick: verkaufen
        slot.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          AutoBattleUI.instance?.onSellUnit?.(unitId);
        });
        slot.addEventListener('mouseenter', () => {
          slot.style.transform = 'scale(1.08)';
        });
        slot.addEventListener('mouseleave', () => {
          slot.style.transform = 'scale(1)';
        });
      } else {
        slot.style.cssText = `
          width: 52px; height: 52px;
          background: rgba(20,20,40,0.3);
          border: 1px dashed rgba(60,60,80,0.3);
          border-radius: 6px;
        `;
      }

      this.benchPanel.appendChild(slot);
    }
  }

  /** Info-Leiste aktualisieren (Gold, Level, XP, HP, Runde) */
  private updateInfoBar(
    shop: AutoBattleShop,
    round: number,
    playerHP: number,
    boardCount: number,
    maxBoard: number
  ): void {
    this.infoBar.innerHTML = '';

    // Runde
    const roundEl = this.createInfoItem('Runde', `${round}`, '#ccccff');
    this.infoBar.appendChild(roundEl);

    // Gold
    const goldEl = this.createInfoItem('Gold', `${shop.gold}`, '#ffcc44');
    this.infoBar.appendChild(goldEl);

    // Level + XP
    const xpNeeded = AutoBattleShop.XP_PER_LEVEL[shop.playerLevel] ?? 0;
    const xpText = shop.playerLevel >= 8 ? 'MAX' : `${shop.xp}/${xpNeeded}`;
    const levelEl = this.createInfoItem('Level', `${shop.playerLevel} (XP: ${xpText})`, '#88aaff');
    this.infoBar.appendChild(levelEl);

    // HP
    const hpColor = playerHP > 60 ? '#44dd66' : playerHP > 30 ? '#ffaa44' : '#ff4444';
    const hpEl = this.createInfoItem('HP', `${playerHP}`, hpColor);
    this.infoBar.appendChild(hpEl);

    // Einheiten
    const unitColor = boardCount >= maxBoard ? '#ff8844' : '#88ccff';
    const unitsEl = this.createInfoItem('Einheiten', `${boardCount}/${maxBoard}`, unitColor);
    this.infoBar.appendChild(unitsEl);
  }

  /** Hilfs-Funktion: Info-Element erstellen */
  private createInfoItem(label: string, value: string, valueColor: string): HTMLDivElement {
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex; align-items: center; gap: 6px;
      padding: 4px 12px;
      background: rgba(20,20,50,0.6);
      border-radius: 6px;
      border: 1px solid rgba(80,80,120,0.25);
    `;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = `font-size: 11px; color: #888;`;
    labelEl.textContent = label + ':';
    item.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.style.cssText = `font-size: 14px; font-weight: bold; color: ${valueColor};`;
    valueEl.textContent = value;
    item.appendChild(valueEl);

    return item;
  }

  /** Aktions-Leiste aktualisieren (Auffrischen, XP kaufen, Kampf starten) */
  private updateActionBar(shop: AutoBattleShop): void {
    this.actionBar.innerHTML = '';

    // Auffrischen-Button
    const refreshBtn = this.createActionButton(
      `Auffrischen (${shop.REFRESH_COST} G)`,
      shop.gold >= shop.REFRESH_COST,
      '#44aadd',
      () => { AutoBattleUI.instance?.onRefreshShop?.(); }
    );
    this.actionBar.appendChild(refreshBtn);

    // XP kaufen-Button
    const xpDisabled = shop.gold < shop.XP_COST || shop.playerLevel >= 8;
    const xpLabel = shop.playerLevel >= 8 ? 'Max Level!' : `+4 XP kaufen (${shop.XP_COST} G)`;
    const xpBtn = this.createActionButton(
      xpLabel,
      !xpDisabled,
      '#88aaff',
      () => { AutoBattleUI.instance?.onBuyXP?.(); }
    );
    this.actionBar.appendChild(xpBtn);

    // Kampf starten-Button
    const fightBtn = this.createActionButton(
      'Kampf starten!',
      true,
      '#ff6644',
      () => { AutoBattleUI.instance?.onStartCombat?.(); }
    );
    fightBtn.style.fontSize = '14px';
    fightBtn.style.padding = '8px 20px';
    this.actionBar.appendChild(fightBtn);
  }

  /** Hilfs-Funktion: Aktions-Button erstellen */
  private createActionButton(
    text: string,
    enabled: boolean,
    accentColor: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.style.cssText = `
      padding: 6px 14px;
      background: ${enabled ? 'rgba(20,20,50,0.85)' : 'rgba(30,30,40,0.5)'};
      border: 1px solid ${enabled ? accentColor + '66' : 'rgba(60,60,80,0.3)'};
      border-radius: 6px;
      color: ${enabled ? '#eee' : '#666'};
      font-size: 12px; font-weight: bold;
      cursor: ${enabled ? 'pointer' : 'not-allowed'};
      transition: background 0.15s, transform 0.1s;
      font-family: inherit;
    `;

    btn.textContent = text;

    if (enabled) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = accentColor + '33';
        btn.style.transform = 'scale(1.04)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(20,20,50,0.85)';
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('click', onClick);
    }

    return btn;
  }

  /** Phasen-Banner anzeigen (blendet nach 2s aus) */
  showPhaseBanner(phase: ABPhase, extraText?: string): void {
    let text = '';
    switch (phase) {
      case 'planning':
        text = 'Planungsphase';
        break;
      case 'combat':
        text = 'Kampfphase';
        break;
      case 'result':
        text = 'Ergebnis';
        break;
    }

    if (extraText) {
      text += `\n${extraText}`;
    }

    this.phaseBanner.textContent = text;
    this.phaseBanner.style.whiteSpace = 'pre-line';
    this.phaseBanner.style.display = 'block';
    this.phaseBanner.style.opacity = '1';

    setTimeout(() => {
      this.phaseBanner.style.opacity = '0';
      setTimeout(() => {
        this.phaseBanner.style.display = 'none';
      }, 500);
    }, 2000);
  }

  /** Kampfergebnis anzeigen */
  showResult(won: boolean, goldEarned: number, damage: number): void {
    this.resultPanel.style.display = 'block';
    this.resultPanel.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 26px; font-weight: bold;
      margin-bottom: 12px;
      color: ${won ? '#44dd66' : '#ff4444'};
      text-shadow: 0 0 10px ${won ? 'rgba(0,200,80,0.4)' : 'rgba(255,0,0,0.4)'};
    `;
    titleEl.textContent = won ? 'Sieg!' : 'Niederlage!';
    this.resultPanel.appendChild(titleEl);

    if (won) {
      const goldEl = document.createElement('div');
      goldEl.style.cssText = `font-size: 16px; color: #ffcc44; margin-bottom: 6px;`;
      goldEl.textContent = `+${goldEarned} Gold verdient`;
      this.resultPanel.appendChild(goldEl);
    } else {
      const dmgEl = document.createElement('div');
      dmgEl.style.cssText = `font-size: 16px; color: #ff6666; margin-bottom: 6px;`;
      dmgEl.textContent = `${damage} Schaden erlitten`;
      this.resultPanel.appendChild(dmgEl);

      if (goldEarned > 0) {
        const goldEl = document.createElement('div');
        goldEl.style.cssText = `font-size: 14px; color: #ffcc44; margin-bottom: 6px;`;
        goldEl.textContent = `+${goldEarned} Gold verdient`;
        this.resultPanel.appendChild(goldEl);
      }
    }

    const nextEl = document.createElement('div');
    nextEl.style.cssText = `font-size: 13px; color: #888; margin-top: 8px;`;
    nextEl.textContent = 'Nächste Runde beginnt...';
    this.resultPanel.appendChild(nextEl);
  }

  /** Ergebnis-Panel verstecken */
  hideResult(): void {
    this.resultPanel.style.display = 'none';
  }

  /** Stufen-Hintergrundfarbe für Laden-Slots */
  private getTierBackground(tier: number): string {
    switch (tier) {
      case 1: return 'linear-gradient(135deg, rgba(40,40,55,0.9) 0%, rgba(50,50,65,0.9) 100%)';
      case 2: return 'linear-gradient(135deg, rgba(30,50,55,0.9) 0%, rgba(35,60,70,0.9) 100%)';
      case 3: return 'linear-gradient(135deg, rgba(45,35,60,0.9) 0%, rgba(55,40,75,0.9) 100%)';
      case 4: return 'linear-gradient(135deg, rgba(60,40,25,0.9) 0%, rgba(75,50,30,0.9) 100%)';
      default: return 'rgba(30,30,45,0.9)';
    }
  }

  /** Aufräumen: Container entfernen */
  cleanup(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (AutoBattleUI.instance === this) {
      AutoBattleUI.instance = null;
    }
  }
}
