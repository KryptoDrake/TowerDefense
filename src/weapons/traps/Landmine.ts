import * as THREE from 'three';
import { PathWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class Landmine extends PathWeapon {
  private exploded = false;
  private readonly triggerRadius: number;
  private readonly explosionDamage: number;
  private readonly explosionRadius: number;

  constructor(gridX: number, gridZ: number) {
    super('landmine', gridX, gridZ);
    const config = BALANCE.weapons.landmine;
    this.triggerRadius = 1.0;
    this.explosionDamage = config.damage;
    this.explosionRadius = config.radius;
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.landmine;

    // Disc shape buried in ground
    const discGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.15, 12);
    const discMat = new THREE.MeshLambertMaterial({ color: config.color });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.08;
    disc.castShadow = true;
    group.add(disc);

    // Red indicator on top
    const indicatorGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8);
    const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    indicator.position.y = 0.18;
    group.add(indicator);

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
        this.explode(enemies);
        return;
      }
    }
  }

  private explode(enemies: Enemy[]): void {
    this.exploded = true;
    const pos = this.mesh.position;

    // Damage all enemies in radius
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dist = pos.distanceTo(enemy.getPosition());
      if (dist < this.explosionRadius) {
        const falloff = 1 - (dist / this.explosionRadius) * 0.5;
        const dmg = this.explosionDamage * falloff;
        const wasAlive = enemy.alive;
        enemy.takeDamage(dmg);
        this.totalDamageDealt += dmg;
        enemy.lastDamagedByWeapon = this;
        if (wasAlive && !enemy.alive) { this.kills++; enemy.killAttributed = true; }
      }
    }

    // Visual explosion
    this.createExplosion();
  }

  private createExplosion(): void {
    const pos = this.mesh.position.clone();
    const scene = this.mesh.parent!;

    // Bright core flash
    const coreGeo = new THREE.SphereGeometry(this.explosionRadius * 0.2, 8, 6);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 1,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(pos);
    core.position.y = 0.5;
    scene.add(core);

    const animCore = () => {
      core.scale.multiplyScalar(1.15);
      coreMat.opacity -= 0.1;
      if (coreMat.opacity > 0) {
        requestAnimationFrame(animCore);
      } else {
        scene.remove(core);
        coreGeo.dispose();
        coreMat.dispose();
      }
    };
    requestAnimationFrame(animCore);

    // Fire sphere
    const flashGeo = new THREE.SphereGeometry(this.explosionRadius * 0.5, 12, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.9,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    flash.position.y = 0.5;
    scene.add(flash);

    const animFlash = () => {
      flash.scale.multiplyScalar(1.1);
      flashMat.opacity -= 0.05;
      if (flashMat.opacity > 0) {
        requestAnimationFrame(animFlash);
      } else {
        scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animFlash);

    // Ground shockwave ring
    const shockGeo = new THREE.RingGeometry(0.1, 0.3, 24);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xff8844,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const shock = new THREE.Mesh(shockGeo, shockMat);
    shock.position.copy(pos);
    shock.position.y = 0.12;
    shock.rotation.x = -Math.PI / 2;
    scene.add(shock);

    const animShock = () => {
      shock.scale.multiplyScalar(1.14);
      shockMat.opacity -= 0.025;
      if (shockMat.opacity > 0) {
        requestAnimationFrame(animShock);
      } else {
        scene.remove(shock);
        shockGeo.dispose();
        shockMat.dispose();
      }
    };
    requestAnimationFrame(animShock);

    // Debris particles (dirt chunks + fire bits)
    for (let i = 0; i < 10; i++) {
      const debGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const colors = [0x664422, 0x553311, 0xff6600, 0xff8800, 0x888888];
      const debMat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 0.9,
      });
      const deb = new THREE.Mesh(debGeo, debMat);
      deb.position.copy(pos);
      deb.position.y = 0.3;
      scene.add(deb);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        3 + Math.random() * 5,
        (Math.random() - 0.5) * 6
      );

      const animDeb = () => {
        vel.y -= 9.8 * 0.016;
        deb.position.add(vel.clone().multiplyScalar(0.016));
        deb.rotation.x += 0.2;
        deb.rotation.z += 0.15;
        debMat.opacity -= 0.02;
        if (debMat.opacity > 0 && deb.position.y > -0.5) {
          requestAnimationFrame(animDeb);
        } else {
          scene.remove(deb);
          debGeo.dispose();
          debMat.dispose();
        }
      };
      requestAnimationFrame(animDeb);
    }

    // Smoke puffs
    for (let i = 0; i < 3; i++) {
      const smokeGeo = new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 6, 4);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.35,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.copy(pos);
      smoke.position.y = 0.8 + Math.random() * 0.5;
      smoke.position.x += (Math.random() - 0.5) * 0.5;
      smoke.position.z += (Math.random() - 0.5) * 0.5;
      scene.add(smoke);

      const animate = () => {
        smoke.position.y += 0.015;
        smoke.scale.multiplyScalar(1.02);
        smokeMat.opacity -= 0.006;
        if (smokeMat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          scene.remove(smoke);
          smokeGeo.dispose();
          smokeMat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }

    // Hide mine mesh
    this.mesh.visible = false;
  }

  isExploded(): boolean {
    return this.exploded;
  }
}
