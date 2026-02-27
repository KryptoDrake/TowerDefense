import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class ArrowTower extends TowerWeapon {
  constructor(gridX: number, gridZ: number) {
    super('arrowTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.arrowTower;
    const baseMat = new THREE.MeshLambertMaterial({ color: config.color });
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x5a3010 });
    const lightWood = new THREE.MeshLambertMaterial({ color: 0x8a6030 });

    // Stone base with slight taper
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.7, 0.4, 8);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x777766 }));
    base.position.y = 0.2;
    base.castShadow = true;
    group.add(base);

    // Wooden tower body with planks look
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.42, 1.5, 6);
    const body = new THREE.Mesh(bodyGeo, baseMat);
    body.position.y = 1.15;
    body.castShadow = true;
    group.add(body);

    // Wooden rim at top
    const rimGeo = new THREE.CylinderGeometry(0.4, 0.35, 0.12, 6);
    const rim = new THREE.Mesh(rimGeo, darkWood);
    rim.position.y = 1.96;
    group.add(rim);

    // Turret head (rotates) - crossbow mount
    this.turretHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.2, 0.55),
      darkWood
    );
    this.turretHead.position.y = 2.15;
    this.turretHead.castShadow = true;
    group.add(this.turretHead);

    // Crossbow arms (curved)
    const armMat = lightWood;
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.06), armMat);
    leftArm.position.set(-0.28, 0, 0.18);
    leftArm.rotation.z = -0.15;
    this.turretHead.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.06), armMat);
    rightArm.position.set(0.28, 0, 0.18);
    rightArm.rotation.z = 0.15;
    this.turretHead.add(rightArm);

    // Bowstring (thin line between arm tips)
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xccccaa });
    const stringGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.85, 3);
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.set(0, 0, 0.18);
    string.rotation.z = Math.PI / 2;
    this.turretHead.add(string);

    // Arrow guide rail
    const railGeo = new THREE.BoxGeometry(0.04, 0.04, 0.4);
    const rail = new THREE.Mesh(railGeo, darkWood);
    rail.position.set(0, 0.06, 0.15);
    this.turretHead.add(rail);

    return group;
  }

  protected applyUpgradeVisual(): void {
    super.applyUpgradeVisual();
    const old = this.mesh.getObjectByName('tower-upgrade');
    if (old) this.mesh.remove(old);
    const ug = new THREE.Group();
    ug.name = 'tower-upgrade';

    if (this.level >= 2) {
      // Quiver with arrows on the side
      const quiverMat = new THREE.MeshLambertMaterial({ color: 0x5a3010 });
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.5, 6), quiverMat);
      quiver.position.set(0.35, 1.5, 0);
      quiver.rotation.z = 0.15;
      ug.add(quiver);
      // Arrow tips sticking out
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
      for (let i = 0; i < 3; i++) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), tipMat);
        tip.position.set(0.33 + i * 0.04, 1.82, (i - 1) * 0.04);
        ug.add(tip);
      }
      // Reinforced base ring
      const ringMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 12), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.0;
      ug.add(ring);
    }
    if (this.level >= 3) {
      // Golden crossbow arm accents
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0x885500, emissiveIntensity: 0.3 });
      const leftAccent = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.04), goldMat);
      leftAccent.position.set(-0.28, 2.15, 0.18);
      leftAccent.rotation.z = -0.15;
      ug.add(leftAccent);
      const rightAccent = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.04), goldMat);
      rightAccent.position.set(0.28, 2.15, 0.18);
      rightAccent.rotation.z = 0.15;
      ug.add(rightAccent);
      // Glowing bowstring
      const glowString = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.9, 3),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.7 })
      );
      glowString.position.set(0, 2.15, 0.18);
      glowString.rotation.z = Math.PI / 2;
      ug.add(glowString);
      // Banner flag at top
      const flagMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), flagMat);
      flag.position.set(0.15, 2.6, 0);
      ug.add(flag);
    }
    this.mesh.add(ug);
  }

  protected fire(target: Enemy, createProjectile: (p: Projectile) => void): void {
    const config = BALANCE.weapons.arrowTower;
    const projGeo = new THREE.ConeGeometry(0.04, 0.45, 4);
    projGeo.rotateX(Math.PI / 2);
    const projMat = new THREE.MeshBasicMaterial({ color: config.projectileColor });
    const mesh = new THREE.Mesh(projGeo, projMat);
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 2.15;

    createProjectile({
      mesh,
      target,
      speed: config.projectileSpeed,
      damage: this.getEffectiveDamage(),
      sourceWeaponKey: this.key,
      sourceWeapon: this,
    });
  }
}
