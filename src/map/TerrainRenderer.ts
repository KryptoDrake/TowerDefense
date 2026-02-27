import * as THREE from 'three';
import { GameMap } from './GameMap';
import {
  GRID_SIZE,
  CELL_SIZE,
  MAP_SIZE,
} from '../utils/Constants';
import { PathSystem } from './PathSystem';
import { TerrainTheme } from '../systems/LevelConfig';

// Default theme (level 1 meadow)
const DEFAULT_THEME: TerrainTheme = {
  name: 'Friedhofswiese',
  skyColor: 0x78b8e0,
  fogColor: 0xa8d8ea,
  fogDensity: 0.008,
  groundColor: 0x5a9a35,
  groundTextureBase: '#4a9030',
  groundTextureVariation: { r: [40, 80], g: [100, 180], b: [20, 50] },
  pathColor: 0x9a7530,
  pathTextureBase: '#8a6520',
  trunkColor: 0x6b4226,
  leafColors: [0x2d7a1e, 0x358222, 0x2a6b18, 0x3d8a28],
  rockColor: 0x888880,
  bushColors: [0x3a8825, 0x4a9a30, 0x2d7520],
  spawnTheme: 'graveyard',
  ambientColor: 0xc8d8f0,
  ambientIntensity: 0.5,
  sunColor: 0xffeedd,
  sunIntensity: 1.4,
};

function createGrassTexture(theme: TerrainTheme): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.groundTextureBase;
  ctx.fillRect(0, 0, size, size);

  const v = theme.groundTextureVariation;
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 3;
    const red = v.r[0] + Math.floor(Math.random() * (v.r[1] - v.r[0]));
    const green = v.g[0] + Math.floor(Math.random() * (v.g[1] - v.g[0]));
    const blue = v.b[0] + Math.floor(Math.random() * (v.b[1] - v.b[0]));
    ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.4)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const green = 120 + Math.floor(Math.random() * 100);
    ctx.strokeStyle = `rgba(50, ${green}, 30, 0.5)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 2 - Math.random() * 5);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function createDirtTexture(theme: TerrainTheme): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.pathTextureBase;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    const lum = Math.floor(Math.random() * 50);
    const base = 90 + lum;
    ctx.fillStyle = `rgba(${base}, ${60 + lum}, ${15 + Math.floor(lum * 0.4)}, 0.35)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.5 + Math.random() * 1.5;
    ctx.fillStyle = `rgba(${130 + Math.floor(Math.random() * 40)}, ${100 + Math.floor(Math.random() * 30)}, ${60 + Math.floor(Math.random() * 20)}, 0.6)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export class TerrainRenderer {
  private terrainGroup: THREE.Group;
  private gameMap: GameMap;
  private theme: TerrainTheme;
  private spawnWorldPos: { x: number; z: number };
  private endWorldPos: { x: number; z: number };

  // Base damage visual state
  private baseGroup: THREE.Group | null = null;
  private lastDamageLevel = -1;
  private smokeParticles: THREE.Mesh[] = [];
  private fireParticles: THREE.Mesh[] = [];
  private baseMaterials: THREE.MeshStandardMaterial[] = [];
  private originalEmissives: THREE.Color[] = [];
  private fireLight: THREE.PointLight | null = null;

  // Path direction arrows
  private pathArrows: THREE.Mesh[] = [];
  private pathArrowMaterials: THREE.MeshStandardMaterial[] = [];
  private pathArrowTime = 0;

  // Ambient environment particles (leaves, snow, embers, fireflies, sand)
  private ambientParticles: THREE.Points | null = null;
  private ambientVelocities: Float32Array | null = null;
  private ambientPhases: Float32Array | null = null;
  private ambientStyle: 'leaves' | 'snow' | 'embers' | 'fireflies' | 'sand' | 'spores' | 'none' = 'none';
  private ambientTime = 0;

  constructor(scene: THREE.Scene, gameMap: GameMap, theme?: TerrainTheme) {
    this.terrainGroup = new THREE.Group();
    this.terrainGroup.name = 'terrain';
    this.gameMap = gameMap;
    this.theme = theme || DEFAULT_THEME;
    this.spawnWorldPos = gameMap.pathSystem.spawnPoint;
    this.endWorldPos = gameMap.pathSystem.endPoint;

    this.createGround();
    this.createPath(gameMap);
    this.createPathEdges(gameMap);
    this.addPathArrows(gameMap.pathSystem);
    this.createSpawnMarker(gameMap.pathSystem);
    this.createBaseBuilding(gameMap.pathSystem);
    this.createGrassDetails();
    this.createRocks();
    this.createTrees();
    this.createBushes();
    this.createPathEdgeScatter();
    this.createWildflowers();
    this.createPuddles();
    this.addDecorations();
    this.createAmbientParticles();

    scene.add(this.terrainGroup);
  }

  private createGround(): void {
    const grassTex = createGrassTexture(this.theme);
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE + 20, MAP_SIZE + 20);

    const groundMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      color: this.theme.groundColor,
      roughness: 0.9,
      metalness: 0.0,
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.terrainGroup.add(ground);

    const outerGeo = new THREE.PlaneGeometry(200, 200);
    const outerColor = new THREE.Color(this.theme.groundColor).multiplyScalar(0.6);
    const outerMat = new THREE.MeshStandardMaterial({
      color: outerColor,
      roughness: 1,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.12;
    outer.receiveShadow = true;
    this.terrainGroup.add(outer);
  }

  private createPath(gameMap: GameMap): void {
    const dirtTex = createDirtTexture(this.theme);
    const pathGroup = new THREE.Group();
    pathGroup.name = 'path';

    const pathMat = new THREE.MeshStandardMaterial({
      map: dirtTex,
      color: this.theme.pathColor,
      roughness: 0.95,
      metalness: 0.0,
    });

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (gameMap.pathSystem.isPathCell(gx, gz)) {
          const [wx, wz] = gameMap.gridToWorld(gx, gz);
          const cellGeo = new THREE.PlaneGeometry(CELL_SIZE + 0.02, CELL_SIZE + 0.02);
          const cell = new THREE.Mesh(cellGeo, pathMat);
          cell.rotation.x = -Math.PI / 2;
          cell.position.set(wx, 0.02, wz);
          cell.receiveShadow = true;
          pathGroup.add(cell);
        }
      }
    }

    this.terrainGroup.add(pathGroup);
  }

  private createPathEdges(gameMap: GameMap): void {
    const edgeColor = new THREE.Color(this.theme.groundColor).lerp(new THREE.Color(this.theme.pathColor), 0.4);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: 1,
      transparent: true,
      opacity: 0.5,
    });

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (!gameMap.pathSystem.isPathCell(gx, gz)) continue;

        const neighbors = [
          [gx - 1, gz], [gx + 1, gz], [gx, gz - 1], [gx, gz + 1],
        ];

        for (const [nx, nz] of neighbors) {
          if (!gameMap.pathSystem.isPathCell(nx, nz)) {
            const [wx, wz] = gameMap.gridToWorld(gx, gz);
            const dx = nx - gx;
            const dz = nz - gz;
            const edgeGeo = new THREE.PlaneGeometry(
              dx !== 0 ? 0.4 : CELL_SIZE,
              dz !== 0 ? 0.4 : CELL_SIZE
            );
            const edge = new THREE.Mesh(edgeGeo, edgeMat);
            edge.rotation.x = -Math.PI / 2;
            edge.position.set(
              wx + dx * CELL_SIZE * 0.5,
              0.01,
              wz + dz * CELL_SIZE * 0.5
            );
            this.terrainGroup.add(edge);
          }
        }
      }
    }
  }

  /**
   * Place small arrow-shaped meshes along the enemy path, pointing in the
   * direction of movement.  Arrows are spaced ~3-4 cells apart and use a
   * slightly brighter variant of the theme's path colour.
   */
  private addPathArrows(pathSystem: PathSystem): void {
    const waypoints = pathSystem.waypoints;
    if (waypoints.length < 2) return;

    // Slightly brighter path colour for arrows
    const arrowColor = new THREE.Color(this.theme.pathColor).offsetHSL(0, 0.05, 0.15);

    // Spacing in world units (3-4 cells = 6-8 world units)
    const spacing = CELL_SIZE * 3.5; // 7 world units

    const arrowGroup = new THREE.Group();
    arrowGroup.name = 'path-arrows';

    // Walk along each waypoint segment and place arrows at regular intervals
    let distSinceLastArrow = spacing * 0.5; // start offset so first arrow isn't at spawn

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      if (segLen < 0.01) continue;

      // Direction angle: atan2 gives angle from +Z axis (Three.js forward)
      const angle = Math.atan2(dx, dz);

      let walked = 0;
      while (walked < segLen) {
        const remaining = spacing - distSinceLastArrow;
        if (walked + remaining > segLen) {
          // Not enough segment left for another arrow
          distSinceLastArrow += segLen - walked;
          break;
        }
        walked += remaining;
        distSinceLastArrow = 0;

        // Position along segment
        const t = walked / segLen;
        const px = from.x + dx * t;
        const pz = from.z + dz * t;

        // Create arrow mesh: a small cone laid flat pointing in movement direction
        const arrowMat = new THREE.MeshStandardMaterial({
          color: arrowColor,
          roughness: 0.6,
          metalness: 0.1,
          transparent: true,
          opacity: 0.7,
        });

        // Use a cone rotated so its tip points forward (along +Z initially)
        const coneGeo = new THREE.ConeGeometry(0.35, 0.8, 3);
        // ConeGeometry points along +Y by default. Rotate -90deg around X so tip faces +Z.
        coneGeo.rotateX(-Math.PI / 2);

        const arrow = new THREE.Mesh(coneGeo, arrowMat);
        arrow.position.set(px, 0.05, pz);
        // Rotate around Y to face movement direction
        arrow.rotation.y = angle;

        // Store phase offset for staggered animation
        arrow.userData.phase = this.pathArrows.length * 1.2;

        arrowGroup.add(arrow);
        this.pathArrows.push(arrow);
        this.pathArrowMaterials.push(arrowMat);
      }
    }

    this.terrainGroup.add(arrowGroup);
  }

  private isExcludedZone(x: number, z: number, extraPadding = 0): boolean {
    const [gx, gz] = this.gameMap.worldToGrid(x, z);
    const pad = Math.ceil(extraPadding / CELL_SIZE);
    for (let dz = -pad; dz <= pad; dz++) {
      for (let dx = -pad; dx <= pad; dx++) {
        if (this.gameMap.pathSystem.isPathCell(gx + dx, gz + dz)) return true;
      }
    }

    const dxS = x - this.spawnWorldPos.x;
    const dzS = z - this.spawnWorldPos.z;
    if (dxS * dxS + dzS * dzS < 6 * 6) return true;

    const dxE = x - this.endWorldPos.x;
    const dzE = z - this.endWorldPos.z;
    if (dxE * dxE + dzE * dzE < 4 * 4) return true;

    return false;
  }

  private createGrassDetails(): void {
    const grassColors = [
      this.theme.groundColor,
      new THREE.Color(this.theme.groundColor).offsetHSL(0, 0.1, 0.05).getHex(),
      new THREE.Color(this.theme.groundColor).offsetHSL(0, -0.1, -0.05).getHex(),
      new THREE.Color(this.theme.groundColor).offsetHSL(0.05, 0, 0.08).getHex(),
    ];

    let placed = 0;
    for (let attempts = 0; attempts < 600 && placed < 300; attempts++) {
      const x = (Math.random() - 0.5) * MAP_SIZE;
      const z = (Math.random() - 0.5) * MAP_SIZE;

      if (this.isExcludedZone(x, z)) continue;

      const color = grassColors[Math.floor(Math.random() * grassColors.length)];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        side: THREE.DoubleSide,
      });

      const bladeCount = 2 + Math.floor(Math.random() * 3);
      const cluster = new THREE.Group();

      for (let b = 0; b < bladeCount; b++) {
        const h = 0.15 + Math.random() * 0.25;
        const w = 0.04 + Math.random() * 0.06;
        const bladeGeo = new THREE.PlaneGeometry(w, h);
        const positions = bladeGeo.attributes.position;
        positions.setX(0, positions.getX(0) + (Math.random() - 0.5) * 0.05);
        positions.setX(1, positions.getX(1) + (Math.random() - 0.5) * 0.05);

        const blade = new THREE.Mesh(bladeGeo, mat);
        blade.position.set(
          (Math.random() - 0.5) * 0.2,
          h / 2,
          (Math.random() - 0.5) * 0.2
        );
        blade.rotation.y = Math.random() * Math.PI;
        cluster.add(blade);
      }

      cluster.position.set(x, 0, z);
      this.terrainGroup.add(cluster);
      placed++;
    }
  }

  private createRocks(): void {
    const rockMat = new THREE.MeshStandardMaterial({
      color: this.theme.rockColor,
      roughness: 0.85,
      metalness: 0.05,
    });

    let placed = 0;
    for (let attempts = 0; attempts < 80 && placed < 30; attempts++) {
      const x = (Math.random() - 0.5) * (MAP_SIZE + 10);
      const z = (Math.random() - 0.5) * (MAP_SIZE + 10);
      if (this.isExcludedZone(x, z, 1)) continue;
      const scale = 0.1 + Math.random() * 0.3;

      const rockGeo = new THREE.DodecahedronGeometry(scale, 0);
      const positions = rockGeo.attributes.position;
      for (let v = 0; v < positions.count; v++) {
        positions.setX(v, positions.getX(v) * (0.7 + Math.random() * 0.6));
        positions.setY(v, positions.getY(v) * (0.5 + Math.random() * 0.5));
        positions.setZ(v, positions.getZ(v) * (0.7 + Math.random() * 0.6));
      }
      rockGeo.computeVertexNormals();

      const shade = 0.8 + Math.random() * 0.4;
      const mat = rockMat.clone();
      mat.color = new THREE.Color(this.theme.rockColor).multiplyScalar(shade);

      const rock = new THREE.Mesh(rockGeo, mat);
      rock.position.set(x, scale * 0.3, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.terrainGroup.add(rock);
      placed++;
    }
  }

  private createSpawnMarker(pathSystem: PathSystem): void {
    const spawn = pathSystem.spawnPoint;

    if (this.theme.spawnTheme === 'graveyard') {
      this.createGraveyardSpawn(spawn);
    } else if (this.theme.spawnTheme === 'portal') {
      this.createPortalSpawn(spawn);
    } else {
      this.createSwampSpawn(spawn);
    }
  }

  private createGraveyardSpawn(spawn: { x: number; z: number }): void {
    const graveyard = new THREE.Group();
    graveyard.name = 'graveyard';

    const dirtGeo = new THREE.CircleGeometry(6.5, 32);
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x3a2a15, roughness: 1 });
    const dirt = new THREE.Mesh(dirtGeo, dirtMat);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.06;
    graveyard.add(dirt);

    const edgeRingGeo = new THREE.RingGeometry(5.5, 7.5, 32);
    const edgeRingMat = new THREE.MeshStandardMaterial({ color: 0x4a3a1e, roughness: 1, transparent: true, opacity: 0.7 });
    const edgeRing = new THREE.Mesh(edgeRingGeo, edgeRingMat);
    edgeRing.rotation.x = -Math.PI / 2;
    edgeRing.position.y = 0.05;
    graveyard.add(edgeRing);

    const fogGeo = new THREE.CircleGeometry(5, 24);
    const fogMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.08 });
    const fog = new THREE.Mesh(fogGeo, fogMat);
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = 0.3;
    graveyard.add(fog);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.85, metalness: 0.05 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });

    const gravePositions = [
      { x: -2.5, z: -1.5, ry: 0.1, type: 'cross' },
      { x: -1.0, z: -2.0, ry: -0.05, type: 'round' },
      { x: 1.2, z: -1.8, ry: 0.15, type: 'rect' },
      { x: 2.8, z: -1.0, ry: -0.1, type: 'cross' },
      { x: -2.0, z: 1.5, ry: 0.08, type: 'rect' },
      { x: 0.5, z: 2.0, ry: -0.12, type: 'round' },
      { x: 2.5, z: 1.5, ry: 0.05, type: 'rect' },
      { x: -3.2, z: 0, ry: -0.08, type: 'round' },
      { x: 3.0, z: 0.3, ry: 0.1, type: 'cross' },
    ];

    for (const gp of gravePositions) {
      const grave = new THREE.Group();
      if (gp.type === 'cross') {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.08), stoneMat);
        post.position.y = 0.5;
        grave.add(post);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.08), stoneMat);
        arm.position.y = 0.75;
        grave.add(arm);
      } else if (gp.type === 'round') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), darkStoneMat);
        base.position.y = 0.3;
        grave.add(base);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 8, 1, false, 0, Math.PI), darkStoneMat);
        top.rotation.z = Math.PI / 2;
        top.rotation.y = Math.PI / 2;
        top.position.y = 0.6;
        grave.add(top);
      } else {
        const rect = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, 0.08), stoneMat);
        rect.position.y = 0.35;
        grave.add(rect);
      }

      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 1 })
      );
      mound.scale.set(1, 0.4, 1.3);
      mound.position.set(0, 0, 0.4);
      grave.add(mound);
      grave.position.set(gp.x, 0, gp.z);
      grave.rotation.y = gp.ry;
      grave.castShadow = true;
      graveyard.add(grave);
    }

    // Fence
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, metalness: 0.4 });
    const fenceRadius = 4.5;
    const fencePosts = 16;
    for (let i = 0; i < fencePosts; i++) {
      const angle = (i / fencePosts) * Math.PI * 2;
      const nx = Math.sin(angle);
      const nz = Math.cos(angle);
      if (nz > 0.6) continue;

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), fenceMat);
      post.position.set(nx * fenceRadius, 0.45, nz * fenceRadius);
      graveyard.add(post);

      const point = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), fenceMat);
      point.position.set(nx * fenceRadius, 0.96, nz * fenceRadius);
      graveyard.add(point);
    }

    // Dead tree
    const deadTreeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.95 });
    const deadTree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 2.0, 5), deadTreeMat);
    trunk.position.y = 1.0;
    trunk.rotation.z = 0.05;
    trunk.castShadow = true;
    deadTree.add(trunk);

    const branchGeo = new THREE.CylinderGeometry(0.02, 0.05, 0.8, 4);
    for (const b of [{ rx: 0, rz: -0.7, y: 1.6, x: 0.2 }, { rx: 0, rz: 0.6, y: 1.8, x: -0.15 }, { rx: 0.5, rz: -0.4, y: 1.4, x: 0.1 }]) {
      const branch = new THREE.Mesh(branchGeo, deadTreeMat);
      branch.position.set(b.x, b.y, 0);
      branch.rotation.set(b.rx, 0, b.rz);
      branch.castShadow = true;
      deadTree.add(branch);
    }
    deadTree.position.set(-3.5, 0, -2.5);
    graveyard.add(deadTree);

    graveyard.position.set(spawn.x, 0, spawn.z);
    this.terrainGroup.add(graveyard);
  }

  private createPortalSpawn(spawn: { x: number; z: number }): void {
    const portal = new THREE.Group();
    portal.name = 'spawn-portal';

    // Sandy crater
    const craterGeo = new THREE.CircleGeometry(5, 32);
    const craterMat = new THREE.MeshStandardMaterial({ color: 0x8a6030, roughness: 1 });
    const crater = new THREE.Mesh(craterGeo, craterMat);
    crater.rotation.x = -Math.PI / 2;
    crater.position.y = 0.06;
    portal.add(crater);

    // Stone pillars in a circle
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xaa8866, roughness: 0.7, metalness: 0.1 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6), pillarMat);
      pillar.position.set(Math.sin(angle) * 3.5, 1.25, Math.cos(angle) * 3.5);
      pillar.castShadow = true;
      portal.add(pillar);

      // Top stone
      const capstone = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.8), pillarMat);
      capstone.position.set(Math.sin(angle) * 3.5, 2.6, Math.cos(angle) * 3.5);
      portal.add(capstone);
    }

    // Glowing portal center
    const portalGlow = new THREE.Mesh(
      new THREE.CircleGeometry(2, 24),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.15 })
    );
    portalGlow.rotation.x = -Math.PI / 2;
    portalGlow.position.y = 0.2;
    portal.add(portalGlow);

    portal.position.set(spawn.x, 0, spawn.z);
    this.terrainGroup.add(portal);
  }

  private createSwampSpawn(spawn: { x: number; z: number }): void {
    const swamp = new THREE.Group();
    swamp.name = 'spawn-swamp';

    // Murky water pool
    const poolGeo = new THREE.CircleGeometry(5.5, 32);
    const poolMat = new THREE.MeshStandardMaterial({
      color: 0x2a3a20,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.04;
    swamp.add(pool);

    // Fog
    const fogGeo = new THREE.CircleGeometry(6, 24);
    const fogMat = new THREE.MeshBasicMaterial({ color: 0x88aa88, transparent: true, opacity: 0.12 });
    const fog = new THREE.Mesh(fogGeo, fogMat);
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = 0.5;
    swamp.add(fog);

    // Dead stumps
    const stumpMat = new THREE.MeshStandardMaterial({ color: 0x3a3020, roughness: 0.95 });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
      const r = 2 + Math.random() * 2;
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 0.5 + Math.random() * 0.5, 5), stumpMat);
      stump.position.set(Math.sin(angle) * r, 0.3, Math.cos(angle) * r);
      stump.rotation.set(Math.random() * 0.2, 0, Math.random() * 0.2);
      stump.castShadow = true;
      swamp.add(stump);
    }

    // Lily pads
    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x3a6a28, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 3.5;
      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.2 + Math.random() * 0.2, 8), lilyMat);
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(Math.sin(angle) * r, 0.06, Math.cos(angle) * r);
      swamp.add(lily);
    }

    swamp.position.set(spawn.x, 0, spawn.z);
    this.terrainGroup.add(swamp);
  }

  createBaseBuilding(pathSystem: PathSystem): THREE.Group {
    const end = pathSystem.endPoint;
    const baseGroup = new THREE.Group();
    baseGroup.name = 'base-building';

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5588bb, roughness: 0.7, metalness: 0.1 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x446699, roughness: 0.75, metalness: 0.1 });

    const found = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 3.5), darkStoneMat);
    found.position.set(0, 0.15, 0);
    found.castShadow = true;
    found.receiveShadow = true;
    baseGroup.add(found);

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 3), darkStoneMat);
    step2.position.set(0, 0.43, 0);
    step2.castShadow = true;
    baseGroup.add(step2);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 3.2, 8), stoneMat);
    body.position.set(0, 2.2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    baseGroup.add(body);

    const battlementMat = new THREE.MeshStandardMaterial({ color: 0x5080aa, roughness: 0.65, metalness: 0.15 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), battlementMat);
      merlon.position.set(Math.sin(angle) * 1.0, 3.9, Math.cos(angle) * 1.0);
      merlon.rotation.y = angle;
      merlon.castShadow = true;
      baseGroup.add(merlon);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0xbb3333, roughness: 0.6, metalness: 0.15 }));
    roof.position.set(0, 4.8, 0);
    roof.castShadow = true;
    baseGroup.add(roof);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0x886644, metalness: 0.3 }));
    pole.position.set(0, 6.3, 0);
    baseGroup.add(pole);

    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshStandardMaterial({ color: 0x2255cc, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(0.32, 6.65, 0);
    baseGroup.add(flag);

    const windowMat = new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffcc66, emissiveIntensity: 0.7, roughness: 0.2 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const windowGeo = new THREE.PlaneGeometry(0.3, 0.5);
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.position.set(Math.sin(angle) * 1.01, 2.5, Math.cos(angle) * 1.01);
      win.rotation.y = angle + Math.PI;
      baseGroup.add(win);

      const win2 = new THREE.Mesh(windowGeo, windowMat);
      win2.position.set(Math.sin(angle) * 1.01, 1.5, Math.cos(angle) * 1.01);
      win2.rotation.y = angle + Math.PI;
      baseGroup.add(win2);
    }

    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 }));
    door.position.set(0, 0.95, 1.11);
    baseGroup.add(door);

    baseGroup.position.set(end.x, 0, end.z);

    // Rotate base so door faces the path (direction enemies come from)
    const waypoints = pathSystem.waypoints;
    if (waypoints.length >= 2) {
      const prev = waypoints[waypoints.length - 2];
      const angle = Math.atan2(prev.x - end.x, prev.z - end.z);
      baseGroup.rotation.y = angle;
    }

    this.terrainGroup.add(baseGroup);
    this.baseGroup = baseGroup;

    // Collect base materials for damage tinting
    this.baseMaterials = [];
    this.originalEmissives = [];
    baseGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        this.baseMaterials.push(child.material);
        this.originalEmissives.push(child.material.emissive.clone());
      }
    });

    return baseGroup;
  }

  private createTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: this.theme.trunkColor, roughness: 0.9 });

    for (let i = 0; i < 40; i++) {
      const tree = new THREE.Group();
      const height = 1.5 + Math.random() * 1.5;
      const trunkGeo = new THREE.CylinderGeometry(0.08 + Math.random() * 0.05, 0.15 + Math.random() * 0.08, height, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const layers = 2 + Math.floor(Math.random() * 2);
      for (let l = 0; l < layers; l++) {
        const crownSize = 0.5 + Math.random() * 0.6 - l * 0.1;
        const leafColor = this.theme.leafColors[Math.floor(Math.random() * this.theme.leafColors.length)];
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8 });
        const crownGeo = new THREE.SphereGeometry(crownSize, 7, 5);
        const positions = crownGeo.attributes.position;
        for (let v = 0; v < positions.count; v++) {
          positions.setX(v, positions.getX(v) * (0.85 + Math.random() * 0.3));
          positions.setZ(v, positions.getZ(v) * (0.85 + Math.random() * 0.3));
        }
        crownGeo.computeVertexNormals();

        const crown = new THREE.Mesh(crownGeo, leafMat);
        crown.position.set((Math.random() - 0.5) * 0.3, height + crownSize * 0.4 + l * crownSize * 0.5, (Math.random() - 0.5) * 0.3);
        crown.castShadow = true;
        tree.add(crown);
      }

      const mapRadius = MAP_SIZE / 2;
      let x: number = 0, z: number = 0;
      let valid = false;
      for (let try_ = 0; try_ < 10; try_++) {
        if (Math.random() > 0.3) {
          const side = Math.floor(Math.random() * 4);
          const offset = (Math.random() - 0.5) * MAP_SIZE * 1.1;
          const edgeDist = mapRadius + 1 + Math.random() * 6;
          switch (side) {
            case 0: x = offset; z = -edgeDist; break;
            case 1: x = offset; z = edgeDist; break;
            case 2: x = -edgeDist; z = offset; break;
            default: x = edgeDist; z = offset; break;
          }
        } else {
          x = (Math.random() > 0.5 ? 1 : -1) * (mapRadius * 0.7 + Math.random() * mapRadius * 0.3);
          z = (Math.random() > 0.5 ? 1 : -1) * (mapRadius * 0.7 + Math.random() * mapRadius * 0.3);
        }
        if (!this.isExcludedZone(x, z, 2)) { valid = true; break; }
      }
      if (!valid) continue;

      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.terrainGroup.add(tree);
    }
  }

  private createBushes(): void {
    for (let i = 0; i < 40; i++) {
      const bush = new THREE.Group();
      const color = this.theme.bushColors[Math.floor(Math.random() * this.theme.bushColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

      const lobes = 2 + Math.floor(Math.random() * 3);
      for (let l = 0; l < lobes; l++) {
        const size = 0.2 + Math.random() * 0.25;
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 5), mat);
        lobe.position.set((Math.random() - 0.5) * 0.3, size * 0.7, (Math.random() - 0.5) * 0.3);
        lobe.castShadow = true;
        bush.add(lobe);
      }

      let x: number = 0, z: number = 0, valid = false;
      for (let try_ = 0; try_ < 10; try_++) {
        x = (Math.random() - 0.5) * (MAP_SIZE + 8);
        z = (Math.random() - 0.5) * (MAP_SIZE + 8);
        if (!this.isExcludedZone(x, z, 1)) { valid = true; break; }
      }
      if (!valid) continue;
      bush.position.set(x, 0, z);
      this.terrainGroup.add(bush);
    }
  }

  // ─── Path Edge Scatter (pebbles, moss along path borders) ───

  private createPathEdgeScatter(): void {
    const scatterGroup = new THREE.Group();
    scatterGroup.name = 'path-edge-scatter';

    // Find cells adjacent to path (but not on path)
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (this.gameMap.pathSystem.isPathCell(gx, gz)) continue;

        let adjacentToPath = false;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            if (this.gameMap.pathSystem.isPathCell(gx + dx, gz + dz)) {
              adjacentToPath = true;
              break;
            }
          }
          if (adjacentToPath) break;
        }
        if (!adjacentToPath) continue;

        // 60% chance to place scatter on this edge cell
        if (Math.random() > 0.6) continue;

        const [wx, wz] = this.gameMap.gridToWorld(gx, gz);

        // Pebbles (2-5 small stones)
        const pebbleCount = 2 + Math.floor(Math.random() * 4);
        const pebbleMat = new THREE.MeshStandardMaterial({
          color: this.varyColor(this.theme.rockColor, 0, -0.05, -0.05),
          roughness: 0.9,
        });
        for (let i = 0; i < pebbleCount; i++) {
          const size = 0.02 + Math.random() * 0.04;
          const geo = new THREE.SphereGeometry(size, 4, 3);
          const pebble = new THREE.Mesh(geo, pebbleMat);
          pebble.position.set(
            wx + (Math.random() - 0.5) * CELL_SIZE * 0.8,
            size * 0.4,
            wz + (Math.random() - 0.5) * CELL_SIZE * 0.8
          );
          pebble.scale.y = 0.4 + Math.random() * 0.3;
          scatterGroup.add(pebble);
        }

        // 30% chance for a moss/dirt patch
        if (Math.random() < 0.3) {
          const patchSize = 0.15 + Math.random() * 0.2;
          const mossMat = new THREE.MeshBasicMaterial({
            color: this.varyColor(this.theme.groundColor, 0.02, 0.1, -0.08),
            transparent: true,
            opacity: 0.4 + Math.random() * 0.2,
            depthWrite: false,
          });
          const patch = new THREE.Mesh(new THREE.CircleGeometry(patchSize, 6), mossMat);
          patch.rotation.x = -Math.PI / 2;
          patch.position.set(
            wx + (Math.random() - 0.5) * CELL_SIZE * 0.6,
            0.01,
            wz + (Math.random() - 0.5) * CELL_SIZE * 0.6
          );
          patch.rotation.z = Math.random() * Math.PI;
          scatterGroup.add(patch);
        }
      }
    }
    this.terrainGroup.add(scatterGroup);
  }

  // ─── Wildflowers (colorful on meadow/forest themes) ────

  private createWildflowers(): void {
    const name = this.theme.name.toLowerCase();
    // Only spawn flowers on green/meadow/forest themes
    const isFloweryTheme = !name.includes('eis') && !name.includes('frost')
      && !name.includes('vulkan') && !name.includes('hölle') && !name.includes('hoelle')
      && !name.includes('wüste') && !name.includes('wueste')
      && !name.includes('geister');

    if (!isFloweryTheme) return;

    const flowerColors = [0xff6688, 0xffaa44, 0xffff66, 0xaa88ff, 0xff4466, 0x66ccff, 0xffccee];
    const flowerGroup = new THREE.Group();
    flowerGroup.name = 'wildflowers';

    let placed = 0;
    for (let attempts = 0; attempts < 300 && placed < 80; attempts++) {
      const x = (Math.random() - 0.5) * MAP_SIZE;
      const z = (Math.random() - 0.5) * MAP_SIZE;
      if (this.isExcludedZone(x, z)) continue;

      const cluster = new THREE.Group();
      const flowerCount = 2 + Math.floor(Math.random() * 4);

      for (let f = 0; f < flowerCount; f++) {
        const stemH = 0.08 + Math.random() * 0.12;
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x448833, roughness: 0.9 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, stemH, 3), stemMat);
        stem.position.set(
          (Math.random() - 0.5) * 0.15,
          stemH / 2,
          (Math.random() - 0.5) * 0.15
        );

        const petalColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
        const petalMat = new THREE.MeshStandardMaterial({
          color: petalColor,
          roughness: 0.6,
          emissive: petalColor,
          emissiveIntensity: 0.1,
        });

        const petalSize = 0.015 + Math.random() * 0.02;
        // Simple flower head: tiny sphere for center + 3-5 petal spheres
        const center = new THREE.Mesh(
          new THREE.SphereGeometry(petalSize * 0.6, 4, 3),
          new THREE.MeshStandardMaterial({ color: 0xffee44, roughness: 0.7 })
        );
        center.position.set(stem.position.x, stemH, stem.position.z);

        // Petals around center
        const petalCount = 3 + Math.floor(Math.random() * 3);
        const petalGroup = new THREE.Group();
        petalGroup.position.copy(center.position);
        for (let p = 0; p < petalCount; p++) {
          const angle = (p / petalCount) * Math.PI * 2;
          const petal = new THREE.Mesh(
            new THREE.SphereGeometry(petalSize, 4, 3),
            petalMat
          );
          petal.position.set(
            Math.cos(angle) * petalSize * 1.5,
            0,
            Math.sin(angle) * petalSize * 1.5
          );
          petal.scale.y = 0.4;
          petalGroup.add(petal);
        }

        cluster.add(stem, center, petalGroup);
      }

      cluster.position.set(x, 0, z);
      flowerGroup.add(cluster);
      placed++;
    }

    this.terrainGroup.add(flowerGroup);
  }

  // ─── Puddles (water pools on wet themes) ────────────────

  private createPuddles(): void {
    const name = this.theme.name.toLowerCase();
    // Only on wet themes: swamp, ice/frost, dark
    const isWetTheme = name.includes('sumpf') || name.includes('dunkel')
      || name.includes('eis') || name.includes('frost')
      || name.includes('friedhof');

    if (!isWetTheme) return;

    const puddleGroup = new THREE.Group();
    puddleGroup.name = 'puddles';

    const isIcy = name.includes('eis') || name.includes('frost');
    const puddleColor = isIcy ? 0xaaddff : 0x334455;
    const puddleOpacity = isIcy ? 0.35 : 0.25;

    let placed = 0;
    for (let attempts = 0; attempts < 80 && placed < 15; attempts++) {
      const x = (Math.random() - 0.5) * MAP_SIZE;
      const z = (Math.random() - 0.5) * MAP_SIZE;
      if (this.isExcludedZone(x, z, 1)) continue;

      const radius = 0.2 + Math.random() * 0.4;
      const puddleMat = new THREE.MeshStandardMaterial({
        color: puddleColor,
        roughness: isIcy ? 0.05 : 0.15,
        metalness: isIcy ? 0.6 : 0.8,
        transparent: true,
        opacity: puddleOpacity + Math.random() * 0.15,
        depthWrite: false,
      });

      // Irregular puddle shape using circle with vertex noise
      const geo = new THREE.CircleGeometry(radius, 10);
      const positions = geo.attributes.position;
      for (let v = 1; v < positions.count; v++) { // skip center vertex
        const px = positions.getX(v);
        const pz = positions.getY(v); // Y in circle geom = Z in world
        const noise = 0.8 + Math.random() * 0.4;
        positions.setX(v, px * noise);
        positions.setY(v, pz * noise);
      }
      geo.computeVertexNormals();

      const puddle = new THREE.Mesh(geo, puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(x, 0.01, z);
      puddle.rotation.z = Math.random() * Math.PI * 2;

      puddleGroup.add(puddle);
      placed++;
    }

    this.terrainGroup.add(puddleGroup);
  }

  // ─── Theme-specific Decorations ───────────────────────

  /**
   * Determines the decoration style based on theme name and spawnTheme.
   */
  private getDecorationStyle(): string {
    const name = this.theme.name.toLowerCase();

    if (name.includes('kristall')) return 'crystal';
    if (name.includes('eis') || name.includes('frost')) return 'ice';
    if (name.includes('vulkan') || name.includes('hölle') || name.includes('hoelle')) return 'lava';
    if (name.includes('geister')) return 'ghost';
    if (name.includes('wüste') || name.includes('wueste') || name.includes('canyon')) return 'desert';
    if (name.includes('sumpf') || name.includes('dunkel')) return 'swamp';
    if (name.includes('friedhof')) return 'graveyard';

    // Fallback based on spawnTheme
    if (this.theme.spawnTheme === 'graveyard') return 'graveyard';
    if (this.theme.spawnTheme === 'swamp') return 'swamp';

    // For portal/endgame themes, use ghost
    return 'ghost';
  }

  /**
   * Collects grid cells that are safe for decoration placement:
   * not path, not adjacent to path, not near spawn/end.
   */
  private collectDecorableCells(): { wx: number; wz: number }[] {
    const cells: { wx: number; wz: number }[] = [];

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        // Skip path cells
        if (this.gameMap.pathSystem.isPathCell(gx, gz)) continue;

        // Skip cells adjacent to path (tower placement zone)
        let adjacentToPath = false;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            if (this.gameMap.pathSystem.isPathCell(gx + dx, gz + dz)) {
              adjacentToPath = true;
              break;
            }
          }
          if (adjacentToPath) break;
        }
        if (adjacentToPath) continue;

        const [wx, wz] = this.gameMap.gridToWorld(gx, gz);

        // Skip near spawn/end
        const dxS = wx - this.spawnWorldPos.x;
        const dzS = wz - this.spawnWorldPos.z;
        if (dxS * dxS + dzS * dzS < 8 * 8) continue;

        const dxE = wx - this.endWorldPos.x;
        const dzE = wz - this.endWorldPos.z;
        if (dxE * dxE + dzE * dzE < 5 * 5) continue;

        cells.push({ wx, wz });
      }
    }

    return cells;
  }

  /**
   * Places environment-specific 3D decorations on empty cells.
   */
  private addDecorations(): void {
    const style = this.getDecorationStyle();
    const available = this.collectDecorableCells();
    if (available.length === 0) return;

    // Shuffle and pick 10-20 cells
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    const count = Math.min(10 + Math.floor(Math.random() * 11), available.length);
    const selected = available.slice(0, count);

    const decoGroup = new THREE.Group();
    decoGroup.name = 'decorations';

    for (const cell of selected) {
      let meshes: THREE.Object3D[];

      switch (style) {
        case 'graveyard': meshes = this.createGraveyardDeco(); break;
        case 'desert': meshes = this.createDesertDeco(); break;
        case 'ice': meshes = this.createIceDeco(); break;
        case 'swamp': meshes = this.createSwampDeco(); break;
        case 'lava': meshes = this.createLavaDeco(); break;
        case 'ghost': meshes = this.createGhostDeco(); break;
        case 'crystal': meshes = this.createCrystalDeco(); break;
        default: meshes = this.createGraveyardDeco(); break;
      }

      for (const mesh of meshes) {
        // Random offset within cell
        mesh.position.x += cell.wx + (Math.random() - 0.5) * CELL_SIZE * 0.6;
        mesh.position.z += cell.wz + (Math.random() - 0.5) * CELL_SIZE * 0.6;
        // Random rotation
        mesh.rotation.y += Math.random() * Math.PI * 2;
        // Random scale variation 0.7-1.3
        const s = 0.7 + Math.random() * 0.6;
        mesh.scale.multiplyScalar(s);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        decoGroup.add(mesh);
      }
    }

    this.terrainGroup.add(decoGroup);
  }

  /** Slightly vary a theme color for decoration variety. */
  private varyColor(baseColor: number, hueShift = 0, satShift = 0, lightShift = 0): number {
    return new THREE.Color(baseColor)
      .offsetHSL(
        hueShift + (Math.random() - 0.5) * 0.05,
        satShift + (Math.random() - 0.5) * 0.1,
        lightShift + (Math.random() - 0.5) * 0.08,
      )
      .getHex();
  }

  // ─── Graveyard decorations ────────────────────────────

  private createGraveyardDeco(): THREE.Object3D[] {
    const items: THREE.Object3D[] = [];
    const pick = Math.random();

    if (pick < 0.4) {
      // Tombstone with cross
      const stoneColor = this.varyColor(this.theme.rockColor, 0, -0.1, -0.1);
      const mat = new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.1), mat);
      body.position.y = 0.25;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.08), mat);
      cross.position.y = 0.55;
      const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), mat);
      crossVert.position.y = 0.6;
      const group = new THREE.Group();
      group.add(body, cross, crossVert);
      // Slight tilt
      group.rotation.z = (Math.random() - 0.5) * 0.2;
      items.push(group);
    } else if (pick < 0.7) {
      // Dead tree
      const woodColor = this.varyColor(this.theme.trunkColor, 0, -0.1, -0.15);
      const mat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.95 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.9, 5), mat);
      trunk.position.y = 0.45;
      const group = new THREE.Group();
      group.add(trunk);
      // Bare branches
      for (let b = 0; b < 2 + Math.floor(Math.random() * 2); b++) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.03, 0.35, 4), mat);
        branch.position.set(
          (Math.random() - 0.5) * 0.15,
          0.55 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.15,
        );
        branch.rotation.set(
          (Math.random() - 0.5) * 1.0,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.8,
        );
        group.add(branch);
      }
      items.push(group);
    } else {
      // Bone pile (small spheres)
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xccccaa, roughness: 0.8 });
      const group = new THREE.Group();
      const boneCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < boneCount; i++) {
        const bone = new THREE.Mesh(
          new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 5, 4),
          boneMat,
        );
        bone.position.set(
          (Math.random() - 0.5) * 0.25,
          0.03 + Math.random() * 0.05,
          (Math.random() - 0.5) * 0.25,
        );
        bone.scale.y = 0.5 + Math.random() * 0.5;
        group.add(bone);
      }
      items.push(group);
    }
    return items;
  }

  // ─── Desert decorations ───────────────────────────────

  private createDesertDeco(): THREE.Object3D[] {
    const items: THREE.Object3D[] = [];
    const pick = Math.random();

    if (pick < 0.4) {
      // Cactus (cylinder + arms)
      const cactusColor = this.varyColor(0x2a7a20, 0.05, 0, 0);
      const mat = new THREE.MeshStandardMaterial({ color: cactusColor, roughness: 0.85 });
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6), mat);
      body.position.y = 0.35;
      group.add(body);
      // Arms
      if (Math.random() > 0.3) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 5), mat);
        arm.position.set(0.12, 0.45, 0);
        arm.rotation.z = -0.8;
        group.add(arm);
        const armTop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 5), mat);
        armTop.position.set(0.2, 0.6, 0);
        group.add(armTop);
      }
      if (Math.random() > 0.5) {
        const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 5), mat);
        arm2.position.set(-0.1, 0.35, 0);
        arm2.rotation.z = 0.7;
        group.add(arm2);
      }
      items.push(group);
    } else if (pick < 0.75) {
      // Rocks (dodecahedron, scaled)
      const rockColor = this.varyColor(this.theme.rockColor, 0, 0, -0.05);
      const mat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.9 });
      const group = new THREE.Group();
      const rockCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < rockCount; i++) {
        const size = 0.1 + Math.random() * 0.2;
        const geo = new THREE.DodecahedronGeometry(size, 0);
        const positions = geo.attributes.position;
        for (let v = 0; v < positions.count; v++) {
          positions.setY(v, positions.getY(v) * (0.4 + Math.random() * 0.4));
        }
        geo.computeVertexNormals();
        const rock = new THREE.Mesh(geo, mat);
        rock.position.set(
          (Math.random() - 0.5) * 0.3,
          size * 0.25,
          (Math.random() - 0.5) * 0.3,
        );
        rock.rotation.y = Math.random() * Math.PI;
        group.add(rock);
      }
      items.push(group);
    } else {
      // Sand ripples (flat plane with wave shape)
      const sandColor = this.varyColor(this.theme.groundColor, 0, 0, 0.1);
      const mat = new THREE.MeshStandardMaterial({
        color: sandColor,
        roughness: 1,
        transparent: true,
        opacity: 0.6,
      });
      const geo = new THREE.PlaneGeometry(0.8, 0.8, 8, 8);
      const positions = geo.attributes.position;
      for (let v = 0; v < positions.count; v++) {
        const px = positions.getX(v);
        positions.setZ(v, Math.sin(px * 8) * 0.02);
      }
      geo.computeVertexNormals();
      const ripple = new THREE.Mesh(geo, mat);
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.y = 0.03;
      items.push(ripple);
    }
    return items;
  }

  // ─── Ice decorations ──────────────────────────────────

  private createIceDeco(): THREE.Object3D[] {
    const items: THREE.Object3D[] = [];
    const pick = Math.random();

    if (pick < 0.4) {
      // Ice crystals (octahedron, semi-transparent cyan)
      const group = new THREE.Group();
      const crystalCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < crystalCount; i++) {
        const size = 0.1 + Math.random() * 0.2;
        const crystalColor = this.varyColor(0x88ddff, 0, 0, 0.05);
        const mat = new THREE.MeshStandardMaterial({
          color: crystalColor,
          roughness: 0.1,
          metalness: 0.3,
          transparent: true,
          opacity: 0.65,
        });
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), mat);
        crystal.position.set(
          (Math.random() - 0.5) * 0.3,
          size * 0.8,
          (Math.random() - 0.5) * 0.3,
        );
        crystal.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
        group.add(crystal);
      }
      items.push(group);
    } else if (pick < 0.7) {
      // Frozen stump
      const stumpColor = this.varyColor(this.theme.trunkColor, 0, -0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial({ color: stumpColor, roughness: 0.7, metalness: 0.1 });
      const stump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 0.3 + Math.random() * 0.2, 6),
        mat,
      );
      stump.position.y = 0.15;
      const group = new THREE.Group();
      group.add(stump);
      // Icicles on top
      const iceMat = new THREE.MeshStandardMaterial({
        color: 0xaaeeff,
        roughness: 0.1,
        metalness: 0.2,
        transparent: true,
        opacity: 0.7,
      });
      for (let i = 0; i < 3; i++) {
        const icicle = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), iceMat);
        icicle.position.set(
          (Math.random() - 0.5) * 0.15,
          0.35 + Math.random() * 0.05,
          (Math.random() - 0.5) * 0.15,
        );
        icicle.rotation.x = Math.PI; // upside down
        group.add(icicle);
      }
      items.push(group);
    } else {
      // Snow mound (hemisphere)
      const snowColor = this.varyColor(0xeef4ff, 0, -0.05, 0);
      const mat = new THREE.MeshStandardMaterial({ color: snowColor, roughness: 0.95 });
      const radius = 0.15 + Math.random() * 0.2;
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        mat,
      );
      mound.position.y = 0;
      mound.scale.y = 0.5;
      items.push(mound);
    }
    return items;
  }

  // ─── Swamp decorations ────────────────────────────────

  private createSwampDeco(): THREE.Object3D[] {
    const items: THREE.Object3D[] = [];
    const pick = Math.random();

    if (pick < 0.4) {
      // Mushroom (cylinder stem + sphere cap)
      const stemColor = this.varyColor(0xccbb99, 0, -0.1, 0);
      const capColor = this.varyColor(0xaa3322, 0.05, 0, 0);
      const stemMat = new THREE.MeshStandardMaterial({ color: stemColor, roughness: 0.85 });
      const capMat = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.7 });
      const group = new THREE.Group();
      const stemH = 0.12 + Math.random() * 0.1;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, stemH, 5), stemMat);
      stem.position.y = stemH / 2;
      group.add(stem);
      const capR = 0.06 + Math.random() * 0.04;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capR, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        capMat,
      );
      cap.position.y = stemH;
      group.add(cap);
      // Maybe a second smaller mushroom
      if (Math.random() > 0.4) {
        const stem2H = stemH * 0.6;
        const stem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, stem2H, 5), stemMat);
        stem2.position.set(0.06, stem2H / 2, 0.04);
        group.add(stem2);
        const cap2 = new THREE.Mesh(
          new THREE.SphereGeometry(capR * 0.7, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
          capMat,
        );
        cap2.position.set(0.06, stem2H, 0.04);
        group.add(cap2);
      }
      items.push(group);
    } else if (pick < 0.7) {
      // Cattails (thin cylinder)
      const group = new THREE.Group();
      const stalkColor = this.varyColor(0x557730, 0, 0, 0);
      const topColor = this.varyColor(0x664422, 0, 0, 0);
      const stalkMat = new THREE.MeshStandardMaterial({ color: stalkColor, roughness: 0.9 });
      const topMat = new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.85 });
      const cattailCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < cattailCount; i++) {
        const h = 0.4 + Math.random() * 0.3;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, h, 4), stalkMat);
        stalk.position.set(
          (Math.random() - 0.5) * 0.15,
          h / 2,
          (Math.random() - 0.5) * 0.15,
        );
        stalk.rotation.z = (Math.random() - 0.5) * 0.15;
        group.add(stalk);
        // Brown top
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 5), topMat);
        top.position.set(stalk.position.x, h - 0.02, stalk.position.z);
        group.add(top);
      }
      items.push(group);
    } else {
      // Fog patch (transparent circle)
      const fogColor = this.varyColor(this.theme.fogColor, 0, 0, 0.1);
      const mat = new THREE.MeshBasicMaterial({
        color: fogColor,
        transparent: true,
        opacity: 0.12 + Math.random() * 0.08,
        side: THREE.DoubleSide,
      });
      const radius = 0.4 + Math.random() * 0.5;
      const fog = new THREE.Mesh(new THREE.CircleGeometry(radius, 12), mat);
      fog.rotation.x = -Math.PI / 2;
      fog.position.y = 0.15 + Math.random() * 0.2;
      items.push(fog);
    }
    return items;
  }

  // ─── Lava / Volcanic decorations ──────────────────────

  private createLavaDeco(): THREE.Object3D[] {
    const items: THREE.Object3D[] = [];
    const pick = Math.random();

    if (pick < 0.4) {
      // Lava rocks (irregular dodecahedron, dark)
      const rockColor = this.varyColor(this.theme.rockColor, 0, -0.05, -0.1);
      const mat = new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.95 });
      const group = new THREE.Group();
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const size = 0.08 + Math.random() * 0.15;
        const geo = new THREE.DodecahedronGeometry(size, 0);
        const positions = geo.attributes.position;
        for (let v = 0; v < positions.count; v++) {
          positions.setX(v, positions.getX(v) * (0.6 + Math.random() * 0.8));
          positions.setY(v, positions.getY(v) * (0.5 + Math.random() * 0.6));
          positions.setZ(v, positions.getZ(v) * (0.6 + Math.random() * 0.8));
        }
        geo.computeVertexNormals();
        const rock = new THREE.Mesh(geo, mat);
        rock.position.set(
          (Math.random() - 0.5) * 0.3,
          size * 0.3,
          (Math.random() - 0.5) * 0.3,
        );
        rock.rotation.y = Math.random() * Math.PI;
        group.add(rock);
      }
      items.push(group);
    } else if (pick < 0.7) {
      // Obsidian spire (cone, glossy black)
      const mat = new THREE.MeshStandardMaterial({
        color: 0x111118,
        roughness: 0.15,
        metalness: 0.5,
      });
      const h = 0.3 + Math.random() * 0.5;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.08 + Math.random() * 0.06, h, 5), mat);
      spire.position.y = h / 2;
      const group = new THREE.Group();
      group.add(spire);
      // Maybe a second smaller spire
      if (Math.random() > 0.4) {
        const h2 = h * 0.6;
        const spire2 = new THREE.Mesh(new THREE.ConeGeometry(0.05, h2, 5), mat);
        spire2.position.set(0.12, h2 / 2, 0.05);
        spire2.rotation.z = (Math.random() - 0.5) * 0.3;
        group.add(spire2);
      }
      items.push(group);
    } else {
      // Small fire vent (cylinder + orange glow)
      const ventMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
      const group = new THREE.Group();
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.12, 8), ventMat);
      vent.position.y = 0.06;
      group.add(vent);
      // Inner glow
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.5,
      });
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.13;
      group.add(glow);
      // Outer haze
      const hazeMat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.15,
      });
      const haze = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), hazeMat);
      haze.rotation.x = -Math.PI / 2;
      haze.position.y = 0.2;
      group.add(haze);
      items.push(group);
    }
    return items;
  }

  // ─── Ghost decorations ────────────────────────────────

  private createGhostDeco(): THREE.Object3D[] {
    const items: THREE.Object3D[] = [];
    const pick = Math.random();

    if (pick < 0.35) {
      // Broken tombstone
      const stoneColor = this.varyColor(this.theme.rockColor, 0, -0.1, -0.05);
      const mat = new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.9 });
      const group = new THREE.Group();
      // Broken base
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.08), mat);
      base.position.y = 0.125;
      group.add(base);
      // Broken top shard
      if (Math.random() > 0.3) {
        const shard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.07), mat);
        shard.position.set(0.1, 0.02, 0.15);
        shard.rotation.set(0.3, 0.5, 0.8);
        group.add(shard);
      }
      group.rotation.z = (Math.random() - 0.5) * 0.25;
      items.push(group);
    } else if (pick < 0.65) {
      // Rubble (scattered small boxes)
      const rubbleColor = this.varyColor(this.theme.rockColor, 0, -0.05, -0.08);
      const mat = new THREE.MeshStandardMaterial({ color: rubbleColor, roughness: 0.9 });
      const group = new THREE.Group();
      const count = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const s = 0.03 + Math.random() * 0.06;
        const piece = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.6, s * 0.8), mat);
        piece.position.set(
          (Math.random() - 0.5) * 0.35,
          s * 0.3,
          (Math.random() - 0.5) * 0.35,
        );
        piece.rotation.set(Math.random(), Math.random(), Math.random());
        group.add(piece);
      }
      items.push(group);
    } else {
      // Wispy ghost marker (transparent sphere)
      const ghostMat = new THREE.MeshBasicMaterial({
        color: 0xaabbcc,
        transparent: true,
        opacity: 0.12 + Math.random() * 0.1,
      });
      const radius = 0.12 + Math.random() * 0.15;
      const wisp = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), ghostMat);
      wisp.position.y = 0.3 + Math.random() * 0.3;
      wisp.scale.y = 1.3;
      items.push(wisp);
    }
    return items;
  }

  // ─── Crystal decorations ──────────────────────────────

  private createCrystalDeco(): THREE.Object3D[] {
    const items: THREE.Object3D[] = [];
    const pick = Math.random();

    if (pick < 0.4) {
      // Crystal cluster (group of octahedrons)
      const group = new THREE.Group();
      const count = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const crystalColor = this.varyColor(this.theme.leafColors[Math.floor(Math.random() * this.theme.leafColors.length)], 0.05, 0.1, 0.1);
        const mat = new THREE.MeshStandardMaterial({
          color: crystalColor,
          roughness: 0.1,
          metalness: 0.4,
          transparent: true,
          opacity: 0.7,
        });
        const size = 0.06 + Math.random() * 0.12;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), mat);
        crystal.position.set(
          (Math.random() - 0.5) * 0.25,
          size * 0.6 + Math.random() * 0.05,
          (Math.random() - 0.5) * 0.25,
        );
        crystal.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
        crystal.scale.y = 1 + Math.random() * 0.8;
        group.add(crystal);
      }
      items.push(group);
    } else if (pick < 0.7) {
      // Glowing gem (icosahedron)
      const gemColor = this.varyColor(this.theme.leafColors[Math.floor(Math.random() * this.theme.leafColors.length)], 0, 0.1, 0.15);
      const mat = new THREE.MeshStandardMaterial({
        color: gemColor,
        emissive: gemColor,
        emissiveIntensity: 0.4,
        roughness: 0.05,
        metalness: 0.5,
        transparent: true,
        opacity: 0.8,
      });
      const size = 0.08 + Math.random() * 0.1;
      const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), mat);
      gem.position.y = size + 0.02;
      gem.rotation.set(Math.random(), Math.random(), Math.random());
      items.push(gem);
    } else {
      // Luminescent fungi
      const group = new THREE.Group();
      const fungiColor = this.varyColor(0x44ddaa, 0.1, 0, 0);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x334433, roughness: 0.8 });
      const capMat = new THREE.MeshStandardMaterial({
        color: fungiColor,
        emissive: fungiColor,
        emissiveIntensity: 0.3,
        roughness: 0.5,
      });
      const fungiCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < fungiCount; i++) {
        const h = 0.06 + Math.random() * 0.08;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, h, 4), stemMat);
        const ox = (Math.random() - 0.5) * 0.2;
        const oz = (Math.random() - 0.5) * 0.2;
        stem.position.set(ox, h / 2, oz);
        group.add(stem);
        const capR = 0.03 + Math.random() * 0.03;
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(capR, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
          capMat,
        );
        cap.position.set(ox, h, oz);
        group.add(cap);
      }
      items.push(group);
    }
    return items;
  }

  // ─── Base Damage Visuals ──────────────────────────────

  /**
   * Update visual damage on the base building based on remaining HP percentage.
   * @param hpPercent  value from 0.0 (dead) to 1.0 (full HP)
   */
  updateBaseDamage(hpPercent: number): void {
    if (!this.baseGroup) return;

    // Determine damage level (0=fine, 1=<75%, 2=<50%, 3=<25%, 4=<10%)
    let level = 0;
    if (hpPercent < 0.10) level = 4;
    else if (hpPercent < 0.25) level = 3;
    else if (hpPercent < 0.50) level = 2;
    else if (hpPercent < 0.75) level = 1;

    // Avoid redundant rebuilds
    if (level === this.lastDamageLevel) return;
    this.lastDamageLevel = level;

    // Clean up existing damage visuals
    this.removeDamageVisuals();

    if (level === 0) return;

    const darkCrackMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.4,
    });
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.5,
    });

    // ─── Level 1+: Cracks ─────────────────────────
    const crackCount = level === 1 ? 3 : level >= 2 ? 6 : 3;
    for (let i = 0; i < crackCount; i++) {
      const crackGeo = new THREE.BoxGeometry(0.02, 0.25 + Math.random() * 0.2, 0.01);
      const crack = new THREE.Mesh(crackGeo, darkCrackMat);
      crack.name = 'damage-visual';
      // Place cracks on the cylindrical tower body surface (radius ~1.0, body center at y=2.2)
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.02;
      crack.position.set(
        Math.sin(angle) * radius,
        1.2 + Math.random() * 2.0,
        Math.cos(angle) * radius,
      );
      crack.rotation.y = angle + Math.PI;
      crack.rotation.z = (Math.random() - 0.5) * 0.6;
      this.baseGroup.add(crack);
    }

    // ─── Level 2+: Smoke particles ────────────────
    if (level >= 2) {
      this.smokeParticles = [];
      const smokeCount = level >= 3 ? 5 : 3;
      for (let i = 0; i < smokeCount; i++) {
        const smokeGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 6, 4);
        const smoke = new THREE.Mesh(smokeGeo, smokeMat.clone());
        smoke.name = 'damage-visual';
        smoke.position.set(
          (Math.random() - 0.5) * 1.0,
          5.0 + Math.random() * 1.5,
          (Math.random() - 0.5) * 1.0,
        );
        smoke.userData.baseY = smoke.position.y;
        smoke.userData.driftSpeed = 0.3 + Math.random() * 0.4;
        smoke.userData.phase = Math.random() * Math.PI * 2;
        this.baseGroup.add(smoke);
        this.smokeParticles.push(smoke);
      }
    }

    // ─── Level 3+: Fire glow + fire particles + red tint ─────
    if (level >= 3) {
      // Fire point light
      const intensity = level >= 4 ? 3.0 : 1.5;
      const fireColor = level >= 4 ? 0xff3300 : 0xff6600;
      this.fireLight = new THREE.PointLight(fireColor, intensity, 8);
      this.fireLight.name = 'damage-visual';
      this.fireLight.position.set(0, 5.2, 0);
      this.baseGroup.add(this.fireLight);

      // Fire particles
      this.fireParticles = [];
      const fireCount = level >= 4 ? 6 : 4;
      for (let i = 0; i < fireCount; i++) {
        const fireGeo = new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 6, 4);
        const fire = new THREE.Mesh(fireGeo, fireMat.clone());
        fire.name = 'damage-visual';
        fire.position.set(
          (Math.random() - 0.5) * 0.8,
          4.5 + Math.random() * 1.0,
          (Math.random() - 0.5) * 0.8,
        );
        fire.userData.baseY = fire.position.y;
        fire.userData.flickerSpeed = 3 + Math.random() * 4;
        fire.userData.phase = Math.random() * Math.PI * 2;
        this.baseGroup.add(fire);
        this.fireParticles.push(fire);
      }

      // Red tint on building materials
      const tintIntensity = level >= 4 ? 0.35 : 0.15;
      for (const mat of this.baseMaterials) {
        mat.emissive.set(0xff2200);
        mat.emissiveIntensity = tintIntensity;
      }
    }

    // ─── Level 4: Building tilts, intense visuals ─────
    if (level >= 4) {
      this.baseGroup.rotation.z = 0.05;
    }
  }

  /**
   * Animate smoke and fire damage particles. Call from Game update loop.
   * @param dt  delta time in seconds
   */
  updateDamageAnimation(dt: number): void {
    // Animate smoke: drift upward, sway, fade and reset
    for (const smoke of this.smokeParticles) {
      if (!smoke.parent) continue;
      smoke.userData.phase += dt * smoke.userData.driftSpeed;
      smoke.position.y += dt * smoke.userData.driftSpeed;
      smoke.position.x += Math.sin(smoke.userData.phase * 2) * dt * 0.1;

      // Fade out as smoke rises
      const rise = smoke.position.y - smoke.userData.baseY;
      const mat = smoke.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.4 - rise * 0.15);

      // Reset smoke when it's risen too far
      if (rise > 3.0) {
        smoke.position.y = smoke.userData.baseY;
        smoke.position.x = (Math.random() - 0.5) * 1.0;
        smoke.position.z = (Math.random() - 0.5) * 1.0;
        mat.opacity = 0.4;
      }
    }

    // Animate fire: flicker scale and slight vertical oscillation
    for (const fire of this.fireParticles) {
      if (!fire.parent) continue;
      fire.userData.phase += dt * fire.userData.flickerSpeed;
      const flicker = 0.7 + Math.sin(fire.userData.phase) * 0.4;
      fire.scale.setScalar(flicker);
      fire.position.y = fire.userData.baseY + Math.sin(fire.userData.phase * 0.7) * 0.15;
    }

    // Animate fire light intensity flicker
    if (this.fireLight && this.fireLight.parent) {
      const base = this.lastDamageLevel >= 4 ? 3.0 : 1.5;
      this.fireLight.intensity = base + Math.sin(Date.now() * 0.005) * 0.5;
    }

    // Animate path direction arrows: subtle opacity and scale pulse
    this.pathArrowTime += dt;
    for (let i = 0; i < this.pathArrows.length; i++) {
      const arrow = this.pathArrows[i];
      const mat = this.pathArrowMaterials[i];
      if (!arrow.parent || !mat) continue;

      const phase = this.pathArrowTime * 2.0 + arrow.userData.phase;
      // Smooth sine wave oscillation for opacity: range 0.35 - 0.7
      mat.opacity = 0.525 + Math.sin(phase) * 0.175;
      // Subtle scale pulse: range 0.9 - 1.05
      const s = 0.975 + Math.sin(phase) * 0.075;
      arrow.scale.set(s, s, s);
    }
  }

  /**
   * Remove all damage visuals and reset building to pristine state.
   * Called when starting a new level.
   */
  resetBaseDamage(): void {
    this.removeDamageVisuals();
    this.cleanupPathArrows();
    this.lastDamageLevel = -1;

    // Reset building rotation
    if (this.baseGroup) {
      this.baseGroup.rotation.z = 0;
    }

    // Restore original material emissives
    for (let i = 0; i < this.baseMaterials.length; i++) {
      if (this.originalEmissives[i]) {
        this.baseMaterials[i].emissive.copy(this.originalEmissives[i]);
        this.baseMaterials[i].emissiveIntensity = this.originalEmissives[i].r > 0 || this.originalEmissives[i].g > 0 || this.originalEmissives[i].b > 0 ? 0.7 : 0;
      }
    }
  }

  /**
   * Remove all children named 'damage-visual' from the base group.
   */
  private removeDamageVisuals(): void {
    if (!this.baseGroup) return;

    const toRemove: THREE.Object3D[] = [];
    for (const child of this.baseGroup.children) {
      if (child.name === 'damage-visual') {
        toRemove.push(child);
      }
    }
    for (const obj of toRemove) {
      this.baseGroup.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      }
    }
    if (this.fireLight) {
      this.baseGroup.remove(this.fireLight);
      this.fireLight.dispose();
      this.fireLight = null;
    }

    this.smokeParticles = [];
    this.fireParticles = [];

    // Reset material emissives (in case tint was applied)
    for (let i = 0; i < this.baseMaterials.length; i++) {
      if (this.originalEmissives[i]) {
        this.baseMaterials[i].emissive.copy(this.originalEmissives[i]);
        this.baseMaterials[i].emissiveIntensity = this.originalEmissives[i].r > 0 || this.originalEmissives[i].g > 0 || this.originalEmissives[i].b > 0 ? 0.7 : 0;
      }
    }

    // Reset tilt
    if (this.baseGroup) {
      this.baseGroup.rotation.z = 0;
    }
  }

  /**
   * Dispose path arrow meshes and materials.
   * Called automatically from resetBaseDamage (which runs before the renderer
   * is discarded) so GPU resources are freed.
   */
  private cleanupPathArrows(): void {
    for (let i = 0; i < this.pathArrows.length; i++) {
      const arrow = this.pathArrows[i];
      arrow.geometry.dispose();
      this.pathArrowMaterials[i].dispose();
    }
    this.pathArrows = [];
    this.pathArrowMaterials = [];
  }

  // ─── Ambient Environment Particles ──────────────────────

  private getAmbientStyle(): 'leaves' | 'snow' | 'embers' | 'fireflies' | 'sand' | 'spores' | 'none' {
    const name = this.theme.name.toLowerCase();
    if (name.includes('eis') || name.includes('frost')) return 'snow';
    if (name.includes('vulkan') || name.includes('hölle') || name.includes('hoelle')) return 'embers';
    if (name.includes('wüste') || name.includes('wueste') || name.includes('canyon')) return 'sand';
    if (name.includes('sumpf') || name.includes('dunkel')) return 'spores';
    if (name.includes('geister') || name.includes('kristall')) return 'fireflies';
    // Default: falling leaves for forest/graveyard themes
    return 'leaves';
  }

  private createAmbientParticles(): void {
    this.ambientStyle = this.getAmbientStyle();
    if (this.ambientStyle === 'none') return;

    const count = this.ambientStyle === 'fireflies' ? 40 : 80;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    this.ambientVelocities = new Float32Array(count * 3);
    this.ambientPhases = new Float32Array(count);

    const spread = MAP_SIZE * 0.8;
    const height = 12;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Random starting position in a volume above the map
      positions[i3] = (Math.random() - 0.5) * spread;
      positions[i3 + 1] = 1 + Math.random() * height;
      positions[i3 + 2] = (Math.random() - 0.5) * spread;

      this.ambientPhases[i] = Math.random() * Math.PI * 2;

      let r = 1, g = 1, b = 1;
      let size = 0.15;

      switch (this.ambientStyle) {
        case 'leaves': {
          // Autumn-colored leaves
          const leafPalette = [[0.6, 0.4, 0.1], [0.5, 0.6, 0.15], [0.7, 0.3, 0.05], [0.4, 0.5, 0.1]];
          const lc = leafPalette[Math.floor(Math.random() * leafPalette.length)];
          r = lc[0] + (Math.random() - 0.5) * 0.1;
          g = lc[1] + (Math.random() - 0.5) * 0.1;
          b = lc[2] + (Math.random() - 0.5) * 0.05;
          size = 0.12 + Math.random() * 0.12;
          // Drift slowly downward with lateral sway
          this.ambientVelocities[i3] = (Math.random() - 0.5) * 0.3;
          this.ambientVelocities[i3 + 1] = -0.3 - Math.random() * 0.4;
          this.ambientVelocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
          break;
        }
        case 'snow': {
          r = 0.95; g = 0.97; b = 1.0;
          size = 0.08 + Math.random() * 0.1;
          this.ambientVelocities[i3] = (Math.random() - 0.5) * 0.15;
          this.ambientVelocities[i3 + 1] = -0.5 - Math.random() * 0.3;
          this.ambientVelocities[i3 + 2] = (Math.random() - 0.5) * 0.15;
          break;
        }
        case 'embers': {
          // Orange/red embers rising
          const ember = Math.random();
          r = 1.0; g = 0.3 + ember * 0.5; b = 0.05 + ember * 0.1;
          size = 0.06 + Math.random() * 0.08;
          positions[i3 + 1] = Math.random() * 3; // start near ground
          this.ambientVelocities[i3] = (Math.random() - 0.5) * 0.5;
          this.ambientVelocities[i3 + 1] = 0.8 + Math.random() * 1.2;
          this.ambientVelocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
          break;
        }
        case 'fireflies': {
          r = 0.4; g = 1.0; b = 0.3 + Math.random() * 0.3;
          size = 0.1 + Math.random() * 0.08;
          positions[i3 + 1] = 0.5 + Math.random() * 3;
          this.ambientVelocities[i3] = (Math.random() - 0.5) * 0.8;
          this.ambientVelocities[i3 + 1] = (Math.random() - 0.5) * 0.3;
          this.ambientVelocities[i3 + 2] = (Math.random() - 0.5) * 0.8;
          break;
        }
        case 'sand': {
          r = 0.85; g = 0.75; b = 0.55;
          size = 0.05 + Math.random() * 0.06;
          positions[i3 + 1] = Math.random() * 4;
          this.ambientVelocities[i3] = 0.5 + Math.random() * 1.0; // wind direction
          this.ambientVelocities[i3 + 1] = (Math.random() - 0.5) * 0.2;
          this.ambientVelocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
          break;
        }
        case 'spores': {
          r = 0.3; g = 0.8; b = 0.2 + Math.random() * 0.3;
          size = 0.07 + Math.random() * 0.06;
          positions[i3 + 1] = 0.3 + Math.random() * 2;
          this.ambientVelocities[i3] = (Math.random() - 0.5) * 0.2;
          this.ambientVelocities[i3 + 1] = 0.1 + Math.random() * 0.3;
          this.ambientVelocities[i3 + 2] = (Math.random() - 0.5) * 0.2;
          break;
        }
      }

      colors[i3] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
      sizes[i] = size;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const isGlowing = this.ambientStyle === 'embers' || this.ambientStyle === 'fireflies';
    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
      size: 0.15,
      opacity: isGlowing ? 0.9 : 0.7,
      blending: isGlowing ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.ambientParticles = new THREE.Points(geo, mat);
    this.ambientParticles.frustumCulled = false;
    this.terrainGroup.add(this.ambientParticles);
  }

  /**
   * Animate ambient environment particles. Call from Game update loop.
   */
  updateAmbientParticles(dt: number): void {
    if (!this.ambientParticles || !this.ambientVelocities || !this.ambientPhases) return;

    this.ambientTime += dt;
    const posAttr = this.ambientParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const count = positions.length / 3;
    const spread = MAP_SIZE * 0.8;
    const halfSpread = spread / 2;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const phase = this.ambientPhases[i];

      // Apply velocity
      positions[i3] += this.ambientVelocities[i3] * dt;
      positions[i3 + 1] += this.ambientVelocities[i3 + 1] * dt;
      positions[i3 + 2] += this.ambientVelocities[i3 + 2] * dt;

      // Add sinusoidal sway for organic feel
      switch (this.ambientStyle) {
        case 'leaves':
          positions[i3] += Math.sin(this.ambientTime * 1.5 + phase) * 0.4 * dt;
          positions[i3 + 2] += Math.cos(this.ambientTime * 1.2 + phase) * 0.3 * dt;
          break;
        case 'snow':
          positions[i3] += Math.sin(this.ambientTime * 0.8 + phase) * 0.2 * dt;
          positions[i3 + 2] += Math.cos(this.ambientTime * 0.6 + phase) * 0.15 * dt;
          break;
        case 'fireflies':
          // Erratic movement with direction changes
          this.ambientVelocities[i3] += (Math.random() - 0.5) * 2 * dt;
          this.ambientVelocities[i3 + 1] += (Math.random() - 0.5) * 1 * dt;
          this.ambientVelocities[i3 + 2] += (Math.random() - 0.5) * 2 * dt;
          // Damping to prevent flying away
          this.ambientVelocities[i3] *= 0.98;
          this.ambientVelocities[i3 + 1] *= 0.98;
          this.ambientVelocities[i3 + 2] *= 0.98;
          break;
        case 'embers':
          positions[i3] += Math.sin(this.ambientTime * 2 + phase) * 0.5 * dt;
          positions[i3 + 2] += Math.cos(this.ambientTime * 1.8 + phase * 1.3) * 0.4 * dt;
          break;
        case 'sand':
          positions[i3 + 1] += Math.sin(this.ambientTime * 3 + phase) * 0.15 * dt;
          break;
        case 'spores':
          positions[i3] += Math.sin(this.ambientTime * 0.5 + phase) * 0.15 * dt;
          positions[i3 + 2] += Math.cos(this.ambientTime * 0.7 + phase) * 0.12 * dt;
          break;
      }

      // Wrap around: recycle particles that leave the volume
      const y = positions[i3 + 1];
      const isRising = this.ambientStyle === 'embers' || this.ambientStyle === 'spores';

      if (isRising && y > 15) {
        positions[i3 + 1] = 0.2;
        positions[i3] = (Math.random() - 0.5) * spread;
        positions[i3 + 2] = (Math.random() - 0.5) * spread;
      } else if (!isRising && y < 0) {
        positions[i3 + 1] = 10 + Math.random() * 4;
        positions[i3] = (Math.random() - 0.5) * spread;
        positions[i3 + 2] = (Math.random() - 0.5) * spread;
      }

      // Horizontal wrap
      if (positions[i3] > halfSpread) positions[i3] = -halfSpread;
      if (positions[i3] < -halfSpread) positions[i3] = halfSpread;
      if (positions[i3 + 2] > halfSpread) positions[i3 + 2] = -halfSpread;
      if (positions[i3 + 2] < -halfSpread) positions[i3 + 2] = halfSpread;

      // Firefly height bounds
      if (this.ambientStyle === 'fireflies') {
        if (y < 0.3) positions[i3 + 1] = 0.3;
        if (y > 4) positions[i3 + 1] = 4;
      }
    }

    posAttr.needsUpdate = true;

    // Firefly glow pulsing
    if (this.ambientStyle === 'fireflies') {
      const mat = this.ambientParticles.material as THREE.PointsMaterial;
      mat.opacity = 0.6 + Math.sin(this.ambientTime * 3) * 0.3;
    }
  }
}
