import * as THREE from 'three';
import { Projectile } from './Weapon';
import { Enemy } from '../enemies/Enemy';
import { Vector3Pool } from '../systems/ObjectPool';
import { WeaponKey } from '../systems/BalanceConfig';

// Shared temp vector pool to reduce GC pressure in hot update loop
const vec3Pool = new Vector3Pool(16, 64);

// ── Trail type definitions ───────────────────────────────────
type TrailType = 'arrow' | 'fire' | 'ice' | 'electric' | 'smoke' | 'poison' | 'wind' | 'magic' | 'dark' | 'none';

interface TrailConfig {
  color: number;
  colorRGB: { r: number; g: number; b: number }; // pre-computed linear RGB
  lineWidth: number;    // visual thickness factor (unused for Line but kept for future)
  maxPoints: number;    // max trail positions stored (3-5)
  opacity: number;      // starting opacity at front
  style: 'line' | 'zigzag';  // zigzag adds lateral offsets for electric
}

/** Pre-compute linear RGB from hex */
function hexToRGB(hex: number): { r: number; g: number; b: number } {
  const c = new THREE.Color(hex);
  return { r: c.r, g: c.g, b: c.b };
}

const TRAIL_CONFIGS: Record<TrailType, TrailConfig> = {
  arrow:    { color: 0xeeeeee, colorRGB: hexToRGB(0xeeeeee), lineWidth: 1, maxPoints: 4, opacity: 0.5,  style: 'line' },
  fire:     { color: 0xff6600, colorRGB: hexToRGB(0xff6600), lineWidth: 2, maxPoints: 5, opacity: 0.7,  style: 'line' },
  ice:      { color: 0x88ddff, colorRGB: hexToRGB(0x88ddff), lineWidth: 1, maxPoints: 4, opacity: 0.55, style: 'line' },
  electric: { color: 0xffff44, colorRGB: hexToRGB(0xffff44), lineWidth: 1, maxPoints: 5, opacity: 0.8,  style: 'zigzag' },
  smoke:    { color: 0x888888, colorRGB: hexToRGB(0x888888), lineWidth: 2, maxPoints: 4, opacity: 0.4,  style: 'line' },
  poison:   { color: 0x44ff44, colorRGB: hexToRGB(0x44ff44), lineWidth: 1, maxPoints: 5, opacity: 0.55, style: 'line' },
  wind:     { color: 0xccffee, colorRGB: hexToRGB(0xccffee), lineWidth: 1, maxPoints: 4, opacity: 0.45, style: 'line' },
  magic:    { color: 0xaa66ff, colorRGB: hexToRGB(0xaa66ff), lineWidth: 1, maxPoints: 4, opacity: 0.6,  style: 'line' },
  dark:     { color: 0x886ecc, colorRGB: hexToRGB(0x886ecc), lineWidth: 1, maxPoints: 4, opacity: 0.5,  style: 'line' },
  none:     { color: 0xffffff, colorRGB: hexToRGB(0xffffff), lineWidth: 1, maxPoints: 0, opacity: 0,    style: 'line' },
};

/** Map weapon key to trail type */
function getTrailType(key: WeaponKey): TrailType {
  switch (key) {
    case 'arrowTower':                           return 'arrow';
    case 'sniperTower':                          return 'arrow';
    case 'fireTower':
    case 'flamethrowerTower':                    return 'fire';
    case 'iceTower':                             return 'ice';
    case 'teslaTower':
    case 'laserTower':                           return 'electric';
    case 'cannonTower':
    case 'mortarTower':                          return 'smoke';
    case 'poisonTower':                          return 'poison';
    case 'windTower':                            return 'wind';
    case 'mageTower':                            return 'magic';
    case 'necromancerTower':                     return 'dark';
    default:                                     return 'none';
  }
}

// ── Trail data per projectile ────────────────────────────────
interface TrailData {
  positions: Float32Array;   // flattened xyz, size = maxPoints * 3
  colors: Float32Array;      // flattened rgb, size = maxPoints * 3
  count: number;             // how many positions currently stored
  line: THREE.Line;
  geometry: THREE.BufferGeometry;
  config: TrailConfig;
  trailType: TrailType;
}

// Shared materials per trail type (reused across all projectiles)
const sharedTrailMaterials = new Map<TrailType, THREE.LineBasicMaterial>();

function getTrailMaterial(type: TrailType): THREE.LineBasicMaterial {
  let mat = sharedTrailMaterials.get(type);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    sharedTrailMaterials.set(type, mat);
  }
  return mat;
}

export class ProjectileSystem {
  private scene: THREE.Scene;
  private projectiles: Projectile[] = [];
  private trails = new Map<Projectile, TrailData>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  add(projectile: Projectile): void {
    this.scene.add(projectile.mesh);
    this.projectiles.push(projectile);
    this.initTrail(projectile);
  }

  // ── Trail initialisation ────────────────────────────────────
  private initTrail(proj: Projectile): void {
    const trailType = getTrailType(proj.sourceWeaponKey);
    if (trailType === 'none') return;

    const cfg = TRAIL_CONFIGS[trailType];
    const maxPts = cfg.maxPoints;

    const positions = new Float32Array(maxPts * 3);
    const colors = new Float32Array(maxPts * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0); // nothing to draw yet

    const mat = getTrailMaterial(trailType);
    const line = new THREE.Line(geometry, mat);
    line.frustumCulled = false;
    this.scene.add(line);

    this.trails.set(proj, {
      positions,
      colors,
      count: 0,
      line,
      geometry,
      config: cfg,
      trailType,
    });
  }

  update(dt: number, enemies: Enemy[]): void {
    const toRemove: Projectile[] = [];

    for (const proj of this.projectiles) {
      if (!proj.target.alive) {
        toRemove.push(proj);
        continue;
      }

      const targetPos = proj.target.getPosition();
      targetPos.y = 0.5;
      const dir = vec3Pool.acquire(
        targetPos.x - proj.mesh.position.x,
        targetPos.y - proj.mesh.position.y,
        targetPos.z - proj.mesh.position.z,
      );
      const dist = dir.length();

      if (dist < 0.5) {
        this.onHit(proj, enemies);
        toRemove.push(proj);
        vec3Pool.release(dir);
      } else {
        // Move toward target
        dir.normalize().multiplyScalar(proj.speed * dt);
        proj.mesh.position.add(dir);
        proj.mesh.lookAt(targetPos);
        vec3Pool.release(dir);

        // Update line trail
        this.updateTrail(proj);
      }
    }

    for (const proj of toRemove) {
      this.scene.remove(proj.mesh);
      (proj.mesh.geometry as THREE.BufferGeometry).dispose();
      this.cleanupTrail(proj);
    }
    this.projectiles = this.projectiles.filter(p => !toRemove.includes(p));
  }

  // ── Trail update: push current position, shift old ones out ─
  private updateTrail(proj: Projectile): void {
    const trail = this.trails.get(proj);
    if (!trail) return;

    const { positions, colors, config } = trail;
    const maxPts = config.maxPoints;
    const pos = proj.mesh.position;
    const c = config.colorRGB;

    // Shift positions back (drop oldest, index 0 = tail/oldest)
    if (trail.count >= maxPts) {
      // Shift everything one slot toward index 0
      for (let i = 0; i < (maxPts - 1) * 3; i++) {
        positions[i] = positions[i + 3];
      }
    }

    // Insert current position at the front (newest = last index)
    const idx = Math.min(trail.count, maxPts - 1);
    let px = pos.x;
    let py = pos.y;
    let pz = pos.z;

    // Zigzag offset for electric trails
    if (config.style === 'zigzag' && idx > 0) {
      px += (Math.random() - 0.5) * 0.15;
      py += (Math.random() - 0.5) * 0.1;
      pz += (Math.random() - 0.5) * 0.15;
    }

    positions[idx * 3]     = px;
    positions[idx * 3 + 1] = py;
    positions[idx * 3 + 2] = pz;

    if (trail.count < maxPts) trail.count++;

    // Recompute vertex colors (RGB): tail fades to black, head = full color
    // With additive blending, black (0,0,0) = invisible
    const n = trail.count;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 1; // 0 = tail, 1 = head
      const fade = t * config.opacity;
      colors[i * 3]     = c.r * fade;
      colors[i * 3 + 1] = c.g * fade;
      colors[i * 3 + 2] = c.b * fade;
    }

    // Update GPU buffers
    const posAttr = trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    const colAttr = trail.geometry.getAttribute('color') as THREE.BufferAttribute;
    colAttr.needsUpdate = true;
    trail.geometry.setDrawRange(0, n);
  }

  // ── Trail cleanup ──────────────────────────────────────────
  private cleanupTrail(proj: Projectile): void {
    const trail = this.trails.get(proj);
    if (!trail) return;
    this.scene.remove(trail.line);
    trail.geometry.dispose();
    // shared material is NOT disposed
    this.trails.delete(proj);
  }

  // ── Hit handling ─────────────────────────────────────────
  private onHit(proj: Projectile, enemies: Enemy[]): void {
    const srcWeapon = proj.sourceWeapon;

    // Direct damage
    const targetWasAlive = proj.target.alive;
    proj.target.takeDamage(proj.damage);
    if (srcWeapon) {
      srcWeapon.totalDamageDealt += proj.damage;
      proj.target.lastDamagedByWeapon = srcWeapon;
      if (targetWasAlive && !proj.target.alive) {
        srcWeapon.kills++;
        proj.target.killAttributed = true;
      }
    }

    // Splash damage
    if (proj.splashRadius && proj.splashRadius > 0) {
      const hitPos = proj.mesh.position;
      for (const enemy of enemies) {
        if (!enemy.alive || enemy === proj.target) continue;
        const dist = hitPos.distanceTo(enemy.getPosition());
        if (dist < proj.splashRadius) {
          const falloff = 1 - (dist / proj.splashRadius);
          const splashDmg = proj.damage * falloff * 0.6;
          const wasAlive = enemy.alive;
          enemy.takeDamage(splashDmg);
          if (srcWeapon) {
            srcWeapon.totalDamageDealt += splashDmg;
            enemy.lastDamagedByWeapon = srcWeapon;
            if (wasAlive && !enemy.alive) {
              srcWeapon.kills++;
              enemy.killAttributed = true;
            }
          }
        }
      }
    }

    // Slow effect
    if (proj.slowFactor && proj.slowDuration) {
      proj.target.applySlow(proj.slowFactor, proj.slowDuration);
      if (proj.splashRadius) {
        const hitPos = proj.mesh.position;
        for (const enemy of enemies) {
          if (!enemy.alive || enemy === proj.target) continue;
          const dist = hitPos.distanceTo(enemy.getPosition());
          if (dist < proj.splashRadius) {
            enemy.applySlow(proj.slowFactor!, proj.slowDuration!);
          }
        }
      }
    }

    // DoT effect
    if (proj.dotDamage && proj.dotDuration) {
      const dotType: 'fire' | 'poison' = proj.sourceWeaponKey === 'poisonTower' ? 'poison' : 'fire';
      proj.target.applyDot(proj.dotDamage, proj.dotDuration, dotType);
      if (proj.splashRadius) {
        const hitPos = proj.mesh.position;
        for (const enemy of enemies) {
          if (!enemy.alive || enemy === proj.target) continue;
          const dist = hitPos.distanceTo(enemy.getPosition());
          if (dist < proj.splashRadius) {
            enemy.applyDot(proj.dotDamage!, proj.dotDuration!, dotType);
          }
        }
      }
    }

    // Weapon-specific visual effects
    const pos = proj.mesh.position.clone();
    switch (proj.sourceWeaponKey) {
      case 'arrowTower':
        this.createArrowImpact(pos);
        break;
      case 'cannonTower':
        this.createCannonExplosion(pos, proj.splashRadius || 2);
        break;
      case 'iceTower':
        this.createIceShatter(pos);
        break;
      case 'fireTower':
        this.createFireBurst(pos);
        break;
      case 'sniperTower':
        this.createSniperSpark(pos);
        break;
      case 'mortarTower':
        this.createMortarExplosion(pos, proj.splashRadius || 3);
        break;
      case 'poisonTower':
        this.createPoisonCloud(pos, proj.splashRadius || 2.5);
        break;
      case 'teslaTower':
        this.createTeslaArc(pos);
        break;
      case 'windTower':
        this.createWindGust(pos);
        break;
      case 'mageTower':
        this.createMagicBurst(pos);
        break;
      case 'flamethrowerTower':
        this.createFireBurst(pos);
        break;
      case 'laserTower':
        this.createLaserHit(pos);
        break;
      case 'necromancerTower':
        this.createDarkImpact(pos);
        break;
    }
  }

  // ── Arrow impact: small dust puff ──────────────────────
  private createArrowImpact(pos: THREE.Vector3): void {
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xccaa77,
        transparent: true,
        opacity: 0.7,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0.5 + Math.random(),
        (Math.random() - 0.5) * 1.5
      );

      const animate = () => {
        vel.y -= 4 * 0.016;
        p.position.add(vel.clone().multiplyScalar(0.016));
        mat.opacity -= 0.04;
        p.scale.multiplyScalar(0.95);
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Cannon explosion: fiery burst + debris ─────────────
  private createCannonExplosion(pos: THREE.Vector3, radius: number): void {
    // Central flash
    const flashGeo = new THREE.SphereGeometry(radius * 0.4, 10, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.9,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    flash.position.y = 0.5;
    this.scene.add(flash);

    const animFlash = () => {
      flash.scale.multiplyScalar(1.1);
      flashMat.opacity -= 0.06;
      if (flashMat.opacity > 0) {
        requestAnimationFrame(animFlash);
      } else {
        this.scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animFlash);

    // Inner bright core
    const coreGeo = new THREE.SphereGeometry(radius * 0.15, 8, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(pos);
    core.position.y = 0.5;
    this.scene.add(core);

    const animCore = () => {
      core.scale.multiplyScalar(1.15);
      coreMat.opacity -= 0.1;
      if (coreMat.opacity > 0) {
        requestAnimationFrame(animCore);
      } else {
        this.scene.remove(core);
        coreGeo.dispose();
        coreMat.dispose();
      }
    };
    requestAnimationFrame(animCore);

    // Debris particles
    for (let i = 0; i < 6; i++) {
      const debGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const debMat = new THREE.MeshBasicMaterial({
        color: i < 3 ? 0x664422 : 0xff6600,
        transparent: true,
        opacity: 0.9,
      });
      const deb = new THREE.Mesh(debGeo, debMat);
      deb.position.copy(pos);
      deb.position.y = 0.5;
      this.scene.add(deb);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 4
      );

      const animDeb = () => {
        vel.y -= 9.8 * 0.016;
        deb.position.add(vel.clone().multiplyScalar(0.016));
        deb.rotation.x += 0.15;
        deb.rotation.z += 0.1;
        debMat.opacity -= 0.025;
        if (debMat.opacity > 0 && deb.position.y > -0.5) {
          requestAnimationFrame(animDeb);
        } else {
          this.scene.remove(deb);
          debGeo.dispose();
          debMat.dispose();
        }
      };
      requestAnimationFrame(animDeb);
    }
  }

  // ── Ice shatter: frost crystal burst ───────────────────
  private createIceShatter(pos: THREE.Vector3): void {
    // Frost flash ring
    const ringGeo = new THREE.RingGeometry(0, 0.8, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.position.y = 0.3;
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    const animRing = () => {
      ring.scale.multiplyScalar(1.12);
      ringMat.opacity -= 0.05;
      if (ringMat.opacity > 0) {
        requestAnimationFrame(animRing);
      } else {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    requestAnimationFrame(animRing);

    // Ice crystal shards
    for (let i = 0; i < 5; i++) {
      const shardGeo = new THREE.OctahedronGeometry(0.06 + Math.random() * 0.06, 0);
      const shardMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xaaeeff : 0xccffff,
        transparent: true,
        opacity: 0.8,
      });
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.copy(pos);
      shard.position.y = 0.5;
      this.scene.add(shard);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 2.5
      );

      const animShard = () => {
        vel.y -= 5 * 0.016;
        shard.position.add(vel.clone().multiplyScalar(0.016));
        shard.rotation.x += 0.1;
        shard.rotation.y += 0.15;
        shardMat.opacity -= 0.03;
        if (shardMat.opacity > 0) {
          requestAnimationFrame(animShard);
        } else {
          this.scene.remove(shard);
          shardGeo.dispose();
          shardMat.dispose();
        }
      };
      requestAnimationFrame(animShard);
    }
  }

  // ── Fire burst: flame particles ────────────────────────
  private createFireBurst(pos: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      const size = 0.06 + Math.random() * 0.08;
      const geo = new THREE.BoxGeometry(size, size, size);
      const color = [0xff4400, 0xff8800, 0xffcc00, 0xff2200][Math.floor(Math.random() * 4)];
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      p.position.y = 0.5;
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        1 + Math.random() * 2.5,
        (Math.random() - 0.5) * 2
      );

      const animate = () => {
        vel.y -= 2 * 0.016;
        p.position.add(vel.clone().multiplyScalar(0.016));
        p.scale.multiplyScalar(0.96);
        mat.opacity -= 0.035;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Sniper spark: bright flash ─────────────────────────
  private createSniperSpark(pos: THREE.Vector3): void {
    // Bright point flash
    const flashGeo = new THREE.SphereGeometry(0.15, 6, 4);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 1,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    flash.position.y = 0.5;
    this.scene.add(flash);

    const animFlash = () => {
      flash.scale.multiplyScalar(1.2);
      flashMat.opacity -= 0.12;
      if (flashMat.opacity > 0) {
        requestAnimationFrame(animFlash);
      } else {
        this.scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animFlash);

    // Small sparks
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffff88,
        transparent: true,
        opacity: 1,
      });
      const s = new THREE.Mesh(geo, mat);
      s.position.copy(pos);
      s.position.y = 0.5;
      this.scene.add(s);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 3
      );

      const animate = () => {
        vel.y -= 8 * 0.016;
        s.position.add(vel.clone().multiplyScalar(0.016));
        mat.opacity -= 0.08;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(s);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Mortar explosion: massive blast + shockwave ────────
  private createMortarExplosion(pos: THREE.Vector3, radius: number): void {
    // Big fiery sphere
    const blastGeo = new THREE.SphereGeometry(radius * 0.5, 12, 10);
    const blastMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
    });
    const blast = new THREE.Mesh(blastGeo, blastMat);
    blast.position.copy(pos);
    blast.position.y = 0.5;
    this.scene.add(blast);

    const animBlast = () => {
      blast.scale.multiplyScalar(1.08);
      blastMat.opacity -= 0.04;
      if (blastMat.opacity > 0) {
        requestAnimationFrame(animBlast);
      } else {
        this.scene.remove(blast);
        blastGeo.dispose();
        blastMat.dispose();
      }
    };
    requestAnimationFrame(animBlast);

    // White hot core
    const coreGeo = new THREE.SphereGeometry(radius * 0.2, 8, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffeecc,
      transparent: true,
      opacity: 1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(pos);
    core.position.y = 0.6;
    this.scene.add(core);

    const animCore = () => {
      core.scale.multiplyScalar(1.12);
      coreMat.opacity -= 0.08;
      if (coreMat.opacity > 0) {
        requestAnimationFrame(animCore);
      } else {
        this.scene.remove(core);
        coreGeo.dispose();
        coreMat.dispose();
      }
    };
    requestAnimationFrame(animCore);

    // Ground shockwave ring
    const shockGeo = new THREE.RingGeometry(0.1, 0.3, 24);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const shock = new THREE.Mesh(shockGeo, shockMat);
    shock.position.copy(pos);
    shock.position.y = 0.15;
    shock.rotation.x = -Math.PI / 2;
    this.scene.add(shock);

    const animShock = () => {
      shock.scale.multiplyScalar(1.12);
      shockMat.opacity -= 0.03;
      if (shockMat.opacity > 0) {
        requestAnimationFrame(animShock);
      } else {
        this.scene.remove(shock);
        shockGeo.dispose();
        shockMat.dispose();
      }
    };
    requestAnimationFrame(animShock);

    // Heavy debris
    for (let i = 0; i < 8; i++) {
      const debGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const colors = [0x664422, 0x553311, 0xff6600, 0xff8800, 0x888888];
      const debMat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.9,
      });
      const deb = new THREE.Mesh(debGeo, debMat);
      deb.position.copy(pos);
      deb.position.y = 0.5;
      this.scene.add(deb);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 5
      );

      const animDeb = () => {
        vel.y -= 9.8 * 0.016;
        deb.position.add(vel.clone().multiplyScalar(0.016));
        deb.rotation.x += 0.2;
        deb.rotation.z += 0.15;
        debMat.opacity -= 0.018;
        if (debMat.opacity > 0 && deb.position.y > -0.5) {
          requestAnimationFrame(animDeb);
        } else {
          this.scene.remove(deb);
          debGeo.dispose();
          debMat.dispose();
        }
      };
      requestAnimationFrame(animDeb);
    }

    // Smoke puffs (darker, linger longer)
    for (let i = 0; i < 4; i++) {
      const smokeGeo = new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 6, 4);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.4,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.copy(pos);
      smoke.position.y = 0.8 + Math.random() * 0.5;
      smoke.position.x += (Math.random() - 0.5) * 0.8;
      smoke.position.z += (Math.random() - 0.5) * 0.8;
      this.scene.add(smoke);

      const animate = () => {
        smoke.position.y += 0.012;
        smoke.scale.multiplyScalar(1.02);
        smokeMat.opacity -= 0.008;
        if (smokeMat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(smoke);
          smokeGeo.dispose();
          smokeMat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Poison cloud: lingering green gas ──────────────────
  private createPoisonCloud(pos: THREE.Vector3, radius: number): void {
    // Multiple cloud puffs
    for (let i = 0; i < 5; i++) {
      const size = 0.2 + Math.random() * 0.3;
      const geo = new THREE.SphereGeometry(size, 6, 5);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x44ff44 : 0x22aa22,
        transparent: true,
        opacity: 0.35,
      });
      const cloud = new THREE.Mesh(geo, mat);
      cloud.position.copy(pos);
      cloud.position.x += (Math.random() - 0.5) * radius * 0.6;
      cloud.position.y = 0.3 + Math.random() * 0.5;
      cloud.position.z += (Math.random() - 0.5) * radius * 0.6;
      this.scene.add(cloud);

      // Slow rise and fade
      const driftX = (Math.random() - 0.5) * 0.3;
      const driftZ = (Math.random() - 0.5) * 0.3;
      const animate = () => {
        cloud.position.y += 0.006;
        cloud.position.x += driftX * 0.016;
        cloud.position.z += driftZ * 0.016;
        cloud.scale.multiplyScalar(1.005);
        mat.opacity -= 0.005;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(cloud);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }

    // Small poison drip particles
    for (let i = 0; i < 4; i++) {
      const dripGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const dripMat = new THREE.MeshBasicMaterial({
        color: 0x88ff88,
        transparent: true,
        opacity: 0.8,
      });
      const drip = new THREE.Mesh(dripGeo, dripMat);
      drip.position.copy(pos);
      drip.position.y = 0.8 + Math.random() * 0.5;
      drip.position.x += (Math.random() - 0.5) * 1;
      drip.position.z += (Math.random() - 0.5) * 1;
      this.scene.add(drip);

      const animate = () => {
        drip.position.y -= 0.02;
        dripMat.opacity -= 0.025;
        if (dripMat.opacity > 0 && drip.position.y > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(drip);
          dripGeo.dispose();
          dripMat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Tesla arc: electric discharge ─────────────────────
  private createTeslaArc(pos: THREE.Vector3): void {
    // Bright electric flash
    const flashGeo = new THREE.SphereGeometry(0.2, 6, 4);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xcc88ff,
      transparent: true,
      opacity: 1,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    flash.position.y = 0.5;
    this.scene.add(flash);

    const animFlash = () => {
      flash.scale.multiplyScalar(1.15);
      flashMat.opacity -= 0.1;
      if (flashMat.opacity > 0) {
        requestAnimationFrame(animFlash);
      } else {
        this.scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animFlash);

    // Electric arc lines (thin cylinders)
    for (let i = 0; i < 4; i++) {
      const arcGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.3 + Math.random() * 0.4, 3);
      const arcMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xaa66ff : 0xeeddff,
        transparent: true,
        opacity: 0.9,
      });
      const arc = new THREE.Mesh(arcGeo, arcMat);
      arc.position.copy(pos);
      arc.position.y = 0.5;
      arc.rotation.set(
        (Math.random() - 0.5) * Math.PI,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * Math.PI
      );
      this.scene.add(arc);

      const animate = () => {
        arcMat.opacity -= 0.08;
        arc.rotation.z += 0.2;
        if (arcMat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(arc);
          arcGeo.dispose();
          arcMat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Wind gust: swirl particles ──────────────────────────
  private createWindGust(pos: THREE.Vector3): void {
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.PlaneGeometry(0.15, 0.05);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xccffee,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const p = new THREE.Mesh(geo, mat);
      const angle = (i / 5) * Math.PI * 2;
      p.position.copy(pos);
      p.position.x += Math.cos(angle) * 0.3;
      p.position.z += Math.sin(angle) * 0.3;
      p.position.y = 0.4 + Math.random() * 0.4;
      this.scene.add(p);

      let a = angle;
      const animate = () => {
        a += 0.15;
        p.position.x = pos.x + Math.cos(a) * (0.3 + (a - angle) * 0.2);
        p.position.z = pos.z + Math.sin(a) * (0.3 + (a - angle) * 0.2);
        p.position.y += 0.01;
        p.rotation.z = a;
        mat.opacity -= 0.03;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Magic burst: arcane sparkles ────────────────────────
  private createMagicBurst(pos: THREE.Vector3): void {
    // Arcane ring
    const ringGeo = new THREE.RingGeometry(0, 0.6, 12);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xaa66ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.position.y = 0.3;
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    const animRing = () => {
      ring.scale.multiplyScalar(1.1);
      ring.rotation.z += 0.1;
      ringMat.opacity -= 0.04;
      if (ringMat.opacity > 0) {
        requestAnimationFrame(animRing);
      } else {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    requestAnimationFrame(animRing);

    // Sparkles
    for (let i = 0; i < 4; i++) {
      const sparkGeo = new THREE.OctahedronGeometry(0.04, 0);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: [0xaa66ff, 0xcc88ff, 0x8844dd, 0xeeccff][i],
        transparent: true,
        opacity: 0.9,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.copy(pos);
      spark.position.y = 0.5;
      this.scene.add(spark);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        1 + Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      );

      const animate = () => {
        vel.y -= 3 * 0.016;
        spark.position.add(vel.clone().multiplyScalar(0.016));
        spark.rotation.x += 0.15;
        spark.rotation.y += 0.2;
        sparkMat.opacity -= 0.04;
        if (sparkMat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(spark);
          sparkGeo.dispose();
          sparkMat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Laser hit: red flash + burn mark ────────────────────
  private createLaserHit(pos: THREE.Vector3): void {
    // Bright red flash
    const flashGeo = new THREE.SphereGeometry(0.12, 6, 4);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      transparent: true,
      opacity: 1,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    flash.position.y = 0.5;
    this.scene.add(flash);

    const animFlash = () => {
      flash.scale.multiplyScalar(1.25);
      flashMat.opacity -= 0.15;
      if (flashMat.opacity > 0) {
        requestAnimationFrame(animFlash);
      } else {
        this.scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animFlash);

    // Small hot sparks
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6644,
        transparent: true,
        opacity: 1,
      });
      const s = new THREE.Mesh(geo, mat);
      s.position.copy(pos);
      s.position.y = 0.5;
      this.scene.add(s);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0.5 + Math.random(),
        (Math.random() - 0.5) * 2
      );

      const animate = () => {
        vel.y -= 6 * 0.016;
        s.position.add(vel.clone().multiplyScalar(0.016));
        mat.opacity -= 0.1;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(s);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  // ── Dark impact: necromancer soul burst ──────────────────
  private createDarkImpact(pos: THREE.Vector3): void {
    // Purple-dark flash
    const flashGeo = new THREE.SphereGeometry(0.18, 6, 4);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0x663399,
      transparent: true,
      opacity: 0.8,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    flash.position.y = 0.5;
    this.scene.add(flash);

    const animFlash = () => {
      flash.scale.multiplyScalar(1.1);
      flashMat.opacity -= 0.06;
      if (flashMat.opacity > 0) {
        requestAnimationFrame(animFlash);
      } else {
        this.scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animFlash);

    // Soul wisps rising
    for (let i = 0; i < 3; i++) {
      const wispGeo = new THREE.SphereGeometry(0.05, 4, 3);
      const wispMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x886ecc : 0x553388,
        transparent: true,
        opacity: 0.7,
      });
      const wisp = new THREE.Mesh(wispGeo, wispMat);
      wisp.position.copy(pos);
      wisp.position.y = 0.5;
      wisp.position.x += (Math.random() - 0.5) * 0.3;
      wisp.position.z += (Math.random() - 0.5) * 0.3;
      this.scene.add(wisp);

      const driftX = (Math.random() - 0.5) * 0.8;
      const driftZ = (Math.random() - 0.5) * 0.8;
      const animate = () => {
        wisp.position.y += 0.02;
        wisp.position.x += driftX * 0.016;
        wisp.position.z += driftZ * 0.016;
        wisp.scale.multiplyScalar(0.97);
        wispMat.opacity -= 0.02;
        if (wispMat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          this.scene.remove(wisp);
          wispGeo.dispose();
          wispMat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }

  clear(): void {
    for (const proj of this.projectiles) {
      this.scene.remove(proj.mesh);
      this.cleanupTrail(proj);
    }
    this.projectiles = [];
  }
}
