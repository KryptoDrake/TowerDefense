import * as THREE from 'three';
import { CELL_SIZE, MAP_SIZE } from '../utils/Constants';
import { PathSegment } from '../systems/LevelConfig';

export interface PathPoint {
  x: number;
  z: number;
}

// Grid origin is at (-MAP_SIZE/2, -MAP_SIZE/2) in world space
function gridToWorld(gx: number, gz: number): PathPoint {
  return {
    x: -MAP_SIZE / 2 + gx * CELL_SIZE + CELL_SIZE / 2,
    z: -MAP_SIZE / 2 + gz * CELL_SIZE + CELL_SIZE / 2,
  };
}

export class PathSystem {
  readonly waypoints: PathPoint[] = [];
  readonly pathCells: Set<string> = new Set();
  readonly spawnPoint: PathPoint;
  readonly endPoint: PathPoint;

  constructor(pathDef?: PathSegment) {
    if (pathDef) {
      // Use provided path definition
      for (const [gx, gz] of pathDef.cells) {
        this.pathCells.add(`${gx},${gz}`);
      }
      this.waypoints = pathDef.waypoints.map(([gx, gz]) => gridToWorld(gx, gz));
    } else {
      // Fallback: default S-curve path
      const gridPath = this.generateSCurvePath();
      for (const [gx, gz] of gridPath) {
        this.pathCells.add(`${gx},${gz}`);
      }
      this.waypoints = this.extractWaypoints();
    }

    this.spawnPoint = this.waypoints[0];
    this.endPoint = this.waypoints[this.waypoints.length - 1];
  }

  private generateSCurvePath(): [number, number][] {
    const path: [number, number][] = [];
    for (let z = 0; z <= 5; z++) path.push([3, z]);
    for (let x = 4; x <= 9; x++) path.push([x, 5]);
    for (let z = 6; z <= 10; z++) path.push([9, z]);
    for (let x = 8; x >= 3; x--) path.push([x, 10]);
    for (let z = 11; z <= 15; z++) path.push([3, z]);
    for (let x = 4; x <= 16; x++) path.push([x, 15]);
    for (let z = 16; z <= 19; z++) path.push([16, z]);
    return path;
  }

  private extractWaypoints(): PathPoint[] {
    return [
      gridToWorld(3, 0),
      gridToWorld(3, 5),
      gridToWorld(9, 5),
      gridToWorld(9, 10),
      gridToWorld(3, 10),
      gridToWorld(3, 15),
      gridToWorld(16, 15),
      gridToWorld(16, 19),
    ];
  }

  isPathCell(gx: number, gz: number): boolean {
    return this.pathCells.has(`${gx},${gz}`);
  }

  getPositionAtDistance(distance: number): THREE.Vector3 {
    if (distance <= 0) {
      return new THREE.Vector3(this.waypoints[0].x, 0, this.waypoints[0].z);
    }

    const totalLength = this.getTotalLength();
    const targetDist = distance * totalLength;
    let traveled = 0;

    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const from = this.waypoints[i];
      const to = this.waypoints[i + 1];
      const segLen = Math.sqrt((to.x - from.x) ** 2 + (to.z - from.z) ** 2);

      if (traveled + segLen >= targetDist) {
        const t = (targetDist - traveled) / segLen;
        return new THREE.Vector3(
          from.x + (to.x - from.x) * t,
          0,
          from.z + (to.z - from.z) * t
        );
      }
      traveled += segLen;
    }

    const last = this.waypoints[this.waypoints.length - 1];
    return new THREE.Vector3(last.x, 0, last.z);
  }

  getTotalLength(): number {
    let total = 0;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const from = this.waypoints[i];
      const to = this.waypoints[i + 1];
      total += Math.sqrt((to.x - from.x) ** 2 + (to.z - from.z) ** 2);
    }
    return total;
  }
}
