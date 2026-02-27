import * as THREE from 'three';
import { GameMap } from '../map/GameMap';
import { Weapon, TowerWeapon, TargetingMode, TARGETING_MODE_LABELS, TARGETING_MODES } from './Weapon';
import { WeaponKey, BALANCE } from '../systems/BalanceConfig';
import { EconomySystem } from '../systems/EconomySystem';
import {
  CELL_SIZE, MAP_SIZE, GRID_SIZE,
  CELL_EMPTY, CELL_PATH, CELL_TOWER, CELL_TRAP, CELL_BLOCKED,
  COLOR_GRID_VALID, COLOR_GRID_INVALID,
} from '../utils/Constants';
import { CameraController } from '../scene/CameraController';
import { ArrowTower } from './towers/ArrowTower';
import { CannonTower } from './towers/CannonTower';
import { IceTower } from './towers/IceTower';
import { FireTower } from './towers/FireTower';
import { SniperTower } from './towers/SniperTower';
import { TeslaTower } from './towers/TeslaTower';
import { MortarTower } from './towers/MortarTower';
import { PoisonTower } from './towers/PoisonTower';
import { LaserTower } from './towers/LaserTower';
import { WindTower } from './towers/WindTower';
import { MageTower } from './towers/MageTower';
import { FlamethrowerTower } from './towers/FlamethrowerTower';
import { BarrierTower } from './towers/BarrierTower';
import { NecromancerTower } from './towers/NecromancerTower';
import { EarthquakeTower } from './towers/EarthquakeTower';
import { HealTower } from './towers/HealTower';
import { Landmine } from './traps/Landmine';
import { SpikeTrap } from './traps/SpikeTrap';
import { FrostMine } from './traps/FrostMine';
import { GoldMine } from './traps/GoldMine';
import { renderTowerIcons } from '../ui/TowerIconRenderer';
import { SynergySystem } from '../systems/SynergySystem';
import { BackpackManager } from '../systems/BackpackManager';
import { TowerSpecialization } from '../systems/TowerSpecialization';
import { AchievementSystem } from '../systems/AchievementSystem';

export class PlacementSystem {
  private scene: THREE.Scene;
  private gameMap: GameMap;
  private economy: EconomySystem;
  private camera: THREE.PerspectiveCamera;
  private cameraController: CameraController;
  private raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane;
  private previewMesh: THREE.Mesh | null = null;
  private rangeMesh: THREE.Mesh | null = null;
  private selectedWeapon: WeaponKey | null = null;

  // Range indicator (hover/select) - two-layer: ring + fill
  private rangeRingMesh: THREE.Mesh | null = null;
  private rangeFillMesh: THREE.Mesh | null = null;
  private hoveredTower: Weapon | null = null;
  private placedWeapons: Weapon[] = [];

  // Tower selection (for upgrade/sell)
  private selectedTower: Weapon | null = null;
  private selectionRing: THREE.Mesh | null = null;
  private towerInfoPanel: HTMLElement;
  private tiName: HTMLElement;
  private tiLevel: HTMLElement;
  private tiStats: HTMLElement;
  private tiCombatStats: HTMLElement;
  private tiSynergies: HTMLElement;
  private upgradeBtn: HTMLButtonElement;
  private sellBtn: HTMLButtonElement;
  private tiTargeting: HTMLElement;
  private targetingModeBtn: HTMLButtonElement;

  // Synergy system reference (set from Game.ts)
  synergySystem: SynergySystem | null = null;
  // Backpack manager reference (set from Game.ts)
  backpackManager: BackpackManager | null = null;
  // Tower specialization system (set from Game.ts)
  towerSpecialization: TowerSpecialization | null = null;
  // Callback when a spec is applied (for sound/particles)
  onSpecialized: ((weapon: Weapon, specName: string) => void) | null = null;
  // Callback when a tower is upgraded (key, newLevel)
  onTowerUpgrade: ((weaponKey: WeaponKey, newLevel: number) => void) | null = null;
  // Callback when a weapon is placed (key)
  onWeaponPlaced: ((weaponKey: WeaponKey) => void) | null = null;

  // Wave-lock: prevent placing during active waves
  private waveActive = false;
  // Arena mode: tower limit
  private towerLimitReached = false;
  // Auto-upgrade: automatically upgrade cheapest tower between waves
  private autoUpgradeEnabled = false;
  private autoUpgradeFrameDelay = 0; // small delay between auto-upgrades for visual feedback
  // Optional weapon filter (e.g. daily challenge: only traps / only towers)
  allowedWeaponFilter: WeaponKey[] | null = null;

  // Ghost preview mesh (semi-transparent tower/trap shape)
  private ghostMesh: THREE.Group | null = null;
  private ghostRangeRing: THREE.Mesh | null = null;
  private currentGhostKey: string | null = null;

  // Placement tooltip (cursor-following stats while placing)
  private placementTooltip: HTMLDivElement | null = null;

  // Sell confirmation dialog
  private sellConfirmDiv: HTMLDivElement | null = null;
  private sellConfirmTimer: ReturnType<typeof setTimeout> | null = null;

  // Undo last placement
  private undoState: { weapon: Weapon; key: WeaponKey; gx: number; gz: number; cost: number } | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private undoFadeTimer: ReturnType<typeof setTimeout> | null = null;

  // Weapon comparison tooltip (DPS info on weapon select)
  private weaponCompareDiv: HTMLDivElement | null = null;

  // "Show All Ranges" overlay (R key)
  private allRangesMeshes: THREE.Mesh[] = [];
  private allRangesVisible = false;

  // Placement grid highlight overlay (shows valid/invalid cells when weapon selected)
  private gridHighlightMesh: THREE.Mesh | null = null;
  private gridHighlightCanvas: HTMLCanvasElement | null = null;
  private gridHighlightTexture: THREE.CanvasTexture | null = null;

  // Target line visualization (shows line from selected tower to its current target)
  private targetLineMesh: THREE.Line | null = null;
  private targetReticle: THREE.Mesh | null = null;
  private targetLinePulseTimer = 0;

  private static listenersAttached = false;
  private static instance: PlacementSystem | null = null;

  /** Map weapon keys to CSS category classes */
  private static readonly WEAPON_CATEGORIES: Record<string, string> = {
    arrowTower: 'cat-physical',
    cannonTower: 'cat-physical',
    sniperTower: 'cat-physical',
    mortarTower: 'cat-physical',
    iceTower: 'cat-elemental',
    fireTower: 'cat-elemental',
    flamethrowerTower: 'cat-elemental',
    windTower: 'cat-elemental',
    teslaTower: 'cat-elemental',
    mageTower: 'cat-magic',
    necromancerTower: 'cat-magic',
    laserTower: 'cat-magic',
    barrierTower: 'cat-support',
    healTower: 'cat-support',
    earthquakeTower: 'cat-support',
    poisonTower: 'cat-elemental',
    landmine: 'cat-trap',
    spikeTrap: 'cat-trap',
    frostMine: 'cat-trap',
    goldMine: 'cat-trap',
  };

  static getWeaponCategory(key: WeaponKey): string {
    return PlacementSystem.WEAPON_CATEGORIES[key] || 'cat-physical';
  }

  constructor(
    scene: THREE.Scene,
    gameMap: GameMap,
    economy: EconomySystem,
    camera: THREE.PerspectiveCamera,
    cameraController: CameraController
  ) {
    this.scene = scene;
    this.gameMap = gameMap;
    this.economy = economy;
    this.camera = camera;
    this.cameraController = cameraController;
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Tower info panel
    this.towerInfoPanel = document.getElementById('tower-info-panel')!;
    this.tiName = document.getElementById('ti-name')!;
    this.tiLevel = document.getElementById('ti-level')!;
    this.tiStats = document.getElementById('ti-stats')!;
    this.tiCombatStats = document.getElementById('ti-combat-stats')!;
    this.tiSynergies = document.getElementById('ti-synergies')!;
    this.upgradeBtn = document.getElementById('upgrade-btn') as HTMLButtonElement;
    this.sellBtn = document.getElementById('sell-btn') as HTMLButtonElement;
    this.tiTargeting = document.getElementById('ti-targeting')!;
    this.targetingModeBtn = document.getElementById('targeting-mode-btn') as HTMLButtonElement;

    this.createPreviewMesh();
    this.createSelectionRing();

    // Only attach event listeners and build UI once
    PlacementSystem.instance = this;
    if (!PlacementSystem.listenersAttached) {
      this.upgradeBtn.addEventListener('click', () => PlacementSystem.instance?.upgradeTower());
      this.sellBtn.addEventListener('click', () => {
        const inst = PlacementSystem.instance;
        if (inst?.selectedTower) inst.showSellConfirmation(inst.selectedTower);
      });
      this.targetingModeBtn.addEventListener('click', () => PlacementSystem.instance?.cycleTargetingMode());
      this.setupUI();
      this.setupMouseEvents();
      PlacementSystem.listenersAttached = true;
    }
  }

  private createPreviewMesh(): void {
    const geo = new THREE.BoxGeometry(CELL_SIZE * 0.9, 0.2, CELL_SIZE * 0.9);
    const mat = new THREE.MeshBasicMaterial({
      color: COLOR_GRID_VALID,
      transparent: true,
      opacity: 0.4,
    });
    this.previewMesh = new THREE.Mesh(geo, mat);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);

    // Range circle
    const rangeGeo = new THREE.RingGeometry(0, 1, 32);
    const rangeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    this.rangeMesh = new THREE.Mesh(rangeGeo, rangeMat);
    this.rangeMesh.rotation.x = -Math.PI / 2;
    this.rangeMesh.position.y = 0.05;
    this.rangeMesh.visible = false;
    this.scene.add(this.rangeMesh);
  }

  private createSelectionRing(): void {
    const ringGeo = new THREE.RingGeometry(0.8, 0.95, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.12;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    this.createRangeIndicator();
  }

  private createRangeIndicator(): void {
    // Outer ring (brighter, visible outline)
    const ringGeo = new THREE.RingGeometry(0.92, 1.0, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rangeRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.rangeRingMesh.position.y = 0.08;
    this.rangeRingMesh.visible = false;
    this.scene.add(this.rangeRingMesh);

    // Inner fill (very transparent area)
    const fillGeo = new THREE.CircleGeometry(0.92, 64);
    fillGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rangeFillMesh = new THREE.Mesh(fillGeo, fillMat);
    this.rangeFillMesh.position.y = 0.07;
    this.rangeFillMesh.visible = false;
    this.scene.add(this.rangeFillMesh);
  }

  private showRangeIndicator(tower: TowerWeapon): void {
    if (!this.rangeRingMesh || !this.rangeFillMesh) return;

    const range = tower.getEffectiveRange();
    const color = BALANCE.weapons[tower.key].color;

    // Position and scale both meshes
    this.rangeRingMesh.scale.set(range, range, range);
    this.rangeRingMesh.position.set(tower.mesh.position.x, 0.08, tower.mesh.position.z);
    (this.rangeRingMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.rangeRingMesh.visible = true;

    this.rangeFillMesh.scale.set(range, range, range);
    this.rangeFillMesh.position.set(tower.mesh.position.x, 0.07, tower.mesh.position.z);
    (this.rangeFillMesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.rangeFillMesh.visible = true;
  }

  private hideRangeIndicator(): void {
    if (this.rangeRingMesh) this.rangeRingMesh.visible = false;
    if (this.rangeFillMesh) this.rangeFillMesh.visible = false;
  }

  // ── Target Line Visualization ──────────────────────────
  /** Update the target line from the selected tower to its current target.
   *  Called each frame from Game.ts update(). */
  updateTargetLine(dt: number): void {
    this.targetLinePulseTimer += dt;

    // Only show when a TowerWeapon is selected and has a living target
    if (
      !this.selectedTower ||
      !(this.selectedTower instanceof TowerWeapon) ||
      !this.selectedTower.currentTarget ||
      !this.selectedTower.currentTarget.alive
    ) {
      this.removeTargetLine();
      return;
    }

    const tower = this.selectedTower;
    const target = tower.currentTarget!;
    const towerPos = tower.getPosition();
    towerPos.y += 1.5; // raise to turret height
    const targetPos = target.getPosition();
    targetPos.y += 0.5; // raise to enemy center

    const color = BALANCE.weapons[tower.key].color;

    // Pulse opacity: gentle sine wave between 0.3 and 0.7
    const pulseAlpha = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(this.targetLinePulseTimer * 4));

    // ── Target line ──────────────────────────────
    if (!this.targetLineMesh) {
      const geometry = new THREE.BufferGeometry().setFromPoints([towerPos, targetPos]);
      const material = new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity: pulseAlpha,
        dashSize: 0.5,
        gapSize: 0.25,
        depthWrite: false,
      });
      this.targetLineMesh = new THREE.Line(geometry, material);
      this.targetLineMesh.computeLineDistances();
      this.scene.add(this.targetLineMesh);
    } else {
      // Update positions
      const positions = this.targetLineMesh.geometry.attributes.position as THREE.BufferAttribute;
      positions.setXYZ(0, towerPos.x, towerPos.y, towerPos.z);
      positions.setXYZ(1, targetPos.x, targetPos.y, targetPos.z);
      positions.needsUpdate = true;
      // Recompute line distances for dashed material
      this.targetLineMesh.computeLineDistances();
      // Update color and opacity
      const mat = this.targetLineMesh.material as THREE.LineDashedMaterial;
      mat.color.setHex(color);
      mat.opacity = pulseAlpha;
    }

    // ── Target reticle ───────────────────────────
    if (!this.targetReticle) {
      const ringGeo = new THREE.RingGeometry(0.4, 0.55, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: pulseAlpha,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.targetReticle = new THREE.Mesh(ringGeo, ringMat);
      this.targetReticle.rotation.x = -Math.PI / 2;
      this.scene.add(this.targetReticle);
    } else {
      (this.targetReticle.material as THREE.MeshBasicMaterial).color.setHex(color);
      (this.targetReticle.material as THREE.MeshBasicMaterial).opacity = pulseAlpha;
    }

    // Position reticle at enemy feet, slightly above ground
    this.targetReticle.position.set(targetPos.x, 0.15, targetPos.z);
    // Slow rotation for visual flair
    this.targetReticle.rotation.z = this.targetLinePulseTimer * 1.5;
  }

  private removeTargetLine(): void {
    if (this.targetLineMesh) {
      this.scene.remove(this.targetLineMesh);
      this.targetLineMesh.geometry.dispose();
      (this.targetLineMesh.material as THREE.Material).dispose();
      this.targetLineMesh = null;
    }
    if (this.targetReticle) {
      this.scene.remove(this.targetReticle);
      this.targetReticle.geometry.dispose();
      (this.targetReticle.material as THREE.Material).dispose();
      this.targetReticle = null;
    }
    this.targetLinePulseTimer = 0;
  }

  // ── Show All Ranges (R key overlay) ─────────────────────
  showAllRanges(): void {
    if (this.allRangesVisible) return;
    this.allRangesVisible = true;

    // Build a cache of shared materials by weapon color to reduce draw calls
    const materialCache = new Map<number, THREE.MeshBasicMaterial>();

    for (const weapon of this.placedWeapons) {
      if (!(weapon instanceof TowerWeapon)) continue;

      const range = weapon.getEffectiveRange();
      if (range <= 0) continue;

      const color = BALANCE.weapons[weapon.key].color;

      // Reuse material for same color
      let mat = materialCache.get(color);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        materialCache.set(color, mat);
      }

      // Create a filled circle on the ground plane
      const geo = new THREE.CircleGeometry(range, 48);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(weapon.mesh.position.x, 0.06, weapon.mesh.position.z);
      this.scene.add(mesh);
      this.allRangesMeshes.push(mesh);
    }
  }

  hideAllRanges(): void {
    if (!this.allRangesVisible) return;
    this.allRangesVisible = false;

    // Collect unique materials before cleanup
    const uniqueMats = new Set<THREE.Material>();
    for (const mesh of this.allRangesMeshes) {
      uniqueMats.add(mesh.material as THREE.Material);
    }

    // Remove from scene and dispose geometries
    for (const mesh of this.allRangesMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }

    // Dispose shared materials
    for (const mat of uniqueMats) {
      mat.dispose();
    }

    this.allRangesMeshes = [];
  }

  // ── Placement Grid Highlight ──────────────────────────
  /**
   * Shows a grid overlay highlighting valid (green) and invalid (red) cells
   * for the currently selected weapon type. Uses a single canvas-textured plane
   * for performance (one draw call for the entire 20x20 grid).
   */
  private showGridHighlight(weaponKey: WeaponKey): void {
    // Remove any existing highlight first
    this.removeGridHighlight();

    const config = BALANCE.weapons[weaponKey];
    const isPath = config.isPath; // true = trap (placed on path), false = tower (placed on empty)

    // Pixel size per cell on the canvas (keep low for performance)
    const PX = 8;
    const canvasSize = GRID_SIZE * PX; // 20 * 8 = 160px

    // Create canvas (reuse if cached, but always repaint)
    if (!this.gridHighlightCanvas) {
      this.gridHighlightCanvas = document.createElement('canvas');
      this.gridHighlightCanvas.width = canvasSize;
      this.gridHighlightCanvas.height = canvasSize;
    }
    const canvas = this.gridHighlightCanvas;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Paint each cell
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const cell = this.gameMap.getCell(gx, gz);

        // Determine color based on weapon type and cell state
        let color: string | null = null;

        if (isPath) {
          // Placing a trap: only path cells are relevant
          if (cell === CELL_PATH) {
            color = 'rgba(0, 255, 0, 0.15)'; // valid: empty path
          } else if (cell === CELL_TRAP) {
            color = 'rgba(255, 0, 0, 0.1)';  // invalid: trap already there
          }
          // Non-path cells (CELL_EMPTY, CELL_TOWER, CELL_BLOCKED) get no highlight
        } else {
          // Placing a tower: only non-path cells are relevant
          if (cell === CELL_EMPTY) {
            color = 'rgba(0, 255, 0, 0.15)'; // valid: empty ground
          } else if (cell === CELL_TOWER) {
            color = 'rgba(255, 0, 0, 0.1)';  // invalid: tower already there
          } else if (cell === CELL_BLOCKED) {
            color = 'rgba(255, 0, 0, 0.1)';  // invalid: blocked (base area)
          }
          // Path cells (CELL_PATH, CELL_TRAP) get no highlight for towers
        }

        if (color) {
          ctx.fillStyle = color;
          // Canvas y-axis corresponds to grid z-axis
          ctx.fillRect(gx * PX, gz * PX, PX, PX);
        }
      }
    }

    // Create or update THREE.js texture
    if (!this.gridHighlightTexture) {
      this.gridHighlightTexture = new THREE.CanvasTexture(canvas);
      this.gridHighlightTexture.magFilter = THREE.NearestFilter;
      this.gridHighlightTexture.minFilter = THREE.NearestFilter;
    } else {
      this.gridHighlightTexture.needsUpdate = true;
    }

    // Create the mesh (single flat plane covering the entire grid)
    if (!this.gridHighlightMesh) {
      const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
      const mat = new THREE.MeshBasicMaterial({
        map: this.gridHighlightTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.gridHighlightMesh = new THREE.Mesh(geo, mat);
      this.gridHighlightMesh.rotation.x = -Math.PI / 2;
      this.gridHighlightMesh.position.y = 0.02; // just above ground to avoid z-fighting
    } else {
      // Update texture reference on existing material
      (this.gridHighlightMesh.material as THREE.MeshBasicMaterial).map = this.gridHighlightTexture;
      (this.gridHighlightMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }

    this.gridHighlightMesh.visible = true;
    this.scene.add(this.gridHighlightMesh);
  }

  /** Remove the grid highlight overlay from the scene */
  private removeGridHighlight(): void {
    if (this.gridHighlightMesh) {
      this.gridHighlightMesh.visible = false;
      this.scene.remove(this.gridHighlightMesh);
    }
  }

  /** Dispose all grid highlight resources (for full cleanup / reset) */
  private disposeGridHighlight(): void {
    this.removeGridHighlight();
    if (this.gridHighlightMesh) {
      this.gridHighlightMesh.geometry.dispose();
      (this.gridHighlightMesh.material as THREE.MeshBasicMaterial).dispose();
      this.gridHighlightMesh = null;
    }
    if (this.gridHighlightTexture) {
      this.gridHighlightTexture.dispose();
      this.gridHighlightTexture = null;
    }
    this.gridHighlightCanvas = null;
  }

  // ── Placement Tooltip ──────────────────────────────────
  private showPlacementTooltip(x: number, y: number, key: WeaponKey): void {
    if (!this.placementTooltip) {
      this.placementTooltip = document.getElementById('placement-tooltip') as HTMLDivElement;
    }
    if (!this.placementTooltip) return;

    const stats = BALANCE.weapons[key] as any;
    const name = stats.name;

    // Build stat rows depending on weapon type (tower vs trap)
    let statsHtml = '';
    if (stats.isPath) {
      // Trap stats
      if (stats.damage) {
        statsHtml += `<div class="pt-stat"><span class="pt-stat-label">Schaden</span><span class="pt-stat-value">${stats.damage}</span></div>`;
      }
      if (stats.radius) {
        statsHtml += `<div class="pt-stat"><span class="pt-stat-label">Radius</span><span class="pt-stat-value">${stats.radius}</span></div>`;
      }
      if (stats.slowFactor) {
        statsHtml += `<div class="pt-stat"><span class="pt-stat-label">Verlangsamung</span><span class="pt-stat-value">${Math.round((1 - stats.slowFactor) * 100)}%</span></div>`;
      }
    } else {
      // Tower stats
      if (stats.damage) {
        statsHtml += `<div class="pt-stat"><span class="pt-stat-label">Schaden</span><span class="pt-stat-value">${stats.damage}</span></div>`;
      }
      if (stats.range) {
        statsHtml += `<div class="pt-stat"><span class="pt-stat-label">Reichweite</span><span class="pt-stat-value">${stats.range}</span></div>`;
      }
      if (stats.fireRate) {
        statsHtml += `<div class="pt-stat"><span class="pt-stat-label">Feuerrate</span><span class="pt-stat-value">${stats.fireRate}/s</span></div>`;
      }
      // Special modifiers
      if (stats.splashRadius) {
        statsHtml += `<div class="pt-special">Fl\u00E4chenschaden: ${stats.splashRadius} Radius</div>`;
      }
      if (stats.slowFactor) {
        statsHtml += `<div class="pt-special">Verlangsamung: ${Math.round((1 - stats.slowFactor) * 100)}%</div>`;
      }
      if (stats.dotDamage) {
        statsHtml += `<div class="pt-special">DoT: ${stats.dotDamage}/s (${stats.dotDuration}s)</div>`;
      }
      if (stats.chainTargets) {
        statsHtml += `<div class="pt-special">Kettenblitz: ${stats.chainTargets} Ziele</div>`;
      }
    }

    this.placementTooltip.innerHTML =
      `<div class="pt-name">${name}</div>` +
      `<div class="pt-cost">Kosten: ${stats.cost}g</div>` +
      statsHtml +
      `<div class="pt-desc">${stats.description}</div>`;

    // Position near cursor, clamped to viewport
    const tooltipWidth = 200;
    const tooltipHeight = 160;
    let left = x + 18;
    let top = y - 10;

    // Clamp to right edge
    if (left + tooltipWidth > window.innerWidth) {
      left = x - tooltipWidth - 10;
    }
    // Clamp to bottom edge
    if (top + tooltipHeight > window.innerHeight) {
      top = window.innerHeight - tooltipHeight - 8;
    }
    // Clamp to top edge
    if (top < 4) top = 4;

    this.placementTooltip.style.left = `${left}px`;
    this.placementTooltip.style.top = `${top}px`;
    this.placementTooltip.style.display = 'block';
  }

  private hidePlacementTooltip(): void {
    if (this.placementTooltip) {
      this.placementTooltip.style.display = 'none';
    }
  }

  // ── Weapon Comparison Tooltip ────────────────────────
  private showWeaponComparisonTooltip(key: WeaponKey): void {
    if (!this.weaponCompareDiv) {
      this.weaponCompareDiv = document.getElementById('weapon-compare') as HTMLDivElement;
    }
    if (!this.weaponCompareDiv) return;

    const stats = BALANCE.weapons[key] as any;
    const name: string = stats.name;

    // For traps (path weapons), show basic info only (no DPS concept)
    if (stats.isPath) {
      let html = `<div class="wc-title">${name}</div>`;
      if (stats.damage) {
        html += `<span class="wc-stat">Schaden: ${stats.damage}</span>`;
      }
      if (stats.radius) {
        html += ` <span class="wc-stat">| Radius: ${stats.radius}</span>`;
      }
      this.weaponCompareDiv.innerHTML = html;
      this.weaponCompareDiv.style.display = 'block';
      return;
    }

    // Calculate theoretical DPS (fireRate = attacks per second)
    const theoDPS = (stats.damage * stats.fireRate).toFixed(1);

    // Check if any placed towers of the same type exist
    const sameTowers = this.placedWeapons.filter(w => w.key === key);

    let html = `<div class="wc-title">${name}</div>`;

    if (sameTowers.length > 0) {
      // Find best performer by actual DPS
      let bestDPS = 0;
      for (const tower of sameTowers) {
        if (tower.activeTime > 0) {
          const actualDPS = tower.totalDamageDealt / tower.activeTime;
          if (actualDPS > bestDPS) {
            bestDPS = actualDPS;
          }
        }
      }
      html += `<span class="wc-dps">DPS (Theorie): ${theoDPS}</span>`;
      html += ` | <span class="wc-best">Dein bester: ${bestDPS.toFixed(1)} DPS</span>`;
    } else {
      html += `<span class="wc-dps">DPS: ${theoDPS}</span>`;
      html += ` <span class="wc-stat">| Schaden: ${stats.damage} | Feuerrate: ${stats.fireRate}/s</span>`;
    }

    this.weaponCompareDiv.innerHTML = html;
    this.weaponCompareDiv.style.display = 'block';
  }

  private hideWeaponComparisonTooltip(): void {
    if (this.weaponCompareDiv) {
      this.weaponCompareDiv.style.display = 'none';
    }
  }

  // ── Ghost Preview Mesh ──────────────────────────────
  private createGhostMesh(key: WeaponKey): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons[key] as any;
    const weaponColor = config.color as number;

    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x44ff44,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });

    if (config.isPath) {
      // Trap: flat disc
      const discGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
      const disc = new THREE.Mesh(discGeo, ghostMat);
      disc.position.y = 0.05;
      group.add(disc);
    } else {
      // Tower: cylinder base + cylinder turret on top
      const baseGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12);
      const base = new THREE.Mesh(baseGeo, ghostMat);
      base.position.y = 0.25;
      group.add(base);

      const turretGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 12);
      const turret = new THREE.Mesh(turretGeo, ghostMat);
      turret.position.y = 0.9;
      group.add(turret);
    }

    // Range ring (only for towers with range > 0)
    const range = config.range ?? 0;
    if (range > 0) {
      const innerR = range - 0.08;
      const outerR = range;
      const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: weaponColor,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      this.ghostRangeRing = ring;
      this.scene.add(ring);
    }

    this.scene.add(group);
    this.ghostMesh = group;
    this.currentGhostKey = key;
    return group;
  }

  private updateGhostPosition(worldX: number, worldZ: number, isValid: boolean): void {
    if (!this.ghostMesh) return;
    this.ghostMesh.position.set(worldX, 0, worldZ);

    // Update color based on validity
    const color = isValid ? 0x44ff44 : 0xff4444;
    this.ghostMesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.color.setHex(color);
      }
    });

    // Move and show/hide range ring
    if (this.ghostRangeRing) {
      this.ghostRangeRing.position.set(worldX, 0.06, worldZ);
      this.ghostRangeRing.visible = isValid;
    }
  }

  private removeGhost(): void {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
    if (this.ghostRangeRing) {
      this.scene.remove(this.ghostRangeRing);
      this.ghostRangeRing = null;
    }
    this.currentGhostKey = null;
  }

  /** Rebuild the weapon panel (called externally when backpack changes) */
  rebuildUI(): void {
    this.setupUI();
  }

  private setupUI(): void {
    const panel = document.getElementById('weapon-panel')!;
    panel.innerHTML = '';

    let keys: WeaponKey[];
    if (this.backpackManager) {
      keys = this.backpackManager.getEquipped();
    } else {
      keys = Object.keys(BALANCE.weapons) as WeaponKey[];
    }
    // Apply weapon filter (e.g. daily challenge: only traps / only towers)
    if (this.allowedWeaponFilter) {
      const allowed = new Set(this.allowedWeaponFilter);
      keys = keys.filter(k => allowed.has(k));
    }

    // Split into categories
    const towers = keys.filter(k => !BALANCE.weapons[k].isPath).sort((a, b) => BALANCE.weapons[a].cost - BALANCE.weapons[b].cost);
    const traps = keys.filter(k => BALANCE.weapons[k].isPath).sort((a, b) => BALANCE.weapons[a].cost - BALANCE.weapons[b].cost);
    const allSorted = [...towers, ...traps];

    // Render 3D tower icons
    const towerIcons = renderTowerIcons();

    // Category label helper
    const addLabel = (text: string) => {
      const label = document.createElement('div');
      label.style.cssText = `
        color: #888; font-size: 9px; font-weight: bold; text-transform: uppercase;
        letter-spacing: 1px; padding: 4px 6px; display: flex; align-items: center;
        border-right: 1px solid rgba(255,255,255,0.1); margin-right: 2px;
        writing-mode: vertical-rl; text-orientation: mixed;
      `;
      label.textContent = text;
      panel.appendChild(label);
    };

    if (towers.length > 0) addLabel('Türme');

    allSorted.forEach((key, index) => {
      // Add separator between towers and traps
      if (traps.length > 0 && key === traps[0]) {
        addLabel('Fallen');
      }

      const config = BALANCE.weapons[key];
      const slot = document.createElement('div');
      slot.className = 'weapon-slot';
      slot.dataset.weapon = key;

      // Category color class
      const catClass = PlacementSystem.getWeaponCategory(key);
      slot.classList.add(catClass);

      // Hotkey number badge
      const hotkey = document.createElement('div');
      hotkey.className = 'weapon-hotkey';
      hotkey.textContent = `${index < 9 ? index + 1 : 0}`;
      slot.appendChild(hotkey);

      const icon = document.createElement('div');
      icon.className = 'weapon-icon';
      const iconUrl = towerIcons.get(key);
      if (iconUrl) {
        icon.style.backgroundImage = `url(${iconUrl})`;
        icon.style.backgroundSize = 'cover';
        icon.style.backgroundPosition = 'center';
        icon.style.borderRadius = '4px';
      } else {
        icon.style.backgroundColor = '#' + config.color.toString(16).padStart(6, '0');
      }
      slot.appendChild(icon);

      const name = document.createElement('div');
      name.className = 'weapon-name';
      name.textContent = config.name;
      slot.appendChild(name);

      const cost = document.createElement('div');
      cost.className = 'weapon-cost';
      cost.textContent = `${config.cost}g`;
      slot.appendChild(cost);

      slot.addEventListener('click', () => {
        const inst = PlacementSystem.instance!;
        inst.selectWeapon(inst.selectedWeapon === key ? null : key);
      });

      // Tooltip (desktop hover + touch long-press via pointerenter)
      const showTooltip = (clientX: number, clientY: number) => {
        const tooltip = document.getElementById('tooltip')!;
        const weaponConfig = BALANCE.weapons[key] as any;
        tooltip.querySelector('.tooltip-title')!.textContent = config.name;
        tooltip.querySelector('.tooltip-desc')!.textContent = config.description;

        let stats = `Kosten: ${config.cost}g`;
        if (weaponConfig.damage) stats += ` | Schaden: ${weaponConfig.damage}`;
        if (weaponConfig.range) stats += ` | Reichweite: ${weaponConfig.range}`;
        if (weaponConfig.fireRate) stats += ` | Feuerrate: ${weaponConfig.fireRate}/s`;
        tooltip.querySelector('.tooltip-stats')!.textContent = stats;

        tooltip.style.display = 'block';
        tooltip.style.left = `${clientX + 10}px`;
        tooltip.style.top = `${clientY - 80}px`;
      };

      slot.addEventListener('mouseenter', (e) => {
        showTooltip(e.clientX, e.clientY);
      });

      slot.addEventListener('mouseleave', () => {
        document.getElementById('tooltip')!.style.display = 'none';
      });

      // On touch: show tooltip briefly on tap (before click fires)
      slot.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          const rect = slot.getBoundingClientRect();
          showTooltip(rect.left, rect.top);
          // Auto-hide after 2s on touch
          setTimeout(() => {
            document.getElementById('tooltip')!.style.display = 'none';
          }, 2000);
        }
      }, { passive: true });

      panel.appendChild(slot);
    });
  }

  selectWeapon(key: WeaponKey | null): void {
    this.selectedWeapon = key;
    this.hoveredTower = null;
    // Hide sell confirmation when selecting a weapon
    this.hideSellConfirmation();
    // Deselect any selected tower when choosing a new weapon
    this.deselectTower();
    // Hide placement tooltip when deselecting
    if (!key) this.hidePlacementTooltip();

    // Show/hide mobile cancel button
    const cancelBtn = document.getElementById('mobile-cancel-btn');
    if (cancelBtn) {
      cancelBtn.classList.toggle('visible', key !== null);
    }

    // Remove ghost when deselecting weapon
    if (!key) {
      this.removeGhost();
    }

    // Show/hide weapon comparison tooltip
    if (key) {
      this.showWeaponComparisonTooltip(key);
    } else {
      this.hideWeaponComparisonTooltip();
    }

    // Show/hide grid placement highlight overlay
    if (key) {
      this.showGridHighlight(key);
    } else {
      this.removeGridHighlight();
    }

    // Update UI
    document.querySelectorAll('.weapon-slot').forEach(slot => {
      slot.classList.toggle('selected', (slot as HTMLElement).dataset.weapon === key);
    });

    if (key && this.previewMesh) {
      this.previewMesh.visible = true;
      // Show range for towers
      const config = BALANCE.weapons[key] as any;
      if (config.range && this.rangeMesh) {
        this.rangeMesh.visible = true;
        this.rangeMesh.scale.setScalar(config.range);
      } else if (this.rangeMesh) {
        this.rangeMesh.visible = false;
      }
    } else {
      if (this.previewMesh) this.previewMesh.visible = false;
      if (this.rangeMesh) this.rangeMesh.visible = false;
    }
  }

  private setupMouseEvents(): void {
    const canvas = document.getElementById('game-canvas')!;
    const self = () => PlacementSystem.instance!;

    // Mobile cancel button (replaces Escape key on touch devices)
    const cancelBtn = document.getElementById('mobile-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const inst = self();
        inst.hideSellConfirmation();
        inst.selectWeapon(null);
        inst.deselectTower();
      });
    }

    canvas.addEventListener('mousemove', (e) => {
      const inst = self();

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      inst.raycaster.setFromCamera(mouse, inst.camera);
      const intersection = new THREE.Vector3();
      const hit = inst.raycaster.ray.intersectPlane(inst.groundPlane, intersection);

      // Weapon placement preview
      if (inst.selectedWeapon && inst.previewMesh && hit) {
        const [gx, gz] = inst.gameMap.worldToGrid(intersection.x, intersection.z);
        const [wx, wz] = inst.gameMap.gridToWorld(gx, gz);
        inst.previewMesh.position.set(wx, 0.15, wz);

        if (inst.rangeMesh) {
          inst.rangeMesh.position.set(wx, 0.05, wz);
        }

        const config = BALANCE.weapons[inst.selectedWeapon];
        const canPlace = config.isPath
          ? inst.gameMap.canPlaceTrap(gx, gz)
          : inst.gameMap.canPlaceTower(gx, gz);

        const mat = inst.previewMesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(canPlace ? COLOR_GRID_VALID : COLOR_GRID_INVALID);

        // Ghost preview mesh
        if (!inst.ghostMesh || inst.currentGhostKey !== inst.selectedWeapon) {
          inst.removeGhost();
          inst.createGhostMesh(inst.selectedWeapon);
        }
        inst.updateGhostPosition(wx, wz, canPlace);

        // Show placement tooltip near cursor
        inst.showPlacementTooltip(e.clientX, e.clientY, inst.selectedWeapon);
        return;
      }

      // Hide placement tooltip and ghost when not hovering with weapon selected
      inst.hidePlacementTooltip();
      inst.removeGhost();

      // Tower hover range indicator (only when not placing a weapon)
      if (!inst.selectedWeapon && hit) {
        const hovered = inst.findWeaponAt(intersection.x, intersection.z);
        if (hovered && hovered instanceof TowerWeapon) {
          if (inst.hoveredTower !== hovered) {
            inst.hoveredTower = hovered;
            // Only show hover indicator if this tower is not already selected
            if (inst.selectedTower !== hovered) {
              inst.showRangeIndicator(hovered);
            }
          }
        } else {
          if (inst.hoveredTower) {
            inst.hoveredTower = null;
            // Hide hover indicator only if no tower is selected (selected tower keeps its indicator)
            if (!inst.selectedTower || !(inst.selectedTower instanceof TowerWeapon)) {
              inst.hideRangeIndicator();
            }
          }
        }
      }
    });

    canvas.addEventListener('click', (e) => {
      const inst = self();
      // Ignore if the user was dragging to rotate the camera
      if (inst.cameraController.wasDragging()) return;

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      inst.raycaster.setFromCamera(mouse, inst.camera);
      const intersection = new THREE.Vector3();
      const hit = inst.raycaster.ray.intersectPlane(inst.groundPlane, intersection);

      if (!hit) return;

      // If placing a weapon, try to place it
      if (inst.selectedWeapon) {
        inst.tryPlace(intersection.x, intersection.z);
        return;
      }

      // Otherwise, check if clicking on an existing tower
      const clicked = inst.findWeaponAt(intersection.x, intersection.z);
      if (clicked) {
        if (inst.selectedTower === clicked) {
          inst.deselectTower(); // toggle off
        } else {
          inst.selectTower(clicked);
        }
      } else {
        inst.deselectTower();
      }
    });

    // Escape key to deselect weapon or tower
    // Number keys for weapon hotkeys
    window.addEventListener('keydown', (e) => {
      const inst = self();
      if (e.key === 'Escape') {
        inst.hideSellConfirmation();
        inst.selectWeapon(null);
        inst.deselectTower();
        return;
      }

      // Undo last placement (Z key)
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey) {
        if (inst.undoState) {
          inst.executeUndo();
          return;
        }
      }

      // Tower management hotkeys (only when a tower is selected)
      if (inst.selectedTower) {
        if (e.key === 'u' || e.key === 'U') {
          inst.upgradeTower();
          return;
        }
        if (e.key === 's' || e.key === 'S') {
          inst.showSellConfirmation(inst.selectedTower);
          return;
        }
        if (e.key === 't' || e.key === 'T') {
          inst.cycleTargetingMode();
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          inst.cycleSelectedTower();
          return;
        }
      } else if (e.key === 'Tab') {
        // Tab with no tower selected: select the first placed tower
        e.preventDefault();
        inst.cycleSelectedTower();
        return;
      }

      // Hotkeys 1-0 for weapon selection (match panel order)
      let keys: WeaponKey[];
      if (inst.backpackManager) {
        keys = inst.backpackManager.getEquipped();
      } else {
        keys = Object.keys(BALANCE.weapons) as WeaponKey[];
      }
      const sorted = [...keys].sort((a, b) => BALANCE.weapons[a].cost - BALANCE.weapons[b].cost);
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9 && num <= sorted.length) {
        const key = sorted[num - 1];
        inst.selectWeapon(inst.selectedWeapon === key ? null : key);
      } else if (e.key === '0' && sorted.length >= 10) {
        const key = sorted[9];
        inst.selectWeapon(inst.selectedWeapon === key ? null : key);
      }
    });

    // Hide placement tooltip and ghost when mouse leaves the canvas
    canvas.addEventListener('mouseleave', () => {
      const inst = self();
      inst.hidePlacementTooltip();
      inst.removeGhost();
    });

    // ─── Touch: placement preview on touchmove ──────────
    canvas.addEventListener('touchmove', (e) => {
      const inst = self();
      if (!inst.selectedWeapon || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const mouse = new THREE.Vector2(
        (touch.clientX / window.innerWidth) * 2 - 1,
        -(touch.clientY / window.innerHeight) * 2 + 1
      );

      inst.raycaster.setFromCamera(mouse, inst.camera);
      const intersection = new THREE.Vector3();
      const hit = inst.raycaster.ray.intersectPlane(inst.groundPlane, intersection);

      if (inst.selectedWeapon && inst.previewMesh && hit) {
        const [gx, gz] = inst.gameMap.worldToGrid(intersection.x, intersection.z);
        const [wx, wz] = inst.gameMap.gridToWorld(gx, gz);
        inst.previewMesh.position.set(wx, 0.15, wz);

        if (inst.rangeMesh) {
          inst.rangeMesh.position.set(wx, 0.05, wz);
        }

        const config = BALANCE.weapons[inst.selectedWeapon];
        const canPlace = config.isPath
          ? inst.gameMap.canPlaceTrap(gx, gz)
          : inst.gameMap.canPlaceTower(gx, gz);

        const mat = inst.previewMesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(canPlace ? COLOR_GRID_VALID : COLOR_GRID_INVALID);

        if (!inst.ghostMesh || inst.currentGhostKey !== inst.selectedWeapon) {
          inst.removeGhost();
          inst.createGhostMesh(inst.selectedWeapon);
        }
        inst.updateGhostPosition(wx, wz, canPlace);
      }
    }, { passive: true });
  }

  setWaveActive(active: boolean): void {
    this.waveActive = active;
    // Visual feedback: dim weapon panel during waves
    const panel = document.getElementById('weapon-panel');
    if (panel) {
      panel.style.opacity = active ? '0.4' : '1';
      panel.style.pointerEvents = active ? 'none' : 'all';
    }
    // Hide sell confirmation when wave starts
    if (active) this.hideSellConfirmation();
    // Cancel undo window when wave starts
    if (active) this.clearUndo();
    // Deselect weapon when wave starts
    if (active && this.selectedWeapon) {
      this.selectWeapon(null);
    }
  }

  setTowerLimitReached(reached: boolean): void {
    this.towerLimitReached = reached;
  }

  private tryPlace(wx: number, wz: number): void {
    if (!this.selectedWeapon) return;
    // Block placement during active waves
    if (this.waveActive) return;
    // Arena mode: block if tower limit reached (traps still allowed)
    const weaponConfig = BALANCE.weapons[this.selectedWeapon];
    if (!weaponConfig.isPath && this.towerLimitReached) return;

    const [gx, gz] = this.gameMap.worldToGrid(wx, wz);
    const config = BALANCE.weapons[this.selectedWeapon];

    // Check placement validity
    const canPlace = config.isPath
      ? this.gameMap.canPlaceTrap(gx, gz)
      : this.gameMap.canPlaceTower(gx, gz);

    if (!canPlace) return;

    // Check cost
    if (!this.economy.canAfford(config.cost)) return;

    // Spend gold
    this.economy.spend(config.cost);

    // Create weapon
    const weapon = this.createWeapon(this.selectedWeapon, gx, gz);
    const [worldX, worldZ] = this.gameMap.gridToWorld(gx, gz);
    weapon.mesh.position.set(worldX, 0, worldZ);

    this.scene.add(weapon.mesh);
    this.placedWeapons.push(weapon);

    // Mark cell as occupied
    if (config.isPath) {
      this.gameMap.placeTrap(gx, gz);
    } else {
      this.gameMap.placeTower(gx, gz);
    }

    // Track achievement: tower placed
    const weaponTypes = new Set(this.placedWeapons.map(w => w.key));
    AchievementSystem.getInstance().trackTowerPlaced(weaponTypes);

    // Fire placement callback for post-game stats
    this.onWeaponPlaced?.(this.selectedWeapon);

    // Start undo window for this placement
    this.startUndoWindow(weapon, this.selectedWeapon, gx, gz, config.cost);

    // Deselect weapon after placing
    this.selectWeapon(null);
  }

  private createWeapon(key: WeaponKey, gx: number, gz: number): Weapon {
    switch (key) {
      case 'landmine': return new Landmine(gx, gz);
      case 'spikeTrap': return new SpikeTrap(gx, gz);
      case 'frostMine': return new FrostMine(gx, gz);
      case 'goldMine': return new GoldMine(gx, gz);
      case 'arrowTower': return new ArrowTower(gx, gz);
      case 'cannonTower': return new CannonTower(gx, gz);
      case 'iceTower': return new IceTower(gx, gz);
      case 'fireTower': return new FireTower(gx, gz);
      case 'sniperTower': return new SniperTower(gx, gz);
      case 'teslaTower': return new TeslaTower(gx, gz);
      case 'mortarTower': return new MortarTower(gx, gz);
      case 'poisonTower': return new PoisonTower(gx, gz);
      case 'laserTower': return new LaserTower(gx, gz);
      case 'windTower': return new WindTower(gx, gz);
      case 'mageTower': return new MageTower(gx, gz);
      case 'flamethrowerTower': return new FlamethrowerTower(gx, gz);
      case 'barrierTower': return new BarrierTower(gx, gz);
      case 'necromancerTower': return new NecromancerTower(gx, gz);
      case 'earthquakeTower': return new EarthquakeTower(gx, gz);
      case 'healTower': return new HealTower(gx, gz);
      default: return new ArrowTower(gx, gz);
    }
  }

  private findWeaponAt(wx: number, wz: number): Weapon | null {
    const [gx, gz] = this.gameMap.worldToGrid(wx, wz);
    for (const weapon of this.placedWeapons) {
      if (weapon.gridX === gx && weapon.gridZ === gz) {
        return weapon;
      }
    }
    return null;
  }

  private selectTower(weapon: Weapon): void {
    this.hideSellConfirmation(); // close sell dialog when switching towers
    this.selectWeapon(null); // deselect weapon panel FIRST (calls deselectTower internally)
    this.selectedTower = weapon; // THEN set selected tower

    // Show mobile cancel button for tower deselection
    const cancelBtn = document.getElementById('mobile-cancel-btn');
    if (cancelBtn) cancelBtn.classList.add('visible');

    // Show selection ring
    if (this.selectionRing) {
      this.selectionRing.visible = true;
      this.selectionRing.position.set(
        weapon.mesh.position.x,
        0.12,
        weapon.mesh.position.z
      );
    }

    // Show range indicator for tower weapons
    if (weapon instanceof TowerWeapon) {
      this.showRangeIndicator(weapon);
    }

    // Update tower info panel
    this.updateTowerInfoPanel(weapon);
    this.towerInfoPanel.classList.add('visible');
  }

  private deselectTower(): void {
    this.selectedTower = null;
    if (this.selectionRing) this.selectionRing.visible = false;
    if (this.rangeMesh && !this.selectedWeapon) this.rangeMesh.visible = false;
    this.hideRangeIndicator();
    this.removeTargetLine();
    this.towerInfoPanel.classList.remove('visible');

    // Hide mobile cancel button if no weapon selected either
    if (!this.selectedWeapon) {
      const cancelBtn = document.getElementById('mobile-cancel-btn');
      if (cancelBtn) cancelBtn.classList.remove('visible');
    }
  }

  private cycleSelectedTower(): void {
    if (this.placedWeapons.length === 0) return;

    if (!this.selectedTower) {
      // No tower selected: select the first one
      this.selectTower(this.placedWeapons[0]);
    } else {
      // Find current index and cycle to next
      const currentIndex = this.placedWeapons.indexOf(this.selectedTower);
      const nextIndex = (currentIndex + 1) % this.placedWeapons.length;
      this.selectTower(this.placedWeapons[nextIndex]);
    }
  }

  private updateTowerInfoPanel(weapon: Weapon): void {
    const config = BALANCE.weapons[weapon.key];
    this.tiName.textContent = config.name;
    // Show specialization name if applied
    const spec = this.towerSpecialization?.getApplied(weapon);
    this.tiLevel.textContent = spec
      ? `Level ${weapon.level} / 3 — ${spec.name}`
      : `Level ${weapon.level} / 3`;

    if (weapon instanceof TowerWeapon) {
      this.tiStats.textContent = weapon.getStatsText();
      // Show targeting mode for towers
      this.tiTargeting.style.display = 'flex';
      this.updateTargetingButton(weapon.targetingMode);
    } else {
      this.tiStats.textContent = `Schaden: ${(config as any).damage}`;
      // Hide targeting mode for traps
      this.tiTargeting.style.display = 'none';
    }

    // Combat stats (kills, damage, DPS)
    const dps = weapon.activeTime > 0
      ? (weapon.totalDamageDealt / weapon.activeTime).toFixed(1)
      : '0.0';
    const totalDmg = Math.floor(weapon.totalDamageDealt);
    this.tiCombatStats.innerHTML =
      `<span class="cs-kills">Kills: ${weapon.kills}</span>` +
      `<span class="cs-damage">Schaden: ${totalDmg >= 1000 ? (totalDmg / 1000).toFixed(1) + 'k' : totalDmg}</span>` +
      `<span class="cs-dps">DPS: ${dps}</span>`;

    // Synergies display
    this.tiSynergies.innerHTML = '';
    if (this.synergySystem) {
      const synergies = this.synergySystem.getSynergiesForWeapon(weapon);
      for (const syn of synergies) {
        const tag = document.createElement('span');
        tag.className = 'synergy-tag';
        tag.style.background = '#' + syn.def.color.toString(16).padStart(6, '0');
        tag.textContent = syn.def.name;
        tag.title = syn.def.description;
        this.tiSynergies.appendChild(tag);
      }
    }

    // Upgrade button
    if (weapon.canUpgrade()) {
      const cost = weapon.getUpgradeCost();
      if (this.waveActive) {
        this.upgradeBtn.textContent = 'Welle aktiv!';
        this.upgradeBtn.disabled = true;
      } else {
        this.upgradeBtn.textContent = `Upgrade (${cost}g)`;
        this.upgradeBtn.disabled = !this.economy.canAfford(cost);
      }
    } else {
      this.upgradeBtn.textContent = 'Max Level';
      this.upgradeBtn.disabled = true;
    }

    // Sell button
    const sellValue = weapon.getSellValue();
    this.sellBtn.textContent = `Verkaufen (${sellValue}g)`;
  }

  private updateTargetingButton(mode: TargetingMode): void {
    const icons: Record<TargetingMode, string> = {
      first: '\u25B6',    // right-pointing triangle (first in line)
      last: '\u25C0',     // left-pointing triangle (last in line)
      strongest: '\u2666', // diamond (strongest)
      closest: '\u25CE',  // bullseye (closest)
    };
    const iconEl = this.targetingModeBtn.querySelector('.targeting-icon')!;
    const textEl = this.targetingModeBtn.querySelector('.targeting-text')!;
    iconEl.textContent = icons[mode];
    textEl.textContent = TARGETING_MODE_LABELS[mode];
  }

  private cycleTargetingMode(): void {
    if (!this.selectedTower || !(this.selectedTower instanceof TowerWeapon)) return;
    const tower = this.selectedTower;
    const currentIndex = TARGETING_MODES.indexOf(tower.targetingMode);
    const nextIndex = (currentIndex + 1) % TARGETING_MODES.length;
    tower.targetingMode = TARGETING_MODES[nextIndex];
    this.updateTargetingButton(tower.targetingMode);

    // Update the visual indicator on the tower
    this.updateTargetingIndicator(tower);
  }

  /** Add or remove a small colored dot above the tower to indicate non-default targeting */
  private updateTargetingIndicator(tower: TowerWeapon): void {
    const old = tower.mesh.getObjectByName('targeting-indicator');
    if (old) tower.mesh.remove(old);

    // Only show indicator for non-default modes
    if (tower.targetingMode === 'first') return;

    const colors: Record<TargetingMode, number> = {
      first: 0xffffff,
      last: 0xff8844,
      strongest: 0xff4444,
      closest: 0x44aaff,
    };

    const dotGeo = new THREE.SphereGeometry(0.08, 6, 4);
    const dotMat = new THREE.MeshBasicMaterial({
      color: colors[tower.targetingMode],
      transparent: true,
      opacity: 0.85,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.name = 'targeting-indicator';
    dot.position.y = 3.1;
    tower.mesh.add(dot);
  }

  private upgradeTower(): void {
    if (!this.selectedTower || !this.selectedTower.canUpgrade()) return;
    // Block upgrades during active waves
    if (this.waveActive) return;
    const cost = this.selectedTower.getUpgradeCost();
    if (!this.economy.canAfford(cost)) return;

    this.economy.spend(cost);
    this.selectedTower.upgrade();

    // Track achievement: tower upgraded
    AchievementSystem.getInstance().trackTowerUpgraded(this.selectedTower.level);

    // Add enhanced upgrade visuals based on new level
    this.addUpgradeVisuals(this.selectedTower, this.selectedTower.level);

    this.updateTowerInfoPanel(this.selectedTower);

    // Update range indicator after upgrade
    if (this.selectedTower instanceof TowerWeapon) {
      this.showRangeIndicator(this.selectedTower);
    }

    // Fire upgrade callback
    if (this.onTowerUpgrade) {
      this.onTowerUpgrade(this.selectedTower.key, this.selectedTower.level);
    }

    // Check for specialization at level 3
    if (this.selectedTower.level === 3 && this.towerSpecialization) {
      if (this.towerSpecialization.canSpecialize(this.selectedTower)) {
        this.showSpecDialog(this.selectedTower);
      }
    }
  }

  /** Add visual upgrade effects to a weapon when it levels up */
  private addUpgradeVisuals(weapon: Weapon, level: number): void {
    // Remove any previous upgrade visuals
    const toRemove: THREE.Object3D[] = [];
    weapon.mesh.traverse((child) => {
      if (child.name === 'upgrade-visual') {
        toRemove.push(child);
      }
    });
    for (const obj of toRemove) {
      obj.parent?.remove(obj);
    }

    // Get the weapon's theme color from BALANCE config
    const weaponColor = BALANCE.weapons[weapon.key].color;

    if (level === 2) {
      // ── Level 2 Visuals ──────────────────────────────────

      // Scale the weapon mesh up slightly
      weapon.mesh.scale.setScalar(1.12);

      // Glowing ring at base with weapon's theme color
      const ringGeo = new THREE.RingGeometry(0.75, 0.95, 32);
      const ringMat = new THREE.MeshLambertMaterial({
        color: weaponColor,
        emissive: weaponColor,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      ring.name = 'upgrade-visual';
      weapon.mesh.add(ring);

      // Subtle upward particles (small THREE.Points with 5 dots)
      const particleCount = 5;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.4 + Math.random() * 0.3;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = 0.5 + Math.random() * 1.5; // float upward
        positions[i * 3 + 2] = Math.sin(angle) * radius;
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: weaponColor,
        size: 0.12,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      particles.name = 'upgrade-visual';
      weapon.mesh.add(particles);

    } else if (level === 3) {
      // ── Level 3 Visuals ──────────────────────────────────

      // Scale the weapon mesh up more noticeably
      weapon.mesh.scale.setScalar(1.25);

      // Larger, brighter glowing ring at base
      const ringGeo = new THREE.RingGeometry(0.85, 1.1, 32);
      const ringMat = new THREE.MeshLambertMaterial({
        color: weaponColor,
        emissive: weaponColor,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      ring.name = 'upgrade-visual';
      weapon.mesh.add(ring);

      // Gold crown/spire on top of the tower
      const crownGeo = new THREE.ConeGeometry(0.15, 0.4, 6);
      const crownMat = new THREE.MeshLambertMaterial({
        color: 0xffd700,
        emissive: 0xcc8800,
        emissiveIntensity: 0.5,
      });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = 3.2;
      crown.name = 'upgrade-visual';
      weapon.mesh.add(crown);

      // Upward particles (6 dots, more spread out)
      const particleCount = 6;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const radius = 0.5 + Math.random() * 0.4;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = 0.8 + Math.random() * 2.0;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0xffd700,
        size: 0.15,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      particles.name = 'upgrade-visual';
      weapon.mesh.add(particles);

      // Add emissive tint to the main tower materials
      weapon.mesh.traverse((child) => {
        if (child.name === 'upgrade-visual') return;
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
          child.material.emissive = new THREE.Color(weaponColor);
          child.material.emissiveIntensity = 0.15;
        }
      });
    }
  }

  private showSpecDialog(weapon: Weapon): void {
    if (!this.towerSpecialization) return;
    const html = this.towerSpecialization.renderChoiceDialog(weapon.key);
    if (!html) return;

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    // Wire click handlers for spec cards
    const cards = container.querySelectorAll('.spec-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt((card as HTMLElement).dataset.specIndex!) as 0 | 1;
        this.towerSpecialization!.apply(weapon, idx);
        const spec = this.towerSpecialization!.getApplied(weapon);
        if (spec) {
          // Apply spec modifiers directly onto the tower
          if (weapon instanceof TowerWeapon) {
            weapon.specModifiers = spec.modifiers;
          }
          this.onSpecialized?.(weapon, spec.name);
        }
        container.remove();
        if (this.selectedTower === weapon) {
          this.updateTowerInfoPanel(weapon);
        }
      });
    });

    // Cancel button
    const cancelBtn = container.querySelector('#spec-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => container.remove());
    }

    // Close on overlay click
    const overlay = container.querySelector('#spec-dialog-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) container.remove();
      });
    }
  }

  private showSellConfirmation(weapon: Weapon): void {
    // Remove any existing dialog first
    this.hideSellConfirmation();

    const sellValue = weapon.getSellValue();

    const div = document.createElement('div');
    div.id = 'sell-confirm';
    div.innerHTML =
      `<div class="sc-text">Turm verkaufen f\u00FCr <span class="sc-gold">${sellValue}g</span>?</div>` +
      `<div class="sc-buttons">` +
        `<button class="sc-btn sc-btn-yes">Ja</button>` +
        `<button class="sc-btn sc-btn-no">Nein</button>` +
      `</div>`;

    // Position near the tower info panel (bottom-left area)
    const tiPanel = this.towerInfoPanel;
    const tiRect = tiPanel.getBoundingClientRect();
    div.style.left = `${tiRect.left}px`;
    div.style.top = `${tiRect.top - 80}px`;

    document.body.appendChild(div);
    this.sellConfirmDiv = div;

    // "Ja" button => actually sell
    div.querySelector('.sc-btn-yes')!.addEventListener('click', () => {
      this.hideSellConfirmation();
      this.sellTower();
    });

    // "Nein" button => cancel
    div.querySelector('.sc-btn-no')!.addEventListener('click', () => {
      this.hideSellConfirmation();
    });

    // Auto-close after 5 seconds
    this.sellConfirmTimer = setTimeout(() => {
      this.hideSellConfirmation();
    }, 5000);
  }

  private hideSellConfirmation(): void {
    if (this.sellConfirmTimer !== null) {
      clearTimeout(this.sellConfirmTimer);
      this.sellConfirmTimer = null;
    }
    if (this.sellConfirmDiv) {
      this.sellConfirmDiv.remove();
      this.sellConfirmDiv = null;
    }
  }

  private sellTower(): void {
    if (!this.selectedTower) return;

    const weapon = this.selectedTower;
    const sellValue = weapon.getSellValue();

    // Clear hover reference if selling the hovered tower
    if (this.hoveredTower === weapon) this.hoveredTower = null;

    // Give gold back
    this.economy.earn(sellValue);

    // Remove specialization tracking and clear modifiers
    this.towerSpecialization?.remove(weapon);
    if (weapon instanceof TowerWeapon) {
      weapon.specModifiers = null;
    }

    // Remove from scene
    this.scene.remove(weapon.mesh);

    // Free the grid cell
    this.gameMap.removePlacement(weapon.gridX, weapon.gridZ, weapon.isPath);

    // Remove from placed weapons array
    this.placedWeapons = this.placedWeapons.filter(w => w !== weapon);

    // Deselect
    this.deselectTower();
  }

  getPlacedWeapons(): Weapon[] {
    return this.placedWeapons;
  }

  /** Whether a weapon is selected for placement or a tower is selected for info */
  hasActiveSelection(): boolean {
    return this.selectedWeapon !== null || this.selectedTower !== null;
  }

  updateAffordability(): void {
    const slots = document.querySelectorAll('.weapon-slot');
    slots.forEach(slot => {
      const key = (slot as HTMLElement).dataset.weapon as WeaponKey;
      if (key) {
        const config = BALANCE.weapons[key];
        slot.classList.toggle('too-expensive', !this.economy.canAfford(config.cost));
      }
    });

    // Refresh tower info panel affordability
    if (this.selectedTower) {
      this.updateTowerInfoPanel(this.selectedTower);
    }
  }

  // Remove exploded landmines and frost mines
  cleanupExplodedTraps(): void {
    this.placedWeapons = this.placedWeapons.filter(w => {
      if (w.key === 'landmine' && (w as Landmine).isExploded()) {
        this.scene.remove(w.mesh);
        this.gameMap.removePlacement(w.gridX, w.gridZ, true);
        return false;
      }
      if (w.key === 'frostMine' && (w as FrostMine).isExploded()) {
        this.scene.remove(w.mesh);
        this.gameMap.removePlacement(w.gridX, w.gridZ, true);
        return false;
      }
      return true;
    });
  }

  // ── Undo Placement ─────────────────────────────
  private startUndoWindow(weapon: Weapon, key: WeaponKey, gx: number, gz: number, cost: number): void {
    // Clear any previous undo state
    this.clearUndo();

    this.undoState = { weapon, key, gx, gz, cost };

    // Create undo button
    const btn = document.createElement('button');
    btn.id = 'undo-placement-btn';
    btn.textContent = '\u21A9 R\u00FCckg\u00E4ngig (Z)';
    btn.addEventListener('click', () => this.executeUndo());
    document.body.appendChild(btn);
    this.undoBtn = btn;

    // Fade in
    requestAnimationFrame(() => {
      btn.classList.add('visible');
    });

    // Start fade-out at 4.5 seconds (the CSS transition takes 0.5s)
    this.undoFadeTimer = setTimeout(() => {
      if (this.undoBtn) {
        this.undoBtn.classList.remove('visible');
        this.undoBtn.classList.add('fade-out');
      }
    }, 4500);

    // Remove entirely at 5 seconds
    this.undoTimer = setTimeout(() => {
      this.clearUndo();
    }, 5000);
  }

  private executeUndo(): void {
    if (!this.undoState) return;

    const { weapon, cost } = this.undoState;

    // If this weapon is currently selected in the tower info panel, deselect it
    if (this.selectedTower === weapon) {
      this.deselectTower();
    }

    // If this weapon is hovered, clear hover reference
    if (this.hoveredTower === weapon) {
      this.hoveredTower = null;
    }

    // Remove specialization tracking
    this.towerSpecialization?.remove(weapon);
    if (weapon instanceof TowerWeapon) {
      weapon.specModifiers = null;
    }

    // Remove from scene
    this.scene.remove(weapon.mesh);

    // Free the grid cell
    this.gameMap.removePlacement(weapon.gridX, weapon.gridZ, weapon.isPath);

    // Remove from placed weapons array
    this.placedWeapons = this.placedWeapons.filter(w => w !== weapon);

    // Full refund
    this.economy.earn(cost);

    // Clear undo state and button
    this.clearUndo();
  }

  private clearUndo(): void {
    this.undoState = null;
    if (this.undoTimer !== null) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    if (this.undoFadeTimer !== null) {
      clearTimeout(this.undoFadeTimer);
      this.undoFadeTimer = null;
    }
    if (this.undoBtn) {
      this.undoBtn.remove();
      this.undoBtn = null;
    }
  }

  // ── Auto-Upgrade ─────────────────────────────────
  toggleAutoUpgrade(): boolean {
    this.autoUpgradeEnabled = !this.autoUpgradeEnabled;
    return this.autoUpgradeEnabled;
  }

  isAutoUpgradeEnabled(): boolean {
    return this.autoUpgradeEnabled;
  }

  setAutoUpgradeEnabled(enabled: boolean): void {
    this.autoUpgradeEnabled = enabled;
  }

  /**
   * Attempts to auto-upgrade the cheapest upgradeable tower.
   * Called from the Game update loop between waves.
   * Returns true if an upgrade was performed.
   */
  tryAutoUpgrade(): boolean {
    // Only between waves
    if (this.waveActive) return false;
    if (!this.autoUpgradeEnabled) return false;

    // Small frame delay between auto-upgrades for visual feedback
    if (this.autoUpgradeFrameDelay > 0) {
      this.autoUpgradeFrameDelay--;
      return false;
    }

    // Find all upgradeable towers and sort by upgrade cost (cheapest first)
    const upgradeable = this.placedWeapons
      .filter(w => w.canUpgrade() && this.economy.canAfford(w.getUpgradeCost()))
      .sort((a, b) => a.getUpgradeCost() - b.getUpgradeCost());

    if (upgradeable.length === 0) return false;

    const weapon = upgradeable[0];
    const cost = weapon.getUpgradeCost();

    // Spend gold and upgrade
    this.economy.spend(cost);
    weapon.upgrade();

    // Track achievement: tower upgraded
    AchievementSystem.getInstance().trackTowerUpgraded(weapon.level);

    // Add upgrade visuals
    this.addUpgradeVisuals(weapon, weapon.level);

    // Fire upgrade callback
    if (this.onTowerUpgrade) {
      this.onTowerUpgrade(weapon.key, weapon.level);
    }

    // If this tower is currently selected, refresh the info panel
    if (this.selectedTower === weapon) {
      this.updateTowerInfoPanel(weapon);
      if (weapon instanceof TowerWeapon) {
        this.showRangeIndicator(weapon);
      }
    }

    // Check for specialization at level 3
    if (weapon.level === 3 && this.towerSpecialization) {
      if (this.towerSpecialization.canSpecialize(weapon)) {
        this.showSpecDialog(weapon);
      }
    }

    // Delay next auto-upgrade by ~15 frames (~250ms at 60fps) for visual feedback
    this.autoUpgradeFrameDelay = 15;

    return true;
  }

  reset(): void {
    this.hideSellConfirmation();
    this.clearUndo();
    this.removeGhost();
    this.hideAllRanges();
    this.disposeGridHighlight();
    for (const weapon of this.placedWeapons) {
      this.scene.remove(weapon.mesh);
    }
    this.placedWeapons = [];
    this.selectedWeapon = null;
    this.hoveredTower = null;
    this.deselectTower();

    // Remove old scene objects to prevent leaks
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
    }
    if (this.rangeMesh) {
      this.scene.remove(this.rangeMesh);
      this.rangeMesh = null;
    }
    if (this.selectionRing) {
      this.scene.remove(this.selectionRing);
      this.selectionRing = null;
    }
    if (this.rangeRingMesh) {
      this.scene.remove(this.rangeRingMesh);
      this.rangeRingMesh = null;
    }
    if (this.rangeFillMesh) {
      this.scene.remove(this.rangeFillMesh);
      this.rangeFillMesh = null;
    }
  }
}
