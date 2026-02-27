// Arena-UI: HTML-Overlay für den rundenbasierten Arena-Kampfmodus.
// Zeigt Teamauswahl, Kampf-UI, Fähigkeitenleiste, Kampflog, Ergebnisse, Laden und Rast.

import { ArenaUnit } from './ArenaUnit';
import { ArenaAbilityDef, ActiveAbility, AbilityTarget } from './ArenaAbility';
import { TurnResult } from './ArenaCombatEngine';
import { UnitDef } from '../units/UnitConfig';

export type ArenaPhase = 'team_select' | 'combat' | 'map' | 'shop' | 'rest' | 'result';

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

// Element-Bezeichnungen auf Deutsch
const ELEMENT_LABELS: Record<string, string> = {
  physical: 'Physisch',
  fire: 'Feuer',
  ice: 'Eis',
  lightning: 'Blitz',
  poison: 'Gift',
  arcane: 'Arkan',
  nature: 'Natur',
  dark: 'Dunkel',
};

// Zieltyp-Bezeichnungen auf Deutsch
const TARGET_LABELS: Record<string, string> = {
  single_enemy: 'Einzelner Gegner',
  all_enemies: 'Alle Gegner',
  single_ally: 'Einzelner Verbündeter',
  all_allies: 'Alle Verbündeten',
  self: 'Selbst',
};

// Statuseffekt-Symbole
const STATUS_ICONS: Record<string, string> = {
  burn: '\uD83D\uDD25',
  freeze: '\u2744\uFE0F',
  slow: '\uD83D\uDC22',
  poison: '\u2620\uFE0F',
  stun: '\u26A1',
  shield: '\uD83D\uDEE1\uFE0F',
  taunt: '\uD83D\uDCA2',
  regen: '\uD83D\uDC9A',
  buff_atk: '\u2B06\uFE0F',
  buff_def: '\uD83D\uDEE1\uFE0F',
  debuff_atk: '\u2B07\uFE0F',
  debuff_def: '\uD83D\uDD34',
};

// Statuseffekt-Bezeichnungen auf Deutsch
const STATUS_LABELS: Record<string, string> = {
  burn: 'Verbrennung',
  freeze: 'Eingefroren',
  slow: 'Verlangsamt',
  poison: 'Vergiftet',
  stun: 'Betäubt',
  shield: 'Schild',
  taunt: 'Spott',
  regen: 'Regeneration',
  buff_atk: 'Angriff+',
  buff_def: 'Verteidigung+',
  debuff_atk: 'Angriff-',
  debuff_def: 'Verteidigung-',
};

export class ArenaUI {
  private container: HTMLDivElement;

  // Unterbereiche
  private topBar: HTMLDivElement;
  private teamSelectPanel: HTMLDivElement;
  private combatArea: HTMLDivElement;
  private playerTeamPanel: HTMLDivElement;
  private enemyTeamPanel: HTMLDivElement;
  private abilityPanel: HTMLDivElement;
  private targetPrompt: HTMLDivElement;
  private combatLog: HTMLDivElement;
  private combatLogEntries: HTMLDivElement;
  private resultPanel: HTMLDivElement;
  private restPanel: HTMLDivElement;
  private shopScreenPanel: HTMLDivElement;
  private turnResultOverlay: HTMLDivElement;

  // Zustand
  private selectedUnitIds: Set<string> = new Set();
  private currentTargets: ArenaUnit[] = [];
  private selectedAbilityIndex = -1;
  private crystals = 0;
  private fightNumber = 0;
  private maxFights = 7;

  // Callbacks
  onTeamConfirm: ((unitIds: string[]) => void) | null = null;
  onAbilitySelect: ((abilityIndex: number) => void) | null = null;
  onTargetSelect: ((targetIndex: number) => void) | null = null;
  onContinue: (() => void) | null = null;

  // Statisches Instanz-Pattern gegen Event-Listener-Stacking
  private static instance: ArenaUI | null = null;
  private static listenersAttached = false;

  constructor() {
    ArenaUI.instance = this;

    // Haupt-Container
    this.container = document.createElement('div');
    this.container.id = 'arena-ui-container';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 300;
      pointer-events: none;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #e0e0e0;
    `;

    // ── Obere Leiste ──────────────────────────────────────
    this.topBar = document.createElement('div');
    this.topBar.id = 'arena-top-bar';
    this.topBar.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%;
      display: flex; justify-content: center; align-items: center; gap: 24px;
      padding: 10px 20px;
      background: linear-gradient(180deg, rgba(8,8,20,0.92) 0%, rgba(8,8,20,0.7) 80%, rgba(8,8,20,0) 100%);
      pointer-events: auto;
      box-sizing: border-box;
      font-size: 15px;
    `;
    this.container.appendChild(this.topBar);

    // ── Teamauswahl-Panel ─────────────────────────────────
    this.teamSelectPanel = document.createElement('div');
    this.teamSelectPanel.id = 'arena-team-select';
    this.teamSelectPanel.style.cssText = `
      display: none;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 700px; max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      background: rgba(8,8,20,0.95);
      border: 2px solid rgba(120,80,200,0.5);
      border-radius: 14px;
      padding: 24px;
      pointer-events: auto;
      text-align: center;
    `;
    this.container.appendChild(this.teamSelectPanel);

    // ── Kampfbereich ──────────────────────────────────────
    this.combatArea = document.createElement('div');
    this.combatArea.id = 'arena-combat-area';
    this.combatArea.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
    `;
    this.container.appendChild(this.combatArea);

    // Spieler-Team-Panel (links)
    this.playerTeamPanel = document.createElement('div');
    this.playerTeamPanel.id = 'arena-player-team';
    this.playerTeamPanel.style.cssText = `
      position: absolute;
      top: 60px; left: 16px;
      width: 220px;
      display: flex; flex-direction: column; gap: 6px;
      pointer-events: auto;
    `;
    this.combatArea.appendChild(this.playerTeamPanel);

    // Gegner-Team-Panel (rechts)
    this.enemyTeamPanel = document.createElement('div');
    this.enemyTeamPanel.id = 'arena-enemy-team';
    this.enemyTeamPanel.style.cssText = `
      position: absolute;
      top: 60px; right: 16px;
      width: 220px;
      display: flex; flex-direction: column; gap: 6px;
      pointer-events: auto;
    `;
    this.combatArea.appendChild(this.enemyTeamPanel);

    // Fähigkeiten-Panel (unten)
    this.abilityPanel = document.createElement('div');
    this.abilityPanel.id = 'arena-ability-panel';
    this.abilityPanel.style.cssText = `
      display: none;
      position: absolute;
      bottom: 16px; left: 50%;
      transform: translateX(-50%);
      width: 650px; max-width: 92vw;
      background: rgba(8,8,20,0.92);
      border: 1px solid rgba(120,80,200,0.4);
      border-radius: 10px;
      padding: 14px 18px;
      pointer-events: auto;
    `;
    this.combatArea.appendChild(this.abilityPanel);

    // Zielauswahl-Hinweis
    this.targetPrompt = document.createElement('div');
    this.targetPrompt.id = 'arena-target-prompt';
    this.targetPrompt.style.cssText = `
      display: none;
      position: absolute;
      bottom: 160px; left: 50%;
      transform: translateX(-50%);
      padding: 10px 28px;
      background: rgba(120,80,30,0.9);
      border: 1px solid rgba(255,200,80,0.5);
      border-radius: 8px;
      font-size: 16px; font-weight: bold;
      color: #ffd866;
      text-shadow: 0 0 6px rgba(255,200,0,0.3);
      pointer-events: none;
    `;
    this.targetPrompt.textContent = 'W\u00e4hle ein Ziel...';
    this.combatArea.appendChild(this.targetPrompt);

    // Kampflog (rechts unten)
    this.combatLog = document.createElement('div');
    this.combatLog.id = 'arena-combat-log';
    this.combatLog.style.cssText = `
      position: absolute;
      bottom: 16px; right: 16px;
      width: 280px; height: 200px;
      background: rgba(8,8,20,0.85);
      border: 1px solid rgba(80,80,120,0.3);
      border-radius: 8px;
      overflow: hidden;
      display: flex; flex-direction: column;
      pointer-events: auto;
    `;
    const logTitle = document.createElement('div');
    logTitle.style.cssText = `
      padding: 6px 10px;
      background: rgba(40,30,60,0.8);
      font-size: 12px; font-weight: bold;
      color: #aaa;
      border-bottom: 1px solid rgba(80,80,120,0.3);
      flex-shrink: 0;
    `;
    logTitle.textContent = 'Kampflog';
    this.combatLog.appendChild(logTitle);

    this.combatLogEntries = document.createElement('div');
    this.combatLogEntries.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 6px 10px;
      font-size: 11px;
      line-height: 1.5;
    `;
    this.combatLog.appendChild(this.combatLogEntries);
    this.combatArea.appendChild(this.combatLog);

    // Zugergebnis-Overlay (zentral, blendet aus)
    this.turnResultOverlay = document.createElement('div');
    this.turnResultOverlay.id = 'arena-turn-result';
    this.turnResultOverlay.style.cssText = `
      display: none;
      position: absolute;
      top: 40%; left: 50%;
      transform: translate(-50%, -50%);
      padding: 14px 36px;
      background: rgba(0,0,0,0.8);
      border: 2px solid rgba(200,180,100,0.5);
      border-radius: 10px;
      font-size: 20px; font-weight: bold;
      color: #ffd866;
      text-shadow: 0 0 10px rgba(255,200,0,0.3);
      text-align: center;
      pointer-events: none;
      transition: opacity 0.4s ease;
      white-space: pre-line;
    `;
    this.combatArea.appendChild(this.turnResultOverlay);

    // ── Ergebnis-Panel ────────────────────────────────────
    this.resultPanel = document.createElement('div');
    this.resultPanel.id = 'arena-result-panel';
    this.resultPanel.style.cssText = `
      display: none;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      padding: 30px 50px;
      background: rgba(8,8,20,0.95);
      border: 2px solid rgba(200,180,100,0.5);
      border-radius: 14px;
      font-size: 18px;
      text-align: center;
      pointer-events: auto;
      min-width: 320px;
    `;
    this.container.appendChild(this.resultPanel);

    // ── Rast-Panel ────────────────────────────────────────
    this.restPanel = document.createElement('div');
    this.restPanel.id = 'arena-rest-panel';
    this.restPanel.style.cssText = `
      display: none;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 500px; max-width: 90vw;
      background: rgba(8,8,20,0.95);
      border: 2px solid rgba(80,200,120,0.5);
      border-radius: 14px;
      padding: 24px;
      pointer-events: auto;
      text-align: center;
    `;
    this.container.appendChild(this.restPanel);

    // ── Laden-Panel ───────────────────────────────────────
    this.shopScreenPanel = document.createElement('div');
    this.shopScreenPanel.id = 'arena-shop-panel';
    this.shopScreenPanel.style.cssText = `
      display: none;
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 560px; max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      background: rgba(8,8,20,0.95);
      border: 2px solid rgba(200,180,80,0.5);
      border-radius: 14px;
      padding: 24px;
      pointer-events: auto;
      text-align: center;
    `;
    this.container.appendChild(this.shopScreenPanel);

    document.body.appendChild(this.container);

    // Keyboard-Listener mit statischem Pattern
    if (!ArenaUI.listenersAttached) {
      ArenaUI.listenersAttached = true;
      document.addEventListener('keydown', (e: KeyboardEvent) => {
        ArenaUI.instance?.handleKeydown(e);
      });
    }
  }

  // ── Anzeigen / Verstecken ───────────────────────────────

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
    this.hideAllPanels();
  }

  private hideAllPanels(): void {
    this.teamSelectPanel.style.display = 'none';
    this.combatArea.style.display = 'none';
    this.abilityPanel.style.display = 'none';
    this.targetPrompt.style.display = 'none';
    this.resultPanel.style.display = 'none';
    this.restPanel.style.display = 'none';
    this.shopScreenPanel.style.display = 'none';
    this.turnResultOverlay.style.display = 'none';
    this.topBar.style.display = 'none';
  }

  // ── Obere Leiste ────────────────────────────────────────

  private updateTopBar(): void {
    this.topBar.innerHTML = '';
    this.topBar.style.display = 'flex';

    const title = this.createInfoItem('Arena-Kampf', '', '#cc88ff');
    this.topBar.appendChild(title);

    const fightInfo = this.createInfoItem('Kampf', `${this.fightNumber}/${this.maxFights}`, '#ccccff');
    this.topBar.appendChild(fightInfo);

    const crystalInfo = this.createInfoItem('Kristalle', `${this.crystals}`, '#88ddff');
    this.topBar.appendChild(crystalInfo);
  }

  setCrystals(amount: number): void {
    this.crystals = amount;
  }

  setFightInfo(current: number, max: number): void {
    this.fightNumber = current;
    this.maxFights = max;
  }

  // ── Teamauswahl ─────────────────────────────────────────

  showTeamSelect(availableUnits: UnitDef[]): void {
    this.hideAllPanels();
    this.topBar.style.display = 'none';
    this.teamSelectPanel.style.display = 'block';
    this.teamSelectPanel.innerHTML = '';
    this.selectedUnitIds.clear();

    // Titel
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 24px; font-weight: bold;
      color: #cc88ff;
      margin-bottom: 6px;
      text-shadow: 0 0 10px rgba(180,100,255,0.3);
    `;
    title.textContent = 'Arena-Kampf';
    this.teamSelectPanel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size: 15px; color: #aaa;
      margin-bottom: 18px;
    `;
    subtitle.textContent = 'W\u00e4hle 4 Einheiten f\u00fcr dein Team:';
    this.teamSelectPanel.appendChild(subtitle);

    // Einheiten-Raster
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
      margin-bottom: 20px;
    `;

    for (const def of availableUnits) {
      const card = this.createUnitCard(def, grid);
      grid.appendChild(card);
    }
    this.teamSelectPanel.appendChild(grid);

    // Auswahl-Anzeige
    const selectionInfo = document.createElement('div');
    selectionInfo.id = 'arena-selection-info';
    selectionInfo.style.cssText = `
      font-size: 14px; color: #888;
      margin-bottom: 14px;
    `;
    selectionInfo.textContent = 'Ausgew\u00e4hlt: 0/4';
    this.teamSelectPanel.appendChild(selectionInfo);

    // Start-Button
    const startBtn = document.createElement('button');
    startBtn.id = 'arena-start-btn';
    startBtn.style.cssText = `
      padding: 12px 36px;
      background: rgba(80,40,120,0.6);
      border: 2px solid rgba(120,80,200,0.4);
      border-radius: 8px;
      color: #666;
      font-size: 18px; font-weight: bold;
      cursor: not-allowed;
      transition: all 0.2s;
      font-family: inherit;
    `;
    startBtn.textContent = 'Kampf starten!';
    startBtn.addEventListener('click', () => {
      if (ArenaUI.instance && ArenaUI.instance.selectedUnitIds.size === 4) {
        ArenaUI.instance.onTeamConfirm?.(Array.from(ArenaUI.instance.selectedUnitIds));
      }
    });
    this.teamSelectPanel.appendChild(startBtn);
  }

  private createUnitCard(def: UnitDef, grid: HTMLDivElement): HTMLDivElement {
    const card = document.createElement('div');
    const elColor = ELEMENT_COLORS[def.element] || '#aaa';

    card.style.cssText = `
      width: 140px;
      background: rgba(20,20,40,0.85);
      border: 2px solid rgba(80,80,120,0.3);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
      overflow: hidden;
    `;

    // Element-Farbstreifen
    const stripe = document.createElement('div');
    stripe.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: ${elColor};
    `;
    card.appendChild(stripe);

    // Name
    const nameEl = document.createElement('div');
    nameEl.style.cssText = `
      font-size: 13px; font-weight: bold; color: #eee;
      margin-top: 4px; margin-bottom: 4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;
    nameEl.textContent = def.name;
    card.appendChild(nameEl);

    // Rolle + Element
    const roleEl = document.createElement('div');
    roleEl.style.cssText = `font-size: 10px; color: #999; margin-bottom: 6px;`;
    roleEl.textContent = `${ROLE_LABELS[def.role] || def.role} | ${ELEMENT_LABELS[def.element] || def.element}`;
    card.appendChild(roleEl);

    // Stats
    const statsEl = document.createElement('div');
    statsEl.style.cssText = `font-size: 10px; color: #bbb; line-height: 1.6;`;
    statsEl.innerHTML = `
      <span style="color:#ff6666">LP: ${def.hp}</span> |
      <span style="color:#ff8844">ATK: ${def.attack}</span><br>
      <span style="color:#4488ff">DEF: ${def.defense}</span> |
      <span style="color:#44dd66">SPD: ${def.speed}</span>
    `;
    card.appendChild(statsEl);

    // Stufe-Badge
    const tierBadge = document.createElement('div');
    tierBadge.style.cssText = `
      position: absolute; top: 6px; right: 6px;
      font-size: 9px; color: #aaa;
      background: rgba(0,0,0,0.5);
      padding: 1px 5px; border-radius: 3px;
    `;
    tierBadge.textContent = `S${def.tier}`;
    card.appendChild(tierBadge);

    // Auswahl-Markierung
    const checkmark = document.createElement('div');
    checkmark.style.cssText = `
      position: absolute; bottom: 4px; right: 6px;
      font-size: 18px; color: #44dd66;
      display: none;
    `;
    checkmark.textContent = '\u2713';
    card.appendChild(checkmark);

    // Klick-Handler
    const unitId = def.id;
    card.addEventListener('click', () => {
      const inst = ArenaUI.instance;
      if (!inst) return;

      if (inst.selectedUnitIds.has(unitId)) {
        // Abwahl
        inst.selectedUnitIds.delete(unitId);
        card.style.borderColor = 'rgba(80,80,120,0.3)';
        card.style.background = 'rgba(20,20,40,0.85)';
        checkmark.style.display = 'none';
      } else if (inst.selectedUnitIds.size < 4) {
        // Auswahl
        inst.selectedUnitIds.add(unitId);
        card.style.borderColor = elColor;
        card.style.background = 'rgba(40,30,60,0.85)';
        checkmark.style.display = 'block';
      }

      // Auswahl-Info und Button aktualisieren
      const selInfo = document.getElementById('arena-selection-info');
      if (selInfo) {
        selInfo.textContent = `Ausgew\u00e4hlt: ${inst.selectedUnitIds.size}/4`;
        selInfo.style.color = inst.selectedUnitIds.size === 4 ? '#44dd66' : '#888';
      }

      const startBtn = document.getElementById('arena-start-btn') as HTMLButtonElement | null;
      if (startBtn) {
        if (inst.selectedUnitIds.size === 4) {
          startBtn.style.background = 'rgba(80,40,120,0.85)';
          startBtn.style.borderColor = 'rgba(180,100,255,0.6)';
          startBtn.style.color = '#eee';
          startBtn.style.cursor = 'pointer';
        } else {
          startBtn.style.background = 'rgba(80,40,120,0.6)';
          startBtn.style.borderColor = 'rgba(120,80,200,0.4)';
          startBtn.style.color = '#666';
          startBtn.style.cursor = 'not-allowed';
        }
      }
    });

    // Hover
    card.addEventListener('mouseenter', () => {
      if (!ArenaUI.instance?.selectedUnitIds.has(unitId)) {
        card.style.borderColor = elColor + '88';
      }
      card.style.transform = 'scale(1.03)';
    });
    card.addEventListener('mouseleave', () => {
      if (!ArenaUI.instance?.selectedUnitIds.has(unitId)) {
        card.style.borderColor = 'rgba(80,80,120,0.3)';
      }
      card.style.transform = 'scale(1)';
    });

    return card;
  }

  // ── Kampf-UI ────────────────────────────────────────────

  showCombat(playerTeam: ArenaUnit[], enemyTeam: ArenaUnit[]): void {
    this.hideAllPanels();
    this.updateTopBar();
    this.combatArea.style.display = 'block';
    this.combatLogEntries.innerHTML = '';
    this.updateCombat(playerTeam, enemyTeam, null, false);
  }

  updateCombat(
    playerTeam: ArenaUnit[],
    enemyTeam: ArenaUnit[],
    currentUnit: ArenaUnit | null,
    isPlayerTurn: boolean
  ): void {
    this.updateTopBar();
    this.renderTeamPanel(this.playerTeamPanel, playerTeam, true, currentUnit);
    this.renderTeamPanel(this.enemyTeamPanel, enemyTeam, false, currentUnit);
  }

  private renderTeamPanel(
    panel: HTMLDivElement,
    team: ArenaUnit[],
    isPlayer: boolean,
    currentUnit: ArenaUnit | null
  ): void {
    panel.innerHTML = '';

    // Team-Titel
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 12px; font-weight: bold;
      color: ${isPlayer ? '#88aaff' : '#ff6666'};
      padding: 4px 8px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    title.textContent = isPlayer ? 'Dein Team' : 'Gegner';
    panel.appendChild(title);

    for (const unit of team) {
      const row = document.createElement('div');
      const isCurrent = currentUnit !== null && unit === currentUnit;
      const elColor = ELEMENT_COLORS[unit.def.element] || '#aaa';

      row.style.cssText = `
        display: flex; align-items: center; gap: 8px;
        padding: 6px 10px;
        background: ${isCurrent ? 'rgba(60,50,80,0.8)' : 'rgba(15,15,30,0.75)'};
        border: 1px solid ${isCurrent ? 'rgba(200,180,100,0.6)' : 'rgba(60,60,80,0.3)'};
        border-radius: 6px;
        opacity: ${unit.alive ? '1' : '0.35'};
        transition: all 0.2s;
        position: relative;
      `;

      // Farb-Indikator
      const colorDot = document.createElement('div');
      colorDot.style.cssText = `
        width: 10px; height: 10px;
        background: #${unit.def.color.toString(16).padStart(6, '0')};
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid rgba(255,255,255,0.2);
      `;
      row.appendChild(colorDot);

      // Info-Bereich
      const info = document.createElement('div');
      info.style.cssText = `flex: 1; min-width: 0;`;

      // Name-Zeile
      const nameLine = document.createElement('div');
      nameLine.style.cssText = `
        font-size: 12px; font-weight: bold; color: #ddd;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      `;
      let nameText = unit.def.name;
      if (!unit.alive) nameText += ' \u2620';
      if (isCurrent) nameText += ' \u25C0';
      nameLine.textContent = nameText;
      info.appendChild(nameLine);

      // HP-Balken
      const hpBarOuter = document.createElement('div');
      hpBarOuter.style.cssText = `
        width: 100%; height: 8px;
        background: rgba(60,20,20,0.8);
        border-radius: 4px;
        overflow: hidden;
        margin-top: 3px;
      `;
      const hpRatio = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) : 0;
      const hpColor = hpRatio > 0.6 ? '#44dd66' : hpRatio > 0.3 ? '#ffcc00' : '#ff4444';
      const hpBarInner = document.createElement('div');
      hpBarInner.style.cssText = `
        width: ${hpRatio * 100}%; height: 100%;
        background: ${hpColor};
        border-radius: 4px;
        transition: width 0.3s;
      `;
      hpBarOuter.appendChild(hpBarInner);
      info.appendChild(hpBarOuter);

      // HP-Text
      const hpText = document.createElement('div');
      hpText.style.cssText = `font-size: 9px; color: #999; margin-top: 1px;`;
      hpText.textContent = `LP: ${unit.hp}/${unit.maxHp}`;
      info.appendChild(hpText);

      // MP-Balken
      if (unit.maxMp > 0) {
        const mpBarOuter = document.createElement('div');
        mpBarOuter.style.cssText = `
          width: 100%; height: 5px;
          background: rgba(20,20,60,0.8);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 2px;
        `;
        const mpRatio = unit.maxMp > 0 ? Math.max(0, unit.mp / unit.maxMp) : 0;
        const mpBarInner = document.createElement('div');
        mpBarInner.style.cssText = `
          width: ${mpRatio * 100}%; height: 100%;
          background: #4488ff;
          border-radius: 3px;
          transition: width 0.3s;
        `;
        mpBarOuter.appendChild(mpBarInner);
        info.appendChild(mpBarOuter);
      }

      // Statuseffekte
      if (unit.statusEffects.length > 0) {
        const statusLine = document.createElement('div');
        statusLine.style.cssText = `font-size: 9px; margin-top: 2px; display: flex; gap: 3px; flex-wrap: wrap;`;
        for (const effect of unit.statusEffects) {
          const badge = document.createElement('span');
          const icon = STATUS_ICONS[effect.type] || '?';
          badge.style.cssText = `
            background: rgba(40,30,60,0.8);
            padding: 0 4px;
            border-radius: 3px;
            color: #ddd;
          `;
          badge.textContent = `${icon}${effect.duration}`;
          badge.title = `${STATUS_LABELS[effect.type] || effect.type} (${effect.duration} Z\u00fcge)`;
          statusLine.appendChild(badge);
        }
        info.appendChild(statusLine);
      }

      row.appendChild(info);
      panel.appendChild(row);
    }
  }

  // ── F\u00e4higkeiten-Panel ───────────────────────────────────

  showAbilityPanel(unit: ArenaUnit): void {
    this.abilityPanel.style.display = 'block';
    this.abilityPanel.innerHTML = '';
    this.selectedAbilityIndex = -1;

    // Überschrift: Einheit-Name + Zug-Hinweis
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px;
    `;

    const nameSection = document.createElement('div');
    nameSection.style.cssText = `font-size: 15px; font-weight: bold; color: #eee;`;
    nameSection.textContent = `${unit.def.name} (Dein Zug)`;
    header.appendChild(nameSection);

    const mpSection = document.createElement('div');
    mpSection.style.cssText = `font-size: 13px; color: #4488ff;`;
    mpSection.textContent = `MP: ${unit.mp}/${unit.maxMp}`;
    header.appendChild(mpSection);

    this.abilityPanel.appendChild(header);

    // F\u00e4higkeiten-Buttons
    const buttonsRow = document.createElement('div');
    buttonsRow.style.cssText = `
      display: flex; flex-wrap: wrap; gap: 8px;
      margin-bottom: 8px;
    `;

    for (let i = 0; i < unit.abilities.length; i++) {
      const active = unit.abilities[i];
      const def = active.def;
      const canUse = unit.mp >= def.mpCost && active.currentCooldown <= 0 && !unit.isStunned();

      const btn = document.createElement('button');
      btn.style.cssText = `
        flex: 1; min-width: 140px;
        padding: 8px 12px;
        background: ${canUse ? 'rgba(30,25,50,0.9)' : 'rgba(20,20,30,0.6)'};
        border: 1px solid ${canUse ? 'rgba(120,80,200,0.5)' : 'rgba(60,60,80,0.3)'};
        border-radius: 6px;
        color: ${canUse ? '#eee' : '#555'};
        font-size: 12px; font-weight: bold;
        cursor: ${canUse ? 'pointer' : 'not-allowed'};
        text-align: left;
        transition: all 0.15s;
        font-family: inherit;
        position: relative;
      `;

      // Button-Inhalt
      const btnName = document.createElement('div');
      btnName.style.cssText = `margin-bottom: 2px;`;
      btnName.textContent = `${i + 1}. ${def.name}`;
      btn.appendChild(btnName);

      const btnInfo = document.createElement('div');
      btnInfo.style.cssText = `font-size: 10px; color: ${canUse ? '#999' : '#444'}; font-weight: normal;`;
      let infoText = `${def.mpCost} MP`;
      if (active.currentCooldown > 0) {
        infoText += ` | Abklingzeit: ${active.currentCooldown} Z\u00fcge`;
      }
      btnInfo.textContent = infoText;
      btn.appendChild(btnInfo);

      // Element-Farbstreifen
      const elColor = ELEMENT_COLORS[def.element] || '#aaa';
      const elStripe = document.createElement('div');
      elStripe.style.cssText = `
        position: absolute; top: 0; left: 0; bottom: 0; width: 3px;
        background: ${canUse ? elColor : 'rgba(60,60,80,0.3)'};
        border-radius: 6px 0 0 6px;
      `;
      btn.appendChild(elStripe);

      // Tooltip
      let tooltip = `${def.name}\n${def.description}\nElement: ${ELEMENT_LABELS[def.element] || def.element}`;
      tooltip += `\nZiel: ${TARGET_LABELS[def.targetType] || def.targetType}`;
      if (def.baseDamage > 0) tooltip += `\nSchaden: ${def.baseDamage}`;
      if (def.baseHealing > 0) tooltip += `\nHeilung: ${def.baseHealing}`;
      if (def.effect) {
        tooltip += `\nEffekt: ${STATUS_LABELS[def.effect.type] || def.effect.type} (${def.effect.duration} Z\u00fcge)`;
      }
      btn.title = tooltip;

      if (canUse) {
        const abilityIndex = i;
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(50,35,80,0.9)';
          btn.style.borderColor = 'rgba(180,120,255,0.6)';
          btn.style.transform = 'scale(1.02)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'rgba(30,25,50,0.9)';
          btn.style.borderColor = 'rgba(120,80,200,0.5)';
          btn.style.transform = 'scale(1)';
        });
        btn.addEventListener('click', () => {
          ArenaUI.instance?.onAbilitySelect?.(abilityIndex);
        });
      }

      buttonsRow.appendChild(btn);
    }

    this.abilityPanel.appendChild(buttonsRow);

    // Statuseffekte-Zeile
    if (unit.statusEffects.length > 0) {
      const statusLine = document.createElement('div');
      statusLine.style.cssText = `font-size: 11px; color: #aaa;`;
      let statusText = 'Statuseffekte: ';
      for (const effect of unit.statusEffects) {
        const icon = STATUS_ICONS[effect.type] || '?';
        const label = STATUS_LABELS[effect.type] || effect.type;
        statusText += `${icon}${label} (${effect.duration}) `;
      }
      statusLine.textContent = statusText;
      this.abilityPanel.appendChild(statusLine);
    }
  }

  hideAbilityPanel(): void {
    this.abilityPanel.style.display = 'none';
    this.targetPrompt.style.display = 'none';
  }

  // ── Zielauswahl ─────────────────────────────────────────

  showTargetSelection(targets: ArenaUnit[], targetType: AbilityTarget): void {
    this.currentTargets = targets;
    this.targetPrompt.style.display = 'block';

    // Zieltext je nach Typ
    if (targetType === 'all_enemies' || targetType === 'all_allies') {
      this.targetPrompt.textContent = 'Trifft alle Ziele. Klicke zum Best\u00e4tigen...';
    } else if (targetType === 'self') {
      this.targetPrompt.textContent = 'Wirkt auf dich selbst. Klicke zum Best\u00e4tigen...';
    } else {
      this.targetPrompt.textContent = 'W\u00e4hle ein Ziel...';
    }

    // Hervorheben: Bei 'all' oder 'self' Zieltypen alle pulsieren
    // Bei 'single' individuelle Auswahl erforderlich
    const isAoe = targetType === 'all_enemies' || targetType === 'all_allies';
    const isSelf = targetType === 'self';

    // Gegner-Team-Panel durchgehen und klickbare Ziele markieren
    this.highlightTargets(this.enemyTeamPanel, targets, isAoe || isSelf);
    this.highlightTargets(this.playerTeamPanel, targets, isAoe || isSelf);
  }

  private highlightTargets(panel: HTMLDivElement, targets: ArenaUnit[], clickAny: boolean): void {
    // Alle Einheiten-Zeilen im Panel finden (überspringe den Titel)
    const rows = panel.children;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as HTMLDivElement;
      // Prüfe ob die Einheit bei Index i-1 ein gültiges Ziel ist
      // (Index-1 weil Titel-Element an Index 0)
      const targetIndex = i - 1;

      // Extrahiere den Unit-Namen zur Identifikation
      const unitAtIdx = targets.find((_t, _idx) => {
        // Wir müssen über die Position gehen - Einheiten sind in der Reihenfolge der Teams
        return true; // Wird unten korrekt behandelt
      });

      // Wir suchen über position in den targets
      let isTarget = false;
      let matchedTarget: ArenaUnit | null = null;

      for (const t of targets) {
        if (t.position === targetIndex) {
          isTarget = true;
          matchedTarget = t;
          break;
        }
      }

      if (isTarget && matchedTarget) {
        row.style.borderColor = 'rgba(255,200,80,0.7)';
        row.style.background = 'rgba(80,60,20,0.6)';
        row.style.cursor = 'pointer';
        row.style.animation = 'arena-pulse 1s infinite';

        // Pulse-Animation einmalig einf\u00fcgen
        this.ensurePulseAnimation();

        const tIdx = matchedTarget.position;
        // Klick-Handler für individuelle Zielauswahl
        const clickHandler = () => {
          if (clickAny) {
            // Bei AOE: alle Ziel-Indizes senden (erster Index genügt, Engine handhabt AOE)
            ArenaUI.instance?.onTargetSelect?.(targets[0].position);
          } else {
            ArenaUI.instance?.onTargetSelect?.(tIdx);
          }
        };
        row.addEventListener('click', clickHandler);
        // Speichere Handler zum sp\u00e4teren Aufr\u00e4umen
        (row as HTMLDivElement & { _arenaClickHandler?: EventListener })._arenaClickHandler = clickHandler;
      }
    }
  }

  private pulseAnimationAdded = false;

  private ensurePulseAnimation(): void {
    if (this.pulseAnimationAdded) return;
    this.pulseAnimationAdded = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes arena-pulse {
        0% { box-shadow: 0 0 4px rgba(255,200,80,0.3); }
        50% { box-shadow: 0 0 12px rgba(255,200,80,0.6); }
        100% { box-shadow: 0 0 4px rgba(255,200,80,0.3); }
      }
    `;
    document.head.appendChild(style);
  }

  clearTargetHighlights(): void {
    this.targetPrompt.style.display = 'none';
    this.currentTargets = [];
    this.clearHighlightsFromPanel(this.playerTeamPanel);
    this.clearHighlightsFromPanel(this.enemyTeamPanel);
  }

  private clearHighlightsFromPanel(panel: HTMLDivElement): void {
    const rows = panel.children;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as HTMLDivElement & { _arenaClickHandler?: EventListener };
      row.style.borderColor = '';
      row.style.background = '';
      row.style.cursor = '';
      row.style.animation = '';
      row.style.boxShadow = '';
      if (row._arenaClickHandler) {
        row.removeEventListener('click', row._arenaClickHandler);
        row._arenaClickHandler = undefined;
      }
    }
  }

  // ── Zugergebnis ─────────────────────────────────────────

  showTurnResult(result: TurnResult): void {
    // Log-Eintrag hinzuf\u00fcgen
    this.addLogEntry(result.text, '#ddd');

    // Schadensinfos loggen
    for (let i = 0; i < result.action.targets.length; i++) {
      const target = result.action.targets[i];
      if (result.damageDealt[i] > 0) {
        this.addLogEntry(
          `  \u2192 ${target.def.name}: ${result.damageDealt[i]} Schaden`,
          '#ff8866'
        );
      }
      if (result.healingDone[i] > 0) {
        this.addLogEntry(
          `  \u2192 ${target.def.name}: +${result.healingDone[i]} LP`,
          '#44dd66'
        );
      }
    }

    // Besiegte Einheiten
    for (const killed of result.killedUnits) {
      this.addLogEntry(
        `  \u2620 ${killed.def.name} wurde besiegt!`,
        '#ff4444'
      );
    }

    // Statuseffekte
    for (let i = 0; i < result.statusApplied.length; i++) {
      for (const status of result.statusApplied[i]) {
        const target = result.action.targets[i];
        const label = STATUS_LABELS[status.type] || status.type;
        const icon = STATUS_ICONS[status.type] || '';
        this.addLogEntry(
          `  ${icon} ${target.def.name}: ${label} (${status.duration} Z\u00fcge)`,
          '#ffcc66'
        );
      }
    }

    // \u00dcberlay kurz einblenden
    this.turnResultOverlay.textContent = result.text;
    this.turnResultOverlay.style.display = 'block';
    this.turnResultOverlay.style.opacity = '1';
    setTimeout(() => {
      this.turnResultOverlay.style.opacity = '0';
      setTimeout(() => {
        this.turnResultOverlay.style.display = 'none';
      }, 400);
    }, 1200);
  }

  addLogEntry(text: string, color: string = '#ccc'): void {
    const entry = document.createElement('div');
    entry.style.cssText = `
      color: ${color};
      border-bottom: 1px solid rgba(40,40,60,0.3);
      padding: 2px 0;
    `;
    entry.textContent = text;
    this.combatLogEntries.appendChild(entry);
    // Auto-scroll nach unten
    this.combatLogEntries.scrollTop = this.combatLogEntries.scrollHeight;
  }

  // ── Kampfergebnis ───────────────────────────────────────

  showBattleResult(won: boolean, crystalsEarned: number): void {
    this.hideAllPanels();
    this.updateTopBar();
    this.resultPanel.style.display = 'block';
    this.resultPanel.innerHTML = '';

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 32px; font-weight: bold;
      margin-bottom: 16px;
      color: ${won ? '#44dd66' : '#ff4444'};
      text-shadow: 0 0 14px ${won ? 'rgba(0,200,80,0.4)' : 'rgba(255,0,0,0.4)'};
    `;
    title.textContent = won ? 'Sieg!' : 'Niederlage!';
    this.resultPanel.appendChild(title);

    if (won) {
      const reward = document.createElement('div');
      reward.style.cssText = `font-size: 18px; color: #88ddff; margin-bottom: 12px;`;
      reward.textContent = `+${crystalsEarned} Kristalle verdient`;
      this.resultPanel.appendChild(reward);
    } else {
      const lossText = document.createElement('div');
      lossText.style.cssText = `font-size: 16px; color: #ff8888; margin-bottom: 12px;`;
      lossText.textContent = 'Dein Team wurde besiegt...';
      this.resultPanel.appendChild(lossText);
    }

    const continueBtn = document.createElement('button');
    continueBtn.style.cssText = `
      padding: 12px 36px;
      background: rgba(40,30,60,0.85);
      border: 2px solid rgba(120,80,200,0.5);
      border-radius: 8px;
      color: #eee;
      font-size: 16px; font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      margin-top: 8px;
    `;
    continueBtn.textContent = 'Weiter';
    continueBtn.addEventListener('mouseenter', () => {
      continueBtn.style.background = 'rgba(60,45,90,0.9)';
      continueBtn.style.transform = 'scale(1.04)';
    });
    continueBtn.addEventListener('mouseleave', () => {
      continueBtn.style.background = 'rgba(40,30,60,0.85)';
      continueBtn.style.transform = 'scale(1)';
    });
    continueBtn.addEventListener('click', () => {
      ArenaUI.instance?.onContinue?.();
    });
    this.resultPanel.appendChild(continueBtn);
  }

  // ── Rast-Bildschirm ────────────────────────────────────

  showRestScreen(team: ArenaUnit[]): void {
    this.hideAllPanels();
    this.updateTopBar();
    this.restPanel.style.display = 'block';
    this.restPanel.innerHTML = '';

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 24px; font-weight: bold;
      color: #44dd88;
      margin-bottom: 6px;
      text-shadow: 0 0 10px rgba(0,200,100,0.3);
    `;
    title.textContent = 'Raststätte';
    this.restPanel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `font-size: 14px; color: #aaa; margin-bottom: 18px;`;
    subtitle.textContent = 'Dein Team erholt sich und wird geheilt (50% der fehlenden LP).';
    this.restPanel.appendChild(subtitle);

    // Team-Status anzeigen
    const teamGrid = document.createElement('div');
    teamGrid.style.cssText = `
      display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
      margin-bottom: 20px;
    `;

    for (const unit of team) {
      const card = document.createElement('div');
      card.style.cssText = `
        width: 120px;
        background: rgba(20,30,25,0.85);
        border: 1px solid rgba(80,200,120,0.3);
        border-radius: 8px;
        padding: 10px;
        text-align: center;
      `;

      const name = document.createElement('div');
      name.style.cssText = `font-size: 12px; font-weight: bold; color: #ddd; margin-bottom: 6px;`;
      name.textContent = unit.def.name;
      card.appendChild(name);

      const aliveText = unit.alive ? '' : ' (Besiegt)';
      const hpText = document.createElement('div');
      hpText.style.cssText = `font-size: 11px; color: ${unit.alive ? '#44dd66' : '#ff6666'};`;
      hpText.textContent = `LP: ${unit.hp}/${unit.maxHp}${aliveText}`;
      card.appendChild(hpText);

      // HP-Balken
      const hpBar = document.createElement('div');
      hpBar.style.cssText = `
        width: 100%; height: 6px;
        background: rgba(60,20,20,0.8);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 4px;
      `;
      const ratio = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) : 0;
      const barColor = ratio > 0.6 ? '#44dd66' : ratio > 0.3 ? '#ffcc00' : '#ff4444';
      const barInner = document.createElement('div');
      barInner.style.cssText = `
        width: ${ratio * 100}%; height: 100%;
        background: ${barColor};
        border-radius: 3px;
      `;
      hpBar.appendChild(barInner);
      card.appendChild(hpBar);

      teamGrid.appendChild(card);
    }

    this.restPanel.appendChild(teamGrid);

    // Weiter-Button
    const continueBtn = document.createElement('button');
    continueBtn.style.cssText = `
      padding: 12px 36px;
      background: rgba(30,50,40,0.85);
      border: 2px solid rgba(80,200,120,0.5);
      border-radius: 8px;
      color: #eee;
      font-size: 16px; font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    `;
    continueBtn.textContent = 'Weiter';
    continueBtn.addEventListener('mouseenter', () => {
      continueBtn.style.background = 'rgba(40,70,55,0.9)';
      continueBtn.style.transform = 'scale(1.04)';
    });
    continueBtn.addEventListener('mouseleave', () => {
      continueBtn.style.background = 'rgba(30,50,40,0.85)';
      continueBtn.style.transform = 'scale(1)';
    });
    continueBtn.addEventListener('click', () => {
      ArenaUI.instance?.onContinue?.();
    });
    this.restPanel.appendChild(continueBtn);
  }

  // ── Laden-Bildschirm ───────────────────────────────────

  showShopScreen(team: ArenaUnit[]): void {
    this.hideAllPanels();
    this.updateTopBar();
    this.shopScreenPanel.style.display = 'block';
    this.shopScreenPanel.innerHTML = '';

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 24px; font-weight: bold;
      color: #ffd866;
      margin-bottom: 6px;
      text-shadow: 0 0 10px rgba(255,200,0,0.3);
    `;
    title.textContent = 'H\u00e4ndler';
    this.shopScreenPanel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `font-size: 14px; color: #aaa; margin-bottom: 18px;`;
    subtitle.textContent = 'Verwende Kristalle, um deine Einheiten zu st\u00e4rken.';
    this.shopScreenPanel.appendChild(subtitle);

    // Kristalle anzeigen
    const crystalInfo = document.createElement('div');
    crystalInfo.style.cssText = `font-size: 16px; color: #88ddff; margin-bottom: 16px;`;
    crystalInfo.textContent = `Kristalle: ${this.crystals}`;
    this.shopScreenPanel.appendChild(crystalInfo);

    // Upgrade-Optionen für jede Einheit
    const upgradeGrid = document.createElement('div');
    upgradeGrid.style.cssText = `
      display: flex; flex-wrap: wrap; justify-content: center; gap: 12px;
      margin-bottom: 20px;
    `;

    for (const unit of team) {
      if (!unit.alive) continue;

      const card = document.createElement('div');
      const elColor = ELEMENT_COLORS[unit.def.element] || '#aaa';
      card.style.cssText = `
        width: 130px;
        background: rgba(25,20,35,0.9);
        border: 1px solid ${elColor}66;
        border-radius: 8px;
        padding: 10px;
        text-align: center;
      `;

      const name = document.createElement('div');
      name.style.cssText = `font-size: 12px; font-weight: bold; color: #ddd; margin-bottom: 4px;`;
      name.textContent = unit.def.name;
      card.appendChild(name);

      const levelInfo = document.createElement('div');
      levelInfo.style.cssText = `font-size: 10px; color: #aaa; margin-bottom: 8px;`;
      levelInfo.textContent = `Stufe ${unit.level}`;
      card.appendChild(levelInfo);

      // Stats
      const stats = document.createElement('div');
      stats.style.cssText = `font-size: 10px; color: #bbb; margin-bottom: 8px; line-height: 1.5;`;
      stats.innerHTML = `
        LP: ${unit.hp}/${unit.maxHp}<br>
        ATK: ${unit.getEffectiveAttack()}<br>
        DEF: ${unit.getEffectiveDefense()}
      `;
      card.appendChild(stats);

      // Upgrade-Button
      const upgradeCost = 15 + unit.level * 5;
      const canUpgrade = this.crystals >= upgradeCost;
      const upgradeBtn = document.createElement('button');
      upgradeBtn.style.cssText = `
        width: 100%;
        padding: 6px 8px;
        background: ${canUpgrade ? 'rgba(40,30,60,0.85)' : 'rgba(25,25,35,0.6)'};
        border: 1px solid ${canUpgrade ? 'rgba(120,80,200,0.5)' : 'rgba(60,60,80,0.3)'};
        border-radius: 5px;
        color: ${canUpgrade ? '#eee' : '#555'};
        font-size: 11px; font-weight: bold;
        cursor: ${canUpgrade ? 'pointer' : 'not-allowed'};
        font-family: inherit;
        transition: all 0.15s;
      `;
      upgradeBtn.textContent = `Aufwerten (${upgradeCost} \uD83D\uDCA0)`;

      if (canUpgrade) {
        upgradeBtn.addEventListener('mouseenter', () => {
          upgradeBtn.style.background = 'rgba(60,45,90,0.9)';
        });
        upgradeBtn.addEventListener('mouseleave', () => {
          upgradeBtn.style.background = 'rgba(40,30,60,0.85)';
        });
        upgradeBtn.addEventListener('click', () => {
          const inst = ArenaUI.instance;
          if (!inst || inst.crystals < upgradeCost) return;
          inst.crystals -= upgradeCost;

          // Stats aufwerten
          unit.maxHp += Math.floor(unit.def.hp * 0.1);
          unit.hp = Math.min(unit.hp + Math.floor(unit.def.hp * 0.1), unit.maxHp);
          unit.baseAttack += Math.floor(unit.def.attack * 0.1);
          unit.baseDefense += Math.floor(unit.def.defense * 0.05);
          unit.level += 1;
          unit.updateBars();

          // Panel neu rendern
          inst.showShopScreen(team);
        });
      }

      card.appendChild(upgradeBtn);

      // Heilen-Button
      if (unit.hp < unit.maxHp) {
        const healCost = 5;
        const canHeal = this.crystals >= healCost;
        const healBtn = document.createElement('button');
        healBtn.style.cssText = `
          width: 100%;
          padding: 5px 8px;
          margin-top: 4px;
          background: ${canHeal ? 'rgba(20,40,30,0.85)' : 'rgba(20,25,30,0.6)'};
          border: 1px solid ${canHeal ? 'rgba(80,200,120,0.5)' : 'rgba(60,60,80,0.3)'};
          border-radius: 5px;
          color: ${canHeal ? '#88ddaa' : '#555'};
          font-size: 10px; font-weight: bold;
          cursor: ${canHeal ? 'pointer' : 'not-allowed'};
          font-family: inherit;
          transition: all 0.15s;
        `;
        healBtn.textContent = `Voll heilen (${healCost} \uD83D\uDCA0)`;

        if (canHeal) {
          healBtn.addEventListener('click', () => {
            const inst = ArenaUI.instance;
            if (!inst || inst.crystals < healCost) return;
            inst.crystals -= healCost;
            unit.hp = unit.maxHp;
            unit.updateBars();
            inst.showShopScreen(team);
          });
        }

        card.appendChild(healBtn);
      }

      upgradeGrid.appendChild(card);
    }

    this.shopScreenPanel.appendChild(upgradeGrid);

    // Weiter-Button
    const continueBtn = document.createElement('button');
    continueBtn.style.cssText = `
      padding: 12px 36px;
      background: rgba(50,40,20,0.85);
      border: 2px solid rgba(200,180,80,0.5);
      border-radius: 8px;
      color: #eee;
      font-size: 16px; font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    `;
    continueBtn.textContent = 'Weiter';
    continueBtn.addEventListener('mouseenter', () => {
      continueBtn.style.background = 'rgba(70,55,30,0.9)';
      continueBtn.style.transform = 'scale(1.04)';
    });
    continueBtn.addEventListener('mouseleave', () => {
      continueBtn.style.background = 'rgba(50,40,20,0.85)';
      continueBtn.style.transform = 'scale(1)';
    });
    continueBtn.addEventListener('click', () => {
      ArenaUI.instance?.onContinue?.();
    });
    this.shopScreenPanel.appendChild(continueBtn);
  }

  // ── Tastatur-Handler ────────────────────────────────────

  private handleKeydown(e: KeyboardEvent): void {
    // Ziffertasten 1-4 für Fähigkeiten
    if (e.key >= '1' && e.key <= '4') {
      const index = parseInt(e.key, 10) - 1;
      if (this.abilityPanel.style.display !== 'none') {
        this.onAbilitySelect?.(index);
      }
    }
  }

  // ── Hilfsfunktionen ─────────────────────────────────────

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
    labelEl.textContent = value ? label + ':' : '';
    item.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.style.cssText = `font-size: 14px; font-weight: bold; color: ${valueColor};`;
    valueEl.textContent = value || label;
    item.appendChild(valueEl);

    return item;
  }

  // ── Aufr\u00e4umen ──────────────────────────────────────────

  cleanup(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (ArenaUI.instance === this) {
      ArenaUI.instance = null;
    }
  }
}
