import * as THREE from 'three';
import { GRID_SIZE, CELL_SIZE, MAP_SIZE } from '../utils/Constants';

/**
 * Minimap – Echtzeit-Kartenansicht als 2D-Canvas-Overlay.
 *
 * Zeigt Pfad, Türme, Fallen, Gegner, Basis und Kamerabereich.
 * Umschalten mit "M"-Taste, Klick springt die Kamera dorthin.
 */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible: boolean;
  private gridSize: number;
  private hintLabel: HTMLDivElement;

  /** Callback when the player clicks a position on the minimap (world coords). */
  onClickPosition: ((worldX: number, worldZ: number) => void) | null = null;

  // Prevent duplicate key listeners across hot-reloads / re-creation
  private static listenerAttached = false;
  static instance: Minimap | null = null;

  // Pixel constants
  private readonly canvasSize = 180;
  // Scale: world goes from -MAP_SIZE/2 to +MAP_SIZE/2 → total MAP_SIZE in each axis
  // We map that to canvasSize pixels.
  private readonly scale: number;

  // Pulsing glow animation timer for base marker
  private glowPhase = 0;

  constructor(gridSize: number = GRID_SIZE) {
    this.gridSize = gridSize;
    this.visible = true;
    this.scale = this.canvasSize / MAP_SIZE;

    // ── Canvas element ────────────────────────────────────
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap-canvas';
    this.canvas.width = this.canvasSize;
    this.canvas.height = this.canvasSize;
    this.canvas.style.cssText = `
      position: absolute; bottom: 10px; left: 10px;
      width: ${this.canvasSize}px; height: ${this.canvasSize}px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 4px;
      z-index: 40; cursor: crosshair;
      pointer-events: auto;
    `;
    document.body.appendChild(this.canvas);

    const rawCtx = this.canvas.getContext('2d');
    if (!rawCtx) throw new Error('Minimap: could not get 2d context');
    this.ctx = rawCtx;

    // ── "M" key-hint label ────────────────────────────────
    this.hintLabel = document.createElement('div');
    this.hintLabel.id = 'minimap-hint';
    this.hintLabel.textContent = 'M';
    this.hintLabel.style.cssText = `
      position: absolute;
      bottom: ${10 + this.canvasSize + 6}px;
      left: 10px;
      color: rgba(255,255,255,0.45);
      font-size: 12px; font-family: monospace;
      pointer-events: none;
      z-index: 40;
    `;
    document.body.appendChild(this.hintLabel);

    // ── Click → jump camera ───────────────────────────────
    this.canvas.addEventListener('click', (e: MouseEvent) => {
      if (!this.visible) return;
      const rect = this.canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width * this.canvasSize;
      const py = (e.clientY - rect.top) / rect.height * this.canvasSize;
      const worldX = px / this.scale - MAP_SIZE / 2;
      const worldZ = py / this.scale - MAP_SIZE / 2;
      if (this.onClickPosition) {
        this.onClickPosition(worldX, worldZ);
      }
    });

    // ── M key toggle (static guard) ──────────────────────
    Minimap.instance = this;
    if (!Minimap.listenerAttached) {
      Minimap.listenerAttached = true;
      document.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'm' || e.key === 'M') {
          Minimap.instance?.toggle();
        }
      });
    }

    this.applyVisibility();
  }

  // ── Visibility helpers ──────────────────────────────────

  toggle(): void {
    this.visible = !this.visible;
    this.applyVisibility();
  }

  show(): void {
    this.visible = true;
    this.applyVisibility();
  }

  hide(): void {
    this.visible = false;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    this.canvas.style.display = this.visible ? 'block' : 'none';
    this.hintLabel.style.display = this.visible ? 'block' : 'none';
  }

  // ── Main render call (once per frame) ───────────────────

  /**
   * Redraw the minimap.
   *
   * @param pathCells  Grid coordinates [gx, gz] that form the path.
   * @param weapons    Placed weapons (towers + traps).
   * @param enemies    Active enemies (alive or dying).
   * @param cameraPos  Current camera world position for the viewport rectangle.
   */
  update(
    pathCells: [number, number][],
    weapons: Array<{ position: THREE.Vector3; color: number; isPath: boolean }>,
    enemies: Array<{ position: THREE.Vector3; type: string; alive: boolean }>,
    cameraPos: THREE.Vector3,
  ): void {
    if (!this.visible) return;

    const ctx = this.ctx;
    const sz = this.canvasSize;
    const s = this.scale;
    const cellPx = CELL_SIZE * s; // pixels per grid cell

    // ── 1. Background ──────────────────────────────────────
    ctx.clearRect(0, 0, sz, sz);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, sz, sz);

    // ── 2. Ground cells (dim green dots for all buildable cells) ──
    ctx.fillStyle = 'rgba(58,110,40,0.35)';
    for (let gz = 0; gz < this.gridSize; gz++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        const px = this.gridToPx(gx);
        const pz = this.gridToPx(gz);
        ctx.fillRect(px + 1, pz + 1, cellPx - 2, cellPx - 2);
      }
    }

    // ── 3. Path cells (brown) ──────────────────────────────
    ctx.fillStyle = '#8B6914';
    for (const [gx, gz] of pathCells) {
      const px = this.gridToPx(gx);
      const pz = this.gridToPx(gz);
      ctx.fillRect(px, pz, cellPx, cellPx);
    }

    // ── 4. Spawn marker (red square at first path cell) ────
    if (pathCells.length > 0) {
      const [sx, sz_] = pathCells[0];
      const spx = this.gridToPx(sx);
      const spz = this.gridToPx(sz_);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(spx, spz, cellPx, cellPx);
      // small "S" label
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', spx + cellPx / 2, spz + cellPx / 2);
    }

    // ── 5. Derive base world position from last path cell ──
    let baseWorldX = 0;
    let baseWorldZ = 0;
    if (pathCells.length > 1) {
      const [bx, bz] = pathCells[pathCells.length - 1];
      baseWorldX = -MAP_SIZE / 2 + bx * CELL_SIZE + CELL_SIZE / 2;
      baseWorldZ = -MAP_SIZE / 2 + bz * CELL_SIZE + CELL_SIZE / 2;
    }

    // ── 6. Entity overlay (towers, traps, enemies, base) ───
    const entityEnemies = enemies.map(e => ({
      x: e.position.x,
      z: e.position.z,
      type: e.type,
      alive: e.alive,
    }));
    const entityTowers = weapons.map(w => ({
      x: w.position.x,
      z: w.position.z,
      isTrap: w.isPath,
    }));
    const basePos = { x: baseWorldX, z: baseWorldZ };

    this.updateEntities(entityEnemies, entityTowers, basePos);

    // ── 7. Camera viewport rectangle ───────────────────────
    this.drawCameraViewport(ctx, cameraPos);
  }

  // ── Entity overlay ─────────────────────────────────────

  /**
   * Draw entity markers (enemies, towers, traps, base) on top of the terrain.
   * Can be called independently or via update().
   *
   * @param enemies  Array of enemy positions with type and alive status.
   * @param towers   Array of tower/trap positions with isTrap flag.
   * @param basePos  World position of the base.
   */
  updateEntities(
    enemies: { x: number; z: number; type: string; alive: boolean }[],
    towers: { x: number; z: number; isTrap: boolean }[],
    basePos: { x: number; z: number },
  ): void {
    if (!this.visible) return;

    const ctx = this.ctx;

    // Advance glow animation
    this.glowPhase += 0.05;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    // ── Base marker (gold dot with glow) ─────────────────
    {
      const [bpx, bpz] = this.worldToPx(basePos.x, basePos.z);
      const baseSize = 6;
      const glowAlpha = 0.3 + 0.25 * Math.sin(this.glowPhase);

      // Outer glow
      ctx.save();
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bpx, bpz, baseSize + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 204, 0, ${glowAlpha.toFixed(2)})`;
      ctx.fill();
      ctx.restore();

      // Solid gold dot
      ctx.beginPath();
      ctx.arc(bpx, bpz, baseSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();

      // "B" label
      ctx.fillStyle = '#000';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B', bpx, bpz);
    }

    // ── Towers (blue dots, 4px) ──────────────────────────
    for (const t of towers) {
      if (t.isTrap) continue; // draw traps separately
      const [tx, tz] = this.worldToPx(t.x, t.z);
      const towerSize = 4;

      ctx.beginPath();
      ctx.arc(tx, tz, towerSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#4488ff';
      ctx.fill();

      // Bright outline for readability
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // ── Traps (green dots, 3px) ──────────────────────────
    for (const t of towers) {
      if (!t.isTrap) continue;
      const [tx, tz] = this.worldToPx(t.x, t.z);
      const trapSize = 3;

      ctx.beginPath();
      ctx.arc(tx, tz, trapSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#44cc44';
      ctx.fill();
    }

    // ── Enemies (red dots, 3px normal / 5px boss) ────────
    for (const en of enemies) {
      if (!en.alive) continue;
      const [ex, ez] = this.worldToPx(en.x, en.z);
      const isBoss = en.type === 'boss';
      const dotSize = isBoss ? 5 : 3;

      ctx.beginPath();
      ctx.arc(ex, ez, dotSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = isBoss ? '#ff0000' : '#ff4444';
      ctx.fill();

      // Boss: extra bright border
      if (isBoss) {
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // ── Coordinate helpers ──────────────────────────────────

  /**
   * Convert grid index (0..gridSize-1) to top-left canvas pixel.
   * Grid cell (gx, gz) corresponds to world rect starting at
   * (-MAP_SIZE/2 + gx*CELL_SIZE, -MAP_SIZE/2 + gz*CELL_SIZE).
   */
  private gridToPx(g: number): number {
    return g * CELL_SIZE * this.scale;
  }

  /**
   * Convert world X/Z to canvas pixel.
   * World range: [-MAP_SIZE/2, +MAP_SIZE/2] → [0, canvasSize]
   */
  private worldToPx(wx: number, wz: number): [number, number] {
    const px = (wx + MAP_SIZE / 2) * this.scale;
    const pz = (wz + MAP_SIZE / 2) * this.scale;
    return [px, pz];
  }

  // ── Camera viewport indicator ───────────────────────────

  private drawCameraViewport(ctx: CanvasRenderingContext2D, cameraPos: THREE.Vector3): void {
    // Approximate visible area based on camera height.
    // The camera is perspective, looking roughly downward.
    // A reasonable heuristic: visible ground rectangle ≈ cameraY * 1.2 wide/tall.
    const camH = Math.max(cameraPos.y, 5);
    const halfW = camH * 0.8;
    const halfH = camH * 0.6;

    const [cx, cz] = this.worldToPx(cameraPos.x, cameraPos.z);

    const rw = halfW * 2 * this.scale;
    const rh = halfH * 2 * this.scale;

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - rw / 2, cz - rh / 2, rw, rh);
  }

  // ── Cleanup ─────────────────────────────────────────────

  dispose(): void {
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    if (this.hintLabel.parentNode) {
      this.hintLabel.parentNode.removeChild(this.hintLabel);
    }
    if (Minimap.instance === this) {
      Minimap.instance = null;
    }
  }
}
