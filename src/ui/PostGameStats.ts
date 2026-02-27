/**
 * Post-game statistics summary with personal best tracking.
 * Displays a detailed stats breakdown after level victory or defeat,
 * with animated count-up numbers and "Neuer Rekord!" highlights.
 * All UI text in German with proper umlauts.
 */

import { BALANCE, WeaponKey } from '../systems/BalanceConfig';

export interface LevelStats {
  totalDamageDealt: number;
  towersPlaced: number;
  towersUpgraded: number;
  topKillerName: string;
  topKillerKills: number;
  bestCombo: number;
  goldEarned: number;
  goldSpent: number;
  wavesSurvived: number;
  timePlayed: number; // seconds
}

interface PersonalBests {
  totalDamageDealt: number;
  towersPlaced: number;
  towersUpgraded: number;
  topKillerKills: number;
  bestCombo: number;
  goldEarned: number;
  goldSpent: number;
  wavesSurvived: number;
  timePlayed: number;
}

const STORAGE_KEY = 'ztd_personal_bests';

const DEFAULT_BESTS: PersonalBests = {
  totalDamageDealt: 0,
  towersPlaced: 0,
  towersUpgraded: 0,
  topKillerKills: 0,
  bestCombo: 0,
  goldEarned: 0,
  goldSpent: 0,
  wavesSurvived: 0,
  timePlayed: 0,
};

function loadPersonalBests(): PersonalBests {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_BESTS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_BESTS };
}

function savePersonalBests(bests: PersonalBests): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
  } catch {
    // ignore
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface StatRow {
  label: string;
  value: number;
  /** Display string override (e.g. for time or "Tower (X kills)") */
  displayOverride?: string;
  bestKey: keyof PersonalBests;
  colorClass: string;
}

/**
 * Build the detailed post-game statistics HTML section.
 * Returns { html, newRecordCount } where html is the stats section HTML
 * and newRecordCount is the number of new personal bests achieved.
 */
export function buildPostGameStatsHtml(stats: LevelStats): { html: string; newRecordCount: number } {
  const bests = loadPersonalBests();
  const rows: StatRow[] = [];

  rows.push({
    label: 'Gesamtschaden verursacht',
    value: Math.floor(stats.totalDamageDealt),
    bestKey: 'totalDamageDealt',
    colorClass: 'pgs-orange',
  });

  rows.push({
    label: 'T\u00fcrme platziert',
    value: stats.towersPlaced,
    bestKey: 'towersPlaced',
    colorClass: 'pgs-blue',
  });

  rows.push({
    label: 'T\u00fcrme aufgewertet',
    value: stats.towersUpgraded,
    bestKey: 'towersUpgraded',
    colorClass: 'pgs-blue',
  });

  if (stats.topKillerKills > 0) {
    rows.push({
      label: 'Meiste Kills',
      value: stats.topKillerKills,
      displayOverride: `${stats.topKillerName} (${stats.topKillerKills})`,
      bestKey: 'topKillerKills',
      colorClass: 'pgs-red',
    });
  }

  if (stats.bestCombo >= 3) {
    rows.push({
      label: 'Bester Kombo',
      value: stats.bestCombo,
      bestKey: 'bestCombo',
      colorClass: 'pgs-gold',
    });
  }

  rows.push({
    label: 'Gold verdient',
    value: stats.goldEarned,
    bestKey: 'goldEarned',
    colorClass: 'pgs-yellow',
  });

  rows.push({
    label: 'Gold ausgegeben',
    value: stats.goldSpent,
    bestKey: 'goldSpent',
    colorClass: 'pgs-yellow',
  });

  rows.push({
    label: 'Wellen \u00fcberlebt',
    value: stats.wavesSurvived,
    bestKey: 'wavesSurvived',
    colorClass: 'pgs-blue',
  });

  rows.push({
    label: 'Zeit gespielt',
    value: Math.floor(stats.timePlayed),
    displayOverride: formatTime(stats.timePlayed),
    bestKey: 'timePlayed',
    colorClass: 'pgs-white',
  });

  // Determine which stats are new records
  let newRecordCount = 0;
  const recordFlags: boolean[] = [];
  for (const row of rows) {
    const isRecord = row.value > bests[row.bestKey] && row.value > 0;
    recordFlags.push(isRecord);
    if (isRecord) newRecordCount++;
  }

  // Update personal bests
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.value > bests[row.bestKey]) {
      bests[row.bestKey] = row.value;
    }
  }
  savePersonalBests(bests);

  // Build HTML
  let html = '<div class="pgs-section">';
  html += '<div class="pgs-title">Statistik</div>';
  html += '<div class="pgs-grid">';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const isRecord = recordFlags[i];
    const recordClass = isRecord ? ' pgs-record' : '';
    const displayVal = row.displayOverride || row.value.toString();

    html += `<div class="pgs-row${recordClass}" data-pgs-index="${i}">`;
    html += `  <span class="pgs-label">${row.label}</span>`;
    html += `  <span class="pgs-value ${row.colorClass}" data-pgs-target="${row.value}"${row.displayOverride ? ` data-pgs-display="${displayVal}"` : ''}>0</span>`;
    if (isRecord) {
      html += `  <span class="pgs-record-badge">Neuer Rekord!</span>`;
    }
    html += '</div>';
  }

  html += '</div>'; // .pgs-grid

  // Personal bests section
  if (newRecordCount > 0) {
    html += `<div class="pgs-bests-label">${newRecordCount === 1 ? '1 neuer Rekord!' : `${newRecordCount} neue Rekorde!`}</div>`;
  }

  html += '</div>'; // .pgs-section

  return { html, newRecordCount };
}

/**
 * Animate the post-game stats rows: slide in with stagger, then count up values.
 * Call this after inserting the HTML into the DOM.
 */
export function animatePostGameStats(): void {
  const rows = document.querySelectorAll('.pgs-row');
  rows.forEach((row, i) => {
    const delay = 400 + i * 150;
    setTimeout(() => {
      row.classList.add('pgs-animate-in');

      // Count up the numeric value
      const valueEl = row.querySelector('.pgs-value') as HTMLElement;
      if (!valueEl) return;

      const target = parseInt(valueEl.dataset.pgsTarget || '0', 10);
      const displayOverride = valueEl.dataset.pgsDisplay;

      if (displayOverride) {
        // For display-override values (time, tower name), just reveal after a short delay
        setTimeout(() => {
          valueEl.textContent = displayOverride;
        }, 300);
      } else {
        // Numeric count-up
        animateCountUpPgs(valueEl, target, 1200);
      }

      // Animate record badge appearance
      if (row.classList.contains('pgs-record')) {
        setTimeout(() => {
          const badge = row.querySelector('.pgs-record-badge') as HTMLElement;
          if (badge) {
            badge.classList.add('pgs-badge-visible');
          }
        }, 1400);
      }
    }, delay);
  });
}

function animateCountUpPgs(el: HTMLElement, target: number, durationMs: number): void {
  if (target <= 0) {
    el.textContent = '0';
    return;
  }
  const start = performance.now();
  const tick = (now: number) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    // Ease-out cubic for satisfying deceleration
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    el.textContent = current.toLocaleString('de-DE');
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = target.toLocaleString('de-DE');
    }
  };
  requestAnimationFrame(tick);
}

/**
 * Helper to compute the top killer weapon from the placed weapons list.
 */
export function findTopKiller(weapons: { key: WeaponKey; kills: number }[]): { name: string; kills: number } {
  let topName = '';
  let topKills = 0;
  for (const w of weapons) {
    if (w.kills > topKills) {
      topKills = w.kills;
      const config = BALANCE.weapons[w.key];
      topName = config?.name || w.key;
    }
  }
  return { name: topName, kills: topKills };
}
