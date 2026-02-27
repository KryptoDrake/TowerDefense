import { BALANCE, WeaponKey } from './BalanceConfig';

const STORAGE_KEY = 'td_persistent_stats';

interface StatsData {
  // Combat
  totalKills: number;
  normalKills: number;
  fastKills: number;
  tankKills: number;
  bossKills: number;
  flyerKills: number;
  healerKills: number;
  splitterKills: number;
  highestCombo: number;
  totalDamageDealt: number;

  // Economy
  totalGoldEarned: number;
  totalGoldSpent: number;
  totalCrystalsEarned: number;
  chestsOpened: number;

  // Tower
  towersPlaced: number;
  towersUpgraded: number;
  towersSold: number;
  trapsPlaced: number;
  weaponPlaceCounts: Record<string, number>;

  // Game
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  levelsCompleted: string[];
  totalWavesSurvived: number;
  totalPlayTimeSeconds: number;
  fastestLevelClear: Record<string, number>;
  perfectLevels: number;
}

function createDefaultStats(): StatsData {
  return {
    totalKills: 0,
    normalKills: 0,
    fastKills: 0,
    tankKills: 0,
    bossKills: 0,
    flyerKills: 0,
    healerKills: 0,
    splitterKills: 0,
    highestCombo: 0,
    totalDamageDealt: 0,

    totalGoldEarned: 0,
    totalGoldSpent: 0,
    totalCrystalsEarned: 0,
    chestsOpened: 0,

    towersPlaced: 0,
    towersUpgraded: 0,
    towersSold: 0,
    trapsPlaced: 0,
    weaponPlaceCounts: {},

    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    levelsCompleted: [],
    totalWavesSurvived: 0,
    totalPlayTimeSeconds: 0,
    fastestLevelClear: {},
    perfectLevels: 0,
  };
}

// German display names for zombie types
const ZOMBIE_LABELS: Record<string, string> = {
  normalKills: 'Normale Zombies',
  fastKills: 'Schnelle Zombies',
  tankKills: 'Tank Zombies',
  bossKills: 'Bosse',
  flyerKills: 'Flieger',
  healerKills: 'Heiler',
  splitterKills: 'Splitter',
};

// Colors matching BalanceConfig zombie colors (as CSS hex)
const ZOMBIE_COLORS: Record<string, string> = {
  normalKills: '#2d8a4e',
  fastKills: '#8a2d2d',
  tankKills: '#4a2d8a',
  bossKills: '#8a0000',
  flyerKills: '#44aaff',
  healerKills: '#44ff88',
  splitterKills: '#ffaa44',
};

export class PersistentStats {
  private stats: StatsData;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  private static instance: PersistentStats | null = null;

  constructor() {
    this.stats = createDefaultStats();
    this.load();
  }

  static getInstance(): PersistentStats {
    if (!PersistentStats.instance) {
      PersistentStats.instance = new PersistentStats();
    }
    return PersistentStats.instance;
  }

  // ─── Increment a numeric stat ───────────────────────────
  increment(key: keyof StatsData, amount = 1): void {
    const current = this.stats[key];
    if (typeof current === 'number') {
      (this.stats[key] as number) = current + amount;
      this.debouncedSave();
    }
  }

  // ─── Set stat to max(current, value) ────────────────────
  setMax(key: keyof StatsData, value: number): void {
    const current = this.stats[key];
    if (typeof current === 'number') {
      if (value > current) {
        (this.stats[key] as number) = value;
        this.debouncedSave();
      }
    }
  }

  // ─── Set stat to min(current, value) — for fastest times ─
  setMin(key: string, value: number): void {
    // Used for fastestLevelClear per-level keys
    const current = this.stats.fastestLevelClear[key];
    if (current === undefined || value < current) {
      this.stats.fastestLevelClear[key] = value;
      this.debouncedSave();
    }
  }

  // ─── Add to set (for levelsCompleted) ───────────────────
  addToSet(key: 'levelsCompleted', value: string | number): void {
    const strVal = String(value);
    const arr = this.stats[key];
    if (Array.isArray(arr) && !arr.includes(strVal)) {
      arr.push(strVal);
      this.debouncedSave();
    }
  }

  // ─── Track weapon placement ─────────────────────────────
  trackWeaponPlace(weaponKey: string): void {
    if (!this.stats.weaponPlaceCounts[weaponKey]) {
      this.stats.weaponPlaceCounts[weaponKey] = 0;
    }
    this.stats.weaponPlaceCounts[weaponKey]++;

    // Also increment towers/traps placed
    const weaponCfg = BALANCE.weapons[weaponKey as WeaponKey];
    if (weaponCfg) {
      if (weaponCfg.isPath) {
        this.increment('trapsPlaced');
      } else {
        this.increment('towersPlaced');
      }
    }

    this.debouncedSave();
  }

  // ─── Get stat value ─────────────────────────────────────
  get<K extends keyof StatsData>(key: K): StatsData[K] {
    return this.stats[key];
  }

  // ─── Get favorite weapon (most placed) ──────────────────
  getFavoriteWeapon(): string | null {
    const counts = this.stats.weaponPlaceCounts;
    let best: string | null = null;
    let bestCount = 0;
    for (const [weapon, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestCount = count;
        best = weapon;
      }
    }
    return best;
  }

  // ─── Persistence ────────────────────────────────────────
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (_) { /* ignore quota errors */ }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StatsData>;
        const defaults = createDefaultStats();
        // Merge loaded data onto defaults to handle new fields
        for (const k of Object.keys(defaults) as (keyof StatsData)[]) {
          if (parsed[k] !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.stats as any)[k] = parsed[k];
          }
        }
      }
    } catch (_) { /* ignore parse errors */ }
  }

  private debouncedSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
      this.saveTimeout = null;
    }, 1000);
  }

  // ─── Format play time ──────────────────────────────────
  formatPlayTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    if (m > 0) {
      return `${m}m ${s}s`;
    }
    return `${s}s`;
  }

  // ─── Format number with dots as thousands separator ────
  private formatNumber(n: number): string {
    return Math.floor(n).toLocaleString('de-DE');
  }

  // ─── Render Stats Panel HTML ────────────────────────────
  renderStatsPanel(): string {
    const s = this.stats;
    const favorite = this.getFavoriteWeapon();
    const favName = favorite
      ? (BALANCE.weapons[favorite as WeaponKey]?.name ?? favorite)
      : '---';
    const favCount = favorite ? (s.weaponPlaceCounts[favorite] ?? 0) : 0;

    // Compute kill bar chart data
    const killKeys = Object.keys(ZOMBIE_LABELS) as (keyof StatsData)[];
    const killValues = killKeys.map(k => (typeof s[k] === 'number' ? s[k] as number : 0));
    const maxKills = Math.max(1, ...killValues);

    const winRate = s.gamesPlayed > 0
      ? Math.round((s.gamesWon / s.gamesPlayed) * 100)
      : 0;

    // Build kill bars HTML
    let killBarsHtml = '';
    for (let i = 0; i < killKeys.length; i++) {
      const key = killKeys[i];
      const label = ZOMBIE_LABELS[key];
      const color = ZOMBIE_COLORS[key];
      const count = killValues[i];
      const percent = Math.max(2, (count / maxKills) * 100);
      killBarsHtml += `
        <div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
            <span style="color:${color};">${label}</span>
            <span style="color:#ccc;">${this.formatNumber(count)}</span>
          </div>
          <div style="background:#1a1a2e;border-radius:4px;overflow:hidden;height:14px;">
            <div style="width:${percent}%;background:${color};height:100%;border-radius:4px;transition:width 0.3s;min-width:2px;"></div>
          </div>
        </div>`;
    }

    // Fastest level clears
    let fastestHtml = '';
    const fastestEntries = Object.entries(s.fastestLevelClear);
    if (fastestEntries.length > 0) {
      fastestHtml = fastestEntries.map(([levelId, time]) =>
        `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">
          <span style="color:#aaa;">Level ${levelId}</span>
          <span style="color:#ffd700;">${this.formatPlayTime(time)}</span>
        </div>`
      ).join('');
    } else {
      fastestHtml = '<div style="color:#666;font-size:12px;">Noch keine Zeiten</div>';
    }

    // Top 5 weapon placements
    const weaponEntries = Object.entries(s.weaponPlaceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    let weaponRankHtml = '';
    if (weaponEntries.length > 0) {
      const maxPlaced = weaponEntries[0][1];
      weaponRankHtml = weaponEntries.map(([wKey, count], idx) => {
        const wName = BALANCE.weapons[wKey as WeaponKey]?.name ?? wKey;
        const wColor = BALANCE.weapons[wKey as WeaponKey]?.color;
        const cssColor = wColor !== undefined ? `#${wColor.toString(16).padStart(6, '0')}` : '#aaa';
        const pct = Math.max(5, (count / maxPlaced) * 100);
        const medal = idx === 0 ? ' ★' : '';
        return `
          <div style="margin-bottom:5px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:1px;">
              <span style="color:${cssColor};">${wName}${medal}</span>
              <span style="color:#ccc;">${count}x</span>
            </div>
            <div style="background:#1a1a2e;border-radius:3px;overflow:hidden;height:10px;">
              <div style="width:${pct}%;background:${cssColor};height:100%;border-radius:3px;opacity:0.8;"></div>
            </div>
          </div>`;
      }).join('');
    } else {
      weaponRankHtml = '<div style="color:#666;font-size:12px;">Noch keine Waffen platziert</div>';
    }

    // Levels completed display
    const completedArr = s.levelsCompleted;
    const completedDisplay = completedArr.length > 0
      ? completedArr.sort().map(id =>
          `<span style="display:inline-block;background:#2d8a4e;color:#fff;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-size:11px;font-weight:bold;margin:2px;">${id}</span>`
        ).join('')
      : '<span style="color:#666;font-size:12px;">Noch kein Level abgeschlossen</span>';

    return `
      <div style="
        font-family: 'Segoe UI', Tahoma, sans-serif;
        color: #e0e0e0;
        background: linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 50%, #16213e 100%);
        border: 1px solid #2a2a4a;
        border-radius: 12px;
        padding: 20px;
        max-width: 480px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      ">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:18px;border-bottom:1px solid #2a2a4a;padding-bottom:12px;">
          <div style="font-size:22px;font-weight:bold;color:#ffd700;letter-spacing:1px;">Statistiken</div>
          <div style="font-size:13px;color:#aaa;margin-top:4px;">
            Gesamtspielzeit: <span style="color:#ff9944;">${this.formatPlayTime(s.totalPlayTimeSeconds)}</span>
          </div>
        </div>

        <!-- Combat Section -->
        <div style="margin-bottom:18px;">
          <div style="font-size:15px;font-weight:bold;color:#ff4444;margin-bottom:8px;border-left:3px solid #ff4444;padding-left:8px;">
            Kampf
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:10px;padding:6px 10px;background:rgba(255,68,68,0.08);border-radius:6px;">
            <span style="color:#ccc;">Gesamt-Kills</span>
            <span style="color:#ff6666;font-weight:bold;font-size:16px;">${this.formatNumber(s.totalKills)}</span>
          </div>
          ${killBarsHtml}
          <div style="display:flex;justify-content:space-between;margin-top:8px;padding:4px 10px;background:rgba(255,150,50,0.08);border-radius:6px;">
            <span style="color:#ccc;">Gesamt-Schaden</span>
            <span style="color:#ff9944;font-weight:bold;">${this.formatNumber(s.totalDamageDealt)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;padding:4px 10px;background:rgba(255,200,50,0.08);border-radius:6px;">
            <span style="color:#ccc;">Höchste Combo</span>
            <span style="color:#ffcc44;font-weight:bold;">${s.highestCombo}x</span>
          </div>
        </div>

        <!-- Economy Section -->
        <div style="margin-bottom:18px;">
          <div style="font-size:15px;font-weight:bold;color:#ffd700;margin-bottom:8px;border-left:3px solid #ffd700;padding-left:8px;">
            Wirtschaft
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div style="background:rgba(255,215,0,0.08);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:11px;color:#aaa;">Gold verdient</div>
              <div style="font-size:16px;font-weight:bold;color:#ffd700;">${this.formatNumber(s.totalGoldEarned)}</div>
            </div>
            <div style="background:rgba(255,100,50,0.08);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:11px;color:#aaa;">Gold ausgegeben</div>
              <div style="font-size:16px;font-weight:bold;color:#ff8844;">${this.formatNumber(s.totalGoldSpent)}</div>
            </div>
            <div style="background:rgba(150,100,255,0.08);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:11px;color:#aaa;">Kristalle verdient</div>
              <div style="font-size:16px;font-weight:bold;color:#aa88ff;">${this.formatNumber(s.totalCrystalsEarned)}</div>
            </div>
            <div style="background:rgba(200,150,50,0.08);border-radius:6px;padding:8px;text-align:center;">
              <div style="font-size:11px;color:#aaa;">Truhen geöffnet</div>
              <div style="font-size:16px;font-weight:bold;color:#cc9933;">${s.chestsOpened}</div>
            </div>
          </div>
        </div>

        <!-- Tower Section -->
        <div style="margin-bottom:18px;">
          <div style="font-size:15px;font-weight:bold;color:#44aaff;margin-bottom:8px;border-left:3px solid #44aaff;padding-left:8px;">
            Türme & Fallen
          </div>
          ${favorite ? `
          <div style="background:rgba(68,170,255,0.1);border:1px solid #335577;border-radius:8px;padding:10px;margin-bottom:10px;text-align:center;">
            <div style="font-size:11px;color:#aaa;margin-bottom:2px;">Meistplatzierte Waffe</div>
            <div style="font-size:16px;font-weight:bold;color:#44ddff;">${favName}</div>
            <div style="font-size:12px;color:#88aacc;">${favCount}x platziert</div>
          </div>
          ` : ''}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
            <div style="background:rgba(68,170,255,0.06);border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
              <span style="color:#aaa;font-size:12px;">Türme platziert</span>
              <span style="color:#44aaff;font-weight:bold;">${s.towersPlaced}</span>
            </div>
            <div style="background:rgba(68,170,255,0.06);border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
              <span style="color:#aaa;font-size:12px;">Fallen platziert</span>
              <span style="color:#44aaff;font-weight:bold;">${s.trapsPlaced}</span>
            </div>
            <div style="background:rgba(68,170,255,0.06);border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
              <span style="color:#aaa;font-size:12px;">Aufgewertet</span>
              <span style="color:#44ddff;font-weight:bold;">${s.towersUpgraded}</span>
            </div>
            <div style="background:rgba(68,170,255,0.06);border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
              <span style="color:#aaa;font-size:12px;">Verkauft</span>
              <span style="color:#88aacc;font-weight:bold;">${s.towersSold}</span>
            </div>
          </div>
          <div style="font-size:12px;color:#88aacc;margin-bottom:4px;font-weight:bold;">Top-Waffen:</div>
          ${weaponRankHtml}
        </div>

        <!-- Game Section -->
        <div style="margin-bottom:6px;">
          <div style="font-size:15px;font-weight:bold;color:#44ff88;margin-bottom:8px;border-left:3px solid #44ff88;padding-left:8px;">
            Spiel
          </div>

          <!-- Win/Loss bar -->
          <div style="margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span style="color:#44ff88;">Siege: ${s.gamesWon}</span>
              <span style="color:#ccc;">Siegrate: ${winRate}%</span>
              <span style="color:#ff4444;">Niederlagen: ${s.gamesLost}</span>
            </div>
            <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:#1a1a2e;">
              ${s.gamesPlayed > 0 ? `
              <div style="width:${winRate}%;background:#44ff88;height:100%;"></div>
              <div style="width:${100 - winRate}%;background:#ff4444;height:100%;"></div>
              ` : `<div style="width:100%;background:#333;height:100%;"></div>`}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
            <div style="background:rgba(68,255,136,0.06);border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
              <span style="color:#aaa;font-size:12px;">Spiele gespielt</span>
              <span style="color:#44ff88;font-weight:bold;">${s.gamesPlayed}</span>
            </div>
            <div style="background:rgba(68,255,136,0.06);border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
              <span style="color:#aaa;font-size:12px;">Wellen überlebt</span>
              <span style="color:#44ff88;font-weight:bold;">${s.totalWavesSurvived}</span>
            </div>
            <div style="background:rgba(68,255,136,0.06);border-radius:6px;padding:6px 8px;display:flex;justify-content:space-between;">
              <span style="color:#aaa;font-size:12px;">Perfekte Level</span>
              <span style="color:#ffd700;font-weight:bold;">${s.perfectLevels}</span>
            </div>
          </div>

          <!-- Level completion badges -->
          <div style="margin-bottom:8px;">
            <div style="font-size:12px;color:#88ccaa;margin-bottom:4px;font-weight:bold;">Level abgeschlossen:</div>
            <div style="display:flex;flex-wrap:wrap;gap:2px;">
              ${completedDisplay}
            </div>
          </div>

          <!-- Fastest clears -->
          <div>
            <div style="font-size:12px;color:#88ccaa;margin-bottom:4px;font-weight:bold;">Schnellster Abschluss:</div>
            ${fastestHtml}
          </div>
        </div>
      </div>
    `;
  }
}
