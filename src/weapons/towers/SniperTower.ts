import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class SniperTower extends TowerWeapon {
  constructor(gridX: number, gridZ: number) {
    super('sniperTower', gridX, gridZ);
    // Sniper defaults to targeting the strongest (highest HP) enemy
    this.targetingMode = 'strongest';
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.sniperTower;
    const mat = new THREE.MeshLambertMaterial({ color: config.color });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a252f });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // Stone base
    const baseGeo = new THREE.BoxGeometry(0.9, 0.3, 0.9);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x555544 }));
    base.position.y = 0.15;
    base.castShadow = true;
    group.add(base);

    // Tall thin tower body
    const bodyGeo = new THREE.BoxGeometry(0.45, 2.2, 0.45);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 1.4;
    body.castShadow = true;
    group.add(body);

    // Window slits
    const slitMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (let i = 0; i < 3; i++) {
      const slitGeo = new THREE.BoxGeometry(0.08, 0.2, 0.02);
      const slit = new THREE.Mesh(slitGeo, slitMat);
      slit.position.set(0, 1.0 + i * 0.5, 0.24);
      group.add(slit);
    }

    // Platform at top
    const platGeo = new THREE.BoxGeometry(0.7, 0.1, 0.7);
    const plat = new THREE.Mesh(platGeo, darkMat);
    plat.position.y = 2.55;
    group.add(plat);

    // Railing posts
    const railMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    for (const [rx, rz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const postGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(rx, 2.75, rz);
      group.add(post);
    }

    // Sniper nest (rotating turret)
    this.turretHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.5),
      darkMat
    );
    this.turretHead.position.y = 2.65;
    group.add(this.turretHead);

    // Barrel (long rifle)
    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.035, 1.4, 6);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, metalMat);
    barrel.position.set(0, 0.1, 0.7);
    barrel.castShadow = true;
    this.turretHead.add(barrel);

    // Scope on top of barrel
    const scopeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6);
    const scope = new THREE.Mesh(scopeGeo, metalMat);
    scope.position.set(0, 0.18, 0.4);
    scope.rotation.x = Math.PI / 2;
    this.turretHead.add(scope);

    // Scope lens (glowing)
    const lensMat = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.6,
    });
    const lensGeo = new THREE.CircleGeometry(0.035, 6);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, 0.18, 0.56);
    this.turretHead.add(lens);

    // Bipod legs
    const legGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.25, 4);
    const leftLeg = new THREE.Mesh(legGeo, metalMat);
    leftLeg.position.set(-0.08, -0.05, 0.5);
    leftLeg.rotation.z = 0.3;
    this.turretHead.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, metalMat);
    rightLeg.position.set(0.08, -0.05, 0.5);
    rightLeg.rotation.z = -0.3;
    this.turretHead.add(rightLeg);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Laser sight (thin red beam from barrel)
      const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 });
      const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 3, 3), laserMat);
      laser.rotation.x = Math.PI / 2;
      laser.position.set(0, 2.75, 2.5);
      ug.add(laser);
      // Extra window slits (armored)
      const armorMat = new THREE.MeshLambertMaterial({ color: 0x444455 });
      for (const z of [-0.24, 0.24]) {
        for (let i = 0; i < 2; i++) {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.03), armorMat);
          plate.position.set(0, 1.5 + i * 0.5, z);
          ug.add(plate);
        }
      }
    }
    if (this.level >= 3) {
      // Glowing barrel tip
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.4 });
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), glowMat);
      tip.position.set(0, 2.75, 1.4);
      ug.add(tip);
      // Gold scope upgrade
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0x885500, emissiveIntensity: 0.3 });
      const scopeRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 8), goldMat);
      scopeRing.position.set(0, 2.83, 0.56);
      ug.add(scopeRing);
      // Flag/banner
      const flagMat = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.35), flagMat);
      flag.position.set(0.4, 2.8, 0);
      ug.add(flag);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), poleMat);
      pole.position.set(0.4, 2.7, 0);
      ug.add(pole);
    }
    this.mesh.add(ug);
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.sniperTower;
    const projGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4);
    projGeo.rotateX(Math.PI / 2);
    const projMat = new THREE.MeshBasicMaterial({ color: config.projectileColor });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 2.75;

    // Precision Fire synergy: sniper shots apply DoT
    const synDot = this.synergyBuffs?.synergyDot ?? 0;
    const synDotDur = this.synergyBuffs?.synergyDotDuration ?? 0;
    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      dotDamage: synDot > 0 ? synDot : undefined,
      dotDuration: synDotDur > 0 ? synDotDur : undefined,
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });

    // Muzzle flash
    this.createMuzzleFlash();
  }

  private createMuzzleFlash(): void {
    const scene = this.mesh.parent;
    if (!scene) return;

    const flashGeo = new THREE.SphereGeometry(0.1, 6, 4);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffff88,
      transparent: true,
      opacity: 1,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(this.mesh.position);
    flash.position.y = 2.75;
    scene.add(flash);

    const animate = () => {
      flash.scale.multiplyScalar(1.2);
      flashMat.opacity -= 0.15;
      if (flashMat.opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animate);
  }
}
