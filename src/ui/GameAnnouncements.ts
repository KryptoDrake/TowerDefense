interface Announcement {
  text: string;
  color: string;
  size: 'small' | 'medium' | 'large';
  duration: number; // ms
}

export class GameAnnouncements {
  private container: HTMLDivElement;
  private queue: Announcement[] = [];
  private showing = false;
  private currentTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'game-announcements';
    this.container.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      z-index: 180;
      pointer-events: none;
      text-align: center;
    `;
    document.body.appendChild(this.container);
  }

  announce(text: string, color = '#ffcc44', size: 'small' | 'medium' | 'large' = 'medium', duration = 1500): void {
    this.queue.push({ text, color, size, duration });
    if (!this.showing) this.showNext();
  }

  private showNext(): void {
    if (this.queue.length === 0) { this.showing = false; return; }
    this.showing = true;
    const ann = this.queue.shift()!;

    const fontSize = ann.size === 'large' ? '42px' : ann.size === 'medium' ? '28px' : '18px';

    this.container.innerHTML = `<div style="
      font-size: ${fontSize};
      font-weight: bold;
      color: ${ann.color};
      text-shadow: 0 0 20px ${ann.color}80, 0 2px 8px rgba(0,0,0,0.8);
      animation: announceIn 0.3s ease-out, announceOut 0.3s ease-in ${ann.duration - 300}ms forwards;
      letter-spacing: 2px;
    ">${ann.text}</div>`;

    this.currentTimer = setTimeout(() => {
      this.container.innerHTML = '';
      setTimeout(() => this.showNext(), 200); // gap between announcements
    }, ann.duration);
  }

  // Convenience methods for common announcements
  waveStart(waveNum: number): void {
    this.announce(`Welle ${waveNum}`, '#ffcc44', 'medium', 1200);
  }

  bossIncoming(): void {
    this.announce('BOSS NAHT!', '#ff2222', 'large', 2000);
  }

  baseDanger(): void {
    this.announce('Basis in Gefahr!', '#ffaa00', 'medium', 1500);
  }

  critical(): void {
    this.announce('KRITISCH!', '#ff0000', 'large', 2000);
  }

  synergyFormed(name: string): void {
    this.announce(`Synergie: ${name}!`, '#ff8844', 'small', 1500);
  }

  towerMaxed(name: string): void {
    this.announce(`${name} Stufe 3!`, '#ffcc44', 'small', 1200);
  }

  perfectWave(): void {
    this.announce('Perfekte Welle!', '#44ff88', 'medium', 1500);
  }

  goldInterest(amount: number): void {
    this.announce(`+${amount} Zinsen`, '#ffcc44', 'small', 1000);
  }

  enemyWaveWarning(composition: string): void {
    this.announce(composition, '#ff8844', 'small', 2000);
  }

  cleanup(): void {
    if (this.currentTimer) clearTimeout(this.currentTimer);
    this.queue = [];
    this.showing = false;
    this.container.innerHTML = '';
  }
}
