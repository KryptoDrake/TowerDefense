import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class MortarTower extends TowerWeapon {
  constructor(gridX: number, gridZ: number) {
    super('mortarTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.mortarTower;
    const mat = new THREE.MeshLambertMaterial({ color: config.color });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x555544 });
    const darkMetal = new THREE.MeshLambertMaterial({ color: 0x444433 });

    // Heavy sandbag/stone base
    const baseGeo = new THREE.BoxGeometry(1.3, 0.4, 1.3);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x776655 }));
    base.position.y = 0.2;
    base.castShadow = true;
    group.add(base);

    // Stacked sandbags around the base
    const bagMat = new THREE.MeshLambertMaterial({ color: 0x998866 });
    const bagGeo = new THREE.BoxGeometry(0.3, 0.15, 0.6);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bag = new THREE.Mesh(bagGeo, bagMat);
      bag.position.set(Math.sin(angle) * 0.6, 0.47, Math.cos(angle) * 0.6);
      bag.rotation.y = angle;
      bag.castShadow = true;
      group.add(bag);
    }

    // Central support column
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);

    // Rotating turret mount
    this.turretHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 0.15, 8),
      metalMat
    );
    this.turretHead.position.y = 1.45;
    group.add(this.turretHead);

    // Mortar tube (angled upward)
    const tubeGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.9, 8);
    const tube = new THREE.Mesh(tubeGeo, darkMetal);
    tube.rotation.x = -Math.PI / 4;
    tube.position.set(0, 0.35, 0.25);
    tube.castShadow = true;
    this.turretHead.add(tube);

    // Tube muzzle ring
    const muzzleGeo = new THREE.TorusGeometry(0.12, 0.025, 6, 8);
    const muzzle = new THREE.Mesh(muzzleGeo, darkMetal);
    muzzle.rotation.x = -Math.PI / 4;
    muzzle.position.set(0, 0.67, 0.57);
    this.turretHead.add(muzzle);

    // Support struts for the tube
    const strutGeo = new THREE.BoxGeometry(0.03, 0.35, 0.03);
    const leftStrut = new THREE.Mesh(strutGeo, metalMat);
    leftStrut.position.set(-0.12, 0.2, 0.08);
    leftStrut.rotation.x = -0.3;
    this.turretHead.add(leftStrut);

    const rightStrut = new THREE.Mesh(strutGeo, metalMat);
    rightStrut.position.set(0.12, 0.2, 0.08);
    rightStrut.rotation.x = -0.3;
    this.turretHead.add(rightStrut);

    // Ammo shells stacked nearby
    const shellMat = new THREE.MeshLambertMaterial({ color: 0x666644 });
    for (let i = 0; i < 3; i++) {
      const shellGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6);
      const shell = new THREE.Mesh(shellGeo, shellMat);
      shell.position.set(-0.15 + i * 0.1, 0.1, -0.2);
      shell.rotation.z = 0.2;
      this.turretHead.add(shell);
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
      // Reinforced sandbag walls (higher)
      const bagMat = new THREE.MeshLambertMaterial({ color: 0xaa9977 });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.5), bagMat);
        bag.position.set(Math.sin(angle) * 0.6, 0.6, Math.cos(angle) * 0.6);
        bag.rotation.y = angle;
        ug.add(bag);
      }
      // Extra ammo shells
      const shellMat = new THREE.MeshLambertMaterial({ color: 0x777755 });
      for (let i = 0; i < 2; i++) {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 6), shellMat);
        shell.position.set(0.25, 1.55, -0.25 + i * 0.15);
        ug.add(shell);
      }
    }
    if (this.level >= 3) {
      // Second mortar tube (smaller, angled differently)
      const darkMetal = new THREE.MeshLambertMaterial({ color: 0x444433 });
      const tube2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.6, 8), darkMetal);
      tube2.rotation.x = -Math.PI / 3.5;
      tube2.position.set(-0.25, 1.6, 0.2);
      ug.add(tube2);
      // Glowing shells
      const glowShell = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.4 });
      for (let i = 0; i < 2; i++) {
        const g = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), glowShell);
        g.position.set(-0.15 + i * 0.3, 1.55, -0.2);
        ug.add(g);
      }
      // Metal plating
      const metalPlate = new THREE.MeshLambertMaterial({ color: 0x666666 });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.8), metalPlate);
      plate.position.y = 1.38;
      ug.add(plate);
    }
    this.mesh.add(ug);
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.mortarTower;
    const projGeo = new THREE.SphereGeometry(0.18, 6, 6);
    const projMat = new THREE.MeshBasicMaterial({ color: config.projectileColor });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 3;

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

    // Muzzle smoke puff
    this.createMuzzleSmoke();
  }

  private createMuzzleSmoke(): void {
    const scene = this.mesh.parent;
    if (!scene) return;

    for (let i = 0; i < 2; i++) {
      const geo = new THREE.SphereGeometry(0.1, 5, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x999999,
        transparent: true,
        opacity: 0.45,
      });
      const smoke = new THREE.Mesh(geo, mat);
      smoke.position.copy(this.mesh.position);
      smoke.position.y = 2.2 + Math.random() * 0.3;
      scene.add(smoke);

      const animate = () => {
        smoke.position.y += 0.025;
        smoke.scale.multiplyScalar(1.04);
        mat.opacity -= 0.015;
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
