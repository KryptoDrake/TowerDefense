/**
 * HighScoreSystem - Bestenliste (Leaderboard) for per-level high scores.
 * Stores top 3 scores per level in localStorage.
 * All UI text in German with proper umlauts.
 */

import { LEVELS } from './LevelConfig';

const STORAGE_KEY = 'ztd_highscores';
const MAX_ENTRIES_PER_LEVEL = 3;

export interface HighScoreStats {
  wavesCompleted: number;
  killCount: number;
  goldEarned: number;
  remainingHP: number;
  perfectWaves: number;
  timePlayed: number;   // seconds
  bestCombo: number;
  bossKills: number;
}

export interface HighScoreEntry {
  score: number;
  date: string;         // ISO string
  stars: number;        // 1-3
  stats: HighScoreStats;
  levelName: string;
}

type HighScoreData = Record<string, HighScoreEntry[]>;

export class HighScoreSystem {
  private static _instance: HighScoreSystem | null = null;
  private data: HighScoreData;

  private constructor() {
    this.data = {};
    this.load();
  }

  static getInstance(): HighScoreSystem {
    if (!HighScoreSystem._instance) {
      HighScoreSystem._instance = new HighScoreSystem();
    }
    return HighScoreSystem._instance;
  }

  // ─── Score Calculation ────────────────────────────
  calculateScore(stats: HighScoreStats): number {
    const score =
      (stats.wavesCompleted * 100) +
      (stats.killCount * 5) +
      (stats.goldEarned * 2) +
      (stats.remainingHP * 10) +
      (stats.perfectWaves * 50) -
      (stats.timePlayed * 0.1) +
      (stats.bestCombo * 20);
    return Math.max(0, Math.round(score));
  }

  // ─── Submit a score ───────────────────────────────
  submitScore(levelId: number, stars: number, stats: HighScoreStats, levelName: string): { isNew: boolean; rank: number } {
    const score = this.calculateScore(stats);
    const key = String(levelId);

    if (!this.data[key]) {
      this.data[key] = [];
    }

    const entry: HighScoreEntry = {
      score,
      date: new Date().toISOString(),
      stars,
      stats,
      levelName,
    };

    // Insert in sorted order (descending)
    const list = this.data[key];
    let insertIndex = list.findIndex(e => score > e.score);
    if (insertIndex === -1) {
      insertIndex = list.length;
    }

    // Check if this would be within top 3
    if (insertIndex >= MAX_ENTRIES_PER_LEVEL) {
      return { isNew: false, rank: insertIndex + 1 };
    }

    list.splice(insertIndex, 0, entry);

    // Keep only top 3
    if (list.length > MAX_ENTRIES_PER_LEVEL) {
      list.length = MAX_ENTRIES_PER_LEVEL;
    }

    this.save();
    return { isNew: true, rank: insertIndex + 1 };
  }

  // ─── Get high scores for a level ─────────────────
  getHighScores(levelId: number): HighScoreEntry[] {
    return this.data[String(levelId)] || [];
  }

  // ─── Check if a score would be a new high score ──
  isHighScore(levelId: number, stats: HighScoreStats): boolean {
    const score = this.calculateScore(stats);
    const list = this.data[String(levelId)] || [];
    if (list.length < MAX_ENTRIES_PER_LEVEL) return true;
    return score > list[list.length - 1].score;
  }

  // ─── Get best score for a level ──────────────────
  getBestScore(levelId: number): number {
    const list = this.data[String(levelId)] || [];
    return list.length > 0 ? list[0].score : 0;
  }

  // ─── Persistence ─────────────────────────────────
  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (_) { /* ignore quota errors */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.data = JSON.parse(raw) as HighScoreData;
      }
    } catch (_) { /* ignore parse errors */ }
  }

  // ─── Format helpers ──────────────────────────────
  private formatDate(isoStr: string): string {
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  private formatNumber(n: number): string {
    return Math.floor(n).toLocaleString('de-DE');
  }

  // ─── Render "Neuer Highscore!" banner HTML ───────
  renderNewHighScoreBanner(rank: number, score: number): string {
    const rankLabels = ['', '1. Platz!', '2. Platz!', '3. Platz!'];
    const rankColors = ['', '#ffd700', '#c0c0c0', '#cd7f32'];
    const label = rankLabels[rank] || `Platz ${rank}`;
    const color = rankColors[rank] || '#ffd700';

    return `
      <div class="highscore-banner" style="
        margin: 12px 0;
        padding: 14px 20px;
        background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,170,0,0.08) 100%);
        border: 2px solid ${color};
        border-radius: 12px;
        text-align: center;
        animation: highscorePulse 1.5s ease infinite;
      ">
        <div style="font-size: 20px; font-weight: bold; color: ${color}; text-shadow: 0 0 12px ${color}80; margin-bottom: 4px;">
          Neuer Highscore!
        </div>
        <div style="font-size: 16px; color: #fff; margin-bottom: 2px;">
          ${this.formatNumber(score)} Punkte
        </div>
        <div style="font-size: 13px; color: ${color};">
          ${label}
        </div>
      </div>
    `;
  }

  // ─── Render Bestenliste Panel HTML ───────────────
  renderLeaderboardPanel(): string {
    // Gather all levels from LEVELS config
    const levelEntries: { id: number; name: string; scores: HighScoreEntry[] }[] = [];
    for (const level of LEVELS) {
      levelEntries.push({
        id: level.id,
        name: level.name,
        scores: this.getHighScores(level.id),
      });
    }

    let contentHtml = '';

    // Check if any scores exist at all
    const hasAnyScores = levelEntries.some(e => e.scores.length > 0);

    if (!hasAnyScores) {
      contentHtml = `
        <div style="text-align: center; padding: 30px 10px; color: #666;">
          <div style="font-size: 40px; margin-bottom: 12px;">&#127942;</div>
          <div style="font-size: 14px; margin-bottom: 6px;">Noch keine Highscores vorhanden.</div>
          <div style="font-size: 12px; color: #555;">Schlie\u00dfe Level ab, um deine Bestenliste zu f\u00fcllen!</div>
        </div>
      `;
    } else {
      for (const entry of levelEntries) {
        if (entry.scores.length === 0) continue;

        contentHtml += `
          <div style="margin-bottom: 16px;">
            <div style="
              display: flex; justify-content: space-between; align-items: center;
              padding: 6px 10px; margin-bottom: 6px;
              background: rgba(255,215,0,0.06);
              border-left: 3px solid #ffd700;
              border-radius: 0 6px 6px 0;
            ">
              <span style="color: #ffd700; font-size: 14px; font-weight: bold;">Level ${entry.id}: ${entry.name}</span>
              <span style="color: #888; font-size: 11px;">${entry.scores.length} Eintr\u00e4ge</span>
            </div>
        `;

        for (let i = 0; i < entry.scores.length; i++) {
          const s = entry.scores[i];
          const rankColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32';
          const rankIcon = i === 0 ? '&#129351;' : i === 1 ? '&#129352;' : '&#129353;';
          const stars = '\u2605'.repeat(s.stars) + '\u2606'.repeat(3 - s.stars);

          contentHtml += `
            <div style="
              display: flex; align-items: center; gap: 10px;
              padding: 8px 10px; margin-bottom: 4px;
              background: rgba(255,255,255,0.02);
              border: 1px solid rgba(255,255,255,0.06);
              border-radius: 8px;
              transition: background 0.15s;
            ">
              <div style="
                font-size: 18px; width: 32px; text-align: center; flex-shrink: 0;
              ">${rankIcon}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: ${rankColor}; font-size: 16px; font-weight: bold;">${this.formatNumber(s.score)}</span>
                  <span style="color: #ffd700; font-size: 14px; letter-spacing: 2px;">${stars}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
                  <span style="color: #888; font-size: 11px;">${this.formatDate(s.date)}</span>
                  <span style="color: #666; font-size: 10px;">
                    ${s.stats.killCount} Kills | ${this.formatTime(s.stats.timePlayed)} | ${s.stats.perfectWaves} Perfekt
                  </span>
                </div>
              </div>
            </div>
          `;
        }

        contentHtml += '</div>';
      }
    }

    // Overall summary
    let totalBest = 0;
    let levelsWithScores = 0;
    for (const entry of levelEntries) {
      if (entry.scores.length > 0) {
        totalBest += entry.scores[0].score;
        levelsWithScores++;
      }
    }

    const summaryHtml = hasAnyScores ? `
      <div style="
        margin-top: 12px; padding: 10px 14px;
        background: rgba(255,215,0,0.05);
        border: 1px solid rgba(255,215,0,0.2);
        border-radius: 8px;
        display: flex; justify-content: space-around; text-align: center;
      ">
        <div>
          <div style="color: #888; font-size: 10px;">Gesamtpunktzahl</div>
          <div style="color: #ffd700; font-size: 16px; font-weight: bold;">${this.formatNumber(totalBest)}</div>
        </div>
        <div>
          <div style="color: #888; font-size: 10px;">Level mit Scores</div>
          <div style="color: #44aaff; font-size: 16px; font-weight: bold;">${levelsWithScores} / ${LEVELS.length}</div>
        </div>
      </div>
    ` : '';

    return `
      <div style="
        font-family: 'Segoe UI', Tahoma, sans-serif;
        color: #e0e0e0;
      ">
        ${contentHtml}
        ${summaryHtml}
      </div>
    `;
  }
}
