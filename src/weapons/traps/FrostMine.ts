import * as THREE from 'three';
import { PathWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class FrostMine extends PathWeapon {
  private exploded = false;
  private readonly triggerRadius: number;
  private readonly freezeRadius: number;
  private readonly freezeDamage: number;

  constructor(gridX: number, gridZ: number) {
    super('frostMine', gridX, gridZ);
    const config = BALANCE.weapons.frostMine;
    this.triggerRadius = 1.0;
    this.freezeRadius = config.radius;
    this.freezeDamage = config.damage;
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.frostMine;

    // Ice disc
    const discGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.12, 8);
    const discMat = new THREE.MeshLambertMaterial({ color: config.color });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.06;
    disc.castShadow = true;
    group.add(disc);

    // Frost crystal on top
    const crystalGeo = new THREE.OctahedronGeometry(0.15, 0);
    const crystalMat = new THREE.MeshBasicMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.7,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 0.2;
    group.add(crystal);

    // Blue glow indicator
    const glowGeo = new THREE.SphereGeometry(0.3, 8, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff,
      transparent: true,
      opacity: 0.15,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.15;
    group.add(glow);

    return group;
  }

  update(dt: number, enemies: Enemy[], _createProjectile: (p: Projectile) => void): void {
    this.updatePlacementAnim(dt);
    this.activeTime += dt;
    if (this.exploded) return;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      // Flyers fly above ground traps
      if (enemy.flyHeight > 0) continue;
      const dist = this.mesh.position.distanceTo(enemy.getPosition());
      if (dist < this.triggerRadius) {
        this.freeze(enemies);
        return;
      }
    }
  }

  private freeze(enemies: Enemy[]): void {
    this.exploded = true;
    const pos = this.mesh.position;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dist = pos.distanceTo(enemy.getPosition());
      if (dist < this.freezeRadius) {
        const wasAlive = enemy.alive;
        enemy.takeDamage(this.freezeDamage);
        this.totalDamageDealt += this.freezeDamage;
        enemy.lastDamagedByWeapon = this;
        if (wasAlive && !enemy.alive) { this.kills++; enemy.killAttributed = true; }
        enemy.applySlow(0.05, 3.0); // Near-complete freeze for 3s
      }
    }

    this.createFreezeEffect();
  }

  private createFreezeEffect(): void {
    const pos = this.mesh.position.clone();
    const scene = this.mesh.parent!;

    // Ice sphere expanding
    const iceGeo = new THREE.SphereGeometry(0.3, 12, 8);
    const iceMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.6,
    });
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.position.copy(pos);
    ice.position.y = 0.5;
    scene.add(ice);

    const animIce = () => {
      ice.scale.multiplyScalar(1.08);
      iceMat.opacity -= 0.02;
      if (iceMat.opacity > 0) {
        requestAnimationFrame(animIce);
      } else {
        scene.remove(ice);
        iceGeo.dispose();
        iceMat.dispose();
      }
    };
    requestAnimationFrame(animIce);

    // Ice shards
    for (let i = 0; i < 8; i++) {
      const shardGeo = new THREE.ConeGeometry(0.06, 0.25, 4);
      const shardMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xaaddff : 0xccffff,
        transparent: true,
        opacity: 0.8,
      });
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.copy(pos);
      shard.position.y = 0.3;
      scene.add(shard);

      const angle = (i / 8) * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(angle) * 3, 2 + Math.random() * 2, Math.sin(angle) * 3);

      const animShard = () => {
        vel.y -= 6 * 0.016;
        shard.position.add(vel.clone().multiplyScalar(0.016));
        shard.rotation.x += 0.1;
        shardMat.opacity -= 0.02;
        if (shardMat.opacity > 0 && shard.position.y > -0.5) {
          requestAnimationFrame(animShard);
        } else {
          scene.remove(shard);
          shardGeo.dispose();
          shardMat.dispose();
        }
      };
      requestAnimationFrame(animShard);
    }

    // Ground frost ring
    const frostGeo = new THREE.RingGeometry(0.2, this.freezeRadius, 24);
    const frostMat = new THREE.MeshBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const frost = new THREE.Mesh(frostGeo, frostMat);
    frost.position.copy(pos);
    frost.position.y = 0.05;
    frost.rotation.x = -Math.PI / 2;
    scene.add(frost);

    const animFrost = () => {
      frostMat.opacity -= 0.005;
      if (frostMat.opacity > 0) {
        requestAnimationFrame(animFrost);
      } else {
        scene.remove(frost);
        frostGeo.dispose();
        frostMat.dispose();
      }
    };
    requestAnimationFrame(animFrost);

    this.mesh.visible = false;
  }

  isExploded(): boolean {
    return this.exploded;
  }
}
