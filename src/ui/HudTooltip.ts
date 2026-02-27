/**
 * HudTooltip - Generisches Tooltip-System für HUD-Elemente.
 * Zeigt kontextsensitive Informationen beim Hovern über HUD-Elemente.
 * Alle Texte in Deutsch mit korrekten Umlauten.
 */

interface HudTooltipRegistration {
  element: HTMLElement;
  contentFn: () => string;
  showTimer: ReturnType<typeof setTimeout> | null;
}

export class HudTooltip {
  private tooltip: HTMLDivElement;
  private caret: HTMLDivElement;
  private registrations: HudTooltipRegistration[] = [];
  private visible = false;
  private currentReg: HudTooltipRegistration | null = null;

  constructor() {
    // Create tooltip container
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'hud-tooltip';
    this.tooltip.style.cssText = `
      display: none;
      position: fixed;
      background: rgba(10, 8, 18, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 6px;
      padding: 8px 11px;
      color: #ddd;
      font-size: 11px;
      line-height: 1.45;
      z-index: 200;
      pointer-events: none;
      max-width: 260px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.08);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      transition: opacity 0.12s ease;
      opacity: 0;
    `;

    // Create caret (arrow pointing up)
    this.caret = document.createElement('div');
    this.caret.style.cssText = `
      position: absolute;
      top: -6px;
      left: 20px;
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 6px solid rgba(10, 8, 18, 0.94);
      pointer-events: none;
    `;
    this.tooltip.appendChild(this.caret);

    // Content container (after caret)
    const contentDiv = document.createElement('div');
    contentDiv.id = 'hud-tooltip-content';
    this.tooltip.appendChild(contentDiv);

    document.body.appendChild(this.tooltip);
  }

  /**
   * Register a HUD element with a dynamic content callback.
   * The callback is invoked each time the tooltip is shown (fresh data).
   */
  register(element: HTMLElement, contentFn: () => string): void {
    const reg: HudTooltipRegistration = {
      element,
      contentFn,
      showTimer: null,
    };

    // Enable pointer events on this HUD item so hover works
    // (many HUD items live inside pointer-events:none containers)
    element.style.pointerEvents = 'all';

    element.addEventListener('mouseenter', () => this.onEnter(reg));
    element.addEventListener('mouseleave', () => this.onLeave(reg));

    this.registrations.push(reg);
  }

  private onEnter(reg: HudTooltipRegistration): void {
    // Clear any pending hide on other registrations
    for (const r of this.registrations) {
      if (r.showTimer) {
        clearTimeout(r.showTimer);
        r.showTimer = null;
      }
    }

    // Delay show by 300ms
    reg.showTimer = setTimeout(() => {
      this.show(reg);
    }, 300);
  }

  private onLeave(reg: HudTooltipRegistration): void {
    // Cancel pending show
    if (reg.showTimer) {
      clearTimeout(reg.showTimer);
      reg.showTimer = null;
    }

    // Immediate hide
    this.hide();
  }

  private show(reg: HudTooltipRegistration): void {
    this.currentReg = reg;
    this.visible = true;

    // Generate content dynamically
    const content = reg.contentFn();
    const contentEl = this.tooltip.querySelector('#hud-tooltip-content')!;
    contentEl.innerHTML = content;

    // Show and position
    this.tooltip.style.display = 'block';
    // Force reflow for opacity transition
    void this.tooltip.offsetWidth;
    this.tooltip.style.opacity = '1';

    this.positionTooltip(reg.element);
  }

  private hide(): void {
    this.visible = false;
    this.currentReg = null;
    this.tooltip.style.opacity = '0';
    // Hide after transition
    setTimeout(() => {
      if (!this.visible) {
        this.tooltip.style.display = 'none';
      }
    }, 120);
  }

  private positionTooltip(target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const ttWidth = this.tooltip.offsetWidth;
    const ttHeight = this.tooltip.offsetHeight;

    // Default: position below the element, centered horizontally
    let left = rect.left + rect.width / 2 - ttWidth / 2;
    let top = rect.bottom + 8; // 8px gap below element

    // Clamp to viewport edges
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal clamping
    if (left < margin) left = margin;
    if (left + ttWidth > vw - margin) left = vw - margin - ttWidth;

    // If tooltip would go below viewport, show above instead
    let caretOnTop = true;
    if (top + ttHeight > vh - margin) {
      top = rect.top - ttHeight - 8;
      caretOnTop = false;
    }

    // If it still doesn't fit above, just clamp to bottom
    if (top < margin) {
      top = margin;
      caretOnTop = true;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;

    // Position caret to point at the center of the target element
    const caretLeft = Math.max(10, Math.min(
      rect.left + rect.width / 2 - left - 6,
      ttWidth - 22
    ));

    if (caretOnTop) {
      // Arrow on top pointing up
      this.caret.style.top = '-6px';
      this.caret.style.bottom = '';
      this.caret.style.left = `${caretLeft}px`;
      this.caret.style.borderBottom = '6px solid rgba(10, 8, 18, 0.94)';
      this.caret.style.borderTop = 'none';
    } else {
      // Arrow on bottom pointing down
      this.caret.style.top = '';
      this.caret.style.bottom = '-6px';
      this.caret.style.left = `${caretLeft}px`;
      this.caret.style.borderTop = '6px solid rgba(10, 8, 18, 0.94)';
      this.caret.style.borderBottom = 'none';
    }
  }

  /** Remove all registrations and destroy tooltip DOM */
  destroy(): void {
    for (const reg of this.registrations) {
      if (reg.showTimer) clearTimeout(reg.showTimer);
    }
    this.registrations = [];
    this.tooltip.remove();
  }
}
