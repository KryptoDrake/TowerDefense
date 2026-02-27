export class InputManager {
  private keys: Set<string> = new Set();
  private mousePos = { x: 0, y: 0 };
  private mouseDown = false;

  // Touch state
  private _isTouchDevice = false;
  private touchActive = false;
  private touchCount = 0;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });

    window.addEventListener('mousedown', () => {
      this.mouseDown = true;
    });

    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });

    // ─── Touch event mapping ─────────────────────────────
    window.addEventListener('touchstart', (e) => {
      this._isTouchDevice = true;
      this.touchActive = true;
      this.touchCount = e.touches.length;
      if (e.touches.length === 1) {
        this.mousePos.x = e.touches[0].clientX;
        this.mousePos.y = e.touches[0].clientY;
        this.mouseDown = true;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      this.touchCount = e.touches.length;
      if (e.touches.length >= 1) {
        this.mousePos.x = e.touches[0].clientX;
        this.mousePos.y = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      this.touchCount = e.touches.length;
      if (e.touches.length === 0) {
        this.mouseDown = false;
        this.touchActive = false;
      }
    }, { passive: true });

    window.addEventListener('touchcancel', () => {
      this.mouseDown = false;
      this.touchActive = false;
      this.touchCount = 0;
    }, { passive: true });
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  getMousePosition(): { x: number; y: number } {
    return { ...this.mousePos };
  }

  isMouseDown(): boolean {
    return this.mouseDown;
  }

  /** Get mouse position in Normalized Device Coordinates (-1 to +1) */
  getMouseNDC(): { x: number; y: number } {
    return {
      x: (this.mousePos.x / window.innerWidth) * 2 - 1,
      y: -(this.mousePos.y / window.innerHeight) * 2 + 1,
    };
  }

  /** Whether the device supports touch */
  isTouchDevice(): boolean {
    return this._isTouchDevice || 'ontouchstart' in window;
  }

  /** Current number of active touch points */
  getTouchCount(): number {
    return this.touchCount;
  }

  /** Whether a touch is currently active */
  isTouchActive(): boolean {
    return this.touchActive;
  }
}
