import { BALANCE, WeaponKey, WEAPON_KEYS } from '../systems/BalanceConfig';
import { BackpackManager } from '../systems/BackpackManager';

/**
 * German descriptions of each weapon's special ability / flavour text.
 */
const WEAPON_DESCRIPTIONS: Record<WeaponKey, string> = {
  // ─── Original Towers ──────────────────────────────
  arrowTower:
    'Ein zuverlässiger Allrounder. Schnelle Einzelziel-Angriffe mit solider Reichweite machen ihn zum Rückgrat jeder Verteidigung.',
  cannonTower:
    'Verschießt schwere Kanonenkugeln, die beim Aufprall in einem Radius explodieren. Langsam, aber verheerend gegen Gruppen.',
  iceTower:
    'Verlangsamt getroffene Gegner drastisch. Der niedrige Schaden wird durch die enorme Kontrollwirkung wettgemacht.',
  fireTower:
    'Setzt Gegner mit brennenden Projektilen in Brand. Flammen verursachen zusätzlichen Schaden über Zeit (DoT).',
  sniperTower:
    'Extreme Reichweite und enormer Einzelschaden. Perfekt für Bosse und schwer gepanzerte Gegner.',
  teslaTower:
    'Entlädt einen Kettenblitz, der von Gegner zu Gegner springt. Trifft bis zu 3 Ziele gleichzeitig.',
  mortarTower:
    'Feuert Granaten in hohem Bogen auf entfernte Ziele. Riesiger Explosionsradius für massiven Flächenschaden.',
  poisonTower:
    'Erzeugt eine Giftwolke, die allen Gegnern im Bereich Schaden über Zeit zufügt. Exzellent gegen langsame Gruppen.',

  // ─── New Towers ────────────────────────────────────
  laserTower:
    'Feuert einen kontinuierlichen Energiestrahl. Je länger das Ziel bestrahlt wird, desto höher steigt der Schaden.',
  windTower:
    'Stößt Gegner auf dem Pfad zurück und zwingt sie, Strecke erneut zu laufen. Niedriger Schaden, hoher Nutzen.',
  mageTower:
    'Verschießt magische Homing-Projektile, die ihr Ziel verfolgen und bis zu 2 Gegner durchbohren können.',
  flamethrowerTower:
    'Kurze Reichweite, dafür massiver Feuerschaden im Nahbereich. Entzündet Gegner mit brennendem Öl.',
  barrierTower:
    'Erzeugt ein Kraftfeld auf dem Pfad, das alle durchlaufenden Gegner massiv verlangsamt. Kein direkter Schaden.',
  necromancerTower:
    'Beschwört untote Skelette, die den Pfad blockieren und Gegner im Nahkampf angreifen.',
  earthquakeTower:
    'Verursacht periodische Erdstöße, die allen Gegnern im großen Radius Schaden zufügen und sie kurz betäuben.',
  healTower:
    'Kein Angriff – heilt stattdessen die Basis um +5 HP pro Sekunde. Unverzichtbar in langen Kämpfen.',

  // ─── Traps ──────────────────────────────────────────
  landmine:
    'Einweg-Sprengfalle auf dem Pfad. Explodiert bei Kontakt mit hohem Schaden im Radius. Danach verbraucht.',
  spikeTrap:
    'Dauerhafte Falle auf dem Pfad. Verursacht fortlaufenden Schaden und verlangsamt Gegner, die darüber laufen.',
  frostMine:
    'Einweg-Frostbombe. Friert alle Gegner im Radius für 3 Sekunden komplett ein. Danach verbraucht.',
  goldMine:
    'Passive Einkommensquelle. Generiert +2 Gold pro Sekunde, solange sie auf dem Pfad platziert ist.',
};

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

type FilterTab = 'alle' | 'tuerme' | 'fallen';

/**
 * Tower Encyclopedia (Turm-Lexikon) – a reference panel showing all 20 weapons.
 * Renders its content as an HTML string to be placed inside BaseHubScreen's panelWrapper.
 */
export class TowerEncyclopedia {
  private backpackManager: BackpackManager;
  private activeFilter: FilterTab = 'alle';

  constructor(backpackManager: BackpackManager) {
    this.backpackManager = backpackManager;
  }

  setFilter(filter: FilterTab): void {
    this.activeFilter = filter;
  }

  getFilter(): FilterTab {
    return this.activeFilter;
  }

  /**
   * Returns the inner HTML content for the encyclopedia panel.
   */
  renderContent(): string {
    const stats = this.backpackManager.getStats();

    // Filter tab bar
    const tabs: { id: FilterTab; label: string; color: string }[] = [
      { id: 'alle', label: 'Alle', color: '#ffcc44' },
      { id: 'tuerme', label: 'T\u00fcrme', color: '#ffaa44' },
      { id: 'fallen', label: 'Fallen', color: '#44ff88' },
    ];

    let tabBar = '<div style="display: flex; gap: 4px; margin-bottom: 14px;">';
    for (const tab of tabs) {
      const active = this.activeFilter === tab.id;
      tabBar += `
        <button class="lexikon-tab-btn" data-tab="${tab.id}" style="
          flex: 1; padding: 8px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer;
          border: 1px solid ${active ? tab.color : '#444'};
          background: ${active ? `${tab.color}22` : 'transparent'};
          color: ${active ? tab.color : '#888'};
          transition: all 0.15s;
        ">${tab.label}</button>
      `;
    }
    tabBar += '</div>';

    // Progress bar
    const progress = `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; color: #888; font-size: 11px; margin-bottom: 4px;">
          <span>Entdeckt</span>
          <span style="color: #ffcc44;">${stats.totalUnlocked} / ${stats.totalWeapons}</span>
        </div>
        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
          <div style="width: ${(stats.totalUnlocked / stats.totalWeapons) * 100}%; height: 100%; background: linear-gradient(90deg, #ffcc44, #ff8844); border-radius: 3px; transition: width 0.3s;"></div>
        </div>
      </div>
    `;

    // Build weapon lists
    const allWeapons = WEAPON_KEYS;
    const towers = allWeapons.filter(w => !BALANCE.weapons[w].isPath);
    const traps = allWeapons.filter(w => BALANCE.weapons[w].isPath);

    let weaponCards = '';

    if (this.activeFilter === 'alle' || this.activeFilter === 'tuerme') {
      if (towers.length > 0) {
        weaponCards += `
          <div style="color: #ffaa44; font-size: 11px; font-weight: bold; margin: 8px 0 8px; text-transform: uppercase; letter-spacing: 1px;">
            T\u00fcrme (${towers.length})
          </div>
        `;
        for (const w of towers) {
          weaponCards += this.renderWeaponCard(w);
        }
      }
    }

    if (this.activeFilter === 'alle' || this.activeFilter === 'fallen') {
      if (traps.length > 0) {
        weaponCards += `
          <div style="color: #44ff88; font-size: 11px; font-weight: bold; margin: ${this.activeFilter === 'alle' ? '16' : '8'}px 0 8px; text-transform: uppercase; letter-spacing: 1px;">
            Fallen (${traps.length})
          </div>
        `;
        for (const w of traps) {
          weaponCards += this.renderWeaponCard(w);
        }
      }
    }

    return tabBar + progress + weaponCards;
  }

  private renderWeaponCard(weapon: WeaponKey): string {
    const config = BALANCE.weapons[weapon];
    const unlocked = this.backpackManager.isUnlocked(weapon);
    const icon = WEAPON_ICONS[weapon] || '\u2753';
    const description = WEAPON_DESCRIPTIONS[weapon] || config.description;

    // Color from the weapon config
    const colorHex = '#' + config.color.toString(16).padStart(6, '0');

    if (!unlocked) {
      // ─── Locked card ─────────────────────────────
      return `
        <div style="
          display: flex; align-items: center; gap: 12px;
          padding: 12px; margin-bottom: 6px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          opacity: 0.5;
        ">
          <div style="
            width: 44px; height: 44px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            font-size: 24px;
            filter: brightness(0) saturate(0);
          ">${icon}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="color: #555; font-size: 14px; font-weight: bold; letter-spacing: 1px;">???</div>
            <div style="color: #444; font-size: 11px; margin-top: 2px; font-style: italic;">
              Noch nicht freigeschaltet. Beim H\u00e4ndler oder in Truhen erh\u00e4ltlich.
            </div>
          </div>
          <div style="flex-shrink: 0;">
            <span style="
              display: inline-block; padding: 3px 8px;
              background: rgba(255,255,255,0.05);
              border: 1px solid rgba(255,255,255,0.1);
              border-radius: 6px;
              color: #555; font-size: 10px; font-weight: bold;
            ">\u{1F512} Gesperrt</span>
          </div>
        </div>
      `;
    }

    // ─── Unlocked card ────────────────────────────
    // Build stat badges
    let statBadges = '';

    if (config.damage > 0) {
      statBadges += this.statBadge('\u2694\uFE0F', `${config.damage}`, '#ff8844', 'Schaden');
    }
    if ('range' in config && (config as any).range > 0) {
      statBadges += this.statBadge('\u{1F3AF}', `${(config as any).range}`, '#44aaff', 'Reichweite');
    }
    if ('fireRate' in config && (config as any).fireRate > 0) {
      statBadges += this.statBadge('\u26A1', `${(config as any).fireRate}/s`, '#ffcc44', 'Feuerrate');
    }
    statBadges += this.statBadge('\u{1FA99}', `${config.cost}`, '#ffcc00', 'Kosten');

    // Extra stat badges
    let extraStats = '';
    if ('splashRadius' in config) {
      extraStats += this.miniStat('Fl\u00e4chenradius', `${(config as any).splashRadius}`, '#ff6666');
    }
    if ('slowFactor' in config) {
      const slow = Math.round((1 - (config as any).slowFactor) * 100);
      extraStats += this.miniStat('Verlangsamung', `${slow}%`, '#88ccff');
    }
    if ('slowDuration' in config) {
      extraStats += this.miniStat('Slow-Dauer', `${(config as any).slowDuration}s`, '#88ccff');
    }
    if ('dotDamage' in config) {
      extraStats += this.miniStat('DoT-Schaden', `${(config as any).dotDamage}/s`, '#ff8844');
    }
    if ('dotDuration' in config) {
      extraStats += this.miniStat('DoT-Dauer', `${(config as any).dotDuration}s`, '#ff8844');
    }
    if ('chainTargets' in config) {
      extraStats += this.miniStat('Kettenblitz', `${(config as any).chainTargets} Ziele`, '#cc88ff');
    }
    if ('radius' in config && (config as any).radius > 0) {
      extraStats += this.miniStat('Explosionsradius', `${(config as any).radius}`, '#ff6666');
    }

    const categoryLabel = config.isPath
      ? '<span style="color: #44ff88; font-size: 9px; font-weight: bold; letter-spacing: 0.5px;">FALLE</span>'
      : '<span style="color: #ffaa44; font-size: 9px; font-weight: bold; letter-spacing: 0.5px;">TURM</span>';

    return `
      <div style="
        display: flex; gap: 12px;
        padding: 14px; margin-bottom: 6px;
        background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, ${colorHex}08 100%);
        border: 1px solid ${colorHex}44;
        border-radius: 10px;
        transition: all 0.15s;
      ">
        <!-- Icon -->
        <div style="
          width: 48px; height: 48px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: ${colorHex}18;
          border: 2px solid ${colorHex}55;
          border-radius: 12px;
          font-size: 26px;
        ">${icon}</div>

        <!-- Info -->
        <div style="flex: 1; min-width: 0;">
          <!-- Header row -->
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="color: #fff; font-size: 14px; font-weight: bold;">${config.name}</span>
            ${categoryLabel}
          </div>

          <!-- Description -->
          <div style="color: #aaa; font-size: 11px; line-height: 1.5; margin-bottom: 8px;">
            ${description}
          </div>

          <!-- Main stats row -->
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: ${extraStats ? '6' : '0'}px;">
            ${statBadges}
          </div>

          <!-- Extra stats -->
          ${extraStats ? `<div style="display: flex; flex-wrap: wrap; gap: 4px 12px;">${extraStats}</div>` : ''}
        </div>
      </div>
    `;
  }

  private statBadge(icon: string, value: string, color: string, _label: string): string {
    return `
      <span style="
        display: inline-flex; align-items: center; gap: 3px;
        padding: 2px 8px;
        background: ${color}15;
        border: 1px solid ${color}33;
        border-radius: 6px;
        color: ${color}; font-size: 11px; font-weight: bold;
        white-space: nowrap;
      ">${icon} ${value}</span>
    `;
  }

  private miniStat(label: string, value: string, color: string): string {
    return `
      <span style="color: #888; font-size: 10px;">
        ${label}: <span style="color: ${color}; font-weight: bold;">${value}</span>
      </span>
    `;
  }
}
