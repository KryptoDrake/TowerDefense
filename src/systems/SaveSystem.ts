import { WeaponKey } from './BalanceConfig';
import { LEVELS } from './LevelConfig';

// ─── Save Data Interfaces ─────────────────────────────────

export interface TowerSaveData {
  weaponKey: WeaponKey;
  gridX: number;
  gridZ: number;
  level: number;
  specialization?: string;
}

export interface TrapSaveData {
  weaponKey: WeaponKey;
  gridX: number;
  gridZ: number;
}

export interface MidLevelState {
  levelId: number;
  gold: number;
  baseHP: number;
  maxBaseHP: number;
  currentWave: number;
  towers: TowerSaveData[];
  traps: TrapSaveData[];
}

export interface RunModifierSave {
  chosenRewards: {
    name: string;
    type: string;
    modifierKey: string;
    modifierValue: number;
  }[];
}

export interface SaveData {
  version: number;
  timestamp: number;
  slotName: string;

  // Run progress
  currentLevelIndex: number;

  // Mid-level state (if saved during gameplay)
  midLevel?: MidLevelState;

  // Run modifiers (from RunManager choices)
  runModifiers: RunModifierSave;
}

// ─── Save System ───────────────────────────────────────────

const SAVE_KEY_PREFIX = 'td_save_';
const AUTOSAVE_KEY = 'td_autosave';
const MAX_SLOTS = 3;
const SAVE_VERSION = 1;

export class SaveSystem {
  private static instance: SaveSystem | null = null;

  constructor() {
    if (SaveSystem.instance) {
      return SaveSystem.instance;
    }
    SaveSystem.instance = this;
  }

  static getInstance(): SaveSystem {
    if (!SaveSystem.instance) {
      SaveSystem.instance = new SaveSystem();
    }
    return SaveSystem.instance;
  }

  // ─── Save / Load / Delete ──────────────────────────────

  save(slotIndex: number, data: SaveData): void {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
    data.version = SAVE_VERSION;
    data.timestamp = Date.now();
    const key = SAVE_KEY_PREFIX + slotIndex;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('[SaveSystem] Fehler beim Speichern:', e);
    }
  }

  load(slotIndex: number): SaveData | null {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return null;
    const key = SAVE_KEY_PREFIX + slotIndex;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (!this.validateSave(data)) return null;
      return data;
    } catch (e) {
      console.error('[SaveSystem] Fehler beim Laden:', e);
      return null;
    }
  }

  delete(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
    const key = SAVE_KEY_PREFIX + slotIndex;
    localStorage.removeItem(key);
  }

  listSaves(): (SaveData | null)[] {
    const saves: (SaveData | null)[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      saves.push(this.load(i));
    }
    return saves;
  }

  // ─── Auto-Save ─────────────────────────────────────────

  autoSave(data: SaveData): void {
    data.version = SAVE_VERSION;
    data.timestamp = Date.now();
    data.slotName = 'Autospeicherung';
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[SaveSystem] Autosave-Fehler:', e);
    }
  }

  loadAutoSave(): SaveData | null {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (!this.validateSave(data)) return null;
      return data;
    } catch (e) {
      console.error('[SaveSystem] Autosave-Ladefehler:', e);
      return null;
    }
  }

  deleteAutoSave(): void {
    localStorage.removeItem(AUTOSAVE_KEY);
  }

  // ─── Export / Import ───────────────────────────────────

  exportSave(slotIndex: number): string | null {
    const data = this.load(slotIndex);
    if (!data) return null;
    return JSON.stringify(data, null, 2);
  }

  importSave(json: string): SaveData | null {
    try {
      const data = JSON.parse(json) as SaveData;
      if (!this.validateSave(data)) {
        console.warn('[SaveSystem] Importierte Daten ungültig.');
        return null;
      }
      return data;
    } catch (e) {
      console.error('[SaveSystem] Import-Fehler:', e);
      return null;
    }
  }

  // ─── Query ─────────────────────────────────────────────

  hasSave(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return false;
    const key = SAVE_KEY_PREFIX + slotIndex;
    return localStorage.getItem(key) !== null;
  }

  hasAutoSave(): boolean {
    return localStorage.getItem(AUTOSAVE_KEY) !== null;
  }

  // ─── Validation ────────────────────────────────────────

  private validateSave(data: SaveData): boolean {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.version !== 'number') return false;
    if (typeof data.timestamp !== 'number') return false;
    if (typeof data.currentLevelIndex !== 'number') return false;
    if (data.currentLevelIndex < 0 || data.currentLevelIndex >= LEVELS.length) return false;
    if (!data.runModifiers || typeof data.runModifiers !== 'object') return false;
    if (!Array.isArray(data.runModifiers.chosenRewards)) return false;

    // Validate midLevel if present
    if (data.midLevel) {
      const ml = data.midLevel;
      if (typeof ml.levelId !== 'number') return false;
      if (typeof ml.gold !== 'number') return false;
      if (typeof ml.baseHP !== 'number') return false;
      if (typeof ml.maxBaseHP !== 'number') return false;
      if (typeof ml.currentWave !== 'number') return false;
      if (!Array.isArray(ml.towers)) return false;
      if (!Array.isArray(ml.traps)) return false;
    }

    return true;
  }

  // ─── UI Rendering ──────────────────────────────────────

  renderSavePanel(): string {
    const saves = this.listSaves();
    const mostRecentIdx = this.findMostRecentSlot(saves);

    let html = `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #e0e0e0;
        max-width: 520px;
        margin: 0 auto;
      ">
        <h2 style="
          text-align: center;
          color: #ffcc44;
          margin: 0 0 16px 0;
          font-size: 22px;
          text-shadow: 0 0 10px rgba(255,204,68,0.3);
        ">Spiel speichern</h2>
    `;

    for (let i = 0; i < MAX_SLOTS; i++) {
      const save = saves[i];
      const isRecent = i === mostRecentIdx;
      html += this.renderSlotCard(i, save, isRecent, 'save');
    }

    html += `
        <div style="
          text-align: center;
          margin-top: 12px;
          font-size: 11px;
          color: #666;
        ">3 Speicherplätze verfügbar</div>
      </div>
    `;

    return html;
  }

  renderLoadPanel(): string {
    const saves = this.listSaves();
    const autoSave = this.loadAutoSave();
    const mostRecentIdx = this.findMostRecentSlot(saves);

    let html = `
      <div style="
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #e0e0e0;
        max-width: 520px;
        margin: 0 auto;
      ">
        <h2 style="
          text-align: center;
          color: #44ccff;
          margin: 0 0 16px 0;
          font-size: 22px;
          text-shadow: 0 0 10px rgba(68,204,255,0.3);
        ">Spiel laden</h2>
    `;

    // Auto-save slot
    html += this.renderAutoSaveCard(autoSave);

    // Separator
    html += `
      <div style="
        border-top: 1px solid #333;
        margin: 12px 0;
        position: relative;
      ">
        <span style="
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #1a1a2e;
          padding: 0 12px;
          color: #666;
          font-size: 11px;
        ">Manuelle Speicherungen</span>
      </div>
    `;

    for (let i = 0; i < MAX_SLOTS; i++) {
      const save = saves[i];
      const isRecent = i === mostRecentIdx;
      html += this.renderSlotCard(i, save, isRecent, 'load');
    }

    // Import button
    html += `
      <div style="text-align: center; margin-top: 14px;">
        <button id="save-import-btn" style="
          background: #2a2a3e;
          color: #88aacc;
          border: 1px solid #445566;
          border-radius: 6px;
          padding: 8px 18px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        " onmouseover="this.style.background='#3a3a4e';this.style.borderColor='#6688aa';"
           onmouseout="this.style.background='#2a2a3e';this.style.borderColor='#445566';">
          Spielstand importieren (JSON)
        </button>
      </div>
    `;

    html += `</div>`;
    return html;
  }

  // ─── Private rendering helpers ─────────────────────────

  private renderSlotCard(
    slotIndex: number,
    save: SaveData | null,
    isRecent: boolean,
    mode: 'save' | 'load'
  ): string {
    const borderColor = save
      ? isRecent
        ? '#ffcc44'
        : '#445566'
      : '#2a2a3e';
    const bgColor = save ? 'rgba(30, 30, 50, 0.9)' : 'rgba(20, 20, 35, 0.6)';

    if (!save) {
      // Empty slot
      return `
        <div class="save-slot-card" data-slot="${slotIndex}" data-mode="${mode}" style="
          background: ${bgColor};
          border: 1px solid ${borderColor};
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 8px;
          cursor: ${mode === 'save' ? 'pointer' : 'default'};
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 14px;
          opacity: ${mode === 'load' ? '0.5' : '0.7'};
        " ${mode === 'save' ? `onmouseover="this.style.borderColor='#667788';this.style.opacity='1';"
            onmouseout="this.style.borderColor='${borderColor}';this.style.opacity='0.7';"` : ''}>
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 6px;
            background: #222233;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: #555;
            flex-shrink: 0;
          ">${slotIndex + 1}</div>
          <div style="flex: 1;">
            <div style="color: #555; font-size: 14px;">Leer</div>
            <div style="color: #444; font-size: 11px; margin-top: 2px;">
              ${mode === 'save' ? 'Klicken zum Speichern' : 'Kein Spielstand'}
            </div>
          </div>
        </div>
      `;
    }

    // Populated slot
    const levelName = this.getLevelName(save);
    const dateStr = this.formatTimestamp(save.timestamp);
    const waveStr = save.midLevel
      ? `Welle ${save.midLevel.currentWave}`
      : 'Zwischen Leveln';
    const goldStr = save.midLevel
      ? `${save.midLevel.gold}g`
      : '';
    const hpStr = save.midLevel
      ? `${Math.ceil(save.midLevel.baseHP)} / ${save.midLevel.maxBaseHP} HP`
      : '';
    const modifierCount = save.runModifiers.chosenRewards.length;

    return `
      <div class="save-slot-card" data-slot="${slotIndex}" data-mode="${mode}" style="
        background: ${bgColor};
        border: 1px solid ${borderColor};
        border-radius: 8px;
        padding: 14px 16px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 14px;
        ${isRecent ? 'box-shadow: 0 0 8px rgba(255,204,68,0.15);' : ''}
      " onmouseover="this.style.borderColor='#88aacc';this.style.transform='translateX(2px)';"
         onmouseout="this.style.borderColor='${borderColor}';this.style.transform='translateX(0)';">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 6px;
          background: ${isRecent ? 'linear-gradient(135deg, #3a3520, #2a2a1a)' : '#222233'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: ${isRecent ? '#ffcc44' : '#aaa'};
          flex-shrink: 0;
          border: 1px solid ${isRecent ? '#554400' : '#333'};
        ">${slotIndex + 1}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-size: 14px;
            font-weight: bold;
            color: #ddd;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${save.slotName || levelName}</div>
          <div style="
            font-size: 11px;
            color: #888;
            margin-top: 3px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          ">
            <span>${levelName}</span>
            <span style="color: #aabbcc;">${waveStr}</span>
            ${goldStr ? `<span style="color: #ffcc44;">${goldStr}</span>` : ''}
            ${hpStr ? `<span style="color: #66cc66;">${hpStr}</span>` : ''}
            ${modifierCount > 0 ? `<span style="color: #cc88ff;">${modifierCount} Modif.</span>` : ''}
          </div>
          <div style="font-size: 10px; color: #555; margin-top: 2px;">${dateStr}</div>
        </div>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          ${mode === 'load' ? `
            <button class="save-delete-btn" data-slot="${slotIndex}" style="
              background: #3a2020;
              color: #cc4444;
              border: 1px solid #552222;
              border-radius: 4px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 11px;
              transition: all 0.2s;
            " onmouseover="this.style.background='#4a2020';this.style.borderColor='#883333';"
               onmouseout="this.style.background='#3a2020';this.style.borderColor='#552222';"
               onclick="event.stopPropagation();">Löschen</button>
          ` : ''}
          ${mode === 'save' || mode === 'load' ? `
            <button class="save-export-btn" data-slot="${slotIndex}" style="
              background: #202a3a;
              color: #4488cc;
              border: 1px solid #223355;
              border-radius: 4px;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 11px;
              transition: all 0.2s;
            " onmouseover="this.style.background='#203a4a';this.style.borderColor='#335588';"
               onmouseout="this.style.background='#202a3a';this.style.borderColor='#223355';"
               onclick="event.stopPropagation();">Export</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderAutoSaveCard(save: SaveData | null): string {
    if (!save) {
      return `
        <div style="
          background: rgba(20, 20, 35, 0.6);
          border: 1px solid #2a2a3e;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 14px;
          opacity: 0.5;
        ">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 6px;
            background: #222233;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #555;
            flex-shrink: 0;
          ">A</div>
          <div>
            <div style="color: #555; font-size: 14px;">Autospeicherung</div>
            <div style="color: #444; font-size: 11px; margin-top: 2px;">Keine Autospeicherung vorhanden</div>
          </div>
        </div>
      `;
    }

    const levelName = this.getLevelName(save);
    const dateStr = this.formatTimestamp(save.timestamp);
    const waveStr = save.midLevel
      ? `Welle ${save.midLevel.currentWave}`
      : 'Zwischen Leveln';
    const goldStr = save.midLevel ? `${save.midLevel.gold}g` : '';
    const hpStr = save.midLevel
      ? `${Math.ceil(save.midLevel.baseHP)} / ${save.midLevel.maxBaseHP} HP`
      : '';

    return `
      <div class="save-slot-card" data-slot="auto" data-mode="load" style="
        background: rgba(25, 35, 30, 0.9);
        border: 1px solid #336644;
        border-radius: 8px;
        padding: 14px 16px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 0 6px rgba(68,204,68,0.1);
      " onmouseover="this.style.borderColor='#44aa66';this.style.transform='translateX(2px)';"
         onmouseout="this.style.borderColor='#336644';this.style.transform='translateX(0)';">
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 6px;
          background: linear-gradient(135deg, #1a2e20, #1a2a1a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: #44cc44;
          flex-shrink: 0;
          border: 1px solid #2a4430;
          font-weight: bold;
        ">A</div>
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-size: 14px;
            font-weight: bold;
            color: #88dd88;
          ">Autospeicherung</div>
          <div style="
            font-size: 11px;
            color: #888;
            margin-top: 3px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          ">
            <span>${levelName}</span>
            <span style="color: #aabbcc;">${waveStr}</span>
            ${goldStr ? `<span style="color: #ffcc44;">${goldStr}</span>` : ''}
            ${hpStr ? `<span style="color: #66cc66;">${hpStr}</span>` : ''}
          </div>
          <div style="font-size: 10px; color: #555; margin-top: 2px;">${dateStr}</div>
        </div>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          <button class="save-delete-btn" data-slot="auto" style="
            background: #3a2020;
            color: #cc4444;
            border: 1px solid #552222;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#4a2020';this.style.borderColor='#883333';"
             onmouseout="this.style.background='#3a2020';this.style.borderColor='#552222';"
             onclick="event.stopPropagation();">Löschen</button>
        </div>
      </div>
    `;
  }

  // ─── Utility helpers ───────────────────────────────────

  private getLevelName(save: SaveData): string {
    if (save.currentLevelIndex >= 0 && save.currentLevelIndex < LEVELS.length) {
      const level = LEVELS[save.currentLevelIndex];
      return `Level ${level.id}: ${level.name}`;
    }
    return `Level ${save.currentLevelIndex + 1}`;
  }

  private formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    return `${day}.${month}.${year} ${hours}:${mins}`;
  }

  private findMostRecentSlot(saves: (SaveData | null)[]): number {
    let bestIdx = -1;
    let bestTs = 0;
    for (let i = 0; i < saves.length; i++) {
      const s = saves[i];
      if (s && s.timestamp > bestTs) {
        bestTs = s.timestamp;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
}
