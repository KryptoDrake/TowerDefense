import * as THREE from 'three';

export const AB_COLS = 8;
export const AB_ROWS = 8;
export const AB_CELL_SIZE = 2;
export const AB_PLAYER_ROWS = 4; // rows 0-3

export interface ABCell {
  col: number;
  row: number;
  worldX: number;
  worldZ: number;
  occupantId: string | null; // unit instance ID
}

/**
 * 8x8 Schlachtfeld-Raster für den Auto-Kampf-Modus.
 * Untere 4 Reihen (0-3) = Spielerseite, obere 4 Reihen (4-7) = Gegnerseite.
 * Raster zentriert am Ursprung: X von -8 bis +8, Z von -8 bis +8.
 */
export class AutoBattleGrid {
  private cells: ABCell[][] = []; // [row][col]
  private gridGroup: THREE.Group;
  private highlightMesh: THREE.Mesh | null = null;
  private cellMeshes: THREE.Mesh[][] = []; // [row][col] for individual cell planes
  private borderLines: THREE.LineSegments;

  constructor(scene: THREE.Scene) {
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = 'autobattle-grid';

    // Initialize cells
    for (let row = 0; row < AB_ROWS; row++) {
      this.cells[row] = [];
      this.cellMeshes[row] = [];
      for (let col = 0; col < AB_COLS; col++) {
        const worldX = (col - AB_COLS / 2 + 0.5) * AB_CELL_SIZE;
        const worldZ = (row - AB_ROWS / 2 + 0.5) * AB_CELL_SIZE;
        this.cells[row][col] = {
          col,
          row,
          worldX,
          worldZ,
          occupantId: null,
        };
      }
    }

    // Create cell meshes with player/enemy coloring
    this.createCellMeshes();

    // Create grid border lines
    this.borderLines = this.createBorderLines();
    this.gridGroup.add(this.borderLines);

    // Create highlight mesh (initially invisible)
    this.createHighlightMesh();

    scene.add(this.gridGroup);
  }

  /** Create individual cell plane meshes with blue (player) / red (enemy) tint */
  private createCellMeshes(): void {
    const cellGeo = new THREE.PlaneGeometry(AB_CELL_SIZE - 0.05, AB_CELL_SIZE - 0.05);

    for (let row = 0; row < AB_ROWS; row++) {
      for (let col = 0; col < AB_COLS; col++) {
        const isPlayer = row < AB_PLAYER_ROWS;
        // Checkerboard pattern with faction tinting
        const isLight = (row + col) % 2 === 0;

        let color: number;
        if (isPlayer) {
          // Blue-ish tones for player side
          color = isLight ? 0x334466 : 0x2a3a55;
        } else {
          // Red-ish tones for enemy side
          color = isLight ? 0x663344 : 0x552a3a;
        }

        const mat = new THREE.MeshLambertMaterial({
          color,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(cellGeo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(
          this.cells[row][col].worldX,
          0.01, // slightly above ground to avoid z-fighting
          this.cells[row][col].worldZ
        );
        mesh.receiveShadow = true;

        this.cellMeshes[row][col] = mesh;
        this.gridGroup.add(mesh);
      }
    }
  }

  /** Create thin border lines between cells */
  private createBorderLines(): THREE.LineSegments {
    const points: number[] = [];
    const halfW = (AB_COLS * AB_CELL_SIZE) / 2;
    const halfH = (AB_ROWS * AB_CELL_SIZE) / 2;
    const y = 0.02; // slightly above cells

    // Vertical lines
    for (let col = 0; col <= AB_COLS; col++) {
      const x = -halfW + col * AB_CELL_SIZE;
      points.push(x, y, -halfH, x, y, halfH);
    }

    // Horizontal lines
    for (let row = 0; row <= AB_ROWS; row++) {
      const z = -halfH + row * AB_CELL_SIZE;
      points.push(-halfW, y, z, halfW, y, z);
    }

    // Center dividing line (thicker visual via separate line)
    const divZ = -halfH + AB_PLAYER_ROWS * AB_CELL_SIZE;
    points.push(-halfW - 0.1, y + 0.01, divZ, halfW + 0.1, y + 0.01, divZ);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x556677,
      transparent: true,
      opacity: 0.6,
    });

    return new THREE.LineSegments(geometry, material);
  }

  /** Create the cell highlight overlay */
  private createHighlightMesh(): void {
    const geo = new THREE.PlaneGeometry(AB_CELL_SIZE - 0.1, AB_CELL_SIZE - 0.1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffff44,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.highlightMesh = new THREE.Mesh(geo, mat);
    this.highlightMesh.rotation.x = -Math.PI / 2;
    this.highlightMesh.position.y = 0.03;
    this.highlightMesh.visible = false;
    this.gridGroup.add(this.highlightMesh);
  }

  /** Get cell at grid position */
  getCell(col: number, row: number): ABCell | null {
    if (col < 0 || col >= AB_COLS || row < 0 || row >= AB_ROWS) return null;
    return this.cells[row][col];
  }

  /** Convert world position to grid coordinates */
  worldToGrid(worldPos: THREE.Vector3): { col: number; row: number } | null {
    const halfW = (AB_COLS * AB_CELL_SIZE) / 2;
    const halfH = (AB_ROWS * AB_CELL_SIZE) / 2;

    const localX = worldPos.x + halfW;
    const localZ = worldPos.z + halfH;

    const col = Math.floor(localX / AB_CELL_SIZE);
    const row = Math.floor(localZ / AB_CELL_SIZE);

    if (col < 0 || col >= AB_COLS || row < 0 || row >= AB_ROWS) return null;
    return { col, row };
  }

  /** Convert grid coordinates to world position (center of cell) */
  gridToWorld(col: number, row: number): THREE.Vector3 {
    const worldX = (col - AB_COLS / 2 + 0.5) * AB_CELL_SIZE;
    const worldZ = (row - AB_ROWS / 2 + 0.5) * AB_CELL_SIZE;
    return new THREE.Vector3(worldX, 0, worldZ);
  }

  /** Check if a cell is on the player's side (rows 0-3) */
  isPlayerSide(row: number): boolean {
    return row >= 0 && row < AB_PLAYER_ROWS;
  }

  /** Place a unit on the grid. Returns false if cell is occupied or invalid. */
  placeUnit(col: number, row: number, unitId: string): boolean {
    const cell = this.getCell(col, row);
    if (!cell) return false;
    if (cell.occupantId !== null) return false;
    cell.occupantId = unitId;
    return true;
  }

  /** Remove a unit from the grid */
  removeUnit(col: number, row: number): void {
    const cell = this.getCell(col, row);
    if (cell) {
      cell.occupantId = null;
    }
  }

  /** Remove a unit by ID (searches all cells) */
  removeUnitById(unitId: string): void {
    for (let row = 0; row < AB_ROWS; row++) {
      for (let col = 0; col < AB_COLS; col++) {
        if (this.cells[row][col].occupantId === unitId) {
          this.cells[row][col].occupantId = null;
          return;
        }
      }
    }
  }

  /** Find empty cell on player side (for initial placement). Searches bottom-left first. */
  findEmptyPlayerCell(): { col: number; row: number } | null {
    for (let row = 0; row < AB_PLAYER_ROWS; row++) {
      for (let col = 0; col < AB_COLS; col++) {
        if (this.cells[row][col].occupantId === null) {
          return { col, row };
        }
      }
    }
    return null;
  }

  /** Get all occupied cells */
  getOccupiedCells(): ABCell[] {
    const result: ABCell[] = [];
    for (let row = 0; row < AB_ROWS; row++) {
      for (let col = 0; col < AB_COLS; col++) {
        if (this.cells[row][col].occupantId !== null) {
          result.push(this.cells[row][col]);
        }
      }
    }
    return result;
  }

  /** Highlight a cell (hover/selection) */
  highlightCell(col: number, row: number): void {
    if (!this.highlightMesh) return;
    const cell = this.getCell(col, row);
    if (!cell) return;
    this.highlightMesh.position.set(cell.worldX, 0.03, cell.worldZ);
    this.highlightMesh.visible = true;
  }

  /** Clear highlight */
  clearHighlight(): void {
    if (this.highlightMesh) {
      this.highlightMesh.visible = false;
    }
  }

  /** Reset grid (remove all occupants) */
  reset(): void {
    for (let row = 0; row < AB_ROWS; row++) {
      for (let col = 0; col < AB_COLS; col++) {
        this.cells[row][col].occupantId = null;
      }
    }
  }

  /** Get the THREE.Group containing all grid visuals */
  getGroup(): THREE.Group {
    return this.gridGroup;
  }

  /** Remove 3D objects from scene */
  cleanup(scene: THREE.Scene): void {
    scene.remove(this.gridGroup);

    // Dispose geometries and materials
    for (let row = 0; row < AB_ROWS; row++) {
      for (let col = 0; col < AB_COLS; col++) {
        const mesh = this.cellMeshes[row][col];
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    }

    if (this.borderLines) {
      this.borderLines.geometry.dispose();
      (this.borderLines.material as THREE.Material).dispose();
    }

    if (this.highlightMesh) {
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
    }
  }
}
