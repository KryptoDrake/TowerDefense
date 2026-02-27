import * as THREE from 'three';
import { PathSystem } from '../map/PathSystem';
import { BALANCE, ZombieType } from '../systems/BalanceConfig';

export class Enemy {
  readonly mesh: THREE.Group;
  readonly type: ZombieType;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  damage: number;
  alive = true;
  reachedEnd = false;
  dying = false;
  deathDone = false;
  goldGiven = false;

  /** The last weapon that dealt damage to this enemy (for kill attribution).
   *  Typed as `any` to avoid circular import with Weapon. */
  lastDamagedByWeapon: any = null;
  /** Whether the kill for this enemy was already attributed to a weapon */
  killAttributed = false;

  private deathTimer = 0;
  private readonly deathDuration = 1.0;
  private originalScale = 1;
  private deathRotDir = 1; // random tumble direction on death

  // Hit flash
  private hitFlashTimer = 0;
  private readonly hitFlashDuration = 0.15;
  private originalColors: Map<THREE.Material, number> = new Map();
  private colorsStored = false;

  private pathSystem: PathSystem;
  private distanceTraveled = 0;
  private totalPathLength: number;
  // Floating health bar (sprite-based, auto-billboards)
  private healthBarSprite: THREE.Sprite | null = null;
  private healthBarCanvas: HTMLCanvasElement | null = null;
  private healthBarCtx: CanvasRenderingContext2D | null = null;
  private healthBarTexture: THREE.CanvasTexture | null = null;
  private healthBarVisible = false;
  private lastHealthRatio = 1; // track to avoid unnecessary redraws

  private slowTimer = 0;
  private dotDamage = 0;
  private dotTimer = 0;
  private dotType: 'fire' | 'poison' = 'fire';

  // Boss ability state
  shielded = false;
  enraged = false;

  // Status effect visuals
  private slowAura: THREE.Mesh | null = null;
  private dotAura: THREE.Mesh | null = null;

  // Status icon bar (below health bar)
  private statusBarSprite: THREE.Sprite | null = null;
  private statusBarCanvas: HTMLCanvasElement | null = null;
  private statusBarCtx: CanvasRenderingContext2D | null = null;
  private statusBarTexture: THREE.CanvasTexture | null = null;
  private lastStatusKey = ''; // cache key to avoid unnecessary redraws

  // Animation
  private walkCycle = 0;
  private leftLeg: THREE.Mesh | null = null;
  private rightLeg: THREE.Mesh | null = null;
  private leftArm: THREE.Mesh | null = null;
  private rightArm: THREE.Mesh | null = null;

  // ─── Special type visual indicators ────────────────
  /** Healer: floating green cross above head */
  private healerCross: THREE.Group | null = null;
  /** Shielded: translucent blue shield sphere */
  private shieldBubble: THREE.Mesh | null = null;
  /** Splitter: orbiting dot meshes */
  private orbitDots: THREE.Mesh[] = [];
  private orbitTimer = 0;
  /** Fast: yellow motion trail mesh */
  private speedTrail: THREE.Mesh | null = null;
  /** Boss: pulsing red aura ring */
  private bossAura: THREE.Mesh | null = null;
  private bossAuraTimer = 0;

  // Spawn (rising from ground) animation
  private spawnTimer = 0;
  private readonly spawnDuration = 1.5;
  private isSpawning = true;
  // Walk from grave to path center
  private isWalkingToPath = false;
  private spawnOrigin = new THREE.Vector3();
  private pathStart = new THREE.Vector3();

  // ─── Special enemy type properties ───────────────────
  /** Flyer: height above ground (default 0 for ground units) */
  readonly flyHeight: number = 0;
  /** Flyer: animation timer for hovering bob */
  private flyBobTimer = 0;
  /** Flyer: wing meshes for flapping animation */
  private leftWing: THREE.Mesh | null = null;
  private rightWing: THREE.Mesh | null = null;

  /** Healer: radius in which nearby allies are healed */
  readonly healRadius: number = 0;
  /** Healer: HP healed per second to nearby allies */
  readonly healRate: number = 0;
  /** Healer: visual aura mesh */
  private healAura: THREE.Mesh | null = null;
  /** Healer: pulse animation timer */
  private healPulseTimer = 0;

  /** Splitter: whether this enemy splits on death */
  readonly splitsOnDeath: boolean = false;
  /** Splitter: the type to spawn when splitting */
  readonly splitType: ZombieType | null = null;
  /** Splitter: number of mini enemies to spawn */
  readonly splitCount: number = 0;

  // ─── Death Effects (static, scene-level) ─────────────────
  /** Whether death debris has been spawned for this enemy */
  private deathEffectsSpawned = false;

  private static deathDebris: Array<{
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    lifetime: number;
    maxLifetime: number;
  }> = [];

  private static groundSplats: Array<{
    mesh: THREE.Mesh;
    lifetime: number;
  }> = [];

  // ─── Spawn Ground Crack (static, scene-level) ─────────
  private spawnCrackSpawned = false;

  private static spawnCracks: Array<{
    mesh: THREE.Group;
    lifetime: number;
    maxLifetime: number;
  }> = [];

  constructor(type: ZombieType, pathSystem: PathSystem) {
    this.type = type;
    this.pathSystem = pathSystem;
    this.totalPathLength = pathSystem.getTotalLength();

    const stats = BALANCE.zombies[type];
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.speed = stats.speed;
    this.baseSpeed = stats.speed;
    this.damage = stats.damage;

    // Set special properties based on type
    if (type === 'flyer') {
      this.flyHeight = 2.0;
    } else if (type === 'healer') {
      this.healRadius = 3;
      this.healRate = 10;
    } else if (type === 'splitter') {
      this.splitsOnDeath = true;
      this.splitType = 'mini_splitter';
      this.splitCount = 2;
    }

    this.mesh = this.createZombieMesh(type, stats.color, stats.scale);

    // Random spawn position within graveyard radius
    const startPos = pathSystem.getPositionAtDistance(0);
    this.pathStart.copy(startPos);
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.5 + Math.random() * 3.5; // between 1.5 and 5 units from center
    this.spawnOrigin.set(
      startPos.x + Math.sin(angle) * radius,
      0,
      startPos.z + Math.cos(angle) * radius
    );
    this.mesh.position.copy(this.spawnOrigin);
    this.mesh.position.y = -2.0;

    // Add visual indicators for special enemy types
    this.addSpecialVisuals();
  }

  /** Add visual indicators for special enemy types (healer cross, shield bubble, orbit dots, speed trail, boss aura) */
  private addSpecialVisuals(): void {
    const stats = BALANCE.zombies[this.type];
    const s = stats.scale;

    // ── Healer: floating green cross (+) above head ──
    if (this.healRate > 0) {
      this.healerCross = new THREE.Group();
      const crossMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
      // Horizontal bar
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), crossMat);
      this.healerCross.add(hBar);
      // Vertical bar
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), crossMat);
      this.healerCross.add(vBar);
      // Position above the head
      this.healerCross.position.y = 2.4 * s;
      this.mesh.add(this.healerCross);
    }

    // ── Shielded: translucent blue sphere around the enemy ──
    if (this.shielded) {
      const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shieldGeo = new THREE.SphereGeometry(1.3 * s, 16, 10);
      this.shieldBubble = new THREE.Mesh(shieldGeo, shieldMat);
      this.shieldBubble.position.y = 1.0;
      this.mesh.add(this.shieldBubble);
    }

    // ── Splitter: orbiting dots (3 tiny spheres) ──
    if (this.splitsOnDeath) {
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
      const dotGeo = new THREE.SphereGeometry(0.08, 6, 4);
      for (let i = 0; i < 3; i++) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.y = 1.0;
        this.mesh.add(dot);
        this.orbitDots.push(dot);
      }
    }

    // ── Fast: yellow motion trail behind the enemy ──
    if (this.type === 'fast') {
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.35,
      });
      const trailGeo = new THREE.BoxGeometry(0.12, 0.25, 0.9);
      this.speedTrail = new THREE.Mesh(trailGeo, trailMat);
      // Position behind the enemy (negative Z is backward when facing +Z)
      this.speedTrail.position.set(0, 0.8, -0.7);
      this.mesh.add(this.speedTrail);
    }

    // ── Boss: pulsing red aura ring ──
    if (this.type === 'boss') {
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xff2200,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const auraGeo = new THREE.RingGeometry(1.8, 2.4, 24);
      this.bossAura = new THREE.Mesh(auraGeo, auraMat);
      this.bossAura.rotation.x = -Math.PI / 2; // Lay flat on ground
      this.bossAura.position.y = 0.1;
      this.mesh.add(this.bossAura);
    }
  }

  private createZombieMesh(type: ZombieType, color: number, scale: number): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color });
    const darkMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.15) });

    if (type === 'flyer') {
      return this.createFlyerMesh(group, mat, darkMat, color, scale);
    } else if (type === 'healer') {
      return this.createHealerMesh(group, mat, darkMat, color, scale);
    } else if (type === 'splitter' || type === 'mini_splitter') {
      return this.createSplitterMesh(group, mat, darkMat, color, scale, type === 'mini_splitter');
    }

    // Unique meshes for tank and boss
    if (type === 'tank') {
      return this.createTankMesh(group, mat, darkMat, color, scale);
    } else if (type === 'boss') {
      return this.createBossMesh(group, mat, darkMat, color, scale);
    }

    // Default zombie mesh (normal, fast) — fast gets tweaks after creation
    const mesh = this.createDefaultMesh(group, mat, darkMat, scale);

    // Fast zombie: leaner posture + claw tips + faster animation
    if (type === 'fast') {
      // Lean forward (hunched runner)
      const body = group.children.find(c => c.position.y > 1.0 && c.position.y < 1.2) as THREE.Mesh | undefined;
      if (body) body.rotation.x = 0.15;
      // Elongated arms
      if (this.leftArm) this.leftArm.scale.y = 1.3;
      if (this.rightArm) this.rightArm.scale.y = 1.3;
      // Claw tips on arm ends
      const clawMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const clawGeo = new THREE.ConeGeometry(0.04, 0.12, 4);
      for (const arm of [this.leftArm, this.rightArm]) {
        if (!arm) continue;
        const claw = new THREE.Mesh(clawGeo, clawMat);
        claw.position.y = -0.4;
        claw.rotation.x = Math.PI;
        arm.add(claw);
      }
    }

    // Mouth detail for all default zombies (normal + fast)
    const mouthMat = new THREE.MeshLambertMaterial({ color: 0x220000 });
    const mouthGeo = new THREE.BoxGeometry(0.2, 0.06, 0.05);
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 1.72, 0.23);
    group.add(mouth);

    return mesh;
  }

  private createDefaultMesh(group: THREE.Group, mat: THREE.MeshLambertMaterial, darkMat: THREE.MeshLambertMaterial, scale: number): THREE.Group {
    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.9, 0.4);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.8;
    head.castShadow = true;
    group.add(head);

    // Eyes (red glowing)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 1.85, 0.23);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 1.85, 0.23);
    group.add(rightEye);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.5, 1.1, 0.2);
    this.leftArm.castShadow = true;
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.5, 1.1, 0.2);
    this.rightArm.castShadow = true;
    group.add(this.rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
    this.leftLeg = new THREE.Mesh(legGeo, darkMat);
    this.leftLeg.position.set(-0.15, 0.3, 0);
    this.leftLeg.castShadow = true;
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, darkMat);
    this.rightLeg.position.set(0.15, 0.3, 0);
    this.rightLeg.castShadow = true;
    group.add(this.rightLeg);

    group.scale.setScalar(scale);
    return group;
  }

  private createTankMesh(group: THREE.Group, mat: THREE.MeshLambertMaterial, darkMat: THREE.MeshLambertMaterial, color: number, scale: number): THREE.Group {
    const armorMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.2) });

    // Wide body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.9, 0.55);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    // Gürtel/Belt band
    const beltGeo = new THREE.BoxGeometry(0.85, 0.1, 0.6);
    const belt = new THREE.Mesh(beltGeo, armorMat);
    belt.position.y = 0.75;
    group.add(belt);

    // Shoulder armor plates
    for (const xOff of [-0.38, 0.38]) {
      const shoulderGeo = new THREE.BoxGeometry(0.35, 0.12, 0.45);
      const shoulder = new THREE.Mesh(shoulderGeo, armorMat);
      shoulder.position.set(xOff, 1.65, 0);
      shoulder.castShadow = true;
      group.add(shoulder);
    }

    // Wide head with helm/visor
    const headGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);

    // Helm visor slit (instead of eyes)
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const visorGeo = new THREE.BoxGeometry(0.35, 0.06, 0.05);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.88, 0.26);
    group.add(visor);

    // Shield on left arm
    const shieldMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const shieldGeo = new THREE.BoxGeometry(0.05, 0.6, 0.4);
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(-0.65, 1.1, 0.15);
    shield.castShadow = true;
    group.add(shield);

    // Arms (thick)
    const armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.55, 1.1, 0.1);
    this.leftArm.castShadow = true;
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.55, 1.1, 0.1);
    this.rightArm.castShadow = true;
    group.add(this.rightArm);

    // Legs (thick)
    const legGeo = new THREE.BoxGeometry(0.28, 0.6, 0.28);
    this.leftLeg = new THREE.Mesh(legGeo, darkMat);
    this.leftLeg.position.set(-0.2, 0.3, 0);
    this.leftLeg.castShadow = true;
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, darkMat);
    this.rightLeg.position.set(0.2, 0.3, 0);
    this.rightLeg.castShadow = true;
    group.add(this.rightLeg);

    group.scale.setScalar(scale);
    return group;
  }

  private createBossMesh(group: THREE.Group, mat: THREE.MeshLambertMaterial, darkMat: THREE.MeshLambertMaterial, color: number, scale: number): THREE.Group {
    const hornMat = new THREE.MeshLambertMaterial({ color: 0x660000, emissive: 0x330000, emissiveIntensity: 0.5 });

    // Massive body
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.1, 0.5);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 1.2;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.55, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 2.05;
    head.castShadow = true;
    group.add(head);

    // Horns (2x cones)
    for (const xOff of [-0.22, 0.22]) {
      const hornGeo = new THREE.ConeGeometry(0.06, 0.35, 4);
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(xOff, 2.5, -0.05);
      horn.rotation.z = xOff < 0 ? 0.25 : -0.25;
      horn.castShadow = true;
      group.add(horn);
    }

    // Glowing yellow eyes (bigger than normal)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.1, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.14, 2.1, 0.26);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.14, 2.1, 0.26);
    group.add(rightEye);

    // Jaw with teeth
    const jawMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.1) });
    const jawGeo = new THREE.BoxGeometry(0.4, 0.12, 0.3);
    const jaw = new THREE.Mesh(jawGeo, jawMat);
    jaw.position.set(0, 1.82, 0.12);
    group.add(jaw);

    // Teeth (3 white cones)
    const toothMat = new THREE.MeshLambertMaterial({ color: 0xeeeecc });
    for (let i = 0; i < 3; i++) {
      const toothGeo = new THREE.ConeGeometry(0.025, 0.08, 4);
      const tooth = new THREE.Mesh(toothGeo, toothMat);
      tooth.position.set(-0.08 + i * 0.08, 1.78, 0.22);
      tooth.rotation.x = Math.PI;
      group.add(tooth);
    }

    // Shoulder spikes
    for (const xOff of [-0.5, 0.5]) {
      const spikeGeo = new THREE.ConeGeometry(0.08, 0.3, 4);
      const spike = new THREE.Mesh(spikeGeo, hornMat);
      spike.position.set(xOff, 1.95, 0);
      spike.castShadow = true;
      group.add(spike);
    }

    // Arms (thick) with claws
    const armGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.58, 1.1, 0.15);
    this.leftArm.castShadow = true;
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.58, 1.1, 0.15);
    this.rightArm.castShadow = true;
    group.add(this.rightArm);

    // Claws on each arm (3 small cones)
    const clawMat = new THREE.MeshLambertMaterial({ color: 0xccccaa });
    for (const arm of [this.leftArm, this.rightArm]) {
      if (!arm) continue;
      for (let i = -1; i <= 1; i++) {
        const clawGeo = new THREE.ConeGeometry(0.025, 0.12, 4);
        const claw = new THREE.Mesh(clawGeo, clawMat);
        claw.position.set(i * 0.06, -0.45, 0.05);
        claw.rotation.x = Math.PI;
        arm.add(claw);
      }
    }

    // Legs (thick)
    const legGeo = new THREE.BoxGeometry(0.28, 0.7, 0.28);
    this.leftLeg = new THREE.Mesh(legGeo, darkMat);
    this.leftLeg.position.set(-0.22, 0.35, 0);
    this.leftLeg.castShadow = true;
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, darkMat);
    this.rightLeg.position.set(0.22, 0.35, 0);
    this.rightLeg.castShadow = true;
    group.add(this.rightLeg);

    group.scale.setScalar(scale);
    return group;
  }

  private createFlyerMesh(group: THREE.Group, mat: THREE.MeshLambertMaterial, darkMat: THREE.MeshLambertMaterial, color: number, scale: number): THREE.Group {
    // Slim body
    const bodyGeo = new THREE.BoxGeometry(0.45, 0.7, 0.3);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.6;
    head.castShadow = true;
    group.add(head);

    // Glowing cyan eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08, 1.65, 0.18);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.08, 1.65, 0.18);
    group.add(rightEye);

    // Arms (short, stretched out)
    const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.35, 1.0, 0.1);
    this.leftArm.castShadow = true;
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.35, 1.0, 0.1);
    this.rightArm.castShadow = true;
    group.add(this.rightArm);

    // Bat-like wings (thin wide box geometry)
    const wingMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color).offsetHSL(0, 0, -0.2),
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const wingGeo = new THREE.BoxGeometry(1.0, 0.6, 0.03);
    this.leftWing = new THREE.Mesh(wingGeo, wingMat);
    this.leftWing.position.set(-0.7, 1.2, -0.1);
    this.leftWing.rotation.z = 0.3;
    this.leftWing.castShadow = true;
    group.add(this.leftWing);

    this.rightWing = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing.position.set(0.7, 1.2, -0.1);
    this.rightWing.rotation.z = -0.3;
    this.rightWing.castShadow = true;
    group.add(this.rightWing);

    // No legs for flyer (dangling stumps)
    const stumpGeo = new THREE.BoxGeometry(0.12, 0.25, 0.12);
    this.leftLeg = new THREE.Mesh(stumpGeo, darkMat);
    this.leftLeg.position.set(-0.1, 0.4, 0);
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(stumpGeo, darkMat);
    this.rightLeg.position.set(0.1, 0.4, 0);
    group.add(this.rightLeg);

    group.scale.setScalar(scale);
    return group;
  }

  private createHealerMesh(group: THREE.Group, mat: THREE.MeshLambertMaterial, darkMat: THREE.MeshLambertMaterial, _color: number, scale: number): THREE.Group {
    // Body (robed)
    const bodyGeo = new THREE.BoxGeometry(0.55, 1.0, 0.4);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 1.15;
    body.castShadow = true;
    group.add(body);

    // Robe skirt (wider bottom)
    const skirtGeo = new THREE.BoxGeometry(0.7, 0.35, 0.5);
    const skirt = new THREE.Mesh(skirtGeo, mat);
    skirt.position.y = 0.5;
    skirt.castShadow = true;
    group.add(skirt);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.9;
    head.castShadow = true;
    group.add(head);

    // Green glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.05);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 1.95, 0.21);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 1.95, 0.21);
    group.add(rightEye);

    // Left arm
    const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.45, 1.1, 0.15);
    this.leftArm.castShadow = true;
    group.add(this.leftArm);

    // Right arm (holds staff)
    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.45, 1.1, 0.15);
    this.rightArm.castShadow = true;
    group.add(this.rightArm);

    // Staff
    const staffMat = new THREE.MeshLambertMaterial({ color: 0x886633 });
    const staffGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6);
    const staff = new THREE.Mesh(staffGeo, staffMat);
    staff.position.set(0.55, 1.3, 0.15);
    staff.castShadow = true;
    group.add(staff);

    // Staff orb (glowing green)
    const orbMat = new THREE.MeshBasicMaterial({ color: 0x44ff88 });
    const orbGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(0.55, 2.45, 0.15);
    group.add(orb);

    // Heal aura (transparent green sphere around the unit)
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    const auraGeo = new THREE.SphereGeometry(1.5, 12, 8);
    this.healAura = new THREE.Mesh(auraGeo, auraMat);
    this.healAura.position.y = 1.0;
    group.add(this.healAura);

    // Legs (hidden under robe, short)
    const legGeo = new THREE.BoxGeometry(0.18, 0.3, 0.18);
    this.leftLeg = new THREE.Mesh(legGeo, darkMat);
    this.leftLeg.position.set(-0.12, 0.15, 0);
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, darkMat);
    this.rightLeg.position.set(0.12, 0.15, 0);
    group.add(this.rightLeg);

    group.scale.setScalar(scale);
    return group;
  }

  private createSplitterMesh(group: THREE.Group, mat: THREE.MeshLambertMaterial, darkMat: THREE.MeshLambertMaterial, color: number, scale: number, isMini: boolean): THREE.Group {
    // Bloated body (wider and rounder)
    const bodyW = isMini ? 0.5 : 0.85;
    const bodyH = isMini ? 0.7 : 1.1;
    const bodyD = isMini ? 0.45 : 0.7;
    const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = isMini ? 0.7 : 1.1;
    body.castShadow = true;
    group.add(body);

    // Belly bulge (extra box sticking out front)
    const bellyGeo = new THREE.BoxGeometry(bodyW * 0.7, bodyH * 0.5, bodyD * 0.4);
    const belly = new THREE.Mesh(bellyGeo, mat);
    belly.position.set(0, isMini ? 0.6 : 0.95, bodyD * 0.5);
    belly.castShadow = true;
    group.add(belly);

    // Head (small relative to body)
    const headS = isMini ? 0.25 : 0.38;
    const headGeo = new THREE.BoxGeometry(headS, headS, headS);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = isMini ? 1.15 : 1.9;
    head.castShadow = true;
    group.add(head);

    // Orange glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.04);
    const eyeY = isMini ? 1.18 : 1.95;
    const eyeZ = headS * 0.52;
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-headS * 0.22, eyeY, eyeZ);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(headS * 0.22, eyeY, eyeZ);
    group.add(rightEye);

    // Crack lines on body (thin dark boxes across surface)
    const crackMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.3) });
    for (let i = 0; i < 3; i++) {
      const crackGeo = new THREE.BoxGeometry(bodyW * 0.8, 0.03, bodyD + 0.02);
      const crack = new THREE.Mesh(crackGeo, crackMat);
      crack.position.y = (isMini ? 0.5 : 0.8) + i * (isMini ? 0.15 : 0.25);
      crack.rotation.z = (Math.random() - 0.5) * 0.3;
      group.add(crack);
    }

    // Short thick arms
    const armW = isMini ? 0.12 : 0.22;
    const armH = isMini ? 0.35 : 0.55;
    const armGeo = new THREE.BoxGeometry(armW, armH, armW);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-(bodyW / 2 + armW / 2), isMini ? 0.7 : 1.1, 0.1);
    this.leftArm.castShadow = true;
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set((bodyW / 2 + armW / 2), isMini ? 0.7 : 1.1, 0.1);
    this.rightArm.castShadow = true;
    group.add(this.rightArm);

    // Short thick legs
    const legW = isMini ? 0.14 : 0.24;
    const legH = isMini ? 0.3 : 0.45;
    const legGeo = new THREE.BoxGeometry(legW, legH, legW);
    this.leftLeg = new THREE.Mesh(legGeo, darkMat);
    this.leftLeg.position.set(-(bodyW * 0.25), legH / 2, 0);
    this.leftLeg.castShadow = true;
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, darkMat);
    this.rightLeg.position.set((bodyW * 0.25), legH / 2, 0);
    this.rightLeg.castShadow = true;
    group.add(this.rightLeg);

    group.scale.setScalar(scale);
    return group;
  }

  update(dt: number): void {
    if (!this.alive) return;

    // Phase 1: Rise from the ground
    if (this.isSpawning) {
      this.spawnTimer += dt;
      const t = Math.min(this.spawnTimer / this.spawnDuration, 1);
      const eased = 1 - (1 - t) * (1 - t);

      this.mesh.position.y = -2.0 + eased * (2.0 + this.flyHeight);

      const armReach = Math.sin(t * Math.PI) * 1.2;
      if (this.leftArm) this.leftArm.rotation.x = -armReach;
      if (this.rightArm) this.rightArm.rotation.x = -armReach;
      this.mesh.rotation.z = Math.sin(this.spawnTimer * 8) * 0.08 * (1 - t);

      // Flyer: flap wings during spawn
      if (this.flyHeight > 0) {
        this.flyBobTimer += dt;
        const flapAngle = Math.sin(this.flyBobTimer * 8) * 0.6;
        if (this.leftWing) this.leftWing.rotation.z = 0.3 + flapAngle;
        if (this.rightWing) this.rightWing.rotation.z = -0.3 - flapAngle;
      }

      if (t >= 1) {
        this.isSpawning = false;
        this.isWalkingToPath = true;
        this.mesh.position.y = this.flyHeight;
        this.mesh.rotation.z = 0;
      }
      return;
    }

    // Phase 2: Walk from grave to path start
    if (this.isWalkingToPath) {
      const dir = this.pathStart.clone().sub(this.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 0.3) {
        this.isWalkingToPath = false;
        this.mesh.position.set(this.pathStart.x, this.flyHeight, this.pathStart.z);
      } else {
        dir.normalize();
        const step = this.baseSpeed * dt;
        this.mesh.position.add(dir.multiplyScalar(step));
        this.mesh.position.y = this.flyHeight;

        const targetAngle = Math.atan2(dir.x, dir.z);
        this.mesh.rotation.y = targetAngle;

        // Walk animation during this phase too
        this.walkCycle += dt * this.baseSpeed * 3;
        const swing = Math.sin(this.walkCycle) * 0.4;
        if (this.leftLeg) this.leftLeg.rotation.x = swing;
        if (this.rightLeg) this.rightLeg.rotation.x = -swing;
        if (this.leftArm) this.leftArm.rotation.x = -swing * 0.7;
        if (this.rightArm) this.rightArm.rotation.x = swing * 0.7;
      }

      // Flyer: flap wings while walking to path
      if (this.flyHeight > 0) {
        this.flyBobTimer += dt;
        const flapAngle = Math.sin(this.flyBobTimer * 8) * 0.6;
        if (this.leftWing) this.leftWing.rotation.z = 0.3 + flapAngle;
        if (this.rightWing) this.rightWing.rotation.z = -0.3 - flapAngle;
      }
      return;
    }

    // Apply slow effect
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.speed = this.baseSpeed;
        if (this.slowAura) this.slowAura.visible = false;
      }
    }

    // Apply DoT
    if (this.dotTimer > 0) {
      this.dotTimer -= dt;
      this.takeDamage(this.dotDamage * dt);
      // Flicker the DoT aura
      if (this.dotAura) {
        const mat = this.dotAura.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.15 + Math.sin(this.dotTimer * 8) * 0.15;
      }
      if (this.dotTimer <= 0 && this.dotAura) {
        this.dotAura.visible = false;
      }
    }

    // Move along path
    this.distanceTraveled += this.speed * dt;
    const progress = this.distanceTraveled / this.totalPathLength;

    if (progress >= 1) {
      this.reachedEnd = true;
      this.alive = false;
      return;
    }

    const newPos = this.pathSystem.getPositionAtDistance(progress);

    // Face movement direction
    const dir = newPos.clone().sub(this.mesh.position);
    if (dir.length() > 0.01) {
      const targetAngle = Math.atan2(dir.x, dir.z);
      this.mesh.rotation.y = targetAngle;
    }

    this.mesh.position.copy(newPos);
    this.mesh.position.y = this.flyHeight;

    // Flyer: hovering bob + wing flap animation
    if (this.flyHeight > 0) {
      this.flyBobTimer += dt;
      this.mesh.position.y = this.flyHeight + Math.sin(this.flyBobTimer * 3) * 0.2;

      // Wing flap
      const flapAngle = Math.sin(this.flyBobTimer * 8) * 0.6;
      if (this.leftWing) this.leftWing.rotation.z = 0.3 + flapAngle;
      if (this.rightWing) this.rightWing.rotation.z = -0.3 - flapAngle;

      // Dangling legs
      const legDangle = Math.sin(this.flyBobTimer * 2) * 0.15;
      if (this.leftLeg) this.leftLeg.rotation.x = 0.2 + legDangle;
      if (this.rightLeg) this.rightLeg.rotation.x = 0.2 - legDangle;
    } else {
      // Walk animation for ground units
      const isFast = this.type === 'fast';
      const isTankOrBoss = this.type === 'tank' || this.type === 'boss';
      const animSpeed = isFast ? 4.5 : (isTankOrBoss ? 2.0 : 3.0);
      const swingAmount = isFast ? 0.6 : (isTankOrBoss ? 0.25 : 0.4);
      this.walkCycle += dt * this.speed * animSpeed;
      const swing = Math.sin(this.walkCycle) * swingAmount;
      if (this.leftLeg) this.leftLeg.rotation.x = swing;
      if (this.rightLeg) this.rightLeg.rotation.x = -swing;
      if (this.leftArm) this.leftArm.rotation.x = -swing * 0.7;
      if (this.rightArm) this.rightArm.rotation.x = swing * 0.7;
    }

    // Healer: pulse aura animation
    if (this.healRadius > 0 && this.healAura) {
      this.healPulseTimer += dt;
      const pulseScale = 1.0 + Math.sin(this.healPulseTimer * 3) * 0.15;
      this.healAura.scale.setScalar(pulseScale);
      const auraMat = this.healAura.material as THREE.MeshBasicMaterial;
      auraMat.opacity = 0.08 + Math.sin(this.healPulseTimer * 3) * 0.06;
    }

    // ── Special type visual indicator animations ──

    // Healer cross: gentle bob up and down
    if (this.healerCross) {
      const stats = BALANCE.zombies[this.type];
      this.healerCross.position.y = 2.4 * stats.scale + Math.sin(this.healPulseTimer * 2) * 0.1;
    }

    // Shield bubble: subtle pulse + check if shield broke
    if (this.shieldBubble) {
      if (!this.shielded) {
        // Shield broke - fade out and remove
        const mat = this.shieldBubble.material as THREE.MeshBasicMaterial;
        mat.opacity -= dt * 0.5;
        if (mat.opacity <= 0) {
          this.mesh.remove(this.shieldBubble);
          this.shieldBubble.geometry.dispose();
          mat.dispose();
          this.shieldBubble = null;
        }
      } else {
        // Subtle breathing pulse
        const pulse = 1.0 + Math.sin(Date.now() * 0.003) * 0.05;
        this.shieldBubble.scale.setScalar(pulse);
      }
    }

    // Splitter orbiting dots
    if (this.orbitDots.length > 0) {
      this.orbitTimer += dt;
      const orbitRadius = 0.6;
      const orbitSpeed = 2.0;
      for (let i = 0; i < this.orbitDots.length; i++) {
        const angle = this.orbitTimer * orbitSpeed + (i * Math.PI * 2) / this.orbitDots.length;
        this.orbitDots[i].position.x = Math.cos(angle) * orbitRadius;
        this.orbitDots[i].position.z = Math.sin(angle) * orbitRadius;
        this.orbitDots[i].position.y = 1.0 + Math.sin(this.orbitTimer * 3 + i) * 0.15;
      }
    }

    // Speed trail opacity flicker
    if (this.speedTrail) {
      const trailMat = this.speedTrail.material as THREE.MeshBasicMaterial;
      trailMat.opacity = 0.25 + Math.sin(Date.now() * 0.01) * 0.1;
    }

    // Boss aura pulsing
    if (this.bossAura) {
      this.bossAuraTimer += dt;
      const auraMat = this.bossAura.material as THREE.MeshBasicMaterial;
      auraMat.opacity = 0.15 + Math.sin(this.bossAuraTimer * 2) * 0.1;
      const auraScale = 1.0 + Math.sin(this.bossAuraTimer * 1.5) * 0.15;
      this.bossAura.scale.setScalar(auraScale);
    }

    // Hit flash fade-out
    this.updateHitFlash(dt);

    // Floating health bar
    this.updateHealthBar();
  }

  /** Healer: heals nearby allies. Called externally by WaveManager. */
  healNearby(enemies: Enemy[], dt: number): void {
    if (!this.alive || this.healRate <= 0) return;
    // Skip spawning/walking phases
    if (this.isSpawning || this.isWalkingToPath) return;

    const myPos = this.mesh.position;
    const healAmount = this.healRate * dt;

    for (const other of enemies) {
      if (other === this || !other.alive) continue;
      if (other.isSpawning || other.isWalkingToPath) continue;
      const dist = myPos.distanceTo(other.mesh.position);
      if (dist <= this.healRadius) {
        other.heal(healAmount);
      }
    }
  }

  /** Restore HP (used by healer ability) */
  heal(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.hp + amount, this.maxHp);
    this.updateHpBar();
  }

  /** Set distance traveled (used when spawning mini-splitters at parent's position) */
  setDistanceTraveled(dist: number): void {
    this.distanceTraveled = dist;
  }

  /** Skip spawn animation (used for mini-splitters) */
  skipSpawnAnimation(): void {
    this.isSpawning = false;
    this.isWalkingToPath = false;
    this.spawnTimer = this.spawnDuration;
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    if (this.shielded) return;
    this.hp -= amount;
    this.updateHpBar();

    // Trigger hit flash (only for direct damage, skip tiny DoT ticks)
    if (amount > 0.5) {
      this.hitFlashTimer = this.hitFlashDuration;
      this.applyHitFlash();
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.dying = true;
      this.originalScale = this.mesh.scale.x;
      this.deathRotDir = Math.random() > 0.5 ? 1 : -1;
    }
  }

  updateDeath(dt: number): void {
    if (!this.dying || this.deathDone) return;
    this.deathTimer += dt;
    const t = Math.min(this.deathTimer / this.deathDuration, 1);

    // Two-phase death: 0-0.3 = dramatic fall, 0.3-1.0 = sink & dissolve
    if (t < 0.3) {
      // Phase 1: violent fall with bounce
      const p = t / 0.3; // 0→1 within first phase
      const fallEase = p * p * p; // cubic ease-in for impact feel

      // Slam forward
      this.mesh.rotation.x = fallEase * (Math.PI / 2.2);
      // Tumble sideways
      this.mesh.rotation.z = fallEase * (Math.PI / 5) * this.deathRotDir;
      // Quick drop to ground
      this.mesh.position.y = (this.flyHeight || 0) - fallEase * 0.8;

      // Brief scale "squash" on impact (flattens at end of phase 1)
      if (p > 0.7) {
        const squash = (p - 0.7) / 0.3;
        this.mesh.scale.set(
          this.originalScale * (1 + squash * 0.15),
          this.originalScale * (1 - squash * 0.25),
          this.originalScale * (1 + squash * 0.15)
        );
      }
    } else {
      // Phase 2: sink into ground + shrink away
      const p = (t - 0.3) / 0.7; // 0→1 within second phase
      const sinkEase = p * p;

      // Keep fallen rotation, add slight extra tumble
      this.mesh.rotation.x = (Math.PI / 2.2) + sinkEase * 0.2;
      this.mesh.rotation.z = (Math.PI / 5) * this.deathRotDir;

      // Sink deeper into ground
      this.mesh.position.y = (this.flyHeight || 0) - 0.8 - sinkEase * 1.2;

      // Shrink to nothing
      const shrink = this.originalScale * (1 - sinkEase);
      this.mesh.scale.setScalar(Math.max(0.01, shrink));

      // Fade out materials during last half
      if (p > 0.5) {
        const fadeAlpha = 1 - (p - 0.5) / 0.5;
        this.mesh.traverse(child => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (!mat.transparent) {
              mat.transparent = true;
              mat.depthWrite = false;
            }
            mat.opacity = Math.max(0, fadeAlpha);
          }
        });
      }
    }

    // Fade out hit flash during death
    this.updateHitFlash(dt);

    if (t >= 1) {
      this.deathDone = true;
    }
  }

  applySlow(factor: number, duration: number): void {
    this.speed = this.baseSpeed * factor;
    this.slowTimer = duration;

    // Show blue frost aura
    if (!this.slowAura) {
      const geo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.35,
      });
      this.slowAura = new THREE.Mesh(geo, mat);
      this.slowAura.position.y = 0.05;
      this.mesh.add(this.slowAura);
    }
    this.slowAura.visible = true;
  }

  applyDot(damagePerSec: number, duration: number, type: 'fire' | 'poison' = 'fire'): void {
    this.dotDamage = damagePerSec;
    this.dotTimer = duration;
    this.dotType = type;

    // Show damage-over-time aura
    if (!this.dotAura) {
      const geo = new THREE.SphereGeometry(0.3, 6, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.25,
      });
      this.dotAura = new THREE.Mesh(geo, mat);
      this.dotAura.position.y = 1.2;
      this.mesh.add(this.dotAura);
    }
    this.dotAura.visible = true;
  }

  /** Store original material colors for flash restoration (done once) */
  private storeOriginalColors(): void {
    if (this.colorsStored) return;
    this.colorsStored = true;
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        this.originalColors.set(child.material, child.material.color.getHex());
      }
    });
  }

  /** Apply the hit flash color (white for normal, red for boss) */
  private applyHitFlash(): void {
    this.storeOriginalColors();
    const flashColor = this.type === 'boss' ? 0xff2200 : 0xffffff;
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material.emissive.setHex(flashColor);
        child.material.emissiveIntensity = 1.0;
      }
    });
  }

  /** Update hit flash fade-out (call every frame) */
  private updateHitFlash(dt: number): void {
    if (this.hitFlashTimer <= 0) return;
    this.hitFlashTimer -= dt;
    const t = Math.max(0, this.hitFlashTimer / this.hitFlashDuration);
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material.emissiveIntensity = t;
      }
    });
    if (this.hitFlashTimer <= 0) {
      // Reset emissive completely
      this.mesh.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
          child.material.emissive.setHex(0x000000);
          child.material.emissiveIntensity = 0;
        }
      });
    }
  }

  /** Create the sprite-based floating health bar */
  private createHealthBar(): void {
    const isBoss = this.type === 'boss';
    const canvasW = isBoss ? 128 : 64;
    const canvasH = isBoss ? 20 : 12;

    this.healthBarCanvas = document.createElement('canvas');
    this.healthBarCanvas.width = canvasW;
    this.healthBarCanvas.height = canvasH;
    this.healthBarCtx = this.healthBarCanvas.getContext('2d')!;

    this.healthBarTexture = new THREE.CanvasTexture(this.healthBarCanvas);
    this.healthBarTexture.minFilter = THREE.LinearFilter;
    this.healthBarTexture.magFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.healthBarTexture,
      transparent: true,
      depthTest: false,
    });
    this.healthBarSprite = new THREE.Sprite(spriteMat);

    // Scale sprite to world units
    const barWidth = isBoss ? 2.0 : 1.0;
    const barHeight = isBoss ? 0.32 : 0.18;
    this.healthBarSprite.scale.set(barWidth, barHeight, 1);

    // Position above enemy head (account for enemy scale)
    const stats = BALANCE.zombies[this.type];
    const baseY = isBoss ? 5.0 : 2.5 * stats.scale + (this.flyHeight > 0 ? 0.5 : 0);
    this.healthBarSprite.position.y = baseY;

    // Render order to draw on top
    this.healthBarSprite.renderOrder = 999;

    this.mesh.add(this.healthBarSprite);
    this.healthBarVisible = true;

    // Initial draw
    this.drawHealthBar();
  }

  /** Draw the health bar onto the canvas texture */
  private drawHealthBar(): void {
    if (!this.healthBarCtx || !this.healthBarCanvas || !this.healthBarTexture) return;

    const ctx = this.healthBarCtx;
    const w = this.healthBarCanvas.width;
    const h = this.healthBarCanvas.height;
    const ratio = Math.max(0, this.hp / this.maxHp);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background (dark gray with slight transparency)
    ctx.fillStyle = 'rgba(30, 30, 30, 0.85)';
    ctx.roundRect(0, 0, w, h, 3);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = 1;
    ctx.roundRect(0, 0, w, h, 3);
    ctx.stroke();

    // Fill color based on ratio
    let fillColor: string;
    if (ratio > 0.5) {
      fillColor = '#44ff44';
    } else if (ratio > 0.25) {
      fillColor = '#ffff44';
    } else {
      fillColor = '#ff4444';
    }

    // Fill bar (with 1px padding)
    const pad = 2;
    const fillW = Math.max(0, (w - pad * 2) * ratio);
    if (fillW > 0) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(pad, pad, fillW, h - pad * 2);

      // Subtle highlight on top half for shine effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(pad, pad, fillW, (h - pad * 2) * 0.4);
    }

    this.healthBarTexture.needsUpdate = true;
  }

  /** Build a cache key representing active status effects */
  private getStatusKey(): string {
    let key = '';
    if (this.slowTimer > 0) key += 'S';
    if (this.dotTimer > 0) key += this.dotType === 'fire' ? 'F' : 'G';
    if (this.shielded) key += 'B';
    if (this.enraged) key += 'W';
    return key;
  }

  /** Create the sprite-based status icon bar (below HP bar) */
  private createStatusBar(): void {
    const isBoss = this.type === 'boss';
    const canvasW = isBoss ? 80 : 48;
    const canvasH = 12;

    this.statusBarCanvas = document.createElement('canvas');
    this.statusBarCanvas.width = canvasW;
    this.statusBarCanvas.height = canvasH;
    this.statusBarCtx = this.statusBarCanvas.getContext('2d')!;

    this.statusBarTexture = new THREE.CanvasTexture(this.statusBarCanvas);
    this.statusBarTexture.minFilter = THREE.LinearFilter;
    this.statusBarTexture.magFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.statusBarTexture,
      transparent: true,
      depthTest: false,
    });
    this.statusBarSprite = new THREE.Sprite(spriteMat);

    // Scale: slightly narrower than HP bar
    const barWidth = isBoss ? 1.3 : 0.75;
    const barHeight = 0.18;
    this.statusBarSprite.scale.set(barWidth, barHeight, 1);

    // Position just below the health bar
    const stats = BALANCE.zombies[this.type];
    const hpBarY = isBoss ? 5.0 : 2.5 * stats.scale + (this.flyHeight > 0 ? 0.5 : 0);
    this.statusBarSprite.position.y = hpBarY - (isBoss ? 0.38 : 0.22);

    this.statusBarSprite.renderOrder = 999;
    this.mesh.add(this.statusBarSprite);
  }

  /** Draw active status effect icons onto the status bar canvas */
  private drawStatusBar(): void {
    if (!this.statusBarCtx || !this.statusBarCanvas || !this.statusBarTexture) return;

    const ctx = this.statusBarCtx;
    const w = this.statusBarCanvas.width;
    const h = this.statusBarCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Collect active effects
    const effects: { bg: string; letter: string; fg: string }[] = [];
    if (this.slowTimer > 0) {
      effects.push({ bg: '#2266cc', letter: 'S', fg: '#aaddff' });
    }
    if (this.dotTimer > 0 && this.dotType === 'fire') {
      effects.push({ bg: '#cc4400', letter: 'F', fg: '#ffcc44' });
    }
    if (this.dotTimer > 0 && this.dotType === 'poison') {
      effects.push({ bg: '#226622', letter: 'G', fg: '#66ff66' });
    }
    if (this.shielded) {
      effects.push({ bg: '#2244aa', letter: 'B', fg: '#88bbff' });
    }
    if (this.enraged) {
      effects.push({ bg: '#882200', letter: 'W', fg: '#ff6644' });
    }

    if (effects.length === 0) return;

    // Draw icons centered in canvas
    const iconSize = 10;
    const gap = 2;
    const totalW = effects.length * iconSize + (effects.length - 1) * gap;
    let x = Math.floor((w - totalW) / 2);

    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const fx of effects) {
      // Background rounded rect
      ctx.fillStyle = fx.bg;
      ctx.beginPath();
      ctx.roundRect(x, 1, iconSize, iconSize, 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(x, 1, iconSize, iconSize, 2);
      ctx.stroke();

      // Letter
      ctx.fillStyle = fx.fg;
      ctx.fillText(fx.letter, x + iconSize / 2, 1 + iconSize / 2 + 1);

      x += iconSize + gap;
    }

    this.statusBarTexture.needsUpdate = true;
  }

  /** Update the status icon bar visibility and appearance */
  private updateStatusBar(): void {
    const statusKey = this.getStatusKey();

    // No active effects - hide and bail
    if (statusKey === '') {
      if (this.statusBarSprite) this.statusBarSprite.visible = false;
      this.lastStatusKey = '';
      return;
    }

    // Create on first need
    if (!this.statusBarSprite) {
      this.createStatusBar();
    }

    this.statusBarSprite!.visible = true;

    // Only redraw if the set of active effects changed
    if (statusKey !== this.lastStatusKey) {
      this.lastStatusKey = statusKey;
      this.drawStatusBar();
    }
  }

  /** Update the floating health bar visibility and appearance */
  private updateHealthBar(): void {
    const ratio = Math.max(0, this.hp / this.maxHp);

    // Don't show bar at full health
    if (ratio >= 1) {
      if (this.healthBarSprite) this.healthBarSprite.visible = false;
      // Still update status bar even at full health (enemy could be slowed/shielded)
      this.updateStatusBar();
      return;
    }

    // Create bar on first damage
    if (!this.healthBarVisible) {
      this.createHealthBar();
    }

    // Show it
    if (this.healthBarSprite) this.healthBarSprite.visible = true;

    // Only redraw if health ratio actually changed (avoid unnecessary canvas redraws)
    if (Math.abs(ratio - this.lastHealthRatio) > 0.001) {
      this.lastHealthRatio = ratio;
      this.drawHealthBar();
    }

    // Update status icons below health bar
    this.updateStatusBar();
  }

  private updateHpBar(): void {
    this.updateHealthBar();
  }

  // ─── Death Effects System ────────────────────────────────

  /** Spawn body fragments + ground splat when enemy dies */
  spawnDeathEffects(scene: THREE.Scene): void {
    if (this.deathEffectsSpawned) return;
    this.deathEffectsSpawned = true;

    const pos = this.mesh.position.clone();
    const stats = BALANCE.zombies[this.type];
    const bodyColor = stats.color;
    const scale = stats.scale;

    // ── Body fragments (4-8 small chunks flying outward) ──
    const fragCount = this.type === 'boss' ? 12 : 4 + Math.floor(Math.random() * 5);
    const fragGeo = new THREE.BoxGeometry(1, 1, 1); // shared, scaled per fragment

    for (let i = 0; i < fragCount; i++) {
      const size = (0.08 + Math.random() * 0.15) * scale;
      // Mix body color with dark red for variety
      const color = Math.random() > 0.4 ? bodyColor : 0x661111;
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0,
      });
      const frag = new THREE.Mesh(fragGeo, mat);
      frag.scale.set(
        size * (0.5 + Math.random()),
        size * (0.5 + Math.random()),
        size * (0.5 + Math.random())
      );
      frag.position.copy(pos);
      frag.position.y += 0.3 + Math.random() * 0.8 * scale;
      frag.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Velocity: outward burst with upward bias
      const angle = Math.random() * Math.PI * 2;
      const hSpeed = 1.5 + Math.random() * 3.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * hSpeed,
        2.5 + Math.random() * 4,
        Math.sin(angle) * hSpeed
      );

      scene.add(frag);
      Enemy.deathDebris.push({
        mesh: frag,
        velocity,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
        lifetime: 0,
        maxLifetime: 0.8 + Math.random() * 0.6,
      });
    }

    // ── Ground blood splat ──
    const splatSize = (0.3 + Math.random() * 0.3) * scale;
    const splatGeo = new THREE.CircleGeometry(splatSize, 8);
    const splatMat = new THREE.MeshBasicMaterial({
      color: 0x441111,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const splat = new THREE.Mesh(splatGeo, splatMat);
    splat.rotation.x = -Math.PI / 2;
    splat.position.copy(pos);
    splat.position.y = 0.02;
    scene.add(splat);
    Enemy.groundSplats.push({ mesh: splat, lifetime: 4.0 });

    // Boss gets extra splats
    if (this.type === 'boss') {
      for (let i = 0; i < 3; i++) {
        const extraSize = 0.2 + Math.random() * 0.4;
        const extraGeo = new THREE.CircleGeometry(extraSize, 6);
        const extraMat = new THREE.MeshBasicMaterial({
          color: 0x551111,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        const extra = new THREE.Mesh(extraGeo, extraMat);
        extra.rotation.x = -Math.PI / 2;
        extra.position.set(
          pos.x + (Math.random() - 0.5) * 1.5,
          0.02,
          pos.z + (Math.random() - 0.5) * 1.5
        );
        scene.add(extra);
        Enemy.groundSplats.push({ mesh: extra, lifetime: 3.5 + Math.random() });
      }
    }
  }

  /** Static: update all flying debris and ground splats (call from game loop) */
  static updateDeathEffects(dt: number, scene: THREE.Scene): void {
    const GRAVITY = -14;

    // ── Flying fragments ──
    for (let i = Enemy.deathDebris.length - 1; i >= 0; i--) {
      const d = Enemy.deathDebris[i];
      d.lifetime += dt;

      // Physics
      d.velocity.y += GRAVITY * dt;
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.mesh.rotation.x += d.rotSpeed.x * dt;
      d.mesh.rotation.y += d.rotSpeed.y * dt;
      d.mesh.rotation.z += d.rotSpeed.z * dt;

      // Floor bounce with damping
      if (d.mesh.position.y < 0.05) {
        d.mesh.position.y = 0.05;
        d.velocity.y *= -0.25;
        d.velocity.x *= 0.6;
        d.velocity.z *= 0.6;
        d.rotSpeed.multiplyScalar(0.5);
      }

      // Shrink during last 40% of lifetime
      const t = d.lifetime / d.maxLifetime;
      if (t > 0.6) {
        const fade = 1 - (t - 0.6) / 0.4;
        const sx = d.mesh.scale.x > 0 ? d.mesh.scale.x : 0.1;
        const ratio = Math.max(0.01, fade);
        d.mesh.scale.multiplyScalar(ratio / (d.mesh.scale.x / sx));
      }

      // Remove when expired
      if (d.lifetime >= d.maxLifetime) {
        scene.remove(d.mesh);
        (d.mesh.material as THREE.Material).dispose();
        Enemy.deathDebris.splice(i, 1);
      }
    }

    // Dispose shared geometry when all debris gone
    // (geometry is shared so only dispose once when array empties — handled by GC)

    // ── Ground splats (slow fade) ──
    for (let i = Enemy.groundSplats.length - 1; i >= 0; i--) {
      const s = Enemy.groundSplats[i];
      s.lifetime -= dt;
      // Fade during last 1.5 seconds
      if (s.lifetime < 1.5) {
        (s.mesh.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, (s.lifetime / 1.5) * 0.6);
      }
      if (s.lifetime <= 0) {
        scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        Enemy.groundSplats.splice(i, 1);
      }
    }

    // ── Spawn cracks (slow fade) ──
    Enemy.updateSpawnCracks(dt, scene);
  }

  /** Spawn a ground crack mark at enemy's spawn location */
  spawnGroundCrack(scene: THREE.Scene): void {
    if (this.spawnCrackSpawned) return;
    this.spawnCrackSpawned = true;

    const pos = this.spawnOrigin;
    const stats = BALANCE.zombies[this.type];
    const scale = stats.scale;
    const crackGroup = new THREE.Group();

    // Dark crater circle
    const craterSize = (0.25 + Math.random() * 0.15) * scale;
    const craterMat = new THREE.MeshBasicMaterial({
      color: 0x221100,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const crater = new THREE.Mesh(new THREE.CircleGeometry(craterSize, 8), craterMat);
    crater.rotation.x = -Math.PI / 2;
    crackGroup.add(crater);

    // Radiating crack lines (4-6 lines)
    const crackCount = 4 + Math.floor(Math.random() * 3);
    const crackMat = new THREE.MeshBasicMaterial({
      color: 0x332211,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const length = (0.2 + Math.random() * 0.3) * scale;
      const width = 0.015 + Math.random() * 0.015;
      const crackGeo = new THREE.PlaneGeometry(width, length);
      const crack = new THREE.Mesh(crackGeo, crackMat);
      crack.rotation.x = -Math.PI / 2;
      crack.rotation.z = angle;
      crack.position.set(
        Math.cos(angle) * craterSize * 0.8,
        0,
        Math.sin(angle) * craterSize * 0.8
      );
      crackGroup.add(crack);
    }

    // Small dirt chunks around the crater
    const chunkCount = 2 + Math.floor(Math.random() * 3);
    const chunkMat = new THREE.MeshBasicMaterial({
      color: 0x443322,
      transparent: true,
      opacity: 0.4,
    });
    for (let i = 0; i < chunkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = craterSize + Math.random() * 0.15 * scale;
      const size = 0.02 + Math.random() * 0.03;
      const chunk = new THREE.Mesh(new THREE.SphereGeometry(size, 4, 3), chunkMat);
      chunk.position.set(
        Math.cos(angle) * dist,
        size * 0.5,
        Math.sin(angle) * dist
      );
      chunk.scale.y = 0.4;
      crackGroup.add(chunk);
    }

    crackGroup.position.set(pos.x, 0.015, pos.z);
    scene.add(crackGroup);

    Enemy.spawnCracks.push({
      mesh: crackGroup,
      lifetime: 0,
      maxLifetime: 3.0 + Math.random(),
    });
  }

  /** Static: update spawn cracks (fading), called alongside death effects */
  private static updateSpawnCracks(dt: number, scene: THREE.Scene): void {
    for (let i = Enemy.spawnCracks.length - 1; i >= 0; i--) {
      const c = Enemy.spawnCracks[i];
      c.lifetime += dt;
      const t = c.lifetime / c.maxLifetime;

      // Fade out during last 40%
      if (t > 0.6) {
        const fade = 1 - (t - 0.6) / 0.4;
        c.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshBasicMaterial;
            mat.opacity = Math.max(0, fade * 0.6);
          }
        });
      }

      if (c.lifetime >= c.maxLifetime) {
        c.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        scene.remove(c.mesh);
        Enemy.spawnCracks.splice(i, 1);
      }
    }
  }

  /** Static: clear all debris (call on level reset) */
  static clearDeathEffects(scene: THREE.Scene): void {
    for (const d of Enemy.deathDebris) {
      scene.remove(d.mesh);
      (d.mesh.material as THREE.Material).dispose();
    }
    Enemy.deathDebris.length = 0;
    for (const s of Enemy.groundSplats) {
      scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }
    Enemy.groundSplats.length = 0;
    for (const c of Enemy.spawnCracks) {
      c.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      scene.remove(c.mesh);
    }
    Enemy.spawnCracks.length = 0;
  }

  getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  getDistanceTraveled(): number {
    return this.distanceTraveled;
  }

  /** Check if enemy is still in spawn/walk-to-path phase */
  isInSpawnPhase(): boolean {
    return this.isSpawning || this.isWalkingToPath;
  }

  /** Whether the enemy is currently slowed */
  isSlowed(): boolean {
    return this.slowTimer > 0;
  }

  /** Whether the enemy has an active damage-over-time effect */
  hasDot(): boolean {
    return this.dotTimer > 0;
  }

  /** Get the current DoT type (fire or poison) */
  getDotType(): 'fire' | 'poison' {
    return this.dotType;
  }
}
