import { Enemy } from '../enemies/Enemy';
import { BALANCE, ZombieType } from '../systems/BalanceConfig';

/** German type names for all zombie types */
const TYPE_NAMES: Record<ZombieType, string> = {
  normal: 'Normaler Zombie',
  fast: 'Schneller Zombie',
  tank: 'Tank-Zombie',
  boss: 'Boss-Zombie',
  flyer: 'Flieger-Zombie',
  healer: 'Heiler-Zombie',
  splitter: 'Splitter-Zombie',
  mini_splitter: 'Mini-Splitter',
};

/** Colors for each zombie type (hex CSS strings) */
const TYPE_COLORS: Record<ZombieType, string> = {
  normal: '#44cc66',
  fast: '#ff5555',
  tank: '#aa66ff',
  boss: '#cc0000',
  flyer: '#44aaff',
  healer: '#44ff88',
  splitter: '#ffaa44',
  mini_splitter: '#ffcc66',
};

export class EnemyTooltip {
  private element: HTMLDivElement;
  private visible = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'enemy-tooltip';
    this.element.style.cssText = `
      display: none;
      position: fixed;
      z-index: 160;
      background: rgba(15,10,25,0.95);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 8px 12px;
      pointer-events: none;
      font-size: 12px;
      color: #ccc;
      min-width: 150px;
      max-width: 220px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      font-family: 'Segoe UI', sans-serif;
      line-height: 1.5;
    `;
    document.body.appendChild(this.element);
  }

  show(screenX: number, screenY: number, enemy: Enemy): void {
    const type = enemy.type;
    const typeName = TYPE_NAMES[type] || type;
    const typeColor = TYPE_COLORS[type] || '#ccc';

    // HP ratio for the bar
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    const hpPercent = (hpRatio * 100).toFixed(0);

    // HP bar color
    let hpBarColor = '#44ff44';
    if (hpRatio <= 0.25) hpBarColor = '#ff4444';
    else if (hpRatio <= 0.5) hpBarColor = '#ffaa00';

    // Speed display
    const speedText = enemy.speed.toFixed(1);

    // Gold reward
    const goldReward = BALANCE.goldPerKill[type as keyof typeof BALANCE.goldPerKill] || 0;

    // Status effects
    const effects: string[] = [];
    if (enemy.isSlowed()) {
      effects.push('<span style="color: #44aaff;">Verlangsamt</span>');
    }
    if (enemy.hasDot()) {
      effects.push('<span style="color: #ff8844;">Brennt/Vergiftet</span>');
    }
    if (enemy.shielded) {
      effects.push('<span style="color: #6688ff;">Geschützt</span>');
    }
    if (enemy.enraged) {
      effects.push('<span style="color: #ff4444;">Raserei</span>');
    }

    const effectsHtml = effects.length > 0
      ? `<div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
           ${effects.join(' &middot; ')}
         </div>`
      : '';

    this.element.innerHTML = `
      <div style="font-weight: bold; font-size: 13px; color: ${typeColor}; margin-bottom: 4px;">
        ${typeName}
      </div>
      <div style="margin-bottom: 2px;">
        HP: ${Math.ceil(enemy.hp)} / ${enemy.maxHp}
      </div>
      <div style="
        width: 100%;
        height: 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 4px;
      ">
        <div style="
          width: ${hpPercent}%;
          height: 100%;
          background: ${hpBarColor};
          border-radius: 3px;
          transition: width 0.15s ease;
        "></div>
      </div>
      <div>Geschwindigkeit: ${speedText}</div>
      ${goldReward > 0 ? `<div>Belohnung: ${goldReward} Gold</div>` : ''}
      ${effectsHtml}
    `;

    // Position tooltip offset from cursor, clamped to viewport
    const offsetX = 16;
    const offsetY = 16;
    let left = screenX + offsetX;
    let top = screenY + offsetY;

    // Show first to get dimensions
    this.element.style.display = 'block';
    const rect = this.element.getBoundingClientRect();

    // Clamp to viewport
    if (left + rect.width > window.innerWidth - 8) {
      left = screenX - rect.width - offsetX;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = screenY - rect.height - offsetY;
    }
    left = Math.max(8, left);
    top = Math.max(8, top);

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) return;
    this.element.style.display = 'none';
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Remove the tooltip element from the DOM (for cleanup) */
  destroy(): void {
    this.hide();
    this.element.remove();
  }
}
