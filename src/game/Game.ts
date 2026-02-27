import * as THREE from 'three';
import { SceneManager } from '../scene/SceneManager';
import { CameraController } from '../scene/CameraController';
import { GameMap } from '../map/GameMap';
import { TerrainRenderer } from '../map/TerrainRenderer';
import { Enemy } from '../enemies/Enemy';
import { ZombieFactory } from '../enemies/ZombieFactory';
import { WaveManager } from '../enemies/WaveManager';

import { EconomySystem } from '../systems/EconomySystem';
import { PlacementSystem } from '../weapons/PlacementSystem';
import { ProjectileSystem } from '../weapons/ProjectileSystem';
import { SynergySystem } from '../systems/SynergySystem';
import { InputManager } from './InputManager';
import { Projectile, TowerWeapon } from '../weapons/Weapon';
import { LEVELS, LevelDef, GameMode } from '../systems/LevelConfig';
import { RunManager } from '../systems/RunManager';
import { DamageNumberSystem } from '../ui/DamageNumbers';
import { StatsTracker } from '../systems/StatsTracker';
import { StagePathScreen } from '../ui/StagePathScreen';
import { BaseHubScreen } from '../ui/BaseHubScreen';
import { BackpackManager, ChestReward } from '../systems/BackpackManager';
import { BALANCE } from '../systems/BalanceConfig';
import { HealTower } from '../weapons/towers/HealTower';
import { GoldMine } from '../weapons/traps/GoldMine';
import { BaseHub3D } from '../ui/BaseHub3D';
import { Spielanleitung } from '../ui/Spielanleitung';
import { SettingsMenu } from '../ui/SettingsMenu';
import { ActiveSkillSystem, SKILL_DEFS } from '../systems/ActiveSkills';
import { ParticleSystem } from '../systems/ParticleSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { LootEffects } from '../systems/LootEffects';
import { Minimap } from '../ui/Minimap';
import { AchievementSystem } from '../systems/AchievementSystem';
import { PersistentStats } from '../systems/PersistentStats';
import { TowerSpecialization } from '../systems/TowerSpecialization';
import { EndlessMode } from '../systems/EndlessMode';
import { DailyChallenge, DailyChallengeFlags } from '../systems/DailyChallenge';
import { SaveSystem } from '../systems/SaveSystem';
import { GameController, ModeStats } from './GameController';
import { AutoBattleController } from '../autobattle/AutoBattleController';
import { ArenaController } from '../arena/ArenaController';
import { EnemyTooltip } from '../ui/EnemyTooltip';
import { DifficultyScaling } from '../systems/DifficultyScaling';
import { Tutorial } from '../ui/Tutorial';
import { GameAnnouncements } from '../ui/GameAnnouncements';
import { ResourcePopups } from '../ui/ResourcePopups';
import { buildPostGameStatsHtml, animatePostGameStats, findTopKiller, LevelStats } from '../ui/PostGameStats';
import { HudTooltip } from '../ui/HudTooltip';
import { HighScoreSystem, HighScoreStats } from '../systems/HighScoreSystem';

const MODE_NAMES: Record<GameMode, string> = {
  tower_defense: 'Tower Defense',
  auto_battle: 'Auto-Battle',
  arena: 'Arena',
  survival: 'Survival',
  auto_battle_tft: 'Auto-Kampf',
  arena_turnbased: 'Arena-Kampf',
};

export class Game {
  private sceneManager: SceneManager;
  private cameraController: CameraController;
  private gameMap!: GameMap;
  private economy!: EconomySystem;
  private waveManager!: WaveManager;
  private placementSystem!: PlacementSystem;
  private projectileSystem!: ProjectileSystem;
  private synergySystem!: SynergySystem;
  private inputManager: InputManager;
  private runManager: RunManager;
  private damageNumbers: DamageNumberSystem;
  private statsTracker: StatsTracker;
  private stagePathScreen: StagePathScreen;
  private baseHubScreen: BaseHubScreen;
  private backpackManager: BackpackManager;
  private spielanleitung: Spielanleitung;
  private settingsMenu: SettingsMenu;
  private hub3D: BaseHub3D | null = null;
  private hubRenderLoop: number | null = null;
  private tutorial: Tutorial;

  // ─── New systems ───────────────────────────────
  private activeSkills: ActiveSkillSystem;
  private particleSystem!: ParticleSystem;
  private weatherSystem: WeatherSystem | null = null;
  private terrainRenderer: TerrainRenderer | null = null;
  private soundSystem: SoundSystem;
  private animationSystem!: AnimationSystem;
  private lootEffects!: LootEffects;
  private minimap: Minimap;
  private achievements: AchievementSystem;
  private persistentStats: PersistentStats;
  private highScoreSystem: HighScoreSystem;
  private waveDamageTaken = 0; // track damage per wave for achievements
  private levelDamageTaken = 0; // track damage per level for achievements
  // Reward breakdown trackers (reset per level)
  private totalInterestEarned = 0;
  private totalComboGold = 0;
  private perfectWaveCount = 0;
  private totalEnemyGold = 0;
  // Post-game statistics trackers (reset per level)
  private levelGoldSpent = 0;
  private levelGoldEarned = 0;
  private levelTowersPlaced = 0;
  private levelTowersUpgraded = 0;
  private levelStartTime = 0;
  private towerSpecialization: TowerSpecialization;
  private endlessMode: EndlessMode;
  private dailyChallenge: DailyChallenge;
  private saveSystem: SaveSystem;
  private activeController: GameController | null = null;
  private isEndlessRun = false;
  private isDailyChallengeRun = false;
  private dailyChallengeFlags: DailyChallengeFlags | null = null;
  private difficultyScaling: DifficultyScaling;
  private difficultyLabel: HTMLElement;
  private announcements!: GameAnnouncements;
  private resourcePopups!: ResourcePopups;
  private hudTooltip: HudTooltip;

  // HP threshold flags for announcements (reset per level)
  private announcedDanger = false;
  private announcedCritical = false;
  // Boss announcement tracking (reset per wave)
  private announcedBoss = false;

  // Boss slam tower debuff tracking
  private towerDebuffs: { pos: THREE.Vector3; radius: number; timer: number; fireRateReduction: number }[] = [];

  private currentLevel: LevelDef;
  private currentLevelIndex = 0;
  private currentGameMode: GameMode = 'tower_defense';
  private static readonly PROGRESS_KEY = 'ztd_level_progress';

  private baseHP!: number;
  private maxBaseHP!: number;
  private lastTime = 0;
  private running = false;
  private gameSpeed = 1;
  private speedBtn: HTMLButtonElement;

  // Auto-wave
  private autoWave = false;
  private autoWaveDelay = 5;
  private autoWaveTimer = 0;
  private autoWaveBtn: HTMLButtonElement;
  private autoWaveCountdown = 0;
  private autoWaveInterval: ReturnType<typeof setInterval> | null = null;
  private autoWaveCountdownEl!: HTMLElement;

  // Auto-upgrade
  private autoUpgradeBtn!: HTMLButtonElement;

  // Camera follow
  private cameraFollowBtn: HTMLButtonElement;

  // Boss HP bar
  private bossHpContainer: HTMLElement;
  private bossHpBar: HTMLElement;
  private bossHpText: HTMLElement;
  private bossHpName: HTMLElement;
  private lastBossHp = -1;
  private bossBarVisible = false;

  // Mode banner
  private modeBanner: HTMLElement;

  // Wave preview panel
  private wavePreviewPanel: HTMLElement;
  private wavePreviewLastKey = '';

  // Wave composition announcement
  private waveCompositionEl: HTMLElement;
  private waveCompositionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Interest preview
  private interestPreview: HTMLElement;

  // UI elements
  private hpBar: HTMLElement;
  private hpText: HTMLElement;
  private gameOverScreen: HTMLElement;
  private gameOverTitle: HTMLElement;
  private gameOverStats: HTMLElement;
  private restartBtn: HTMLElement;

  // Track previous enemy HP for damage numbers
  private prevEnemyHp = new Map<object, number>();

  // Final boss phase tracking
  private bossPhaseIndex = 0;
  private lastWaveForPhase = 0;

  // Arena mode: tower placement count
  private towersPlacedThisLevel = 0;
  private maxTowersForLevel = Infinity;

  // Perfekte Welle banner
  private perfekteWelleBanner: HTMLElement;

  // Screen vignette overlay
  private screenVignette: HTMLElement;

  // Wave progress bar
  private waveProgressContainer: HTMLElement;
  private waveProgressBar: HTMLElement;
  private waveProgressText: HTMLElement;

  // Enemy tooltip on hover
  private enemyTooltip!: EnemyTooltip;
  private enemyTooltipRaycaster = new THREE.Raycaster();

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    // Core systems
    this.sceneManager = new SceneManager(canvas);
    this.cameraController = new CameraController(this.sceneManager.camera);
    this.inputManager = new InputManager();
    this.runManager = new RunManager();
    this.damageNumbers = new DamageNumberSystem(this.sceneManager.camera);
    this.statsTracker = new StatsTracker();
    this.backpackManager = new BackpackManager();
    this.stagePathScreen = new StagePathScreen();
    this.baseHubScreen = new BaseHubScreen(this.backpackManager);
    this.currentLevelIndex = this.loadProgress();
    this.currentLevel = LEVELS[Math.min(this.currentLevelIndex, LEVELS.length - 1)];

    // ─── New systems init ─────────────────────────
    this.activeSkills = new ActiveSkillSystem();
    this.soundSystem = SoundSystem.getInstance();
    this.minimap = new Minimap();
    this.achievements = AchievementSystem.getInstance();
    this.persistentStats = PersistentStats.getInstance();
    this.highScoreSystem = HighScoreSystem.getInstance();
    this.towerSpecialization = new TowerSpecialization();
    this.endlessMode = new EndlessMode();
    this.dailyChallenge = new DailyChallenge();
    this.saveSystem = SaveSystem.getInstance();
    this.difficultyScaling = new DifficultyScaling();
    this.announcements = new GameAnnouncements();
    this.resourcePopups = new ResourcePopups();

    // Connect achievement crystal rewards to backpack
    this.achievements.onCrystalReward = (amount) => {
      this.backpackManager.earnCrystals(amount);
      this.resourcePopups.showCrystals(amount);
    };

    // Combo bonus gives gold and shows gold popup
    this.statsTracker.onComboBonus = (gold, label) => {
      this.totalComboGold += gold;
      if (this.economy) this.economy.earn(gold);
      this.achievements.trackCombo(this.statsTracker.getComboCount());
    };
    // Combo milestone visual feedback (floating gold banner)
    this.statsTracker.onComboMilestone = (gold, label) => {
      this.showComboGoldBanner(gold, label);
    };

    // UI refs
    this.hpBar = document.getElementById('base-hp-bar')!;
    this.hpText = document.getElementById('base-hp-text')!;
    this.gameOverScreen = document.getElementById('game-over-screen')!;
    this.gameOverTitle = document.getElementById('game-over-title')!;
    this.gameOverStats = document.getElementById('game-over-stats')!;
    this.restartBtn = document.getElementById('restart-btn')!;
    this.speedBtn = document.getElementById('speed-btn') as HTMLButtonElement;
    this.autoWaveBtn = document.getElementById('auto-wave-btn') as HTMLButtonElement;
    this.autoUpgradeBtn = document.getElementById('auto-upgrade-btn') as HTMLButtonElement;
    this.autoWaveCountdownEl = document.getElementById('auto-wave-countdown')!;
    this.bossHpContainer = document.getElementById('boss-hp-container')!;
    this.bossHpBar = document.getElementById('boss-hp-bar-inner')!;
    this.bossHpText = document.getElementById('boss-hp-text')!;
    this.bossHpName = document.getElementById('boss-hp-name')!;
    this.interestPreview = document.getElementById('interest-preview')!;
    this.modeBanner = document.getElementById('mode-banner')!;
    this.wavePreviewPanel = document.getElementById('wave-preview-panel')!;
    this.waveCompositionEl = document.getElementById('wave-composition')!;
    this.perfekteWelleBanner = document.getElementById('perfekte-welle-banner')!;
    this.screenVignette = document.getElementById('screen-vignette')!;
    this.difficultyLabel = document.getElementById('difficulty-label')!;
    this.waveProgressContainer = document.getElementById('wave-progress-container')!;
    this.waveProgressBar = document.getElementById('wave-progress-bar')!;
    this.waveProgressText = document.getElementById('wave-progress-text')!;

    this.cameraFollowBtn = document.getElementById('camera-follow-btn') as HTMLButtonElement;

    this.restartBtn.addEventListener('click', () => this.restart());
    this.speedBtn.addEventListener('click', () => this.cycleSpeed());
    this.autoWaveBtn.addEventListener('click', () => this.toggleAutoWave());
    this.autoUpgradeBtn.addEventListener('click', () => this.toggleAutoUpgrade());
    this.cameraFollowBtn.addEventListener('click', () => this.toggleCameraFollow());

    // In-game restart button with confirmation dialog
    const restartLevelBtn = document.getElementById('restart-level-btn');
    if (restartLevelBtn) {
      restartLevelBtn.addEventListener('click', () => this.showRestartConfirmation());
    }
    document.getElementById('restart-confirm-yes')?.addEventListener('click', () => {
      this.hideRestartConfirmation();
      this.retryLevel();
    });
    document.getElementById('restart-confirm-no')?.addEventListener('click', () => {
      this.hideRestartConfirmation();
    });
    document.getElementById('restart-confirm-backdrop')?.addEventListener('click', () => {
      this.hideRestartConfirmation();
    });

    // Load auto-wave preference from localStorage
    if (localStorage.getItem('ztd_autowave') === 'true') {
      this.autoWave = true;
      this.autoWaveBtn.classList.add('active');
      this.autoWaveBtn.textContent = 'Auto: An';
    }

    // Load auto-upgrade preference from localStorage
    if (localStorage.getItem('ztd_autoupgrade') === 'true') {
      this.autoUpgradeBtn.classList.add('active');
      this.autoUpgradeBtn.textContent = 'Aufwertung: An';
    }

    // Spielanleitung
    this.spielanleitung = new Spielanleitung();

    // Tutorial (first-time player guide)
    this.tutorial = new Tutorial();

    // Settings menu
    this.settingsMenu = SettingsMenu.getInstance();
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.settingsMenu.toggle());
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        this.spielanleitung.toggle();
      }
      // Space key: start next wave (only when running and no wave active)
      if (e.key === ' ' && this.running && this.waveManager && !this.waveManager.isWaveActive()) {
        e.preventDefault();
        this.clearAutoWaveCountdown();
        this.waveManager.startNextWave();
      }
      // Active skills: keys 1, 2, 3
      if (this.running && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const idx = parseInt(e.key) - 1;
        const mouseWorld = this.getMouseWorldPosition();
        if (this.activeSkills.activate(idx, mouseWorld)) {
          this.soundSystem.play('skill_activate');
        }
      }
      // R key: show all tower ranges overlay (during gameplay)
      //         OR quick-restart on game-over/victory screen
      if (e.key === 'r' || e.key === 'R') {
        if (this.running && this.placementSystem) {
          this.placementSystem.showAllRanges();
        } else if (!this.running && this.gameOverScreen.classList.contains('visible')) {
          // Quick restart: retry the same level from the end screen
          this.cleanupEndScreenExtras();
          this.retryLevel();
        }
      }
      // A key: toggle auto-upgrade
      if ((e.key === 'a' || e.key === 'A') && this.running) {
        this.toggleAutoUpgrade();
      }
      // Escape key: close restart confirmation dialog
      if (e.key === 'Escape') {
        this.hideRestartConfirmation();
      }
    });
    window.addEventListener('keyup', (e) => {
      // R key released: hide all tower ranges overlay
      if ((e.key === 'r' || e.key === 'R') && this.placementSystem) {
        this.placementSystem.hideAllRanges();
      }
    });
    // Close button handlers
    setTimeout(() => {
      document.getElementById('anleitung-close')?.addEventListener('click', () => this.spielanleitung.hide());
      document.getElementById('anleitung-close-bottom')?.addEventListener('click', () => this.spielanleitung.hide());
    }, 100);

    // Connect daily challenge callback
    this.baseHubScreen.onDailyChallengeStart = () => {
      this.startDailyChallenge();
    };

    // Connect endless mode callback
    this.stagePathScreen.onEndlessSelect = () => {
      this.startEndlessMode();
    };

    // Enemy hover tooltip
    this.enemyTooltip = new EnemyTooltip();
    const gameCanvas = document.getElementById('game-canvas')!;
    gameCanvas.addEventListener('mousemove', (e) => {
      this.handleEnemyHover(e.clientX, e.clientY);
    });

    // ─── HUD Tooltips ──────────────────────────────────
    this.hudTooltip = new HudTooltip();
    this.registerHudTooltips();

    // Show base hub on first load
    this.showBaseHub();
  }

  private showBaseHub(): void {
    this.running = false;

    // Hide game UI elements
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = 'none';

    // Set up 3D hub scene
    this.sceneManager.scene.background = new THREE.Color(0x0a0a1a);
    this.sceneManager.scene.fog = new THREE.FogExp2(0x111122, 0.025);

    // Position camera for hub view
    this.sceneManager.camera.position.set(0, 18, 18);
    this.sceneManager.camera.lookAt(0, 0, 0);

    // Create 3D hub
    if (this.hub3D) this.hub3D.remove();
    this.hub3D = new BaseHub3D(this.sceneManager.scene, this.sceneManager.camera);
    this.hub3D.startAnimation();

    // Connect station clicks to panels
    this.hub3D.onStationClick = (station) => {
      if (station === 'portal') {
        this.baseHubScreen.startExpedition();
      } else {
        this.baseHubScreen.showPanel(station);
      }
    };

    // Show hub overlay (header + panel system)
    this.baseHubScreen.show(() => {
      this.cleanupHub();
      this.showStagePath();
    });

    // Start hub render loop
    this.startHubRenderLoop();
  }

  private startHubRenderLoop(): void {
    if (this.hubRenderLoop !== null) return;
    const renderHub = () => {
      this.hubRenderLoop = requestAnimationFrame(renderHub);
      this.sceneManager.render();
    };
    renderHub();
  }

  private stopHubRenderLoop(): void {
    if (this.hubRenderLoop !== null) {
      cancelAnimationFrame(this.hubRenderLoop);
      this.hubRenderLoop = null;
    }
  }

  private cleanupHub(): void {
    this.stopHubRenderLoop();
    if (this.hub3D) {
      this.hub3D.remove();
      this.hub3D = null;
    }
    // Restore game UI
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = '';
  }

  private showStagePath(): void {
    this.running = false;
    // Hide game UI during stage path
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = 'none';

    this.stagePathScreen.show(this.currentLevelIndex, (levelIndex) => {
      this.currentLevelIndex = levelIndex;
      this.currentLevel = LEVELS[levelIndex];
      const mode = this.currentLevel.gameMode || 'tower_defense';

      // Route to appropriate game controller based on mode
      if (mode === 'auto_battle_tft') {
        this.startModeController(new AutoBattleController());
        return;
      }
      if (mode === 'arena_turnbased') {
        this.startModeController(new ArenaController());
        return;
      }

      // Default: Tower Defense (existing logic)
      const ui = document.getElementById('game-ui');
      if (ui) ui.style.display = '';
      this.initLevel(this.currentLevel);
      this.start();
    });
  }

  private initLevel(level: LevelDef): void {
    // Reset screen vignette
    this.screenVignette.classList.remove('danger', 'critical', 'boss-active');

    // Determine game mode
    this.currentGameMode = level.gameMode || 'tower_defense';

    // Final boss: start at first phase
    if (level.isFinalBoss && level.bossPhases) {
      this.bossPhaseIndex = 0;
      this.lastWaveForPhase = 0;
      this.currentGameMode = level.bossPhases[0];
    }

    // Dynamic difficulty: notify level change
    this.difficultyScaling.onLevelChange(this.currentLevelIndex);

    // Arena mode limits
    this.maxTowersForLevel = level.maxTowers ?? Infinity;
    this.towersPlacedThisLevel = 0;

    // Clear old scene objects (keep lights and camera)
    const toRemove: THREE.Object3D[] = [];
    this.sceneManager.scene.traverse(obj => {
      if (obj instanceof THREE.Group && obj.name === 'terrain') {
        toRemove.push(obj);
      }
    });
    toRemove.forEach(obj => this.sceneManager.scene.remove(obj));

    // Apply run modifiers
    const modifiers = this.runManager.getModifiers();

    // Apply permanent upgrades from BackpackManager
    modifiers.damageMult *= this.backpackManager.getPermanentBonus('towerDamage');
    modifiers.goldMult *= this.backpackManager.getPermanentBonus('goldBonus');
    modifiers.fireRateMult *= this.backpackManager.getPermanentBonus('fireRate');
    modifiers.rangeMult *= this.backpackManager.getPermanentBonus('range');

    // Map
    this.gameMap = new GameMap(level);

    // Apply theme to scene
    this.sceneManager.scene.background = new THREE.Color(level.theme.skyColor);
    this.sceneManager.scene.fog = new THREE.FogExp2(level.theme.fogColor, level.theme.fogDensity);

    this.terrainRenderer = new TerrainRenderer(this.sceneManager.scene, this.gameMap, level.theme);

    // Weather / atmospheric particles
    if (this.weatherSystem) this.weatherSystem.cleanup();
    this.weatherSystem = new WeatherSystem(this.sceneManager.scene, level.theme.name);

    // Economy (add permanent Startkapital bonus)
    const permStartGold = this.backpackManager.getPermanentBonus('startGold');
    const startGold = Math.floor((level.startGold + permStartGold) * modifiers.goldMult);
    if (this.economy) {
      this.economy.reset(startGold);
    } else {
      this.economy = new EconomySystem(startGold);
    }
    // Track gold for achievements + show HUD popup
    this.economy.onGoldEarned = (amount: number) => {
      this.achievements.trackGoldEarned(amount);
      this.resourcePopups.showGold(amount);
      this.levelGoldEarned += amount;
    };
    // Track gold spent for post-game statistics
    this.economy.onGoldSpent = (amount: number) => {
      this.levelGoldSpent += amount;
    };

    // Apply dynamic difficulty scaling to enemy HP
    modifiers.enemyHpMult *= this.difficultyScaling.getMultiplier();

    // Enemies
    const factory = new ZombieFactory(this.gameMap.pathSystem);
    this.waveManager = new WaveManager(
      this.sceneManager.scene, factory, this.economy, level.waves, modifiers
    );

    // Connect boss slam debuff callback
    this.towerDebuffs = [];
    this.waveManager.getBossAbilities().onDebuffTowers = (pos, radius, duration, fireRateReduction) => {
      this.towerDebuffs.push({ pos: pos.clone(), radius, timer: duration, fireRateReduction });
      this.cameraController.shake(0.5, 0.6); // Boss slam shakes the screen
    };

    // Weapons
    if (this.placementSystem) {
      this.placementSystem.reset();
    }
    this.placementSystem = new PlacementSystem(
      this.sceneManager.scene,
      this.gameMap,
      this.economy,
      this.sceneManager.camera,
      this.cameraController
    );
    this.projectileSystem = new ProjectileSystem(this.sceneManager.scene);
    if (this.synergySystem) this.synergySystem.reset();
    this.synergySystem = new SynergySystem(this.sceneManager.scene);
    this.placementSystem.synergySystem = this.synergySystem;
    this.placementSystem.backpackManager = this.backpackManager;
    this.placementSystem.towerSpecialization = this.towerSpecialization;
    this.placementSystem.onSpecialized = (_weapon, specName) => {
      this.soundSystem.play('skill_activate');
      this.showDropBanner(`Spezialisierung: ${specName}`);
    };
    this.placementSystem.onTowerUpgrade = (weaponKey, newLevel) => {
      this.levelTowersUpgraded++;
      if (newLevel === 3) {
        const name = BALANCE.weapons[weaponKey].name;
        this.announcements.towerMaxed(name);
      }
    };
    this.placementSystem.onWeaponPlaced = (_weaponKey) => {
      this.levelTowersPlaced++;
    };
    // Restore auto-upgrade preference
    if (localStorage.getItem('ztd_autoupgrade') === 'true') {
      this.placementSystem.setAutoUpgradeEnabled(true);
    }
    this.synergySystem.onNewSynergy = (name) => {
      this.announcements.synergyFormed(name);
    };
    this.towerSpecialization.reset();
    this.placementSystem.rebuildUI();

    // ─── New systems per-level init ──────────────
    this.particleSystem = new ParticleSystem(this.sceneManager.scene);
    this.lootEffects = new LootEffects(this.sceneManager.scene);
    this.animationSystem = new AnimationSystem(this.sceneManager.scene);
    this.activeSkills.setScene(this.sceneManager.scene);
    this.waveDamageTaken = 0;
    this.levelDamageTaken = 0;
    // Reset HP threshold flags for announcements
    this.announcedDanger = false;
    this.announcedCritical = false;
    this.announcedBoss = false;
    // Reset reward breakdown trackers
    this.totalInterestEarned = 0;
    this.totalComboGold = 0;
    this.perfectWaveCount = 0;
    this.totalEnemyGold = 0;
    // Reset post-game statistics trackers
    this.levelGoldSpent = 0;
    this.levelGoldEarned = 0;
    this.levelTowersPlaced = 0;
    this.levelTowersUpgraded = 0;
    this.levelStartTime = performance.now();

    // Connect active skill callbacks
    this.activeSkills.onDamageArea = (pos, radius, damage) => {
      const enemies = this.waveManager.getEnemies();
      for (const e of enemies) {
        if (!e.alive) continue;
        const dist = e.getPosition().distanceTo(pos);
        if (dist <= radius) {
          e.takeDamage(damage);
        }
      }
      this.particleSystem.emit('explosion', pos);
      this.soundSystem.play('explosion');
    };
    this.activeSkills.onSlowAll = (speedFactor, duration) => {
      const enemies = this.waveManager.getEnemies();
      for (const e of enemies) {
        if (e.alive) e.applySlow(speedFactor, duration);
      }
    };
    this.activeSkills.onHealBase = (amount) => {
      this.baseHP = Math.min(this.maxBaseHP, this.baseHP + amount);
      this.updateHpDisplay();
      this.soundSystem.play('wave_complete', 0.5);
    };
    this.activeSkills.onBuffTowers = (_active, _mult) => {
      // buff is read directly from activeSkills.towerBuffActive in update
    };

    // Start level music
    const musicMoods: Record<number, string> = {
      1: 'calm', 2: 'desert', 3: 'tense', 4: 'dark',
      5: 'dark', 6: 'dark', 7: 'dark',
    };
    this.soundSystem.startMusic(musicMoods[level.id] || 'calm');

    // Track persistent stats
    this.persistentStats.increment('gamesPlayed');

    // Show minimap
    this.minimap.show();

    // Base HP (add permanent Basisfestung bonus)
    const permBaseHP = this.backpackManager.getPermanentBonus('baseHP');
    this.maxBaseHP = Math.floor((level.baseHP + permBaseHP) * modifiers.hpMult);
    this.baseHP = this.maxBaseHP;

    // Reset base damage visuals for new level
    if (this.terrainRenderer) this.terrainRenderer.resetBaseDamage();

    // Event handlers
    this.waveManager.onEnemyReachEnd = (damage) => this.damageBase(damage);
    this.waveManager.onAllWavesComplete = () => this.victory();
    this.waveManager.onEnemyKilled = (enemy, goldReward) => {
      this.statsTracker.registerKill(enemy.type === 'boss');
      // Attribute DoT kills to the weapon that applied the DoT (last damaging weapon)
      if (!enemy.killAttributed && enemy.lastDamagedByWeapon) {
        enemy.lastDamagedByWeapon.kills++;
        enemy.killAttributed = true;
      }
      // Boss kills earn extra crystals (apply Kristallfinder bonus) + big screen shake
      if (enemy.type === 'boss') {
        const crystalAmount = Math.floor(50 * this.backpackManager.getPermanentBonus('crystalFind'));
        this.backpackManager.earnCrystals(crystalAmount);
        this.cameraController.shake(0.8, 0.8);
        // Show crystal popup at boss position
        const bossPos = enemy.getPosition();
        this.damageNumbers.spawn(bossPos.x, bossPos.y, bossPos.z, crystalAmount, 'crystal');
        this.showCrystalEarn(crystalAmount);
      }
      // Show gold popup at enemy death position
      if (goldReward > 0) {
        this.totalEnemyGold += goldReward;
        const pos = enemy.getPosition();
        this.damageNumbers.spawn(pos.x, pos.y, pos.z, goldReward, 'gold');
      }
      // Particle effect on death
      this.particleSystem.emit('death', enemy.getPosition(), BALANCE.zombies[enemy.type]?.color);
      this.soundSystem.play('enemy_death', 0.4);
      // Loot effects: gold coins + soul orb
      const deathPos = enemy.getPosition().clone();
      this.lootEffects.spawnCoins(deathPos, enemy.type === 'boss' ? 10 : 3);
      const soulColors: Record<string, number> = {
        normal: 0x44ff44, fast: 0xff4444, tank: 0x8844ff,
        boss: 0xffaa00, flyer: 0x44aaff, healer: 0x44ff88,
        splitter: 0xffaa44, mini_splitter: 0xffaa44,
      };
      this.lootEffects.spawnSoul(deathPos, soulColors[enemy.type] ?? 0x44ff44);
      // Achievements & persistent stats
      this.achievements.trackKill(enemy.type === 'boss');
      this.persistentStats.increment('totalKills');
      const typeKey = `${enemy.type}Kills` as any;
      if (typeKey in (this.persistentStats as any)) {
        this.persistentStats.increment(typeKey);
      }
    };
    this.waveManager.onWaveStart = () => {
      this.placementSystem.setWaveActive(true);
      this.soundSystem.play('wave_start');
      this.clearAutoWaveCountdown();
      this.waveDamageTaken = 0;
      this.announcedBoss = false;
      // Announce wave start
      this.announcements.waveStart(this.waveManager.getCurrentWave());
      // Hide wave hotkey hint during active wave
      const waveHint = document.getElementById('wave-hotkey-hint');
      if (waveHint) waveHint.style.display = 'none';
      // Show wave composition announcement
      this.showWaveComposition();
      // Final boss: check phase change
      if (this.currentLevel.isFinalBoss && this.currentLevel.bossPhases) {
        const wave = this.waveManager.getCurrentWave();
        const phasesCount = this.currentLevel.bossPhases.length;
        const wavesPerPhase = Math.max(1, Math.ceil(this.currentLevel.waves.length / phasesCount));
        const newPhaseIdx = Math.min(
          Math.floor((wave - 1) / wavesPerPhase),
          phasesCount - 1
        );
        if (newPhaseIdx !== this.bossPhaseIndex) {
          this.bossPhaseIndex = newPhaseIdx;
          this.currentGameMode = this.currentLevel.bossPhases[newPhaseIdx];
          this.showModeBanner();
        }
      }
    };
    this.waveManager.onWaveEnd = () => {
      this.placementSystem.setWaveActive(false);
      this.soundSystem.play('wave_complete');
      // Show wave hotkey hint between waves
      const waveHint = document.getElementById('wave-hotkey-hint');
      if (waveHint) waveHint.style.display = 'block';
      // Perfekte Welle! banner + bonus crystals on no damage taken
      if (this.waveDamageTaken === 0 && this.waveManager.getCurrentWave() > 0) {
        this.perfectWaveCount++;
        this.cameraController.shake(0.15, 0.3);
        this.showPerfekteWelle();
        // Award bonus crystals for perfect wave
        const bonusCrystals = Math.floor(5 * this.backpackManager.getPermanentBonus('crystalFind'));
        this.backpackManager.earnCrystals(bonusCrystals);
      }
      // Auto-battle: give bonus gold each wave
      if (this.currentGameMode === 'auto_battle') {
        this.economy.earn(25);
      }
      // Gold interest: reward saving gold between waves
      const interest = this.economy.calculateInterest(this.economy.getGold());
      if (interest > 0) {
        this.totalInterestEarned += interest;
        this.economy.earn(interest);
        this.showInterestPopup(interest);
        this.soundSystem.play('wave_complete', 0.3);
      }
      // Earn crystals for wave completion (apply Kristallfinder bonus)
      const waveCrystals = Math.floor(10 * this.backpackManager.getPermanentBonus('crystalFind'));
      this.backpackManager.earnCrystals(waveCrystals);
      this.showCrystalEarn(waveCrystals);
      // Random weapon drop chance (15% per wave)
      this.tryWeaponDrop();
      // Dynamic difficulty scaling
      this.difficultyScaling.onWaveComplete(this.waveDamageTaken > 0);
      // Achievements
      this.achievements.trackWaveComplete(this.waveDamageTaken);
      this.persistentStats.increment('totalWavesSurvived');
      // Auto-wave countdown: start countdown if auto-wave is enabled and more waves remain
      if (this.autoWave && this.waveManager.getCurrentWave() < this.currentLevel.waves.length) {
        this.startAutoWaveCountdown();
      }
    };

    // Clear damage number tracking
    this.prevEnemyHp.clear();
    this.damageNumbers.clear();
    this.resourcePopups.clear();

    this.updateHpDisplay();
    this.updateRelicsDisplay();

    // Update level display
    const levelNameEl = document.getElementById('level-name');
    if (levelNameEl) {
      levelNameEl.textContent = `Level ${level.id}: ${level.name}`;
    }
    const waveDisplay = document.getElementById('wave-display');
    if (waveDisplay) {
      waveDisplay.textContent = `0 / ${level.waves.length}`;
    }

    // Show mode banner
    this.showModeBanner();

    // Initial wave preview
    this.updateWavePreview();

    // Auto-battle mode: auto-start waves
    if (this.currentGameMode === 'auto_battle') {
      this.autoWave = true;
      this.autoWaveBtn.classList.add('active');
      this.autoWaveBtn.textContent = 'Auto: An';
    }

    // Survival mode banner
    if (this.currentGameMode === 'survival') {
      this.autoWave = true;
      this.autoWaveBtn.classList.add('active');
      this.autoWaveBtn.textContent = 'Auto: An';
    }

    // Show tutorial for first-time players on first level
    if (this.currentLevelIndex === 0 && this.tutorial.shouldShow()) {
      this.tutorial.start();
    }
  }

  private tryWeaponDrop(): void {
    if (Math.random() > 0.15) return; // 15% chance
    const weapon = this.backpackManager.getRandomUnequippedWeapon();
    if (!weapon) return;
    if (!this.backpackManager.addDrop(weapon)) return;

    // Show drop notification
    const config = BALANCE.weapons[weapon];
    this.showDropBanner(config.name);
    // Rebuild weapon panel to include new weapon
    this.placementSystem.rebuildUI();
  }

  private showDropBanner(weaponName: string): void {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: absolute; top: 120px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.85); border: 2px solid #44ff44; border-radius: 12px;
      padding: 12px 24px; color: #44ff44; font-size: 16px; font-weight: bold;
      text-align: center; z-index: 55; pointer-events: none;
      text-shadow: 0 0 10px rgba(68,255,68,0.5);
      animation: dropIn 0.3s ease;
    `;
    banner.innerHTML = `\u{1F381} Neuer Drop: ${weaponName}!`;
    document.body.appendChild(banner);
    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.5s';
      setTimeout(() => banner.remove(), 500);
    }, 2500);
  }

  private showCrystalEarn(amount: number): void {
    this.resourcePopups.showCrystals(amount);
  }

  private showInterestPopup(amount: number): void {
    // Interest gold is already shown via economy.earn -> onGoldEarned -> resourcePopups.showGold
    // This method kept for compatibility but the popup is handled automatically now.
  }

  private showComboGoldBanner(gold: number, label: string): void {
    const banner = document.createElement('div');
    banner.className = 'combo-gold-banner';
    banner.textContent = `${label} +${gold} Gold`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 1500);
  }

  private showPerfekteWelle(): void {
    if (!this.perfekteWelleBanner) return;
    // Reset animation by removing and re-adding class
    this.perfekteWelleBanner.classList.remove('active');
    void this.perfekteWelleBanner.offsetWidth; // force reflow
    this.perfekteWelleBanner.classList.add('active');
    this.soundSystem.play('skill_activate');
    // Remove active class after animation completes
    setTimeout(() => {
      this.perfekteWelleBanner.classList.remove('active');
    }, 2600);
  }

  private showModeBanner(): void {
    if (!this.modeBanner) return;
    const modeName = MODE_NAMES[this.currentGameMode];
    let desc = '';
    switch (this.currentGameMode) {
      case 'tower_defense':
        desc = 'Platziere Türme und verteidige deine Basis!';
        break;
      case 'auto_battle':
        desc = 'Wellen starten automatisch! Platziere schnell zwischen den Wellen.';
        break;
      case 'arena':
        desc = `Nur ${this.maxTowersForLevel} Türme erlaubt! Wähle weise.`;
        break;
      case 'survival':
        desc = 'Überlebe so lange wie möglich! Wellen starten automatisch.';
        break;
      case 'auto_battle_tft':
        desc = 'Platziere Einheiten und sieh dem Kampf zu!';
        break;
      case 'arena_turnbased':
        desc = 'Rundenbasierter Kampf — wähle deine Fähigkeiten weise!';
        break;
    }

    this.modeBanner.innerHTML = `<strong>${modeName}</strong><br><span style="font-size:12px;">${desc}</span>`;
    this.modeBanner.style.display = 'block';
    this.modeBanner.style.opacity = '1';

    // If final boss phase change, flash red
    if (this.currentLevel.isFinalBoss) {
      this.modeBanner.style.borderColor = '#ff0066';
      this.modeBanner.style.color = '#ff4488';
    }

    setTimeout(() => {
      if (this.modeBanner) {
        this.modeBanner.style.opacity = '0';
        setTimeout(() => { this.modeBanner.style.display = 'none'; }, 500);
      }
    }, 4000);
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  private gameLoop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05) * this.gameSpeed;
    this.lastTime = now;

    this.update(dt);
    this.sceneManager.render();

    requestAnimationFrame(this.gameLoop);
  };

  private update(dt: number): void {
    this.cameraController.update();
    this.waveManager.update(dt);

    const enemies = this.waveManager.getEnemies();
    const weapons = this.placementSystem.getPlacedWeapons();

    // Camera auto-follow: track center of alive enemies during active wave
    if (this.cameraController.isAutoFollow() && this.waveManager.isWaveActive()) {
      const aliveEnemies = enemies.filter(e => e.alive);
      if (aliveEnemies.length > 0) {
        const center = new THREE.Vector3();
        for (const e of aliveEnemies) {
          center.add(e.getPosition());
        }
        center.divideScalar(aliveEnemies.length);
        this.cameraController.setAutoFollowTarget(center);
      }
    }

    // Arena mode: track placed tower count
    this.towersPlacedThisLevel = weapons.filter(w => !w.isPath).length;

    // Snapshot enemy HP before weapon updates (for damage numbers)
    for (const enemy of enemies) {
      if (enemy.alive && !this.prevEnemyHp.has(enemy)) {
        this.prevEnemyHp.set(enemy, enemy.hp);
      }
    }

    // Update synergies
    this.synergySystem.update(weapons, dt);

    // Apply synergy buffs
    for (const weapon of weapons) {
      if ('synergyBuffs' in weapon) {
        (weapon as any).synergyBuffs = this.synergySystem.getBuffsForWeapon(weapon);
      }
    }

    // ─── Boss slam: update tower fire rate debuffs ─────
    // Tick down debuff timers and remove expired ones
    for (let i = this.towerDebuffs.length - 1; i >= 0; i--) {
      this.towerDebuffs[i].timer -= dt;
      if (this.towerDebuffs[i].timer <= 0) {
        this.towerDebuffs.splice(i, 1);
      }
    }
    // Apply debuffs to towers in range
    for (const weapon of weapons) {
      if (weapon instanceof TowerWeapon) {
        let debuffMult = 1;
        for (const debuff of this.towerDebuffs) {
          const dist = weapon.getPosition().distanceTo(debuff.pos);
          if (dist <= debuff.radius) {
            debuffMult = Math.min(debuffMult, debuff.fireRateReduction);
          }
        }
        weapon.bossDebuffFireRate = debuffMult;
      }
    }

    for (const weapon of weapons) {
      // Hook up callbacks for special weapons
      if (weapon instanceof HealTower && !weapon.onHeal) {
        weapon.onHeal = (amount) => {
          this.baseHP = Math.min(this.maxBaseHP, this.baseHP + amount);
          this.updateHpDisplay();
        };
      }
      if (weapon instanceof GoldMine && !weapon.onGold) {
        weapon.onGold = (amount) => {
          this.economy.earn(amount);
          // Show gold popup at the GoldMine position
          const pos = weapon.getPosition();
          this.damageNumbers.spawn(pos.x, pos.y, pos.z, amount, 'gold');
        };
      }
      weapon.update(dt, enemies, (proj: Projectile) => {
        this.projectileSystem.add(proj);
      });
    }

    this.projectileSystem.update(dt, enemies);

    // Spawn damage numbers for enemies that took damage
    for (const enemy of enemies) {
      const prev = this.prevEnemyHp.get(enemy);
      if (prev !== undefined && enemy.hp < prev) {
        const dmg = prev - enemy.hp;
        const pos = enemy.getPosition();
        // Detect damage type from the weapon that last hit
        let type: import('../ui/DamageNumbers').DamageType = 'normal';
        const wk = enemy.lastDamagedByWeapon?.key as string | undefined;
        if (dmg >= 50) {
          type = 'crit';
        } else if (wk === 'fireTower' || wk === 'flamethrowerTower') {
          type = 'fire';
        } else if (wk === 'iceTower' || wk === 'frostMine') {
          type = 'ice';
        } else if (wk === 'teslaTower' || wk === 'laserTower') {
          type = 'electric';
        } else if (wk === 'poisonTower' || wk === 'necromancerTower') {
          type = 'poison';
        } else if (wk === 'mortarTower' || wk === 'cannonTower' || wk === 'earthquakeTower') {
          type = 'splash';
        } else if (enemy.hasDot() && dmg <= 10) {
          type = 'dot';
        }
        this.damageNumbers.spawn(pos.x, pos.y, pos.z, dmg, type);
      }
      this.prevEnemyHp.set(enemy, enemy.hp);
    }

    // Clean up dead enemy HP tracking
    for (const key of this.prevEnemyHp.keys()) {
      const enemy = key as any;
      if (!enemy.alive && enemy.deathDone) {
        this.prevEnemyHp.delete(key);
      }
    }

    this.damageNumbers.update(dt / this.gameSpeed); // real-time for UI
    this.statsTracker.update(dt);

    // ─── New system updates ──────────────────────
    this.activeSkills.update(dt);
    this.particleSystem.update(dt);
    this.lootEffects.update(dt);
    if (this.weatherSystem) this.weatherSystem.update(dt);
    this.animationSystem.update(dt);
    if (this.terrainRenderer) {
      this.terrainRenderer.updateDamageAnimation(dt);
      this.terrainRenderer.updateAmbientParticles(dt);
    }
    // Update death debris and ground splats
    Enemy.updateDeathEffects(dt, this.sceneManager.scene);
    this.persistentStats.increment('totalPlayTimeSeconds', dt);

    // Update minimap
    const pathCells = this.gameMap.getPathCells();
    const weaponData = weapons.map(w => ({
      position: w.mesh.position,
      color: typeof (w as any).config?.color === 'number' ? (w as any).config.color : 0xffffff,
      isPath: w.isPath,
    }));
    const enemyData = enemies.map(e => ({
      position: e.getPosition(),
      type: e.type,
      alive: e.alive,
    }));
    this.minimap.update(pathCells, weaponData, enemyData, this.sceneManager.camera.position);

    // Boss HP bar
    this.updateBossHpBar(enemies);

    // Auto-wave is now handled via interval-based countdown (startAutoWaveCountdown)
    // triggered from onWaveEnd callback

    // Endless mode: extend waves and apply scaling dynamically
    if (this.isEndlessRun) {
      const wave = this.waveManager.getCurrentWave();
      const totalWaves = this.currentLevel.waves.length;
      if (wave >= totalWaves - 3) {
        this.endlessMode.extendLevelWaves(this.currentLevel, 10);
      }
      // Sync effective wave for scaling calculations
      this.endlessMode.setEffectiveWave(wave);
      // Apply progressive scaling to enemy stats
      const baseMods = this.runManager.getModifiers();
      baseMods.enemyHpMult *= this.endlessMode.getHpScale() * this.endlessMode.getHpModifierBonus();
      baseMods.enemySpeedMult *= this.endlessMode.getSpeedScale();
      baseMods.goldMult *= this.endlessMode.getGoldScale();
      this.waveManager.setModifiers(baseMods);
    }

    // Arena mode: block placement if tower limit reached
    if (this.currentGameMode === 'arena' && this.towersPlacedThisLevel >= this.maxTowersForLevel) {
      this.placementSystem.setTowerLimitReached(true);
    } else {
      this.placementSystem.setTowerLimitReached(false);
    }

    this.placementSystem.cleanupExplodedTraps();
    this.placementSystem.updateAffordability();
    this.placementSystem.updateTargetLine(dt);

    // Auto-upgrade: try upgrading cheapest tower between waves
    this.placementSystem.tryAutoUpgrade();

    // Update wave progress bar
    this.updateWaveProgress();

    // Update wave preview panel
    this.updateWavePreview();

    // Update difficulty indicator
    if (this.difficultyLabel) {
      const label = this.difficultyScaling.getDifficultyLabel();
      const color = this.difficultyScaling.getDifficultyColor();
      this.difficultyLabel.textContent = label;
      this.difficultyLabel.style.color = color;
    }

    // Update interest preview near gold display
    if (this.interestPreview && this.economy) {
      if (!this.waveManager.isWaveActive()) {
        const preview = this.economy.getInterestPreview(this.economy.getGold());
        if (preview > 0) {
          this.interestPreview.textContent = `(+${preview} Zinsen)`;
          this.interestPreview.style.display = '';
        } else {
          this.interestPreview.textContent = '';
          this.interestPreview.style.display = 'none';
        }
      } else {
        this.interestPreview.textContent = '';
        this.interestPreview.style.display = 'none';
      }
    }
  }

  private static readonly BOSS_NAMES: string[] = [
    'Zombie-K\u00f6nig',
    'Untoten-Lord',
    'Nekromant',
    'Grabw\u00e4chter',
    'Seelenfresser',
    'Schattenf\u00fcrst',
    'Knochenbrecher',
    'Blutf\u00fcrst',
    'Verdammnis',
    'Todesritter',
  ];

  private getBossName(): string {
    if (this.currentLevel.isFinalBoss) {
      return `ULTRA BOSS \u2014 Phase: ${MODE_NAMES[this.currentGameMode]}`;
    }
    const wave = this.waveManager.getCurrentWave();
    const idx = (wave - 1) % Game.BOSS_NAMES.length;
    return Game.BOSS_NAMES[idx];
  }

  private updateBossHpBar(enemies: any[]): void {
    let boss: Enemy | null = null;
    for (const e of enemies) {
      if (e.alive && e.type === 'boss') {
        boss = e;
        break;
      }
    }

    if (boss) {
      // Show bar (with slide-in animation on first appearance)
      if (!this.bossBarVisible) {
        this.bossHpContainer.classList.remove('hiding');
        this.bossHpContainer.classList.add('visible');
        this.bossBarVisible = true;
        this.lastBossHp = boss.hp;
        // Announce boss incoming (once per wave)
        if (!this.announcedBoss) {
          this.announcedBoss = true;
          this.announcements.bossIncoming();
        }
      }

      const ratio = Math.max(0, boss.hp / boss.maxHp);
      this.bossHpBar.style.width = `${ratio * 100}%`;

      // HP text display
      this.bossHpText.textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp}`;

      // Color shift: green -> yellow -> orange -> red as HP decreases
      if (boss.shielded) {
        this.bossHpBar.style.background = 'linear-gradient(90deg, #3366cc, #4488ff, #66aaff)';
      } else if (boss.enraged) {
        this.bossHpBar.style.background = 'linear-gradient(90deg, #cc0000, #ff2200, #ff4400)';
      } else if (ratio > 0.6) {
        this.bossHpBar.style.background = 'linear-gradient(90deg, #cc2222, #ff4444, #ff6644)';
      } else if (ratio > 0.3) {
        this.bossHpBar.style.background = 'linear-gradient(90deg, #cc6600, #ff8800, #ffaa22)';
      } else {
        this.bossHpBar.style.background = 'linear-gradient(90deg, #880000, #cc0000, #ff2222)';
      }

      // Damage flash when HP decreased
      if (this.lastBossHp > 0 && boss.hp < this.lastBossHp) {
        this.bossHpBar.classList.remove('damage-flash');
        // Force reflow to restart animation
        void this.bossHpBar.offsetWidth;
        this.bossHpBar.classList.add('damage-flash');
      }
      this.lastBossHp = boss.hp;

      // Boss name + status
      let nameText = this.getBossName();
      if (boss.shielded) nameText += ' \u2014 Schildphase!';
      else if (boss.enraged) nameText += ' \u2014 Raserei!';
      this.bossHpName.textContent = nameText;

      // Change name color for special states
      if (boss.shielded) {
        this.bossHpName.style.color = '#66aaff';
      } else if (boss.enraged) {
        this.bossHpName.style.color = '#ff4444';
      } else {
        this.bossHpName.style.color = '';
      }
    } else {
      // Hide bar with slide-out animation
      if (this.bossBarVisible) {
        this.bossHpContainer.classList.remove('visible');
        this.bossHpContainer.classList.add('hiding');
        this.bossBarVisible = false;
        this.lastBossHp = -1;
        // Remove hiding class after animation completes
        setTimeout(() => {
          if (!this.bossBarVisible) {
            this.bossHpContainer.classList.remove('hiding');
          }
        }, 400);
      }
    }
  }

  private toggleAutoWave(): void {
    this.autoWave = !this.autoWave;
    this.autoWaveBtn.classList.toggle('active', this.autoWave);
    this.autoWaveBtn.textContent = this.autoWave ? 'Auto: An' : 'Auto: Aus';
    localStorage.setItem('ztd_autowave', String(this.autoWave));
    if (this.autoWave) {
      // If between waves, start the countdown immediately
      if (!this.waveManager.isWaveActive() && this.waveManager.getCurrentWave() > 0) {
        this.startAutoWaveCountdown();
      }
    } else {
      this.clearAutoWaveCountdown();
    }
  }

  private toggleAutoUpgrade(): void {
    if (!this.placementSystem) return;
    const enabled = this.placementSystem.toggleAutoUpgrade();
    this.autoUpgradeBtn.classList.toggle('active', enabled);
    this.autoUpgradeBtn.textContent = enabled ? 'Aufwertung: An' : 'Aufwertung: Aus';
    localStorage.setItem('ztd_autoupgrade', String(enabled));
  }

  private startAutoWaveCountdown(): void {
    this.clearAutoWaveCountdown();
    const delay = this.currentGameMode === 'auto_battle' ? 2 : this.autoWaveDelay;
    this.autoWaveCountdown = delay;
    this.autoWaveCountdownEl.style.display = 'block';
    this.autoWaveCountdownEl.textContent = `N\u00e4chste Welle in ${this.autoWaveCountdown}s...`;
    this.autoWaveInterval = setInterval(() => {
      this.autoWaveCountdown--;
      if (this.autoWaveCountdown <= 0) {
        this.clearAutoWaveCountdown();
        if (this.running && !this.waveManager.isWaveActive()) {
          this.waveManager.startNextWave();
        }
      } else {
        this.autoWaveCountdownEl.textContent = `N\u00e4chste Welle in ${this.autoWaveCountdown}s...`;
      }
    }, 1000);
  }

  private clearAutoWaveCountdown(): void {
    if (this.autoWaveInterval !== null) {
      clearInterval(this.autoWaveInterval);
      this.autoWaveInterval = null;
    }
    this.autoWaveCountdown = 0;
    this.autoWaveCountdownEl.style.display = 'none';
    this.autoWaveCountdownEl.textContent = '';
  }

  private toggleCameraFollow(): void {
    const isActive = this.cameraController.isAutoFollow();
    this.cameraController.setAutoFollow(!isActive);
    this.cameraFollowBtn.classList.toggle('active', !isActive);
    this.cameraFollowBtn.textContent = !isActive ? 'Kamera: Auto' : 'Kamera: Frei';
  }

  // ─── HUD Tooltip Registrations ─────────────────────────
  private registerHudTooltips(): void {
    // German names for enemy types (shared with wave preview)
    const typeNames: Record<string, string> = {
      normal: 'Zombie', fast: 'Schnell', tank: 'Panzer', flyer: 'Flieger',
      healer: 'Heiler', splitter: 'Spalter', mini_splitter: 'Mini', boss: 'Boss',
    };

    // 1) Gold display
    const goldItem = document.getElementById('gold-display')?.parentElement;
    if (goldItem) {
      this.hudTooltip.register(goldItem, () => {
        const gold = this.economy?.getGold() ?? 0;
        const interest = this.economy?.getInterestPreview(gold) ?? 0;
        return `<div style="color:#ffcc00;font-weight:bold;margin-bottom:3px;">Gold</div>`
          + `<div>Dein aktuelles Gold. Wird zum Bauen und Aufwerten von T\u00fcrmen verwendet.</div>`
          + `<div style="margin-top:4px;color:#aaa;">Zinsen: <span style="color:#ffcc00;">+${interest}</span> pro Welle</div>`
          + `<div style="color:#888;font-size:10px;">(1 Gold pro 20 gespart, max 5)</div>`;
      });
    }

    // 2) Kill counter
    const killContainer = document.getElementById('kill-display-container');
    if (killContainer) {
      this.hudTooltip.register(killContainer, () => {
        const kills = this.statsTracker?.kills ?? 0;
        const best = this.statsTracker?.bestCombo ?? 0;
        const currentCombo = this.statsTracker?.getComboCount() ?? 0;
        let html = `<div style="color:#ff8888;font-weight:bold;margin-bottom:3px;">Kills</div>`
          + `<div><span style="color:#ff6666;font-weight:bold;">${kills}</span> insgesamt get\u00f6tet</div>`
          + `<div style="margin-top:3px;">Bester Kombo: <span style="color:#ffcc00;font-weight:bold;">${best}x</span></div>`;
        if (currentCombo >= 3) {
          html += `<div style="color:#ffcc00;">Aktiver Kombo: <span style="font-weight:bold;">${currentCombo}x</span></div>`;
        }
        html += `<div style="margin-top:4px;color:#888;font-size:10px;">T\u00f6te Gegner schnell hintereinander f\u00fcr Kombo-Boni!</div>`;
        return html;
      });
    }

    // 3) Wave counter
    const waveItem = document.getElementById('wave-display')?.parentElement;
    if (waveItem) {
      this.hudTooltip.register(waveItem, () => {
        const current = this.waveManager?.getCurrentWave() ?? 0;
        const total = this.waveManager?.getTotalWaves() ?? 0;
        const active = this.waveManager?.isWaveActive() ?? false;

        let html = `<div style="color:#fff;font-weight:bold;margin-bottom:3px;">Welle ${current} von ${total}</div>`;

        if (active) {
          html += `<div style="color:#ff6644;">Welle l\u00e4uft!</div>`;
        } else if (current < total) {
          html += `<div style="color:#44ff44;">Bereit f\u00fcr n\u00e4chste Welle</div>`;
        } else {
          html += `<div style="color:#44ff44;">Alle Wellen geschafft!</div>`;
        }

        // Show next wave enemy summary if not all waves done
        if (!active && current < total) {
          const waveDefs = this.waveManager?.getWaveDefs();
          if (waveDefs && waveDefs[current]) {
            const nextDef = waveDefs[current];
            const groups = nextDef.map(g => {
              const name = typeNames[g.type] || g.type;
              return `${g.count}x ${name}`;
            });
            html += `<div style="margin-top:4px;color:#aaa;">N\u00e4chste Welle:</div>`
              + `<div style="color:#ddd;">${groups.join(', ')}</div>`;
          }
        }

        html += `<div style="margin-top:4px;color:#888;font-size:10px;">Leertaste: N\u00e4chste Welle starten</div>`;
        return html;
      });
    }

    // 4) HP bar
    const hpItem = document.getElementById('base-hp-bar')?.parentElement?.parentElement;
    if (hpItem) {
      this.hudTooltip.register(hpItem, () => {
        const hp = Math.ceil(this.baseHP ?? 0);
        const max = this.maxBaseHP ?? 0;
        const pct = max > 0 ? Math.round((hp / max) * 100) : 0;
        let color = '#44ff44';
        if (pct <= 25) color = '#ff4444';
        else if (pct <= 50) color = '#ffaa00';
        return `<div style="color:#fff;font-weight:bold;margin-bottom:3px;">Basis-HP</div>`
          + `<div><span style="color:${color};font-weight:bold;">${hp}</span> / ${max} <span style="color:#888;">(${pct}%)</span></div>`
          + `<div style="margin-top:4px;color:#aaa;">Gegner die durchkommen verursachen Schaden an deiner Basis.</div>`
          + `<div style="color:#888;font-size:10px;">F\u00e4llt auf 0 = Niederlage!</div>`;
      });
    }

    // 5) Skill slots
    const skillsBar = document.getElementById('skills-bar');
    if (skillsBar) {
      // Skills are built dynamically by ActiveSkillSystem, use MutationObserver
      // to register once they appear
      const registerSkillSlots = () => {
        const slots = skillsBar.querySelectorAll('.skill-slot');
        slots.forEach((slot, i) => {
          if (i < SKILL_DEFS.length && !(slot as any).__hudTooltipRegistered) {
            (slot as any).__hudTooltipRegistered = true;
            this.hudTooltip.register(slot as HTMLElement, () => {
              const def = SKILL_DEFS[i];
              const cd = this.activeSkills.getCooldown(i);
              const ready = cd <= 0;
              let html = `<div style="color:${def.borderColor};font-weight:bold;margin-bottom:3px;">${def.name}</div>`
                + `<div>${def.description}</div>`
                + `<div style="margin-top:4px;">Abklingzeit: <span style="color:#88ccff;">${def.cooldown}s</span></div>`;
              if (ready) {
                html += `<div style="color:#44ff44;font-weight:bold;">Bereit!</div>`;
              } else {
                html += `<div style="color:#ff8844;">Noch <span style="font-weight:bold;">${Math.ceil(cd)}s</span> Abklingzeit</div>`;
              }
              html += `<div style="margin-top:4px;color:#888;font-size:10px;">Taste [${def.key}] zum Aktivieren</div>`;
              return html;
            });
          }
        });
      };
      // Initial registration (if already built)
      registerSkillSlots();
      // Watch for new skill slots being added
      const observer = new MutationObserver(() => registerSkillSlots());
      observer.observe(skillsBar, { childList: true });
    }
  }

  private damageBase(damage: number): void {
    this.baseHP = Math.max(0, this.baseHP - damage);
    this.updateHpDisplay();
    this.waveDamageTaken += damage;
    this.levelDamageTaken += damage;

    // Screen shake effect
    this.cameraController.shake(0.3, 0.5);
    this.soundSystem.play('base_hit', 0.6);

    // HP threshold announcements
    const ratio = this.baseHP / this.maxBaseHP;
    if (ratio <= 0.2 && !this.announcedCritical) {
      this.announcedCritical = true;
      this.announcements.critical();
    } else if (ratio <= 0.5 && !this.announcedDanger) {
      this.announcedDanger = true;
      this.announcements.baseDanger();
    }

    if (this.baseHP <= 0) {
      this.gameOver();
    }
  }

  private updateHpDisplay(): void {
    const ratio = this.baseHP / this.maxBaseHP;
    this.hpBar.style.width = `${ratio * 100}%`;
    this.hpText.textContent = Math.ceil(this.baseHP).toString();

    if (ratio > 0.5) {
      this.hpBar.style.background = 'linear-gradient(90deg, #44ff44, #88ff44)';
    } else if (ratio > 0.25) {
      this.hpBar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
    } else {
      this.hpBar.style.background = 'linear-gradient(90deg, #ff4444, #ff6644)';
    }

    // Update base building damage visuals
    if (this.terrainRenderer) {
      this.terrainRenderer.updateBaseDamage(ratio);
    }

    // Update screen vignette overlay
    this.screenVignette.classList.remove('danger', 'critical', 'boss-active');
    if (ratio < 0.15) {
      this.screenVignette.classList.add('critical');
    } else if (ratio < 0.3) {
      this.screenVignette.classList.add('danger');
    } else if (this.bossBarVisible) {
      this.screenVignette.classList.add('boss-active');
    }
  }

  private gameOver(): void {
    this.running = false;
    this.soundSystem.stopMusic();
    this.minimap.hide();
    this.enemyTooltip.hide();
    this.announcements.cleanup();
    this.difficultyScaling.onPlayerDeath();
    this.persistentStats.increment('gamesLost');
    this.persistentStats.save();

    // Apply defeat overlay styling
    this.gameOverScreen.classList.remove('victory-overlay');
    this.gameOverScreen.classList.add('defeat-overlay');

    this.gameOverTitle.textContent = 'NIEDERLAGE';
    this.gameOverTitle.className = 'defeat-shake';

    const currentWave = this.waveManager.getCurrentWave();
    const totalWaves = this.isEndlessRun
      ? currentWave
      : this.currentLevel.waves.length;

    const stats = this.collectEndStats();

    let headerHtml = '';
    if (this.isEndlessRun) {
      const highscore = this.endlessMode.getHighScore();
      headerHtml = `
        <div style="color: #cc44ff; font-size: 16px; margin-bottom: 4px;">Endlosmodus</div>
        <div class="defeat-wave-info">Welle ${currentWave} erreicht</div>
        <div style="color: #ffcc44; font-size: 14px; margin-bottom: 8px;">Highscore: ${highscore}</div>
      `;
    } else {
      headerHtml = `
        <div style="color: #999; font-size: 14px; margin-bottom: 2px;">${this.currentLevel.name} \u2014 ${MODE_NAMES[this.currentGameMode]}</div>
        <div class="defeat-wave-info">Welle ${currentWave} von ${totalWaves} erreicht</div>
      `;
    }

    const statsHtml = this.buildEndStatsHtml(stats, true);
    const postGameStats = this.collectPostGameStats();
    const { html: postGameHtml } = buildPostGameStatsHtml(postGameStats);
    const crystals = this.backpackManager.getCrystals();

    this.gameOverStats.innerHTML = `
      ${headerHtml}
      ${statsHtml}
      ${postGameHtml}
      <div class="crystal-reward" id="crystal-counter-defeat" style="filter: saturate(0.6);">
        \u{1F48E} <span id="crystal-value-defeat">0</span> Kristalle
      </div>
      <div style="color: #884444; font-size: 14px; font-style: italic; margin-bottom: 8px;">
        Die Zombies haben deine Basis zerst\u00f6rt!
      </div>
    `;

    // Hide the default restart button, use custom button row instead
    this.restartBtn.style.display = 'none';

    // Create button row
    const btnRow = document.createElement('div');
    btnRow.className = 'end-btn-row';
    btnRow.id = 'end-btn-row';
    btnRow.innerHTML = `
      <button class="end-btn end-btn-retry" id="defeat-retry-btn">Erneut versuchen</button>
      <button class="end-btn end-btn-hub" id="defeat-hub-btn">Zur\u00fcck zur Basis</button>
    `;
    this.gameOverScreen.appendChild(btnRow);

    // Add restart hotkey hint
    const hint = document.createElement('div');
    hint.style.cssText = 'color: #666; font-size: 11px; text-align: center; margin-top: 8px; position: relative; z-index: 1;';
    hint.textContent = 'R: Erneut versuchen';
    hint.id = 'end-restart-hint';
    this.gameOverScreen.appendChild(hint);

    this.gameOverScreen.classList.add('visible');

    // Animate stats, post-game stats, and crystal counter
    this.animateEndStats();
    animatePostGameStats();
    this.animateCountUp('crystal-value-defeat', crystals, 1200);

    // Attach button handlers
    setTimeout(() => {
      document.getElementById('defeat-retry-btn')?.addEventListener('click', () => {
        this.cleanupEndScreenExtras();
        this.retryLevel();
      });
      document.getElementById('defeat-hub-btn')?.addEventListener('click', () => {
        this.cleanupEndScreenExtras();
        this.restart();
      });
    }, 50);
  }

  private victory(): void {
    this.running = false;
    this.soundSystem.stopMusic();
    this.minimap.hide();
    this.enemyTooltip.hide();
    this.announcements.cleanup();

    // Track achievements & stats
    const hpPercent = this.baseHP / this.maxBaseHP;
    this.achievements.trackLevelComplete(this.currentLevel.id, this.levelDamageTaken, hpPercent);
    this.persistentStats.increment('gamesWon');
    this.persistentStats.addToSet('levelsCompleted', this.currentLevel.id);
    this.persistentStats.save();

    // Daily challenge completion reward
    if (this.isDailyChallengeRun) {
      const reward = this.dailyChallenge.complete();
      if (reward > 0) {
        this.backpackManager.earnCrystals(reward);
      }
    }

    // Earn crystals for level completion (apply Kristallfinder bonus)
    this.backpackManager.earnCrystals(Math.floor(25 * this.backpackManager.getPermanentBonus('crystalFind')));
    // Expand backpack on level win
    this.backpackManager.expandSlots(1);

    // Roll for chest drop (40% chance)
    const chestReward = this.backpackManager.rollChestDrop();
    if (chestReward) {
      this.backpackManager.applyChestReward(chestReward);
      this.backpackManager.setPendingChest(chestReward);
    }

    // Check if more levels exist
    const nextLevelIndex = this.currentLevelIndex + 1;
    const hasNextLevel = nextLevelIndex < LEVELS.length;

    // Persist level progress (save highest unlocked index)
    if (hasNextLevel && nextLevelIndex > this.loadProgress()) {
      try { localStorage.setItem(Game.PROGRESS_KEY, String(nextLevelIndex)); } catch { /* ignore */ }
    }

    // Apply victory overlay styling
    this.gameOverScreen.classList.remove('defeat-overlay');
    this.gameOverScreen.classList.add('victory-overlay');

    this.gameOverTitle.textContent = this.currentLevel.isFinalBoss ? 'MEISTER!' : 'SIEG!';
    this.gameOverTitle.id = 'game-over-title';
    this.gameOverTitle.className = 'victory';

    // Build chest drop HTML
    const chestHtml = chestReward ? this.buildChestDropHtml(chestReward) : '';

    // Star rating based on HP remaining
    const starCount = hpPercent >= 0.75 ? 3 : hpPercent >= 0.40 ? 2 : 1;
    const starLabel = starCount === 3 ? 'Perfekt!' : starCount === 2 ? 'Gut gemacht!' : 'Knapp \u00fcberlebt!';
    const starLabelColor = starCount === 3 ? '#ffd700' : starCount === 2 ? '#88cc44' : '#cc8844';

    const starRatingHtml = `
      <div class="star-rating">
        ${[0, 1, 2].map(i =>
          `<span class="star ${i < starCount ? 'earned' : 'unearned'}" style="${i < starCount ? `animation-delay: ${0.3 + i * 0.3}s` : ''}">${i < starCount ? '\u2605' : '\u2606'}</span>`
        ).join('')}
      </div>
      <div class="star-rating-label" style="color: ${starLabelColor};">${starLabel}</div>
    `;

    const stats = this.collectEndStats();
    const statsHtml = this.buildEndStatsHtml(stats, false);
    const postGameStats = this.collectPostGameStats();
    const { html: postGameHtml } = buildPostGameStatsHtml(postGameStats);

    // Award star bonus crystals
    const starBonusCrystals = starCount === 3 ? 15 : starCount === 2 ? 8 : 0;
    if (starBonusCrystals > 0) {
      this.backpackManager.earnCrystals(Math.floor(starBonusCrystals * this.backpackManager.getPermanentBonus('crystalFind')));
    }

    // Build detailed reward breakdown
    const breakdown = this.buildRewardBreakdownHtml(starCount);
    const breakdownHtml = breakdown.crystalHtml + breakdown.goldHtml;

    const crystals = this.backpackManager.getCrystals();

    // ─── High Score submission ─────────────────────
    const hsElapsed = (performance.now() - this.levelStartTime) / 1000;
    const hsWave = this.waveManager.getCurrentWave();
    const hsStats: HighScoreStats = {
      wavesCompleted: hsWave,
      killCount: this.statsTracker.kills,
      goldEarned: this.levelGoldEarned,
      remainingHP: Math.ceil(this.baseHP),
      perfectWaves: this.perfectWaveCount,
      timePlayed: hsElapsed,
      bestCombo: this.statsTracker.bestCombo,
      bossKills: this.statsTracker.bossKills,
    };
    const hsResult = this.highScoreSystem.submitScore(
      this.currentLevel.id, starCount, hsStats, this.currentLevel.name
    );
    const highScoreHtml = hsResult.isNew
      ? this.highScoreSystem.renderNewHighScoreBanner(hsResult.rank, this.highScoreSystem.calculateScore(hsStats))
      : '';

    if (this.currentLevel.isFinalBoss) {
      this.backpackManager.earnCrystals(Math.floor(100 * this.backpackManager.getPermanentBonus('crystalFind')));
      this.gameOverStats.innerHTML = `
        <span style="font-size: 28px; color: #ffcc44;">Du hast den Ultra Endboss besiegt!</span><br>
        ${highScoreHtml}
        ${starRatingHtml}
        ${statsHtml}
        ${postGameHtml}
        ${breakdownHtml}
        <div class="crystal-reward" id="crystal-counter-victory">
          \u{1F48E} <span id="crystal-value-victory">0</span> Kristalle
        </div>
        ${chestHtml}
        <em style="color: #ff66aa;">Du bist der ultimative Verteidiger!</em>
      `;
      this.restartBtn.style.display = 'none';
      this.gameOverScreen.classList.add('visible');
      this.addVictoryButtonRow();
      this.animateEndStats();
      animatePostGameStats();
      this.animateCountUp('crystal-value-victory', this.backpackManager.getCrystals(), 1200);
      this.spawnCrystalSparkles('crystal-counter-victory');
    } else if (hasNextLevel) {
      this.showRewardScreen(nextLevelIndex, chestHtml, starRatingHtml, statsHtml, postGameHtml, crystals, breakdownHtml, highScoreHtml);
    } else {
      this.gameOverStats.innerHTML = `
        <div style="font-size: 16px; color: #88cc44; margin-bottom: 4px;">Alle ${LEVELS.length} Level geschafft!</div>
        ${highScoreHtml}
        ${starRatingHtml}
        ${statsHtml}
        ${postGameHtml}
        ${breakdownHtml}
        <div class="crystal-reward" id="crystal-counter-victory">
          \u{1F48E} <span id="crystal-value-victory">0</span> Kristalle
        </div>
        ${chestHtml}
        <em style="color: #44ff88;">Du hast das Spiel gewonnen!</em>
      `;
      this.restartBtn.style.display = 'none';
      this.gameOverScreen.classList.add('visible');
      this.addVictoryButtonRow();
      this.animateEndStats();
      animatePostGameStats();
      this.animateCountUp('crystal-value-victory', crystals, 1200);
      this.spawnCrystalSparkles('crystal-counter-victory');
    }
  }

  private buildChestDropHtml(reward: ChestReward): string {
    const tierNames: Record<string, string> = { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' };
    const tierColors: Record<string, string> = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700' };
    const tierName = tierNames[reward.tier];
    const tierColor = tierColors[reward.tier];

    let weaponList = '';
    for (const w of reward.weapons) {
      const config = BALANCE.weapons[w];
      weaponList += `<span style="color: #44ff88;">${config.name}</span>, `;
    }
    weaponList = weaponList.replace(/, $/, '');

    return `
      <div style="
        background: rgba(0,0,0,0.5); border: 2px solid ${tierColor};
        border-radius: 12px; padding: 14px; margin: 12px 0;
        text-align: center; animation: chestPop 0.5s ease;
      ">
        <div style="font-size: 24px; margin-bottom: 6px;">
          \u{1F4E6} ${tierName}-Truhe!
        </div>
        <div style="color: ${tierColor}; font-size: 14px; font-weight: bold; margin-bottom: 8px;">
          ${reward.weapons.length > 0 ? `Neue Waffe: ${weaponList}` : ''}
        </div>
        <div style="color: #aa88ff; font-size: 13px;">
          +${reward.crystals} \u{1F48E} Kristalle
          ${reward.slotUpgrade > 0 ? ' | +1 Rucksack-Platz' : ''}
        </div>
      </div>
    `;
  }

  /** Build the detailed crystal & gold breakdown HTML for the victory screen. */
  private buildRewardBreakdownHtml(starCount: number): { crystalHtml: string; goldHtml: string; totalCrystals: number } {
    const crystalFindMult = this.backpackManager.getPermanentBonus('crystalFind');
    const crystalFindPct = Math.round((crystalFindMult - 1) * 100);

    // Crystal breakdown
    const baseCrystals = 25; // level completion base
    const baseCrystalsScaled = Math.floor(baseCrystals * crystalFindMult);

    const perfectCrystalsRaw = this.perfectWaveCount * 5;
    const perfectCrystalsScaled = Math.floor(perfectCrystalsRaw * crystalFindMult);

    const starBonus = starCount === 3 ? 15 : starCount === 2 ? 8 : 0;
    const starBonusScaled = Math.floor(starBonus * crystalFindMult);

    // Wave crystals (10 per wave, already earned during gameplay)
    const totalWaves = this.waveManager.getCurrentWave();
    const waveCrystalsRaw = totalWaves * 10;
    const waveCrystalsScaled = Math.floor(waveCrystalsRaw * crystalFindMult);

    const totalCrystals = baseCrystalsScaled + perfectCrystalsScaled + starBonusScaled + waveCrystalsScaled;

    let crystalHtml = `<div class="reward-breakdown">`;
    crystalHtml += `<div class="rb-title">Kristalle verdient</div>`;
    crystalHtml += `<div class="rb-row"><span>Basis-Belohnung:</span><span>+${baseCrystalsScaled} \u{1F48E}</span></div>`;
    crystalHtml += `<div class="rb-row"><span>Wellen-Kristalle (${totalWaves}x10):</span><span>+${waveCrystalsScaled} \u{1F48E}</span></div>`;
    if (this.perfectWaveCount > 0) {
      crystalHtml += `<div class="rb-row"><span>Perfekte Wellen (${this.perfectWaveCount}x5):</span><span>+${perfectCrystalsScaled} \u{1F48E}</span></div>`;
    }
    if (starBonus > 0) {
      const starLabel = starCount === 3 ? '3 Sterne' : '2 Sterne';
      crystalHtml += `<div class="rb-row"><span>Sterne-Bonus (${starLabel}):</span><span>+${starBonusScaled} \u{1F48E}</span></div>`;
    }
    if (crystalFindPct > 0) {
      const crystalFinderExtra = totalCrystals - Math.floor(baseCrystals + perfectCrystalsRaw + starBonus + waveCrystalsRaw);
      crystalHtml += `<div class="rb-row"><span>Kristallfinder (+${crystalFindPct}%):</span><span>+${crystalFinderExtra} \u{1F48E}</span></div>`;
    }
    crystalHtml += `<div class="rb-total"><span>Gesamt:</span><span>${totalCrystals} \u{1F48E}</span></div>`;
    crystalHtml += `</div>`;

    // Gold breakdown
    const totalGold = this.totalEnemyGold + this.totalInterestEarned + this.totalComboGold;
    let goldHtml = `<div class="reward-breakdown gold">`;
    goldHtml += `<div class="rb-title">Gold-Zusammenfassung</div>`;
    goldHtml += `<div class="rb-row"><span>Feind-Gold:</span><span>${this.totalEnemyGold}g</span></div>`;
    if (this.totalInterestEarned > 0) {
      goldHtml += `<div class="rb-row"><span>Zinsen:</span><span>+${this.totalInterestEarned}g</span></div>`;
    }
    if (this.totalComboGold > 0) {
      goldHtml += `<div class="rb-row"><span>Kombo-Bonus:</span><span>+${this.totalComboGold}g</span></div>`;
    }
    goldHtml += `<div class="rb-total"><span>Gesamt:</span><span>${totalGold}g</span></div>`;
    goldHtml += `</div>`;

    return { crystalHtml, goldHtml, totalCrystals };
  }

  private showRewardScreen(nextLevelIndex: number, chestHtml = '', starRatingHtml = '', statsHtml = '', postGameHtml = '', crystals = 0, breakdownHtml = '', highScoreHtml = ''): void {
    const choices = this.runManager.getRandomChoices(3);

    // Build reward UI
    let choicesHtml = '<div style="display: flex; gap: 12px; margin-top: 12px; justify-content: center; flex-wrap: wrap;">';
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const borderColor = c.type === 'buff' ? '#44ff44' : '#ff4444';
      const bgColor = c.type === 'buff' ? 'rgba(68,255,68,0.1)' : 'rgba(255,68,68,0.1)';
      choicesHtml += `
        <div class="reward-card" data-index="${i}" style="
          background: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 12px;
          padding: 16px;
          width: 180px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        ">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px; color: ${borderColor};">
            ${c.name}
          </div>
          <div style="font-size: 12px; color: #ccc; line-height: 1.4;">
            ${c.description}
          </div>
          ${c.bonus ? `<div style="font-size: 11px; color: #ffcc00; margin-top: 8px;">${c.bonus}</div>` : ''}
        </div>
      `;
    }
    choicesHtml += '</div>';

    this.gameOverStats.innerHTML = `
      <div style="font-size: 16px; color: #88cc44; margin-bottom: 4px;">${this.currentLevel.name} geschafft!</div>
      ${highScoreHtml}
      ${starRatingHtml}
      ${statsHtml}
      ${postGameHtml}
      ${breakdownHtml}
      <div class="crystal-reward" id="crystal-counter-reward">
        \u{1F48E} <span id="crystal-value-reward">0</span> Kristalle
      </div>
      ${chestHtml}
      <strong>W\u00e4hle eine Belohnung f\u00fcr das n\u00e4chste Level:</strong>
      ${choicesHtml}
    `;
    this.restartBtn.style.display = 'none';
    this.gameOverScreen.classList.add('visible');

    // Animate stats, post-game stats, and crystal counter
    this.animateEndStats();
    animatePostGameStats();
    this.animateCountUp('crystal-value-reward', crystals, 1200);
    this.spawnCrystalSparkles('crystal-counter-reward');

    // Attach click handlers to reward cards
    setTimeout(() => {
      const cards = document.querySelectorAll('.reward-card');
      cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
          (card as HTMLElement).style.transform = 'scale(1.05)';
        });
        card.addEventListener('mouseleave', () => {
          (card as HTMLElement).style.transform = 'scale(1)';
        });
        card.addEventListener('click', () => {
          const idx = parseInt((card as HTMLElement).dataset.index!);
          this.runManager.applyChoice(choices[idx]);
          this.gameOverScreen.classList.remove('visible');
          this.gameOverScreen.classList.remove('victory-overlay', 'defeat-overlay');
          this.restartBtn.style.display = '';
          // Show stage path for next level selection
          this.currentLevelIndex = nextLevelIndex;
          this.saveProgress();
          this.showStagePath();
        });
      });
    }, 100);
  }

  private updateRelicsDisplay(): void {
    const bar = document.getElementById('relics-bar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const reward of this.runManager.getChosenRewards()) {
      const icon = document.createElement('span');
      icon.className = `relic-icon ${reward.type}`;
      icon.textContent = reward.name;
      icon.title = reward.description;
      bar.appendChild(icon);
    }
  }

  private updateWaveProgress(): void {
    if (!this.waveManager) return;
    const active = this.waveManager.isWaveActive();
    this.waveProgressContainer.style.display = active ? 'flex' : 'none';
    if (!active) return;

    const total = this.waveManager.getWaveEnemyTotal();
    const killed = this.waveManager.getWaveEnemiesKilled();
    const pct = total > 0 ? Math.round((killed / total) * 100) : 0;
    this.waveProgressBar.style.width = `${pct}%`;
    // Color transition: red → yellow → green
    if (pct < 40) {
      this.waveProgressBar.style.background = '#ff4444';
    } else if (pct < 75) {
      this.waveProgressBar.style.background = '#ffaa44';
    } else {
      this.waveProgressBar.style.background = '#44cc44';
    }
    const allSpawned = this.waveManager.isWaveAllSpawned();
    this.waveProgressText.textContent = allSpawned && killed < total
      ? `${killed}/${total} \u2014 Alle gespawnt!`
      : `${killed} / ${total}`;
  }

  private updateWavePreview(): void {
    if (!this.wavePreviewPanel || !this.waveManager) return;

    const currentWave = this.waveManager.getCurrentWave();
    const totalWaves = this.waveManager.getTotalWaves();
    const waveActive = this.waveManager.isWaveActive();

    // Only re-render when state actually changes
    const cacheKey = `${currentWave}-${totalWaves}-${waveActive}`;
    if (cacheKey === this.wavePreviewLastKey) return;
    this.wavePreviewLastKey = cacheKey;

    const waveDefs = this.waveManager.getWaveDefs();

    // German names for enemy types
    const typeNames: Record<string, string> = {
      normal: 'Zombie',
      fast: 'Schnell',
      tank: 'Panzer',
      flyer: 'Flieger',
      healer: 'Heiler',
      splitter: 'Spalter',
      mini_splitter: 'Mini',
      boss: 'Boss',
    };

    // Colors for enemy types (from BalanceConfig)
    const typeColors: Record<string, string> = {
      normal: '#2d8a4e',
      fast: '#8a2d2d',
      tank: '#4a2d8a',
      flyer: '#44aaff',
      healer: '#44ff88',
      splitter: '#ffaa44',
      mini_splitter: '#ffcc66',
      boss: '#8a0000',
    };

    let html = '';
    html += `<div class="wp-title">Welle ${currentWave} / ${totalWaves}</div>`;

    // All waves complete
    if (currentWave >= totalWaves && !this.waveManager.isWaveActive()) {
      html += `<div class="wp-all-done">Alle Wellen geschafft!</div>`;
      this.wavePreviewPanel.innerHTML = html;
      return;
    }

    // Show current wave composition (if wave is active)
    if (this.waveManager.isWaveActive() && currentWave > 0) {
      const currentDef = waveDefs[currentWave - 1];
      if (currentDef) {
        html += `<div class="wp-label">Aktuelle Welle</div>`;
        html += `<div class="wp-enemies">`;
        for (const group of currentDef) {
          const name = typeNames[group.type] || group.type;
          const color = typeColors[group.type] || '#888';
          html += `<div class="wp-enemy-group">`;
          html += `<div class="wp-enemy-dot" style="background: ${color};"></div>`;
          html += `<span class="wp-enemy-count">${group.count}x</span>`;
          html += `<span class="wp-enemy-name">${name}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
    }

    // Show next wave composition
    const nextWaveIndex = currentWave; // currentWave is 1-based after increment
    if (nextWaveIndex < totalWaves) {
      const nextDef = waveDefs[nextWaveIndex];
      if (nextDef) {
        html += `<div class="wp-label">N\u00e4chste Welle (${nextWaveIndex + 1})</div>`;
        html += `<div class="wp-enemies">`;
        for (const group of nextDef) {
          const name = typeNames[group.type] || group.type;
          const color = typeColors[group.type] || '#888';
          html += `<div class="wp-enemy-group">`;
          html += `<div class="wp-enemy-dot" style="background: ${color};"></div>`;
          html += `<span class="wp-enemy-count">${group.count}x</span>`;
          html += `<span class="wp-enemy-name">${name}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
    }

    this.wavePreviewPanel.innerHTML = html;
  }

  /** Show a wave composition announcement that slides down from the top. */
  private showWaveComposition(): void {
    if (!this.waveCompositionEl || !this.waveManager) return;

    const currentWave = this.waveManager.getCurrentWave();
    const waveDefs = this.waveManager.getWaveDefs();
    if (currentWave < 1 || currentWave > waveDefs.length) return;

    const waveDef = waveDefs[currentWave - 1]; // 1-based index

    // Enemy type German names
    const typeNames: Record<string, string> = {
      normal: 'Normal',
      fast: 'Schnell',
      tank: 'Tank',
      flyer: 'Flieger',
      healer: 'Heiler',
      splitter: 'Splitter',
      mini_splitter: 'Mini',
      boss: 'Boss',
    };

    // Enemy type colors
    const typeColors: Record<string, string> = {
      normal: '#2d8a4e',
      fast: '#8a2d2d',
      tank: '#4a2d8a',
      boss: '#8a0000',
      flyer: '#44aaff',
      healer: '#44ff88',
      splitter: '#ffaa44',
      mini_splitter: '#ffcc66',
    };

    // Count enemies per type
    const counts = new Map<string, number>();
    let totalEnemies = 0;
    for (const group of waveDef) {
      const existing = counts.get(group.type) || 0;
      counts.set(group.type, existing + group.count);
      totalEnemies += group.count;
    }

    // Build HTML
    let html = `<div class="wc-title">Welle ${currentWave}</div>`;
    html += `<div class="wc-groups">`;
    for (const [type, count] of counts) {
      const name = typeNames[type] || type;
      const color = typeColors[type] || '#888';
      html += `<div class="wc-group">`;
      html += `<div class="wc-dot" style="background: ${color}; color: ${color};"></div>`;
      html += `<span class="wc-count">${count}x</span>`;
      html += `<span class="wc-name">${name}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
    html += `<div class="wc-total">${totalEnemies} Gegner insgesamt</div>`;

    this.waveCompositionEl.innerHTML = html;

    // Clear any previous timeout
    if (this.waveCompositionTimeout !== null) {
      clearTimeout(this.waveCompositionTimeout);
      this.waveCompositionTimeout = null;
    }

    // Slide in
    this.waveCompositionEl.classList.remove('wc-slide-out');
    this.waveCompositionEl.classList.add('wc-slide-in');

    // Hold for 3 seconds, then slide out
    this.waveCompositionTimeout = setTimeout(() => {
      this.waveCompositionEl.classList.remove('wc-slide-in');
      this.waveCompositionEl.classList.add('wc-slide-out');
      this.waveCompositionTimeout = null;
    }, 3000);
  }

  private getMouseWorldPosition(): THREE.Vector3 {
    const raycaster = new THREE.Raycaster();
    const ndc = this.inputManager.getMouseNDC();
    const mouse = new THREE.Vector2(ndc.x, ndc.y);
    raycaster.setFromCamera(mouse, this.sceneManager.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return target || new THREE.Vector3();
  }

  /** Raycast against enemy meshes and show/hide the tooltip accordingly. */
  private handleEnemyHover(screenX: number, screenY: number): void {
    // Only during active gameplay
    if (!this.running || !this.waveManager) {
      this.enemyTooltip.hide();
      return;
    }

    // Don't show tooltip when placing weapons or inspecting towers
    if (this.placementSystem && this.placementSystem.hasActiveSelection()) {
      this.enemyTooltip.hide();
      return;
    }

    const mouse = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );
    this.enemyTooltipRaycaster.setFromCamera(mouse, this.sceneManager.camera);

    // Collect meshes from alive enemies
    const enemies = this.waveManager.getEnemies();
    const meshes: THREE.Object3D[] = [];
    const meshToEnemy = new Map<THREE.Object3D, Enemy>();

    for (const enemy of enemies) {
      if (!enemy.alive || enemy.dying) continue;
      meshes.push(enemy.mesh);
      meshToEnemy.set(enemy.mesh, enemy);
      // Also map child meshes to the parent enemy for sub-mesh hits
      enemy.mesh.traverse((child) => {
        if (child !== enemy.mesh) {
          meshToEnemy.set(child, enemy);
        }
      });
    }

    const intersects = this.enemyTooltipRaycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      // Find the enemy from the hit object (walk up to root Group)
      let hitObj: THREE.Object3D | null = intersects[0].object;
      let foundEnemy: Enemy | undefined;
      while (hitObj) {
        foundEnemy = meshToEnemy.get(hitObj);
        if (foundEnemy) break;
        hitObj = hitObj.parent;
      }
      if (foundEnemy && foundEnemy.alive) {
        this.enemyTooltip.show(screenX, screenY, foundEnemy);
        return;
      }
    }

    this.enemyTooltip.hide();
  }

  private cycleSpeed(): void {
    if (this.gameSpeed === 1) this.gameSpeed = 2;
    else if (this.gameSpeed === 2) this.gameSpeed = 3;
    else this.gameSpeed = 1;
    this.speedBtn.textContent = `${this.gameSpeed}x`;
    this.speedBtn.className = '';
    if (this.gameSpeed === 2) this.speedBtn.classList.add('speed-2x');
    else if (this.gameSpeed === 3) this.speedBtn.classList.add('speed-3x');
  }

  public setGameSpeed(speed: number): void {
    this.gameSpeed = Math.max(1, Math.min(3, Math.round(speed)));
    this.speedBtn.textContent = `${this.gameSpeed}x`;
    this.speedBtn.className = '';
    if (this.gameSpeed === 2) this.speedBtn.classList.add('speed-2x');
    else if (this.gameSpeed === 3) this.speedBtn.classList.add('speed-3x');
  }

  private startEndlessMode(): void {
    this.isEndlessRun = true;
    this.isDailyChallengeRun = false;
    this.endlessMode.reset();
    this.currentLevel = EndlessMode.createEndlessLevelDef();
    this.currentLevelIndex = -1; // special marker

    // Restore game UI
    const ui = document.getElementById('game-ui');
    if (ui) ui.style.display = '';

    this.initLevel(this.currentLevel);
    this.start();
  }

  private startDailyChallenge(): void {
    this.isDailyChallengeRun = true;
    this.isEndlessRun = false;
    const challengeData = this.dailyChallenge.getToday();

    // Use challenge level
    this.currentLevel = this.dailyChallenge.getChallengeLevel();
    this.currentLevelIndex = challengeData.levelIndex;

    // Apply daily challenge RunModifiers to the run manager
    this.runManager.reset();
    const challengeMods = this.dailyChallenge.getRunModifiers();
    this.runManager.applyExternalModifiers(challengeMods);

    // Store special flags for gameplay
    this.dailyChallengeFlags = this.dailyChallenge.getSpecialFlags();

    // Restore game UI
    const ui = document.getElementById('game-ui');
    if (ui) ui.style.display = '';

    this.initLevel(this.currentLevel);

    // Apply challenge flags to subsystems
    if (this.dailyChallengeFlags) {
      // Weapon restrictions (onlyTraps / onlyTowers)
      if (this.dailyChallengeFlags.onlyTraps || this.dailyChallengeFlags.onlyTowers) {
        this.placementSystem.allowedWeaponFilter = this.dailyChallenge.getAllowedWeapons();
        this.placementSystem.rebuildUI();
      }

      // No gold per kill
      if (this.dailyChallengeFlags.noGoldPerKill) {
        this.waveManager.noGoldPerKill = true;
      }

      // Boss rush
      if (this.dailyChallengeFlags.bossRush) {
        this.waveManager.bossRush = true;
      }

      // Max towers override
      if (this.dailyChallengeFlags.maxTowersOverride !== null) {
        this.maxTowersForLevel = this.dailyChallengeFlags.maxTowersOverride;
      }

      // Forced auto-wave
      if (this.dailyChallengeFlags.autoWaveForced) {
        this.autoWave = true;
        this.autoWaveDelay = this.dailyChallengeFlags.autoWaveDelay;
        this.autoWaveBtn.classList.add('active');
        this.autoWaveBtn.textContent = 'Auto: An';
      }
    }

    // Show challenge modifiers banner
    const modDescs = this.dailyChallenge.getModifierDescriptions();
    for (const mod of modDescs) {
      this.showDropBanner(`${mod.icon} ${mod.name}`);
    }

    this.start();
  }

  // ─── Level Progress Persistence ──────────────────────
  private loadProgress(): number {
    try {
      const val = localStorage.getItem(Game.PROGRESS_KEY);
      if (val !== null) {
        const idx = parseInt(val, 10);
        if (!isNaN(idx) && idx >= 0) return Math.min(idx, LEVELS.length - 1);
      }
    } catch { /* ignore */ }
    // Alle Level freigeschaltet als Standard
    return LEVELS.length - 1;
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(Game.PROGRESS_KEY, String(this.currentLevelIndex));
    } catch { /* ignore */ }
  }

  // ─── Mode Controller Routing ──────────────────────────
  private startModeController(controller: GameController): void {
    // Clean up any active controller
    if (this.activeController) {
      this.activeController.cleanup();
      this.activeController = null;
    }

    this.activeController = controller;
    const modifiers = this.runManager.getModifiers();

    // Hide TD game UI (controller manages its own UI)
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = 'none';

    controller.onVictory = (stats: ModeStats) => {
      this.activeController?.cleanup();
      this.activeController = null;
      this.running = false;
      // Earn crystals
      this.backpackManager.earnCrystals(stats.crystalsEarned);
      // Advance level progress
      const nextIdx = this.currentLevelIndex + 1;
      if (nextIdx < LEVELS.length && nextIdx > this.loadProgress()) {
        this.currentLevelIndex = nextIdx;
        this.saveProgress();
      }
      // Show victory and return to hub
      this.showModeEndScreen(true, stats);
    };

    controller.onDefeat = (stats: ModeStats) => {
      this.activeController?.cleanup();
      this.activeController = null;
      this.running = false;
      this.backpackManager.earnCrystals(stats.crystalsEarned);
      this.showModeEndScreen(false, stats);
    };

    controller.init(this.currentLevel, modifiers, this.sceneManager.scene, this.sceneManager.camera);
    controller.start();
    this.running = true;
    this.lastTime = performance.now();
    this.modeGameLoop();
  }

  private modeGameLoop = (): void => {
    if (!this.running || !this.activeController) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.activeController.update(dt);
    this.sceneManager.render();
    requestAnimationFrame(this.modeGameLoop);
  };

  private showModeEndScreen(victory: boolean, stats: ModeStats): void {
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = '';

    this.gameOverTitle.textContent = victory ? 'SIEG!' : 'GAME OVER';
    this.gameOverTitle.className = victory ? 'victory' : '';

    const extraLines = stats.extra
      ? Object.entries(stats.extra).map(([k, v]) => `${k}: ${v}`).join('<br>')
      : '';

    this.gameOverStats.innerHTML = `
      Modus: ${MODE_NAMES[this.currentLevel.gameMode || 'tower_defense']}<br>
      Runden: ${stats.wavesCompleted}<br>
      Kills: ${stats.kills}<br>
      💎 Kristalle: ${stats.crystalsEarned}<br>
      ${extraLines}
    `;
    this.restartBtn.textContent = 'Zurück zur Basis';
    this.gameOverScreen.classList.add('visible');
  }

  private restart(): void {
    this.hideRestartConfirmation();
    this.cleanupEndScreenExtras();
    this.gameOverScreen.classList.remove('visible');
    this.gameOverScreen.classList.remove('victory-overlay', 'defeat-overlay');
    this.restartBtn.style.display = '';
    this.screenVignette.classList.remove('danger', 'critical', 'boss-active');

    // Reset game speed, auto-wave, and camera follow
    this.gameSpeed = 1;
    this.speedBtn.textContent = '1x';
    this.clearAutoWaveCountdown();
    this.autoWave = false;
    this.autoWaveBtn.classList.remove('active');
    this.autoWaveBtn.textContent = 'Auto: Aus';
    this.cameraController.setAutoFollow(false);
    this.cameraFollowBtn.classList.remove('active');
    this.cameraFollowBtn.textContent = 'Kamera: Frei';

    // Clean up active mode controller
    if (this.activeController) {
      this.activeController.cleanup();
      this.activeController = null;
    }

    // Full run reset
    this.runManager.reset();
    this.statsTracker.reset();
    this.backpackManager.resetRun();
    this.difficultyScaling.reset();
    this.towerDebuffs = [];
    this.isEndlessRun = false;
    this.isDailyChallengeRun = false;
    this.dailyChallengeFlags = null;
    this.autoWaveDelay = 5;
    this.currentLevelIndex = this.loadProgress();
    this.currentLevel = LEVELS[Math.min(this.currentLevelIndex, LEVELS.length - 1)];
    this.bossBarVisible = false;
    this.lastBossHp = -1;
    this.bossHpContainer.classList.remove('visible', 'hiding');
    this.announcements.cleanup();

    // Clean up (guard for first-load case)
    if (this.waveManager) this.waveManager.reset();
    Enemy.clearDeathEffects(this.sceneManager.scene);
    if (this.placementSystem) this.placementSystem.reset();
    if (this.projectileSystem) this.projectileSystem.clear();
    if (this.synergySystem) this.synergySystem.reset();
    this.damageNumbers.clear();
    this.resourcePopups.clear();
    if (this.particleSystem) this.particleSystem.clear();
    if (this.lootEffects) this.lootEffects.cleanup();
    if (this.weatherSystem) { this.weatherSystem.cleanup(); this.weatherSystem = null; }
    if (this.animationSystem) this.animationSystem.clear();
    if (this.terrainRenderer) { this.terrainRenderer.resetBaseDamage(); this.terrainRenderer = null; }
    this.soundSystem.stopMusic();
    this.minimap.hide();
    this.enemyTooltip.hide();

    // Remove terrain
    const toRemove: THREE.Object3D[] = [];
    this.sceneManager.scene.traverse(obj => {
      if (obj instanceof THREE.Group && obj.name === 'terrain') {
        toRemove.push(obj);
      }
    });
    toRemove.forEach(obj => this.sceneManager.scene.remove(obj));

    // Return to base hub
    this.showBaseHub();
  }

  // ─── End Screen Helpers ──────────────────────────────

  /** Collect all stats for the end screen in a structured format. */
  private collectEndStats(): { label: string; value: number; colorClass: string }[] {
    const currentWave = this.waveManager.getCurrentWave();
    const totalWaves = this.currentLevel.waves.length;
    const bestCombo = this.statsTracker.bestCombo;

    const stats: { label: string; value: number; colorClass: string }[] = [
      { label: 'Kills gesamt', value: this.statsTracker.kills, colorClass: 'red' },
      { label: 'Boss-Kills', value: this.statsTracker.bossKills, colorClass: 'red' },
      { label: 'Wellen \u00fcberlebt', value: currentWave, colorClass: 'blue' },
      { label: 'Wellen gesamt', value: totalWaves, colorClass: 'blue' },
      { label: 'Basis HP', value: Math.ceil(this.baseHP), colorClass: 'green' },
      { label: 'Schaden erhalten', value: Math.floor(this.levelDamageTaken), colorClass: 'red' },
    ];

    if (bestCombo >= 3) {
      stats.push({ label: 'Beste Kombo', value: bestCombo, colorClass: 'gold' });
    }

    return stats;
  }

  /** Collect detailed post-game level stats for the statistics summary. */
  private collectPostGameStats(): LevelStats {
    const weapons = this.placementSystem.getPlacedWeapons();
    const topKiller = findTopKiller(weapons.map(w => ({ key: w.key, kills: w.kills })));
    const currentWave = this.waveManager.getCurrentWave();
    const elapsed = (performance.now() - this.levelStartTime) / 1000;

    // Sum total damage from all placed weapons (per-weapon tracking is more accurate)
    let totalDamage = 0;
    for (const w of weapons) {
      totalDamage += w.totalDamageDealt;
    }

    return {
      totalDamageDealt: totalDamage,
      towersPlaced: this.levelTowersPlaced,
      towersUpgraded: this.levelTowersUpgraded,
      topKillerName: topKiller.name,
      topKillerKills: topKiller.kills,
      bestCombo: this.statsTracker.bestCombo,
      goldEarned: this.levelGoldEarned,
      goldSpent: this.levelGoldSpent,
      wavesSurvived: currentWave,
      timePlayed: elapsed,
    };
  }

  /** Build the HTML grid for end-screen stats with data-target attributes for count-up. */
  private buildEndStatsHtml(stats: { label: string; value: number; colorClass: string }[], muted: boolean): string {
    let html = `<div class="end-stats-grid${muted ? ' muted' : ''}">`;
    for (let i = 0; i < stats.length; i++) {
      const s = stats[i];
      html += `
        <div class="end-stat-row" data-stat-index="${i}">
          <span class="end-stat-label">${s.label}</span>
          <span class="end-stat-value ${s.colorClass}" data-target="${s.value}">0</span>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  /** Animate stat rows sliding in with stagger, then count up their values. */
  private animateEndStats(): void {
    const rows = document.querySelectorAll('.end-stat-row');
    rows.forEach((row, i) => {
      const delay = 200 + i * 120;
      setTimeout(() => {
        row.classList.add('animate-in');
        // Start count-up for the value inside this row
        const valueEl = row.querySelector('.end-stat-value') as HTMLElement;
        if (valueEl) {
          const target = parseInt(valueEl.dataset.target || '0', 10);
          this.animateCountUpElement(valueEl, target, 800);
        }
      }, delay);
    });
  }

  /** Animate a count-up on an element found by ID. */
  private animateCountUp(elementId: string, target: number, durationMs: number): void {
    const el = document.getElementById(elementId);
    if (!el) return;
    // Delay start slightly so it appears after stats
    setTimeout(() => {
      this.animateCountUpElement(el, target, durationMs);
    }, 600);
  }

  /** Core count-up animation using requestAnimationFrame. */
  private animateCountUpElement(el: HTMLElement, target: number, durationMs: number): void {
    if (target <= 0) {
      el.textContent = '0';
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out curve for satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      el.textContent = current.toLocaleString('de-DE');
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toLocaleString('de-DE');
      }
    };
    requestAnimationFrame(tick);
  }

  /** Spawn sparkle particles around the crystal counter element. */
  private spawnCrystalSparkles(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Make container position: relative if not already
    container.style.position = 'relative';
    const spawnOne = () => {
      const sparkle = document.createElement('span');
      sparkle.className = 'crystal-sparkle';
      const sx = (Math.random() - 0.5) * 60;
      const sy = -10 - Math.random() * 30;
      sparkle.style.setProperty('--sx', `${sx}px`);
      sparkle.style.setProperty('--sy', `${sy}px`);
      sparkle.style.left = `${40 + Math.random() * 20}%`;
      sparkle.style.top = `${30 + Math.random() * 40}%`;
      container.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 800);
    };
    // Burst of sparkles during count-up
    let count = 0;
    const interval = setInterval(() => {
      spawnOne();
      count++;
      if (count > 12) clearInterval(interval);
    }, 150);
  }

  /** Show the restart confirmation dialog (mid-game). */
  private showRestartConfirmation(): void {
    if (!this.running) return;
    const dialog = document.getElementById('restart-confirm');
    const backdrop = document.getElementById('restart-confirm-backdrop');
    if (dialog) dialog.classList.add('visible');
    if (backdrop) backdrop.classList.add('visible');
  }

  /** Hide the restart confirmation dialog. */
  private hideRestartConfirmation(): void {
    const dialog = document.getElementById('restart-confirm');
    const backdrop = document.getElementById('restart-confirm-backdrop');
    if (dialog) dialog.classList.remove('visible');
    if (backdrop) backdrop.classList.remove('visible');
  }

  /** Add a button row with "Nochmal spielen" and "Zurueck zur Basis" to the victory screen. */
  private addVictoryButtonRow(): void {
    // Remove any existing button row first
    this.cleanupEndScreenExtras();

    const btnRow = document.createElement('div');
    btnRow.className = 'end-btn-row';
    btnRow.id = 'end-btn-row';
    btnRow.innerHTML = `
      <button class="end-btn end-btn-retry" id="victory-retry-btn">Nochmal spielen</button>
      <button class="end-btn end-btn-hub" id="victory-hub-btn">Zur\u00fcck zur Basis</button>
    `;
    this.gameOverScreen.appendChild(btnRow);

    // Add restart hotkey hint
    const hint = document.createElement('div');
    hint.style.cssText = 'color: #666; font-size: 11px; text-align: center; margin-top: 8px; position: relative; z-index: 1;';
    hint.textContent = 'R: Nochmal spielen';
    hint.id = 'end-restart-hint';
    this.gameOverScreen.appendChild(hint);

    setTimeout(() => {
      document.getElementById('victory-retry-btn')?.addEventListener('click', () => {
        this.cleanupEndScreenExtras();
        this.retryLevel();
      });
      document.getElementById('victory-hub-btn')?.addEventListener('click', () => {
        this.cleanupEndScreenExtras();
        this.restart();
      });
    }, 50);
  }

  /** Remove extra elements added to the game-over screen (button rows etc.). */
  private cleanupEndScreenExtras(): void {
    const btnRow = document.getElementById('end-btn-row');
    if (btnRow) btnRow.remove();
    const hint = document.getElementById('end-restart-hint');
    if (hint) hint.remove();
  }

  /** Retry the current level without going back to hub. */
  private retryLevel(): void {
    this.hideRestartConfirmation();
    this.cleanupEndScreenExtras();
    this.gameOverScreen.classList.remove('visible', 'defeat-overlay', 'victory-overlay');
    this.restartBtn.style.display = '';

    // Reset game speed, auto-wave, and camera follow
    this.gameSpeed = 1;
    this.speedBtn.textContent = '1x';
    this.speedBtn.className = '';
    this.clearAutoWaveCountdown();
    this.autoWave = false;
    this.autoWaveBtn.classList.remove('active');
    this.autoWaveBtn.textContent = 'Auto: Aus';
    this.cameraController.setAutoFollow(false);
    this.cameraFollowBtn.classList.remove('active');
    this.cameraFollowBtn.textContent = 'Kamera: Frei';

    // Reset stats but keep run modifiers (player chose them)
    this.statsTracker.reset();
    this.towerDebuffs = [];
    this.bossBarVisible = false;
    this.lastBossHp = -1;
    this.bossHpContainer.classList.remove('visible', 'hiding');
    this.announcements.cleanup();

    // Clean up systems
    if (this.waveManager) this.waveManager.reset();
    Enemy.clearDeathEffects(this.sceneManager.scene);
    if (this.placementSystem) this.placementSystem.reset();
    if (this.projectileSystem) this.projectileSystem.clear();
    if (this.synergySystem) this.synergySystem.reset();
    this.damageNumbers.clear();
    this.resourcePopups.clear();
    if (this.particleSystem) this.particleSystem.clear();
    if (this.lootEffects) this.lootEffects.cleanup();
    if (this.weatherSystem) { this.weatherSystem.cleanup(); this.weatherSystem = null; }
    if (this.animationSystem) this.animationSystem.clear();
    if (this.terrainRenderer) { this.terrainRenderer.resetBaseDamage(); this.terrainRenderer = null; }
    this.soundSystem.stopMusic();
    this.minimap.hide();
    this.enemyTooltip.hide();

    // Remove terrain
    const toRemove: THREE.Object3D[] = [];
    this.sceneManager.scene.traverse(obj => {
      if (obj instanceof THREE.Group && obj.name === 'terrain') {
        toRemove.push(obj);
      }
    });
    toRemove.forEach(obj => this.sceneManager.scene.remove(obj));

    // Restore game UI
    const gameUI = document.getElementById('game-ui');
    if (gameUI) gameUI.style.display = '';

    // Re-initialize and start the same level
    this.initLevel(this.currentLevel);
    this.start();
  }
}
