import * as THREE from 'three';
import { PathWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class GoldMine extends PathWeapon {
  private goldTimer = 1.0;
  private goldPerSecond = 2;
  /** Set externally by Game.ts to add gold */
  onGold: ((amount: number) => void) | null = null;

  constructor(gridX: number, gridZ: number) {
    super('goldMine', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.goldMine;
    const goldMat = new THREE.MeshLambertMaterial({ color: config.color });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x886600 });

    // Wooden mine frame
    const frameGeo = new THREE.BoxGeometry(0.8, 0.15, 0.8);
    const frame = new THREE.Mesh(frameGeo, darkMat);
    frame.position.y = 0.075;
    frame.castShadow = true;
    group.add(frame);

    // Gold ore pile
    const oreGeo = new THREE.SphereGeometry(0.3, 6, 4);
    const ore = new THREE.Mesh(oreGeo, goldMat);
    ore.position.y = 0.25;
    ore.scale.set(1, 0.6, 1);
    ore.castShadow = true;
    group.add(ore);

    // Small gold nuggets
    for (let i = 0; i < 4; i++) {
      const nuggetGeo = new THREE.OctahedronGeometry(0.08, 0);
      const nugget = new THREE.Mesh(nuggetGeo, goldMat);
      const angle = (i / 4) * Math.PI * 2;
      nugget.position.set(Math.cos(angle) * 0.25, 0.15, Math.sin(angle) * 0.25);
      nugget.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(nugget);
    }

    // Sparkle indicator
    const sparkleGeo = new THREE.SphereGeometry(0.15, 6, 4);
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: 0xffee44,
      transparent: true,
      opacity: 0.4,
    });
    const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
    sparkle.position.y = 0.4;
    group.add(sparkle);

    return group;
  }

  update(dt: number, _enemies: Enemy[], _createProjectile: (p: Projectile) => void): void {
    this.updatePlacementAnim(dt);
    this.goldTimer -= dt;

    if (this.goldTimer <= 0) {
      this.goldTimer = 1.0;
      if (this.onGold) {
        this.onGold(this.goldPerSecond);
      }
      this.createGoldParticle();
    }
  }

  private createGoldParticle(): void {
    const scene = this.mesh.parent;
    if (!scene) return;

    const geo = new THREE.OctahedronGeometry(0.05, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.8,
    });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(
      this.mesh.position.x + (Math.random() - 0.5) * 0.3,
      this.mesh.position.y + 0.3,
      this.mesh.position.z + (Math.random() - 0.5) * 0.3
    );
    scene.add(p);

    const animate = () => {
      p.position.y += 0.025;
      p.rotation.y += 0.1;
      mat.opacity -= 0.02;
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
