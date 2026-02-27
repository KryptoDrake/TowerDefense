import { LEVELS, LevelDef, GameMode } from '../systems/LevelConfig';

const MODE_NAMES: Record<GameMode, string> = {
  tower_defense: 'Tower Defense',
  auto_battle: 'Auto-Battle',
  arena: 'Arena',
  survival: 'Survival',
  auto_battle_tft: 'Auto-Kampf',
  arena_turnbased: 'Arena-Kampf',
};

const MODE_COLORS: Record<GameMode, string> = {
  tower_defense: '#44aaff',
  auto_battle: '#ffaa44',
  arena: '#ff4444',
  survival: '#aa44ff',
  auto_battle_tft: '#ff8800',
  arena_turnbased: '#ff44aa',
};

const MODE_ICONS: Record<GameMode, string> = {
  tower_defense: '\u{1F3F0}',  // castle
  auto_battle: '\u2694\uFE0F', // crossed swords
  arena: '\u{1F3DF}\uFE0F',   // stadium
  survival: '\u{1F480}',       // skull
  auto_battle_tft: '\u2694\uFE0F', // crossed swords
  arena_turnbased: '\u{1F3DF}\uFE0F', // stadium
};

export class StagePathScreen {
  private overlay: HTMLDivElement;
  private onLevelSelect: ((levelIndex: number) => void) | null = null;
  onEndlessSelect: (() => void) | null = null;
  private unlockedUpTo: number;

  constructor() {
    this.unlockedUpTo = 0;
    this.overlay = document.createElement('div');
    this.overlay.id = 'stage-path-overlay';
    this.overlay.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.92);
      z-index: 200;
      flex-direction: column;
      align-items: center;
      overflow-y: auto;
    `;
    document.body.appendChild(this.overlay);
  }

  show(unlockedUpTo: number, onSelect: (levelIndex: number) => void): void {
    this.unlockedUpTo = unlockedUpTo;
    this.onLevelSelect = onSelect;
    this.render();
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  private render(): void {
    // Chapter definitions based on level indices
    const chapters: Record<number, { title: string; color: string }> = {
      0: { title: 'Kapitel 1: Anfang', color: '#44aa44' },
      3: { title: 'Kapitel 2: Aufstieg', color: '#aaaa44' },
      5: { title: '\u2694\uFE0F Spielmodus: Auto-Kampf', color: '#ff8800' },
      6: { title: 'Kapitel 3: H\u00e4rte', color: '#ff6644' },
      9: { title: '\u{1F3DF}\uFE0F Spielmodus: Arena-Kampf', color: '#ff44aa' },
      10: { title: 'Kapitel 4: Endkampf', color: '#aa44ff' },
    };

    const completedCount = Math.min(this.unlockedUpTo, LEVELS.length);
    const progressPct = Math.round((completedCount / LEVELS.length) * 100);

    let html = `
      <div style="text-align: center; margin: 20px 0 10px 0; flex-shrink: 0;">
        <h1 style="color: #ffcc44; font-size: 28px; margin-bottom: 4px; text-shadow: 0 0 20px rgba(255,204,68,0.4);">
          Stufenpfad
        </h1>
        <p style="color: #888; font-size: 12px; margin-bottom: 8px;">W\u00e4hle dein n\u00e4chstes Level</p>
        <div style="width: 200px; margin: 0 auto; height: 6px; background: #222; border-radius: 3px; overflow: hidden;">
          <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #44aa44, #ffcc44); border-radius: 3px; transition: width 0.3s;"></div>
        </div>
        <p style="color: #666; font-size: 10px; margin-top: 4px;">${completedCount} / ${LEVELS.length} Level abgeschlossen (${progressPct}%)</p>
      </div>
      <div style="position: relative; width: 100%; max-width: min(520px, 96vw); padding: 10px 10px 30px 10px; flex-shrink: 0;">
    `;

    // Draw path line
    html += `<div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, #333 0%, #444 50%, #222 100%); transform: translateX(-50%);"></div>`;

    for (let i = 0; i < LEVELS.length; i++) {
      // Chapter header
      if (chapters[i]) {
        const ch = chapters[i];
        html += `
          <div style="position: relative; text-align: center; margin: ${i === 0 ? '0' : '12px'} 0 10px 0; z-index: 3;">
            <span style="color: ${ch.color}; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; background: rgba(0,0,0,0.9); padding: 2px 12px; border-radius: 4px; border: 1px solid ${ch.color}40;">
              ${ch.title}
            </span>
          </div>
        `;
      }
      const level = LEVELS[i];
      const isUnlocked = i <= this.unlockedUpTo;
      const isCurrent = i === this.unlockedUpTo;
      const isLeft = i % 2 === 0;
      const mode = level.gameMode || 'tower_defense';
      const modeColor = MODE_COLORS[mode];
      const modeName = MODE_NAMES[mode];
      const modeIcon = MODE_ICONS[mode];

      const nodeColor = !isUnlocked ? '#333'
        : level.isFinalBoss ? '#ff0066'
        : isCurrent ? modeColor : '#555';

      const glowStyle = isCurrent
        ? `box-shadow: 0 0 15px ${modeColor}80, 0 0 30px ${modeColor}40;`
        : isUnlocked ? `box-shadow: 0 0 6px ${modeColor}40;` : '';

      const cursor = isUnlocked ? 'pointer' : 'not-allowed';
      const opacity = isUnlocked ? '1' : '0.4';

      // Connection dot on path
      html += `
        <div style="position: absolute; left: 50%; top: ${35 + i * 80}px; transform: translate(-50%, -50%);
          width: ${level.isFinalBoss ? 20 : 12}px; height: ${level.isFinalBoss ? 20 : 12}px;
          border-radius: 50%;
          background: ${nodeColor};
          border: 2px solid ${isUnlocked ? modeColor : '#555'};
          z-index: 2;
          ${glowStyle}
        "></div>
      `;

      // Level card
      html += `
        <div class="stage-node" data-level="${i}" style="
          position: relative;
          margin-bottom: 16px;
          display: flex;
          justify-content: ${isLeft ? 'flex-start' : 'flex-end'};
          cursor: ${cursor};
          opacity: ${opacity};
        ">
          <div style="
            width: min(210px, 42vw);
            background: ${isCurrent ? `linear-gradient(135deg, ${modeColor}15, ${modeColor}05)` : 'rgba(30,30,40,0.9)'};
            border: 2px solid ${isCurrent ? modeColor : isUnlocked ? '#444' : '#222'};
            border-radius: 10px;
            padding: 10px 12px;
            transition: all 0.2s;
            ${glowStyle}
            margin-${isLeft ? 'left' : 'right'}: 10px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 6px;">
              <span style="color: ${isUnlocked ? '#fff' : '#666'}; font-size: 13px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;">
                ${level.isFinalBoss ? '\u{1F451} ' : ''}${level.name}
              </span>
              <span style="color: ${modeColor}; font-size: 9px; font-weight: bold; background: ${modeColor}20; padding: 1px 6px; border-radius: 3px; white-space: nowrap; flex-shrink: 0;">
                ${modeIcon} ${modeName}
              </span>
            </div>
            <div style="color: ${isUnlocked ? '#999' : '#444'}; font-size: 10px; line-height: 1.3; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
              ${level.description}
            </div>
            <div style="display: flex; gap: 8px; font-size: 9px; color: ${isUnlocked ? '#777' : '#333'}; flex-wrap: wrap;">
              <span>Gold: ${level.startGold}</span>
              <span>HP: ${level.baseHP}</span>
              <span>Wellen: ${level.waves.length}</span>
              ${level.maxTowers ? `<span style="color: ${modeColor};">Max ${level.maxTowers} Türme</span>` : ''}
            </div>
            ${isCurrent ? `<div style="text-align: center; margin-top: 6px;">
              <span style="color: ${modeColor}; font-size: 11px; font-weight: bold; letter-spacing: 1px;">
                ${'\u25B6'} SPIELEN
              </span>
            </div>` : ''}
          </div>
        </div>
      `;
    }

    // ─── Endless Mode Card ─────────────────────────
    const endlessUnlocked = this.unlockedUpTo >= LEVELS.length - 1;
    const endlessI = LEVELS.length;
    const endlessColor = '#cc44ff';
    html += `
      <div style="position: absolute; left: 50%; top: ${35 + endlessI * 80}px; transform: translate(-50%, -50%);
        width: 16px; height: 16px; border-radius: 50%;
        background: ${endlessUnlocked ? endlessColor : '#333'};
        border: 2px solid ${endlessUnlocked ? endlessColor : '#555'};
        z-index: 2;
        ${endlessUnlocked ? `box-shadow: 0 0 15px ${endlessColor}80, 0 0 30px ${endlessColor}40;` : ''}
      "></div>
      <div id="endless-node" style="
        position: relative;
        margin-bottom: 16px;
        display: flex;
        justify-content: center;
        cursor: ${endlessUnlocked ? 'pointer' : 'not-allowed'};
        opacity: ${endlessUnlocked ? '1' : '0.4'};
      ">
        <div style="
          width: min(240px, 50vw);
          background: ${endlessUnlocked ? `linear-gradient(135deg, ${endlessColor}15, ${endlessColor}05)` : 'rgba(30,30,40,0.9)'};
          border: 2px solid ${endlessUnlocked ? endlessColor : '#222'};
          border-radius: 10px;
          padding: 12px 14px;
          text-align: center;
          transition: all 0.2s;
          ${endlessUnlocked ? `box-shadow: 0 0 15px ${endlessColor}80;` : ''}
        ">
          <div style="color: ${endlessUnlocked ? '#fff' : '#666'}; font-size: 14px; font-weight: bold; margin-bottom: 4px;">
            \u267E\uFE0F Endlosmodus
          </div>
          <div style="color: ${endlessUnlocked ? '#aaa' : '#444'}; font-size: 10px; line-height: 1.3; margin-bottom: 6px;">
            Unendliche Wellen mit steigender Schwierigkeit. Wie weit kommst du?
          </div>
          <div style="display: flex; gap: 8px; font-size: 9px; color: ${endlessUnlocked ? '#777' : '#333'}; justify-content: center;">
            <span>\u{1F480} Survival</span>
            <span>Gold: 150</span>
            <span>HP: 2000</span>
          </div>
          ${endlessUnlocked ? `<div style="margin-top: 6px;">
            <span style="color: ${endlessColor}; font-size: 11px; font-weight: bold; letter-spacing: 1px;">
              \u25B6 SPIELEN
            </span>
          </div>` : `<div style="margin-top: 4px; color: #555; font-size: 9px;">Alle Level abschlie\u00dfen zum Freischalten</div>`}
        </div>
      </div>
    `;

    html += '</div>';
    this.overlay.innerHTML = html;

    // Endless mode click handler
    const endlessNode = this.overlay.querySelector('#endless-node');
    if (endlessNode && endlessUnlocked) {
      endlessNode.addEventListener('click', () => {
        if (this.onEndlessSelect) {
          this.onEndlessSelect();
          this.hide();
        }
      });
      endlessNode.addEventListener('mouseenter', () => {
        const card = endlessNode.querySelector('div') as HTMLElement;
        if (card) card.style.transform = 'scale(1.03)';
      });
      endlessNode.addEventListener('mouseleave', () => {
        const card = endlessNode.querySelector('div') as HTMLElement;
        if (card) card.style.transform = 'scale(1)';
      });
    }

    // Attach click handlers
    this.overlay.querySelectorAll('.stage-node').forEach(node => {
      node.addEventListener('click', () => {
        const idx = parseInt((node as HTMLElement).dataset.level!);
        if (idx <= this.unlockedUpTo && this.onLevelSelect) {
          this.onLevelSelect(idx);
          this.hide();
        }
      });
      node.addEventListener('mouseenter', () => {
        const idx = parseInt((node as HTMLElement).dataset.level!);
        if (idx <= this.unlockedUpTo) {
          const card = node.querySelector('div') as HTMLElement;
          if (card) card.style.transform = 'scale(1.03)';
        }
      });
      node.addEventListener('mouseleave', () => {
        const card = node.querySelector('div') as HTMLElement;
        if (card) card.style.transform = 'scale(1)';
      });
    });
  }
}
