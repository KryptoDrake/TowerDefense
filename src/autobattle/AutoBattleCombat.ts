import { AutoBattleUnit } from './AutoBattleUnit';
import { AutoBattleGrid, AB_COLS, AB_ROWS } from './AutoBattleGrid';
import { UnitElement, getElementMultiplier } from '../units/UnitConfig';

export interface CombatEvent {
  type: 'attack' | 'ability' | 'death' | 'move';
  source: AutoBattleUnit;
  target?: AutoBattleUnit;
  damage?: number;
  element?: string;
}

/**
 * Kampf-KI und Auflösungssystem für den Auto-Kampf-Modus.
 *
 * Kampfpriorität:
 * 1. Wenn Ziel tot oder null -> neues Ziel suchen (nächster Feind)
 * 2. Wenn Ziel in Reichweite -> angreifen (Cooldown beachten)
 * 3. Wenn Ziel außer Reichweite -> zum Ziel bewegen (eine Zelle pro Bewegung)
 * 4. Mana steigt um 10 pro Angriff (Fähigkeit bei 100 Mana, derzeit nur Reset)
 *
 * Schadensformel: max(1, angreifer.attack * elementMult - verteidiger.defense * 0.5)
 */
export class AutoBattleCombat {

  /** Find the best target for a unit (nearest enemy) */
  static findTarget(unit: AutoBattleUnit, enemies: AutoBattleUnit[]): AutoBattleUnit | null {
    let closest: AutoBattleUnit | null = null;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.state === 'dead') continue;
      const dist = unit.getGridDistance(enemy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    return closest;
  }

  /**
   * A*-Pfadfindung von einer Zelle zu einer anderen.
   * Nur 4-direktionale Bewegung (keine Diagonale).
   * Vermeidet von ANDEREN Einheiten besetzte Zellen.
   * Gibt leeres Array zurück wenn kein Pfad existiert.
   */
  static findPath(
    fromCol: number, fromRow: number,
    toCol: number, toRow: number,
    grid: AutoBattleGrid,
    occupiedCells: Set<string>
  ): { col: number; row: number }[] {
    // If same cell, return empty
    if (fromCol === toCol && fromRow === toRow) return [];

    // A* node
    interface ANode {
      col: number;
      row: number;
      g: number; // cost from start
      h: number; // heuristic to goal
      f: number; // g + h
      parent: ANode | null;
    }

    const startKey = `${fromCol},${fromRow}`;
    const goalKey = `${toCol},${toRow}`;

    // Manhattan heuristic
    const heuristic = (c: number, r: number) =>
      Math.abs(c - toCol) + Math.abs(r - toRow);

    const openMap = new Map<string, ANode>();
    const closedSet = new Set<string>();

    const startNode: ANode = {
      col: fromCol,
      row: fromRow,
      g: 0,
      h: heuristic(fromCol, fromRow),
      f: heuristic(fromCol, fromRow),
      parent: null,
    };
    openMap.set(startKey, startNode);

    // 4-directional neighbors
    const dirs = [
      { dc: 0, dr: 1 },  // up
      { dc: 0, dr: -1 }, // down
      { dc: 1, dr: 0 },  // right
      { dc: -1, dr: 0 }, // left
    ];

    // Safety limit for 8x8 grid
    let iterations = 0;
    const maxIterations = AB_COLS * AB_ROWS * 4;

    while (openMap.size > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest f in open set
      let current: ANode | null = null;
      let currentKey = '';
      for (const [key, node] of openMap) {
        if (current === null || node.f < current.f || (node.f === current.f && node.h < current.h)) {
          current = node;
          currentKey = key;
        }
      }

      if (!current) break;

      // Reached goal?
      if (currentKey === goalKey) {
        // Reconstruct path (exclude start, include goal)
        const path: { col: number; row: number }[] = [];
        let node: ANode | null = current;
        while (node && !(node.col === fromCol && node.row === fromRow)) {
          path.unshift({ col: node.col, row: node.row });
          node = node.parent;
        }
        return path;
      }

      // Move current to closed set
      openMap.delete(currentKey);
      closedSet.add(currentKey);

      // Explore neighbors
      for (const dir of dirs) {
        const nc = current.col + dir.dc;
        const nr = current.row + dir.dr;

        // Bounds check
        if (nc < 0 || nc >= AB_COLS || nr < 0 || nr >= AB_ROWS) continue;

        const neighborKey = `${nc},${nr}`;

        // Skip if in closed set
        if (closedSet.has(neighborKey)) continue;

        // Skip if occupied (unless it's the goal - we want to path TO the target)
        if (neighborKey !== goalKey && occupiedCells.has(neighborKey)) continue;

        const tentativeG = current.g + 1;

        const existing = openMap.get(neighborKey);
        if (existing) {
          // Already in open set - check if this path is better
          if (tentativeG < existing.g) {
            existing.g = tentativeG;
            existing.f = tentativeG + existing.h;
            existing.parent = current;
          }
        } else {
          // Add to open set
          const h = heuristic(nc, nr);
          const newNode: ANode = {
            col: nc,
            row: nr,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
          };
          openMap.set(neighborKey, newNode);
        }
      }
    }

    // No path found
    return [];
  }

  /**
   * Schadensberechnung unter Berücksichtigung von Angriff, Verteidigung und Element.
   * Formel: max(1, angreifer.attack * elementMult - verteidiger.defense * 0.5)
   */
  static calculateDamage(attacker: AutoBattleUnit, defender: AutoBattleUnit): number {
    const elementMult = AutoBattleCombat.getElementMultiplier(
      attacker.def.element,
      defender.def.element
    );
    const rawDamage = attacker.attack * elementMult - defender.defense * 0.5;
    return Math.max(1, Math.round(rawDamage));
  }

  /** Get element advantage multiplier */
  static getElementMultiplier(attackElement: UnitElement, defendElement: UnitElement): number {
    return getElementMultiplier(attackElement, defendElement);
  }

  /**
   * Einen Kampf-Tick auflösen: Zielerfassung, Bewegung, Angriffe.
   * Gibt eine Liste von Kampfereignissen zurück.
   */
  static updateCombat(
    playerUnits: AutoBattleUnit[],
    enemyUnits: AutoBattleUnit[],
    grid: AutoBattleGrid,
    dt: number
  ): CombatEvent[] {
    const events: CombatEvent[] = [];

    // Build set of occupied cells (for pathfinding)
    const occupiedCells = new Set<string>();
    for (const u of playerUnits) {
      if (u.state !== 'dead') {
        occupiedCells.add(`${u.gridCol},${u.gridRow}`);
      }
    }
    for (const u of enemyUnits) {
      if (u.state !== 'dead') {
        occupiedCells.add(`${u.gridCol},${u.gridRow}`);
      }
    }

    // Process all living units
    const allUnits = [...playerUnits, ...enemyUnits];
    for (const unit of allUnits) {
      if (unit.state === 'dead') continue;

      const enemies = unit.isPlayerUnit ? enemyUnits : playerUnits;
      const livingEnemies = enemies.filter(e => e.state !== 'dead');

      if (livingEnemies.length === 0) continue;

      // Step 1: If target is dead or null, find new target
      if (!unit.target || unit.target.state === 'dead') {
        unit.target = AutoBattleCombat.findTarget(unit, livingEnemies);
      }

      if (!unit.target) continue;

      // Step 2: If target in range, attack (respect cooldown)
      if (unit.isInRange(unit.target)) {
        // Stop moving
        if (unit.state === 'moving') {
          unit.state = 'idle';
          unit.moveTarget = null;
        }

        // Face target
        const dir = unit.target.mesh.position.clone().sub(unit.mesh.position);
        if (dir.length() > 0.01) {
          unit.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }

        // Attack if cooldown allows
        if (unit.attackCooldown <= 0 && unit.attack > 0) {
          unit.state = 'attacking';
          unit.attackCooldown = 1 / unit.attackSpeed;

          const damage = AutoBattleCombat.calculateDamage(unit, unit.target);
          const died = unit.target.takeDamage(damage, unit.def.element);

          // Play attack animation
          unit.playAttackAnim();

          events.push({
            type: 'attack',
            source: unit,
            target: unit.target,
            damage,
            element: unit.def.element,
          });

          // Build mana (10 per attack)
          unit.mana = Math.min(unit.mana + 10, unit.maxMana);

          // Ability trigger at 100 mana (for now just reset)
          if (unit.mana >= unit.maxMana) {
            unit.mana = 0;
            events.push({
              type: 'ability',
              source: unit,
              target: unit.target,
              element: unit.def.element,
            });
          }

          if (died) {
            events.push({
              type: 'death',
              source: unit.target,
            });
            // Clear occupancy for dead unit
            occupiedCells.delete(`${unit.target.gridCol},${unit.target.gridRow}`);
            grid.removeUnit(unit.target.gridCol, unit.target.gridRow);
            // Clear target so we find a new one next tick
            unit.target = null;
          }

          // Return to idle state after attack
          if (unit.state === 'attacking') {
            unit.state = 'idle';
          }
        }
      } else {
        // Step 3: Target out of range, move toward it
        if (unit.state !== 'moving' || unit.moveTarget === null) {
          // Find path to adjacent cell near target
          const path = AutoBattleCombat.findPath(
            unit.gridCol, unit.gridRow,
            unit.target.gridCol, unit.target.gridRow,
            grid,
            occupiedCells
          );

          if (path.length > 0) {
            // Move one cell at a time
            const nextCell = path[0];

            // Check if next cell is the target cell (occupied by target) - stop one cell before
            if (nextCell.col === unit.target.gridCol && nextCell.row === unit.target.gridRow && path.length === 1) {
              // We are adjacent, should be in range now - re-check next frame
              continue;
            }

            // Don't step onto occupied cells
            if (occupiedCells.has(`${nextCell.col},${nextCell.row}`)
                && !(nextCell.col === unit.target.gridCol && nextCell.row === unit.target.gridRow)) {
              continue;
            }

            // Update grid occupancy
            occupiedCells.delete(`${unit.gridCol},${unit.gridRow}`);
            grid.removeUnit(unit.gridCol, unit.gridRow);

            // If next cell is target's cell, try the cell before it instead
            let moveCell = nextCell;
            if (occupiedCells.has(`${nextCell.col},${nextCell.row}`)) {
              // Can't move there, stay put
              grid.placeUnit(unit.gridCol, unit.gridRow, unit.id);
              occupiedCells.add(`${unit.gridCol},${unit.gridRow}`);
              continue;
            }

            unit.gridCol = moveCell.col;
            unit.gridRow = moveCell.row;
            grid.placeUnit(moveCell.col, moveCell.row, unit.id);
            occupiedCells.add(`${moveCell.col},${moveCell.row}`);

            const worldPos = grid.gridToWorld(moveCell.col, moveCell.row);
            unit.moveTo(worldPos);

            events.push({
              type: 'move',
              source: unit,
            });
          }
        }
      }
    }

    return events;
  }

  /** Check if combat is over */
  static isCombatOver(
    playerUnits: AutoBattleUnit[],
    enemyUnits: AutoBattleUnit[]
  ): 'player_win' | 'enemy_win' | 'ongoing' {
    const playerAlive = playerUnits.some(u => u.state !== 'dead');
    const enemyAlive = enemyUnits.some(u => u.state !== 'dead');

    if (!enemyAlive && playerAlive) return 'player_win';
    if (!playerAlive && enemyAlive) return 'enemy_win';
    if (!playerAlive && !enemyAlive) return 'enemy_win'; // tie = loss
    return 'ongoing';
  }
}
