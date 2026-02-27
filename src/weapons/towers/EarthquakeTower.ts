import * as THREE from 'three';
import { TowerWeapon, Projectile } from '../Weapon';
import { Enemy } from '../../enemies/Enemy';
import { BALANCE } from '../../systems/BalanceConfig';

export class EarthquakeTower extends TowerWeapon {
  private quakeTimer = 0;

  constructor(gridX: number, gridZ: number) {
    super('earthquakeTower', gridX, gridZ);
  }

  createMesh(): THREE.Group {
    const group = new THREE.Group();
    const config = BALANCE.weapons.earthquakeTower;
    const stoneMat = new THREE.MeshLambertMaterial({ color: config.color });
    const darkStone = new THREE.MeshLambertMaterial({ color: 0x554433 });

    // Rough stone base
    const baseGeo = new THREE.CylinderGeometry(0.7, 0.85, 0.3, 8);
    const base = new THREE.Mesh(baseGeo, darkStone);
    base.position.y = 0.15;
    base.castShadow = true;
    group.add(base);

    // Thick stone pillar (irregular)
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.55, 1.2, 6);
    const body = new THREE.Mesh(bodyGeo, stoneMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Top platform with cracks
    const topGeo = new THREE.CylinderGeometry(0.5, 0.4, 0.2, 6);
    const top = new THREE.Mesh(topGeo, darkStone);
    top.position.y = 1.6;
    top.castShadow = true;
    group.add(top);

    // Hammer/weight on top
    const hammerGeo = new THREE.BoxGeometry(0.4, 0.6, 0.4);
    const hammer = new THREE.Mesh(hammerGeo, new THREE.MeshLambertMaterial({ color: 0x444444 }));
    hammer.position.y = 2.0;
    hammer.castShadow = true;
    group.add(hammer);

    // Ground crack marks (decorative)
    for (let i = 0; i < 4; i++) {
      const crackGeo = new THREE.BoxGeometry(0.06, 0.02, 0.8);
      const crackMat = new THREE.MeshBasicMaterial({ color: 0x664422, transparent: true, opacity: 0.5 });
      const crack = new THREE.Mesh(crackGeo, crackMat);
      crack.position.y = 0.01;
      crack.rotation.y = (i / 4) * Math.PI;
      group.add(crack);
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
      // Rock chunks around base
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x665544 });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + 0.3;
        const rock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.18), rockMat);
        rock.position.set(Math.cos(angle) * 0.85, 0.08, Math.sin(angle) * 0.85);
        rock.rotation.y = Math.random() * Math.PI;
        ug.add(rock);
      }
      // Metal strap on hammer
      const strapMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), strapMat);
      strap.position.y = 1.85;
      ug.add(strap);
    }
    if (this.level >= 3) {
      // Glowing ground cracks (orange)
      const crackMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 6; i++) {
        const crack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.6 + Math.random() * 0.3), crackMat);
        crack.position.y = 0.02;
        crack.rotation.y = (i / 6) * Math.PI + Math.random() * 0.2;
        ug.add(crack);
      }
      // Golden hammer head
      const goldMat = new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0x885500, emissiveIntensity: 0.3 });
      const goldHead = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.44), goldMat);
      goldHead.position.y = 2.15;
      ug.add(goldHead);
    }
    this.mesh.add(ug);
  }

  update(dt: number, enemies: Enemy[], createProjectile: (p: Projectile) => void): void {
    this.updatePlacementAnim(dt);
    this.activeTime += dt;
    this.quakeTimer -= dt;

    if (this.quakeTimer <= 0) {
      this.quakeTimer = 1 / this.getEffectiveFireRate();
      this.quake(enemies);
    }
  }

  private quake(enemies: Enemy[]): void {
    const range = this.getEffectiveRange();
    const damage = this.getEffectiveDamage();
    let hit = false;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const dist = this.mesh.position.distanceTo(enemy.getPosition());
      if (dist < range) {
        const wasAlive = enemy.alive;
        enemy.takeDamage(damage);
        this.totalDamageDealt += damage;
        enemy.lastDamagedByWeapon = this;
        if (wasAlive && !enemy.alive) { this.kills++; enemy.killAttributed = true; }
        enemy.applySlow(0.1, 1.0); // 1s stun (near-complete slow)
        hit = true;
      }
    }

    if (hit) {
      this.createQuakeEffect();
    }
  }

  private createQuakeEffect(): void {
    const scene = this.mesh.parent;
    if (!scene) return;
    const pos = this.mesh.position;

    // Expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xaa8844,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, 0.1, pos.z);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const animRing = () => {
      ring.scale.multiplyScalar(1.1);
      ringMat.opacity -= 0.03;
      if (ringMat.opacity > 0) {
        requestAnimationFrame(animRing);
      } else {
        scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
    requestAnimationFrame(animRing);

    // Dust particles
    for (let i = 0; i < 6; i++) {
      const dustGeo = new THREE.SphereGeometry(0.08, 4, 3);
      const dustMat = new THREE.MeshBasicMaterial({
        color: 0x997744,
        transparent: true,
        opacity: 0.5,
      });
      const dust = new THREE.Mesh(dustGeo, dustMat);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 2;
      dust.position.set(pos.x + Math.cos(angle) * r, 0.2, pos.z + Math.sin(angle) * r);
      scene.add(dust);

      const animDust = () => {
        dust.position.y += 0.02;
        dust.scale.multiplyScalar(1.03);
        dustMat.opacity -= 0.015;
        if (dustMat.opacity > 0) {
          requestAnimationFrame(animDust);
        } else {
          scene.remove(dust);
          dustGeo.dispose();
          dustMat.dispose();
        }
      };
      requestAnimationFrame(animDust);
    }
  }

  protected fire(_target: Enemy, _createProjectile: (p: Projectile) => void): void {
    // Earthquake doesn't fire projectiles - handled in quake()
  }
}
