/**
 * SettingsMenu - Einstellungen overlay
 * Singleton pattern, saves to localStorage.
 */

export interface GameSettings {
  masterVolume: number;   // 0-100
  sfxVolume: number;      // 0-100
  musicVolume: number;    // 0-100
  showDamageNumbers: boolean;
  showRange: boolean;
  particleQuality: 'low' | 'mittel' | 'hoch';
  cameraSensitivity: number; // 0-100
}

const STORAGE_KEY = 'ztd_settings';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  sfxVolume: 80,
  musicVolume: 60,
  showDamageNumbers: true,
  showRange: true,
  particleQuality: 'mittel',
  cameraSensitivity: 50,
};

export class SettingsMenu {
  private static instance: SettingsMenu | null = null;

  private overlay!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private settings!: GameSettings;

  constructor() {
    if (SettingsMenu.instance) return;
    SettingsMenu.instance = this;

    this.settings = this.loadSettings();
    this.overlay = document.createElement('div');
    this.panel = document.createElement('div');
    this.buildDOM();

    // Close on ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });
  }

  static getInstance(): SettingsMenu {
    if (!SettingsMenu.instance) {
      new SettingsMenu();
    }
    return SettingsMenu.instance!;
  }

  // ── Public API ─────────────────────────────────

  show(): void {
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.overlay.style.display === 'flex';
  }

  getSettings(): GameSettings {
    return { ...this.settings };
  }

  // ── Persistence ────────────────────────────────

  private loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  // ── DOM Construction ───────────────────────────

  private buildDOM(): void {
    // Overlay (full-screen backdrop)
    this.overlay.id = 'settings-overlay';
    this.overlay.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 200;
      justify-content: center;
      align-items: center;
    `;

    // Close on clicking backdrop
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Panel
    this.panel.style.cssText = `
      background: rgba(0,0,0,0.92);
      border: 2px solid rgba(255,204,68,0.4);
      border-radius: 16px;
      padding: 28px 36px;
      max-width: 440px;
      width: 90%;
      max-height: 85vh;
      overflow-y: auto;
      color: #ccc;
      font-size: 14px;
      line-height: 1.6;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    this.panel.innerHTML = this.buildContent();
    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);

    // Wire up controls after DOM insertion
    this.wireControls();
  }

  private buildContent(): string {
    const s = this.settings;
    return `
      <!-- Title -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px;">
        <h1 style="color: #ffcc44; font-size: 26px; margin: 0;">Einstellungen</h1>
        <button id="settings-close-x" style="
          background: none; border: 1px solid #555; color: #888;
          border-radius: 50%; width: 32px; height: 32px; font-size: 18px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        ">\u2715</button>
      </div>

      <!-- Lautstaerke -->
      <div style="margin-bottom: 20px;">
        <h2 style="color: #44aaff; font-size: 16px; margin: 0 0 10px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Lautst\u00e4rke
        </h2>
        ${this.sliderRow('master-vol', 'Gesamt', s.masterVolume)}
        ${this.sliderRow('sfx-vol', 'Effekte (SFX)', s.sfxVolume)}
        ${this.sliderRow('music-vol', 'Musik', s.musicVolume)}
      </div>

      <!-- Anzeige -->
      <div style="margin-bottom: 20px;">
        <h2 style="color: #44aaff; font-size: 16px; margin: 0 0 10px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Anzeige
        </h2>
        ${this.toggleRow('show-dmg', 'Schadenszahlen anzeigen', s.showDamageNumbers)}
        ${this.toggleRow('show-range', 'Reichweite anzeigen', s.showRange)}
        ${this.selectRow('particle-quality', 'Partikel-Qualit\u00e4t', [
          { value: 'low', label: 'Niedrig' },
          { value: 'mittel', label: 'Mittel' },
          { value: 'hoch', label: 'Hoch' },
        ], s.particleQuality)}
      </div>

      <!-- Spiel -->
      <div style="margin-bottom: 24px;">
        <h2 style="color: #44aaff; font-size: 16px; margin: 0 0 10px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Spiel
        </h2>
        ${this.sliderRow('cam-sens', 'Kamera-Empfindlichkeit', s.cameraSensitivity)}
      </div>

      <!-- Close button -->
      <div style="text-align: center;">
        <button id="settings-close-btn" style="
          padding: 10px 36px; font-size: 14px; font-weight: bold;
          color: #fff; background: linear-gradient(135deg, #3498db, #2980b9);
          border: 2px solid #5dade2; border-radius: 8px; cursor: pointer;
          transition: all 0.15s ease;
        ">Schlie\u00dfen</button>
      </div>
    `;
  }

  // ── Row helpers ────────────────────────────────

  private sliderRow(id: string, label: string, value: number): string {
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <label for="stg-${id}" style="flex: 1; color: #ccc; font-size: 13px;">${label}</label>
        <input id="stg-${id}" type="range" min="0" max="100" value="${value}" style="
          -webkit-appearance: none; appearance: none;
          width: 140px; height: 4px;
          background: rgba(255,255,255,0.25);
          border-radius: 2px; outline: none; cursor: pointer;
        " />
        <span id="stg-${id}-val" style="width: 32px; text-align: right; font-size: 12px; color: #aaa;">${value}</span>
      </div>
    `;
  }

  private toggleRow(id: string, label: string, checked: boolean): string {
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="flex: 1; color: #ccc; font-size: 13px;">${label}</span>
        <label style="position: relative; width: 44px; height: 22px; cursor: pointer;">
          <input id="stg-${id}" type="checkbox" ${checked ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;" />
          <span id="stg-${id}-track" style="
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: ${checked ? '#44aaff' : 'rgba(255,255,255,0.2)'};
            border-radius: 11px; transition: background 0.2s;
          "></span>
          <span id="stg-${id}-thumb" style="
            position: absolute; top: 2px; left: ${checked ? '24px' : '2px'};
            width: 18px; height: 18px; background: #fff;
            border-radius: 50%; transition: left 0.2s;
          "></span>
        </label>
      </div>
    `;
  }

  private selectRow(id: string, label: string, options: { value: string; label: string }[], current: string): string {
    const optionsHtml = options.map(o =>
      `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="flex: 1; color: #ccc; font-size: 13px;">${label}</span>
        <select id="stg-${id}" style="
          background: rgba(255,255,255,0.1); color: #fff;
          border: 1px solid rgba(255,255,255,0.25); border-radius: 6px;
          padding: 4px 8px; font-size: 12px; cursor: pointer; outline: none;
        ">
          ${optionsHtml}
        </select>
      </div>
    `;
  }

  // ── Wire up event handlers ─────────────────────

  private wireControls(): void {
    // Close buttons
    this.panel.querySelector('#settings-close-x')?.addEventListener('click', () => this.hide());
    this.panel.querySelector('#settings-close-btn')?.addEventListener('click', () => this.hide());

    // Sliders
    this.wireSlider('master-vol', (v) => { this.settings.masterVolume = v; });
    this.wireSlider('sfx-vol', (v) => { this.settings.sfxVolume = v; });
    this.wireSlider('music-vol', (v) => { this.settings.musicVolume = v; });
    this.wireSlider('cam-sens', (v) => { this.settings.cameraSensitivity = v; });

    // Toggles
    this.wireToggle('show-dmg', (v) => { this.settings.showDamageNumbers = v; });
    this.wireToggle('show-range', (v) => { this.settings.showRange = v; });

    // Select
    const selectEl = this.panel.querySelector('#stg-particle-quality') as HTMLSelectElement | null;
    if (selectEl) {
      selectEl.addEventListener('change', () => {
        this.settings.particleQuality = selectEl.value as 'low' | 'mittel' | 'hoch';
        this.saveSettings();
      });
    }
  }

  private wireSlider(id: string, setter: (v: number) => void): void {
    const slider = this.panel.querySelector(`#stg-${id}`) as HTMLInputElement | null;
    const valEl = this.panel.querySelector(`#stg-${id}-val`) as HTMLElement | null;
    if (slider) {
      slider.addEventListener('input', () => {
        const v = parseInt(slider.value, 10);
        setter(v);
        if (valEl) valEl.textContent = String(v);
        this.saveSettings();
      });
    }
  }

  private wireToggle(id: string, setter: (v: boolean) => void): void {
    const checkbox = this.panel.querySelector(`#stg-${id}`) as HTMLInputElement | null;
    const track = this.panel.querySelector(`#stg-${id}-track`) as HTMLElement | null;
    const thumb = this.panel.querySelector(`#stg-${id}-thumb`) as HTMLElement | null;
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        const on = checkbox.checked;
        setter(on);
        if (track) track.style.background = on ? '#44aaff' : 'rgba(255,255,255,0.2)';
        if (thumb) thumb.style.left = on ? '24px' : '2px';
        this.saveSettings();
      });
    }
  }
}
