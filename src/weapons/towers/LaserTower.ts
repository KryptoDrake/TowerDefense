import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class LaserTower extends TowerWeapon {
  private beamDamageMultiplier = 1;
  private lastTarget: Enemy | null = null;

  constructor(gridX: number, gridZ: number) {
    super('laserTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.laserTower;
    const crystalMat = new THREE.MeshLambertMaterial({
      color: config.color,
      emissive: 0x880000,
      emissiveIntensity: 0.4,
    });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x551111 });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x666655 });

    // Stone base
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.35, 8);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.18;
    base.castShadow = true;
    group.add(base);

    // Tall red crystal pillar body
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.6, 6);
    const pillar = new THREE.Mesh(pillarGeo, crystalMat);
    pillar.position.y = 1.15;
    pillar.castShadow = true;
    group.add(pillar);

    // Dark accent rings around pillar
    for (const bandY of [0.6, 1.0, 1.4]) {
      const bandGeo = new THREE.TorusGeometry(0.28, 0.025, 4, 8);
      const band = new THREE.Mesh(bandGeo, darkMat);
      band.position.y = bandY;
      band.rotation.x = Math.PI / 2;
      group.add(band);
    }

    // Turret head - rotating crystal emitter
    this.turretHead = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.25, 0),
      new THREE.MeshLambertMaterial({
        color: 0xff4444,
        emissive: 0xff0000,
        emissiveIntensity: 0.6,
      })
    );
    this.turretHead.position.y = 2.1;
    this.turretHead.castShadow = true;
    group.add(this.turretHead);

    // Glow sphere on top of turret head
    const glowGeo = new THREE.SphereGeometry(0.18, 8, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.4,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.2;
    this.turretHead.add(glow);

    // Small crystal shards around the base of the turret head
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const shardGeo = new THREE.ConeGeometry(0.06, 0.25, 4);
      const shard = new THREE.Mesh(shardGeo, crystalMat);
      shard.position.set(Math.cos(angle) * 0.3, 1.85, Math.sin(angle) * 0.3);
      shard.castShadow = true;
      group.add(shard);
    }

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Extra crystal splinters (bigger, glowing)
      const crystalMat = new THREE.MeshLambertMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 0.4 });
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), crystalMat);
        shard.position.set(Math.cos(angle) * 0.4, 1.7, Math.sin(angle) * 0.4);
        shard.castShadow = true;
        ug.add(shard);
      }
    }
    if (this.level >= 3) {
      // Red energy orbit ring
      const orbitMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.4 });
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 16), orbitMat);
      orbit.position.y = 2.1;
      orbit.rotation.x = Math.PI / 3;
      ug.add(orbit);
      // Enhanced glow at emitter
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.25 });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glowMat);
      glow.position.y = 2.1;
      ug.add(glow);
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    // Placement animation
    this.updatePlacementAnim(dt);

    this.fireCooldown -= dt;

    // Find target
    const target = this.findTarget(enemies);

    // Track target changes for beam damage ramp
    if (target && target !== this.lastTarget) {
      this.beamDamageMultiplier = 1;
    }
    if (target) {
      this.rotateTurret(target, dt);
      // Ramp up damage while locked on same target (+0.1/s, max 3x)
      this.beamDamageMultiplier = Math.min(3, this.beamDamageMultiplier + 0.1 * dt);
    } else {
      this.beamDamageMultiplier = 1;
    }
    this.lastTarget = target;

    // Fire when ready
    if (this.fireCooldown <= 0 && target) {
      this.fireCooldown = 1 / this.getEffectiveFireRate();
      this.fire(target, createProjectile);
    }
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.laserTower;

    // Calculate beam direction and length
    const startPos = this.mesh.position.clone();
    startPos.y = 2.1;
    const targetPos = target.getPosition();
    targetPos.y = 1.0;
    const dir = targetPos.clone().sub(startPos);
    const length = dir.length();

    // Create beam mesh (thin box stretching toward target)
    const beamGeo = new THREE.BoxGeometry(0.05, 0.05, length);
    const beamMat = new THREE.MeshBasicMaterial({
      color: config.projectileColor,
      transparent: true,
      opacity: 0.8,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);

    // Position beam at midpoint between tower and target
    const midpoint = startPos.clone().add(targetPos).multiplyScalar(0.5);
    beam.position.copy(midpoint);
    beam.lookAt(targetPos);

    createProjectile({
      mesh: beam,
      target,
      speed: config.projectileSpeed,
      damage: Math.floor(this.getEffectiveDamage() * this.beamDamageMultiplier),
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
