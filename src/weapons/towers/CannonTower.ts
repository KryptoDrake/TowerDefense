import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class CannonTower extends TowerWeapon {
  constructor(gridX: number, gridZ: number) {
    super('cannonTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.cannonTower;
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const darkIron = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x666655 });

    // Heavy stone base
    const baseGeo = new THREE.CylinderGeometry(0.65, 0.8, 0.5, 8);
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.25;
    base.castShadow = true;
    group.add(base);

    // Stone body with iron bands
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.55, 1.0, 8);
    const body = new THREE.Mesh(bodyGeo, stoneMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // Iron band decorations
    for (const bandY of [0.65, 1.35]) {
      const bandGeo = new THREE.TorusGeometry(0.5, 0.03, 4, 8);
      const band = new THREE.Mesh(bandGeo, ironMat);
      band.position.y = bandY;
      band.rotation.x = Math.PI / 2;
      group.add(band);
    }

    // Turret platform (rotating part)
    this.turretHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.48, 0.2, 8),
      ironMat
    );
    this.turretHead.position.y = 1.6;
    group.add(this.turretHead);

    // Cannon barrel - tapered cylinder
    const barrelGeo = new THREE.CylinderGeometry(0.09, 0.14, 1.0, 8);
    const barrel = new THREE.Mesh(barrelGeo, darkIron);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.55);
    barrel.castShadow = true;
    this.turretHead.add(barrel);

    // Barrel muzzle ring
    const muzzleGeo = new THREE.TorusGeometry(0.12, 0.03, 6, 8);
    const muzzle = new THREE.Mesh(muzzleGeo, darkIron);
    muzzle.position.set(0, 0.08, 1.05);
    this.turretHead.add(muzzle);

    // Barrel base reinforcement
    const reinforceGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 8);
    const reinforce = new THREE.Mesh(reinforceGeo, ironMat);
    reinforce.rotation.x = Math.PI / 2;
    reinforce.position.set(0, 0.08, 0.12);
    this.turretHead.add(reinforce);

    // Cannonballs stacked on platform
    const ballMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const ballPositions = [[-0.2, 0.18, -0.15], [0.2, 0.18, -0.15], [0, 0.18, -0.25]];
    for (const [bx, by, bz] of ballPositions) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), ballMat);
      ball.position.set(bx, by, bz);
      this.turretHead.add(ball);
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
      // Extra iron bands
      const ironMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
      for (const bandY of [0.5, 1.0, 1.5]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 4, 8), ironMat);
        band.position.y = bandY;
        band.rotation.x = Math.PI / 2;
        ug.add(band);
      }
      // Reinforced barrel collar
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.15, 8), ironMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 1.68, 0.8);
      ug.add(collar);
    }
    if (this.level >= 3) {
      // Second smaller barrel on the side
      const darkIron = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.7, 8), darkIron);
      barrel2.rotation.x = Math.PI / 2;
      barrel2.position.set(0.22, 1.68, 0.45);
      ug.add(barrel2);
      // Glowing cannonballs
      const glowBall = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.4 });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), glowBall);
      glow.position.set(-0.2, 1.78, -0.15);
      ug.add(glow);
      // Crown on top
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0x885500, emissiveIntensity: 0.3 });
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 4), goldMat);
        spike.position.set(Math.cos(angle) * 0.35, 1.78, Math.sin(angle) * 0.35);
        ug.add(spike);
      }
    }
    this.mesh.add(ug);
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.cannonTower;
    const projGeo = new THREE.SphereGeometry(0.13, 6, 6);
    const projMat = new THREE.MeshBasicMaterial({ color: config.projectileColor });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 1.7;

    const splashMult = this.synergyBuffs?.splashRadiusMult ?? 1;
    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      splashRadius: config.splashRadius * splashMult,
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });

    // Muzzle smoke
    this.createMuzzleSmoke();
  }

  private createMuzzleSmoke(): void {
    const scene = this.mesh.parent;
    if (!scene) return;

    for (let i = 0; i < 3; i++) {
      const geo = new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 5, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xaaaaaa,
        transparent: true,
        opacity: 0.5,
      });
      const smoke = new THREE.Mesh(geo, mat);
      smoke.position.copy(this.mesh.position);
      smoke.position.y = 1.8 + Math.random() * 0.3;
      scene.add(smoke);

      const animate = () => {
        smoke.position.y += 0.02;
        smoke.scale.multiplyScalar(1.03);
        mat.opacity -= 0.02;
        if (mat.opacity > 0) {
          requestAnimationFrame(animate);
        } else {
          scene.remove(smoke);
          geo.dispose();
          mat.dispose();
        }
      };
      requestAnimationFrame(animate);
    }
  }
}
