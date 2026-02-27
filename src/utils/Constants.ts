// Grid and map dimensions
export const GRID_SIZE = 20; // 20x20 grid
export const CELL_SIZE = 2; // Each cell is 2x2 world units
export const MAP_SIZE = GRID_SIZE * CELL_SIZE; // Total map size

// Cell types
export const CELL_EMPTY = 0; // Grass - can place towers
export const CELL_PATH = 1; // Dirt path - enemies walk here, can place traps
export const CELL_BLOCKED = 2; // Cannot place anything (occupied or base)
export const CELL_TOWER = 3; // Tower placed here
export const CELL_TRAP = 4; // Trap placed on path

// Colors
export const COLOR_GRASS = 0x4a8f29;
export const COLOR_GRASS_DARK = 0x3d7a22;
export const COLOR_PATH = 0x8B6914;
export const COLOR_PATH_DARK = 0x6B4F0A;
export const COLOR_GRID_VALID = 0x44ff44;
export const COLOR_GRID_INVALID = 0xff4444;
export const COLOR_BASE = 0x4488cc;
export const COLOR_SPAWN = 0xcc4444;
