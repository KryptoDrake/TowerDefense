/**
 * ResourcePopups – Lightweight floating "+X Gold" / "+X Kristalle" popups
 * anchored near the HUD displays. Stacks vertically when multiple fire quickly.
 *
 * Purely HTML/CSS, no Three.js dependency.
 */

interface PopupEntry {
  el: HTMLElement;
  birth: number; // performance.now()
}

const POPUP_LIFETIME = 1500; // ms
const STACK_OFFSET = 18;     // px between stacked popups
const MAX_ACTIVE = 6;        // max simultaneous popups per type

export class ResourcePopups {
  private goldAnchor: HTMLElement;
  private crystalAnchor: HTMLElement | null;

  private activeGold: PopupEntry[] = [];
  private activeCrystal: PopupEntry[] = [];

  private styleInjected = false;

  constructor() {
    this.goldAnchor = document.getElementById('gold-display')!;

    // Crystal display does not have its own element in the HUD,
    // so we anchor crystal popups relative to the wave display area (top-right area)
    this.crystalAnchor = document.getElementById('wave-display');

    this.injectStyles();
  }

  /** Show a floating "+X Gold" popup near the gold HUD element. */
  showGold(amount: number): void {
    if (amount <= 0) return;
    this.spawn(`+${amount} Gold`, 'rp-gold', this.goldAnchor, this.activeGold);
  }

  /** Show a floating "+X Kristalle" popup near the crystal/wave area. */
  showCrystals(amount: number): void {
    if (amount <= 0) return;
    const anchor = this.crystalAnchor ?? this.goldAnchor;
    this.spawn(`+${amount} Kristalle`, 'rp-crystal', anchor, this.activeCrystal);
  }

  /** Remove all active popups (e.g. on level change). */
  clear(): void {
    for (const p of this.activeGold) p.el.remove();
    for (const p of this.activeCrystal) p.el.remove();
    this.activeGold.length = 0;
    this.activeCrystal.length = 0;
  }

  // ── internals ──────────────────────────────────────────

  private spawn(
    text: string,
    cssClass: string,
    anchor: HTMLElement,
    list: PopupEntry[],
  ): void {
    // Evict oldest if at cap
    while (list.length >= MAX_ACTIVE) {
      const old = list.shift();
      old?.el.remove();
    }

    const rect = anchor.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = `rp-popup ${cssClass}`;
    el.textContent = text;

    // Position just above the anchor element, floating upward
    const stackY = list.length * STACK_OFFSET;
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top - 8 - stackY}px`;

    document.body.appendChild(el);

    const entry: PopupEntry = { el, birth: performance.now() };
    list.push(entry);

    // Auto-remove after lifetime
    setTimeout(() => {
      el.remove();
      const idx = list.indexOf(entry);
      if (idx !== -1) list.splice(idx, 1);
    }, POPUP_LIFETIME);
  }

  private injectStyles(): void {
    if (this.styleInjected) return;
    this.styleInjected = true;

    const style = document.createElement('style');
    style.textContent = `
      .rp-popup {
        position: fixed;
        font-size: 13px;
        font-weight: bold;
        pointer-events: none;
        z-index: 55;
        white-space: nowrap;
        transform: translateX(-50%);
        animation: rpFloat ${POPUP_LIFETIME}ms ease-out forwards;
      }
      .rp-gold {
        color: #ffcc44;
        text-shadow:
          0 0 6px rgba(255,204,68,0.5),
          1px 1px 2px rgba(0,0,0,0.8);
      }
      .rp-crystal {
        color: #cc88ff;
        text-shadow:
          0 0 6px rgba(204,136,255,0.5),
          1px 1px 2px rgba(0,0,0,0.8);
      }
      @keyframes rpFloat {
        0%   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.1); }
        15%  { opacity: 1; transform: translateX(-50%) translateY(-6px) scale(1); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-34px) scale(0.85); }
      }
    `;
    document.head.appendChild(style);
  }
}
