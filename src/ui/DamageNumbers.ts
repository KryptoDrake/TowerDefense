import * as THREE from 'three';

/**
 * Floating damage numbers that appear when enemies take damage.
 * Color-coded by damage type with critical hit indicators.
 * Uses CSS-based rendering for performance (no THREE geometries needed).
 */

export type DamageType = 'normal' | 'fire' | 'ice' | 'electric' | 'poison' | 'crit' | 'heal' | 'dot' | 'splash' | 'gold' | 'crystal';

const TYPE_COLORS: Record<DamageType, string> = {
  normal: '#ffffff',
  fire: '#ff6644',
  ice: '#66ccff',
  electric: '#ffff44',
  poison: '#44ff44',
  crit: '#ffcc00',
  heal: '#44ff88',
  dot: '#bb66ff',
  splash: '#ff9944',
  gold: '#ffcc44',
  crystal: '#cc88ff',
};

const TYPE_SHADOWS: Record<DamageType, string> = {
  normal: '0 0 4px rgba(255,255,255,0.5)',
  fire: '0 0 6px rgba(255,102,68,0.7)',
  ice: '0 0 6px rgba(102,204,255,0.7)',
  electric: '0 0 8px rgba(255,255,68,0.8)',
  poison: '0 0 6px rgba(68,255,68,0.7)',
  crit: '0 0 10px rgba(255,204,0,0.9), 0 0 20px rgba(255,204,0,0.4)',
  heal: '0 0 6px rgba(68,255,136,0.7)',
  dot: '0 0 5px rgba(187,102,255,0.6)',
  splash: '0 0 5px rgba(255,153,68,0.6)',
  gold: '0 0 6px rgba(255,204,68,0.7)',
  crystal: '0 0 6px rgba(204,136,255,0.7)',
};

interface DamageNumber {
  element: HTMLDivElement;
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
}

export class DamageNumberSystem {
  private container: HTMLDivElement;
  private numbers: DamageNumber[] = [];
  private camera: THREE.PerspectiveCamera;
  private enabled = true;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    this.container = document.createElement('div');
    this.container.id = 'damage-numbers';
    this.container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:11;';
    document.body.appendChild(this.container);
  }

  spawn(worldX: number, worldY: number, worldZ: number, amount: number, type: DamageType = 'normal'): void {
    if (!this.enabled || amount < 1) return;

    const el = document.createElement('div');
    const color = TYPE_COLORS[type];
    const shadow = TYPE_SHADOWS[type];

    // Scale font size based on damage amount (bigger hits = bigger numbers)
    const isCrit = type === 'crit';
    const isResource = type === 'gold' || type === 'crystal';
    const isHeal = type === 'heal';
    const baseFontSize = isResource ? 14 : isCrit ? 18 : 13;
    const scaledSize = Math.min(baseFontSize + Math.log2(Math.max(1, amount)) * 1.5, 28);

    el.style.cssText = `
      position: absolute;
      font-family: monospace;
      font-weight: bold;
      font-size: ${scaledSize}px;
      color: ${color};
      text-shadow: ${shadow}, 0 1px 2px rgba(0,0,0,0.8);
      white-space: nowrap;
      pointer-events: none;
      z-index: 11;
    `;

    // Build text content
    let text = '';
    if (isCrit) {
      text = `KRIT! ${Math.round(amount)}`;
    } else if (type === 'gold') {
      text = `+${Math.round(amount)}g`;
    } else if (type === 'crystal') {
      text = `+${Math.round(amount)} \u{1F48E}`;
    } else if (isHeal) {
      text = `+${Math.round(amount)}`;
    } else {
      text = Math.round(amount).toString();
    }
    el.textContent = text;
    this.container.appendChild(el);

    // Random horizontal drift for visual variety
    const driftX = (Math.random() - 0.5) * 1.5;
    const lifetime = isResource ? 1.4 : isCrit ? 1.3 : 1.0;

    this.numbers.push({
      element: el,
      x: worldX + (Math.random() - 0.5) * 0.5,
      y: worldY + (isResource ? 2.0 : 1.5) + Math.random() * 0.5,
      z: worldZ + (Math.random() - 0.5) * 0.5,
      vy: isResource ? 2.0 + Math.random() * 0.3 : isCrit ? 2.2 : 1.5 + Math.random() * 0.5,
      vx: driftX,
      life: lifetime,
      maxLife: lifetime,
    });
  }

  update(dt: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.numbers.length; i++) {
      const n = this.numbers[i];
      n.life -= dt * 1.2;
      n.y += n.vy * dt;
      n.x += n.vx * dt;
      n.vy -= dt * 2;
      // Dampen horizontal drift
      n.vx *= 0.97;

      if (n.life <= 0) {
        toRemove.push(i);
        continue;
      }

      // Project world position to screen
      const vec = new THREE.Vector3(n.x, n.y, n.z);
      vec.project(this.camera);

      const hw = window.innerWidth / 2;
      const hh = window.innerHeight / 2;
      const sx = vec.x * hw + hw;
      const sy = -vec.y * hh + hh;

      // Behind camera or off-screen
      if (vec.z > 1 || sx < -50 || sx > window.innerWidth + 50 || sy < -50 || sy > window.innerHeight + 50) {
        n.element.style.display = 'none';
        continue;
      }

      n.element.style.display = '';
      n.element.style.left = `${sx}px`;
      n.element.style.top = `${sy}px`;
      // Smooth fade: full opacity for first 60%, then fade to 0
      const lifePct = n.life / n.maxLife;
      const opacity = lifePct > 0.4 ? 1 : lifePct / 0.4;
      n.element.style.opacity = `${opacity}`;
      const scale = 0.8 + lifePct * 0.4;
      n.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    // Remove expired
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      this.numbers[idx].element.remove();
      this.numbers.splice(idx, 1);
    }
  }

  clear(): void {
    for (const n of this.numbers) {
      n.element.remove();
    }
    this.numbers = [];
  }
}
