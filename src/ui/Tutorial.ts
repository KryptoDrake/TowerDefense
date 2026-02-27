/**
 * Tutorial - Step-by-step guided tutorial for first-time players.
 * Shows once (persisted via localStorage) and walks through core gameplay mechanics.
 * All text in German with proper umlauts.
 */

interface TutorialStep {
  text: string;
  highlight: string | null; // CSS selector of element to highlight
  position: 'left' | 'right' | 'above' | 'below' | 'center';
}

export class Tutorial {
  private overlay: HTMLDivElement | null = null;
  private bubble: HTMLDivElement | null = null;
  private currentStep = 0;
  private active = false;
  private onComplete: (() => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  private steps: TutorialStep[] = [
    {
      text: 'Willkommen bei Zombie Tower Defense! Wähle eine Waffe aus dem Panel unten.',
      highlight: '#weapon-panel',
      position: 'above',
    },
    {
      text: 'Platziere Türme NEBEN dem Pfad und Fallen AUF dem Pfad. Verschiedene Positionen sind farbig markiert.',
      highlight: '#game-canvas',
      position: 'center',
    },
    {
      text: 'Starte die erste Welle mit dem Button rechts. Du kannst die Geschwindigkeit anpassen (1x/2x/3x).',
      highlight: '#wave-controls',
      position: 'left',
    },
    {
      text: 'Klicke auf einen platzierten Turm um ihn aufzurüsten oder zu verkaufen. Upgrades machen Türme deutlich stärker!',
      highlight: '#tower-info-panel',
      position: 'left',
    },
    {
      text: 'Nutze Synergien! Platziere bestimmte Turm-Paare nebeneinander für Bonus-Effekte. Drücke H für die Spielanleitung.',
      highlight: null,
      position: 'center',
    },
  ];

  constructor() {}

  /** Returns true if the tutorial has never been completed. */
  shouldShow(): boolean {
    return !localStorage.getItem('ztd_tutorial_done');
  }

  /** Start the tutorial sequence. Optionally provide a callback when complete. */
  start(onComplete?: () => void): void {
    if (this.active) return;
    this.active = true;
    this.currentStep = 0;
    this.onComplete = onComplete ?? null;

    this.createOverlay();
    this.showStep();

    // Reposition on window resize
    this.resizeHandler = () => {
      if (this.active) this.positionBubble();
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  /** Create the full-screen overlay element. */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'tutorial-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 250;
      pointer-events: all;
      opacity: 0;
      transition: opacity 0.4s ease;
    `;
    document.body.appendChild(this.overlay);

    // Fade in
    requestAnimationFrame(() => {
      if (this.overlay) this.overlay.style.opacity = '1';
    });
  }

  /** Show the current tutorial step. */
  private showStep(): void {
    if (!this.overlay) return;

    const step = this.steps[this.currentStep];

    // Clear previous bubble
    if (this.bubble) {
      this.bubble.remove();
      this.bubble = null;
    }

    // Apply spotlight effect on the overlay
    this.applySpotlight(step.highlight);

    // Create text bubble
    this.bubble = document.createElement('div');
    this.bubble.id = 'tutorial-bubble';
    this.bubble.style.cssText = `
      position: fixed;
      z-index: 252;
      max-width: min(420px, 90vw);
      min-width: min(280px, 85vw);
      background: rgba(10, 10, 30, 0.96);
      border: 2px solid rgba(255, 204, 68, 0.7);
      border-radius: 14px;
      padding: 20px 24px 16px 24px;
      color: #ddd;
      font-size: 15px;
      line-height: 1.6;
      box-shadow: 0 0 30px rgba(255, 204, 68, 0.15), 0 8px 32px rgba(0,0,0,0.6);
      pointer-events: all;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.35s ease, transform 0.35s ease;
    `;

    // Step counter
    const stepCounter = document.createElement('div');
    stepCounter.style.cssText = `
      font-size: 11px;
      color: rgba(255, 204, 68, 0.6);
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;
    stepCounter.textContent = `Schritt ${this.currentStep + 1} von ${this.steps.length}`;
    this.bubble.appendChild(stepCounter);

    // Text content
    const textEl = document.createElement('div');
    textEl.style.cssText = `
      margin-bottom: 18px;
      color: #e8e8e8;
    `;
    textEl.textContent = step.text;
    this.bubble.appendChild(textEl);

    // Progress dots
    const dotsContainer = document.createElement('div');
    dotsContainer.style.cssText = `
      display: flex;
      gap: 6px;
      justify-content: center;
      margin-bottom: 14px;
    `;
    for (let i = 0; i < this.steps.length; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 8px; height: 8px;
        border-radius: 50%;
        transition: all 0.3s ease;
        ${i === this.currentStep
          ? 'background: #ffcc44; box-shadow: 0 0 6px rgba(255,204,68,0.5);'
          : i < this.currentStep
            ? 'background: rgba(255,204,68,0.4);'
            : 'background: rgba(255,255,255,0.2);'
        }
      `;
      dotsContainer.appendChild(dot);
    }
    this.bubble.appendChild(dotsContainer);

    // Button row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    `;

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Überspringen';
    skipBtn.style.cssText = `
      padding: 8px 16px;
      font-size: 13px;
      color: #999;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    `;
    skipBtn.addEventListener('mouseenter', () => {
      skipBtn.style.background = 'rgba(255,255,255,0.15)';
      skipBtn.style.color = '#ccc';
    });
    skipBtn.addEventListener('mouseleave', () => {
      skipBtn.style.background = 'rgba(255,255,255,0.08)';
      skipBtn.style.color = '#999';
    });
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });
    btnRow.appendChild(skipBtn);

    // Next / Finish button
    const nextBtn = document.createElement('button');
    const isLast = this.currentStep === this.steps.length - 1;
    nextBtn.textContent = isLast ? 'Los geht\'s!' : 'Weiter';
    nextBtn.style.cssText = `
      padding: 8px 20px;
      font-size: 13px;
      font-weight: bold;
      color: #fff;
      background: linear-gradient(135deg, #2266cc, #3388ee);
      border: 1px solid rgba(68,136,238,0.5);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      box-shadow: 0 2px 8px rgba(34,102,204,0.3);
    `;
    nextBtn.addEventListener('mouseenter', () => {
      nextBtn.style.background = 'linear-gradient(135deg, #3377dd, #44aaff)';
      nextBtn.style.transform = 'translateY(-1px)';
      nextBtn.style.boxShadow = '0 4px 12px rgba(34,102,204,0.5)';
    });
    nextBtn.addEventListener('mouseleave', () => {
      nextBtn.style.background = 'linear-gradient(135deg, #2266cc, #3388ee)';
      nextBtn.style.transform = 'translateY(0)';
      nextBtn.style.boxShadow = '0 2px 8px rgba(34,102,204,0.3)';
    });
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextStep();
    });
    btnRow.appendChild(nextBtn);

    this.bubble.appendChild(btnRow);

    document.body.appendChild(this.bubble);

    // Position the bubble relative to the highlighted element
    this.positionBubble();

    // Fade in the bubble
    requestAnimationFrame(() => {
      if (this.bubble) {
        this.bubble.style.opacity = '1';
        this.bubble.style.transform = 'translateY(0)';
      }
    });
  }

  /** Apply a dark overlay with a spotlight cutout around the highlighted element. */
  private applySpotlight(selector: string | null): void {
    if (!this.overlay) return;

    if (!selector) {
      // No highlight - full dark overlay
      this.overlay.style.background = 'rgba(0, 0, 0, 0.75)';
      this.overlay.style.boxShadow = 'none';
      return;
    }

    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) {
      this.overlay.style.background = 'rgba(0, 0, 0, 0.75)';
      this.overlay.style.boxShadow = 'none';
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 8;

    // Clear overlay background - the spotlight element handles the darkening
    this.overlay.style.background = 'none';

    // Remove old spotlight element
    const oldSpot = this.overlay.querySelector('.tutorial-spotlight');
    if (oldSpot) oldSpot.remove();

    // Create a spotlight mask using a positioned element with a huge box-shadow
    const spotEl = document.createElement('div');
    spotEl.className = 'tutorial-spotlight';
    spotEl.style.cssText = `
      position: fixed;
      left: ${rect.left - padding}px;
      top: ${rect.top - padding}px;
      width: ${rect.width + padding * 2}px;
      height: ${rect.height + padding * 2}px;
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
      z-index: 251;
      pointer-events: none;
      transition: all 0.4s ease;
    `;
    // Add a subtle glow border around the highlighted element
    const glowBorder = document.createElement('div');
    glowBorder.style.cssText = `
      position: absolute;
      top: -2px; left: -2px;
      width: calc(100% + 4px); height: calc(100% + 4px);
      border-radius: 14px;
      border: 2px solid rgba(255, 204, 68, 0.5);
      box-shadow: 0 0 15px rgba(255, 204, 68, 0.2), inset 0 0 15px rgba(255, 204, 68, 0.05);
      pointer-events: none;
    `;
    spotEl.appendChild(glowBorder);
    this.overlay.appendChild(spotEl);
  }

  /** Position the bubble relative to the highlighted element. */
  private positionBubble(): void {
    if (!this.bubble) return;
    const step = this.steps[this.currentStep];
    const bubbleRect = this.bubble.getBoundingClientRect();
    const margin = 16;

    if (!step.highlight) {
      // Center on screen
      this.bubble.style.left = `${(window.innerWidth - bubbleRect.width) / 2}px`;
      this.bubble.style.top = `${(window.innerHeight - bubbleRect.height) / 2}px`;
      return;
    }

    const el = document.querySelector(step.highlight) as HTMLElement | null;
    if (!el) {
      // Fallback: center
      this.bubble.style.left = `${(window.innerWidth - bubbleRect.width) / 2}px`;
      this.bubble.style.top = `${(window.innerHeight - bubbleRect.height) / 2}px`;
      return;
    }

    const rect = el.getBoundingClientRect();
    let x = 0;
    let y = 0;

    switch (step.position) {
      case 'above':
        x = rect.left + rect.width / 2 - bubbleRect.width / 2;
        y = rect.top - bubbleRect.height - margin;
        break;
      case 'below':
        x = rect.left + rect.width / 2 - bubbleRect.width / 2;
        y = rect.bottom + margin;
        break;
      case 'left':
        x = rect.left - bubbleRect.width - margin;
        y = rect.top + rect.height / 2 - bubbleRect.height / 2;
        break;
      case 'right':
        x = rect.right + margin;
        y = rect.top + rect.height / 2 - bubbleRect.height / 2;
        break;
      case 'center':
        x = window.innerWidth / 2 - bubbleRect.width / 2;
        y = window.innerHeight / 2 - bubbleRect.height / 2;
        break;
    }

    // Clamp to viewport
    x = Math.max(margin, Math.min(x, window.innerWidth - bubbleRect.width - margin));
    y = Math.max(margin, Math.min(y, window.innerHeight - bubbleRect.height - margin));

    this.bubble.style.left = `${x}px`;
    this.bubble.style.top = `${y}px`;
  }

  /** Advance to the next step or complete if finished. */
  private nextStep(): void {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.complete();
    } else {
      this.showStep();
    }
  }

  /** Skip the entire tutorial. */
  private skip(): void {
    this.complete();
  }

  /** Mark tutorial as complete, persist to localStorage, and clean up. */
  private complete(): void {
    localStorage.setItem('ztd_tutorial_done', 'true');
    this.fadeOut(() => {
      this.cleanup();
      if (this.onComplete) this.onComplete();
    });
  }

  /** Fade out overlay and bubble, then invoke callback. */
  private fadeOut(cb: () => void): void {
    if (this.overlay) {
      this.overlay.style.transition = 'opacity 0.35s ease';
      this.overlay.style.opacity = '0';
    }
    if (this.bubble) {
      this.bubble.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      this.bubble.style.opacity = '0';
      this.bubble.style.transform = 'translateY(10px)';
    }
    setTimeout(cb, 380);
  }

  /** Remove all tutorial DOM elements and listeners. */
  private cleanup(): void {
    this.active = false;
    if (this.bubble) {
      this.bubble.remove();
      this.bubble = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }
}
