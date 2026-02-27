import {
  GRID_SIZE,
  CELL_EMPTY,
  CELL_PATH,
  CELL_BLOCKED,
  CELL_TOWER,
  CELL_TRAP,
  CELL_SIZE,
  MAP_SIZE,
} from '../utils/Constants';
import { PathSystem } from './PathSystem';
import { LevelDef } from '../systems/LevelConfig';

export class GameMap {
  readonly grid: number[][] = [];
  readonly pathSystem: PathSystem;

  constructor(levelDef?: LevelDef) {
    this.pathSystem = new PathSystem(levelDef?.path);

    // Initialize grid
    for (let z = 0; z < GRID_SIZE; z++) {
      this.grid[z] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.pathSystem.isPathCell(x, z)) {
          this.grid[z][x] = CELL_PATH;
        } else {
          this.grid[z][x] = CELL_EMPTY;
        }
      }
    }

    // Mark base area as blocked
    const endWp = this.pathSystem.waypoints[this.pathSystem.waypoints.length - 1];
    const [bx, bz] = this.worldToGrid(endWp.x, endWp.z);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = bx + dx;
        const gz = bz + dz;
        if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
          this.grid[gz][gx] = CELL_BLOCKED;
        }
      }
    }
  }

  worldToGrid(wx: number, wz: number): [number, number] {
    const gx = Math.floor((wx + MAP_SIZE / 2) / CELL_SIZE);
    const gz = Math.floor((wz + MAP_SIZE / 2) / CELL_SIZE);
    return [gx, gz];
  }

  gridToWorld(gx: number, gz: number): [number, number] {
    const wx = -MAP_SIZE / 2 + gx * CELL_SIZE + CELL_SIZE / 2;
    const wz = -MAP_SIZE / 2 + gz * CELL_SIZE + CELL_SIZE / 2;
    return [wx, wz];
  }

  getCell(gx: number, gz: number): number {
    if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return CELL_BLOCKED;
    return this.grid[gz][gx];
  }

  canPlaceTower(gx: number, gz: number): boolean {
    return this.getCell(gx, gz) === CELL_EMPTY;
  }

  canPlaceTrap(gx: number, gz: number): boolean {
    return this.getCell(gx, gz) === CELL_PATH;
  }

  placeTower(gx: number, gz: number): void {
    this.grid[gz][gx] = CELL_TOWER;
  }

  placeTrap(gx: number, gz: number): void {
    this.grid[gz][gx] = CELL_TRAP;
  }

  removePlacement(gx: number, gz: number, wasPath: boolean): void {
    this.grid[gz][gx] = wasPath ? CELL_PATH : CELL_EMPTY;
  }

  getPathCells(): [number, number][] {
    const cells: [number, number][] = [];
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.grid[z][x] === CELL_PATH || this.grid[z][x] === CELL_TRAP) {
          cells.push([x, z]);
        }
      }
    }
    return cells;
  }
}
