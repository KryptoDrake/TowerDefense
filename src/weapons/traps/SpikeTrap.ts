import * as THREE from 'three';
import { PathWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class SpikeTrap extends PathWeapon {
  private readonly damagePerTick: number;
  private readonly slowFactor: number;
  private readonly hitRadius: number;
  private tickTimer = 0;

  constructor(gridX: number, gridZ: number) {
    super('spikeTrap', gridX, gridZ);
    const config = BALANCE.weapons.spikeTrap;
    this.damagePerTick = config.damage;
    this.slowFactor = config.slowFactor;
    this.hitRadius = config.radius;
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.spikeTrap;

    // Base plate
    const baseGeo = new THREE.BoxGeometry(1.4, 0.05, 1.4);
    const baseMat = new THREE.MeshLambertMaterial({ color: config.color });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.025;
    group.add(base);

    // Spikes
    const spikeMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const spikePositions = [
      [0, 0], [-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4],
      [-0.2, 0.2], [0.2, -0.2], [0, -0.4], [0, 0.4],
    ];
    for (const [sx, sz] of spikePositions) {
      const spikeGeo = new THREE.ConeGeometry(0.08, 0.35, 4);
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(sx, 0.22, sz);
      spike.castShadow = true;
      group.add(spike);
    }

    return group;
  }

  update(dt: number, enemies: Enemy[], _createProjectile: (p: Projectile) => void): void {
    this.updatePlacementAnim(dt);
    this.activeTime += dt;
    this.tickTimer -= dt;
    if (this.tickTimer > 0) return;
    this.tickTimer = 0.5; // Damage every 0.5 seconds

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      // Flyers fly above ground traps
      if (enemy.flyHeight > 0) continue;
      const dist = this.mesh.position.distanceTo(enemy.getPosition());
      if (dist < this.hitRadius) {
        const wasAlive = enemy.alive;
        enemy.takeDamage(this.damagePerTick);
        this.totalDamageDealt += this.damagePerTick;
        enemy.lastDamagedByWeapon = this;
        if (wasAlive && !enemy.alive) { this.kills++; enemy.killAttributed = true; }
        enemy.applySlow(this.slowFactor, 1.0);
        this.createDamageParticle(enemy.getPosition());
      }
    }
  }

  private createDamageParticle(pos: THREE.Vector3): void {
    const scene = this.mesh.parent;
    if (!scene) return;

    for (let i = 0; i < 2; i++) {
      const geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff3333,
        transparent: true,
        opacity: 0.8,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      p.position.y = 0.3 + Math.random() * 0.3;
      scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1 + Math.random(),
        (Math.random() - 0.5) * 1.5
      );

      const animate = () => {
        vel.y -= 6 * 0.016;
        p.position.add(vel.clone().multiplyScalar(0.016));
        mat.opacity -= 0.06;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          scene.remove(p);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }
}
