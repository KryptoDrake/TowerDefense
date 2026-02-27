import * as THREE from 'three';
import { WeaponKey, BALANCE } from '../systems/BalanceConfig';
import { ArrowTower } from '../weapons/towers/ArrowTower';
import { CannonTower } from '../weapons/towers/CannonTower';
import { IceTower } from '../weapons/towers/IceTower';
import { FireTower } from '../weapons/towers/FireTower';
import { SniperTower } from '../weapons/towers/SniperTower';
import { TeslaTower } from '../weapons/towers/TeslaTower';
import { MortarTower } from '../weapons/towers/MortarTower';
import { PoisonTower } from '../weapons/towers/PoisonTower';
import { LaserTower } from '../weapons/towers/LaserTower';
import { WindTower } from '../weapons/towers/WindTower';
import { MageTower } from '../weapons/towers/MageTower';
import { FlamethrowerTower } from '../weapons/towers/FlamethrowerTower';
import { BarrierTower } from '../weapons/towers/BarrierTower';
import { NecromancerTower } from '../weapons/towers/NecromancerTower';
import { EarthquakeTower } from '../weapons/towers/EarthquakeTower';
import { HealTower } from '../weapons/towers/HealTower';
import { Landmine } from '../weapons/traps/Landmine';
import { SpikeTrap } from '../weapons/traps/SpikeTrap';
import { FrostMine } from '../weapons/traps/FrostMine';
import { GoldMine } from '../weapons/traps/GoldMine';

const ICON_SIZE = 80;

function createWeaponMesh(key: WeaponKey): THREE.Group {
  // Create temporary weapon just to get its mesh
  switch (key) {
    case 'arrowTower': return new ArrowTower(0, 0).mesh;
    case 'cannonTower': return new CannonTower(0, 0).mesh;
    case 'iceTower': return new IceTower(0, 0).mesh;
    case 'fireTower': return new FireTower(0, 0).mesh;
    case 'sniperTower': return new SniperTower(0, 0).mesh;
    case 'teslaTower': return new TeslaTower(0, 0).mesh;
    case 'mortarTower': return new MortarTower(0, 0).mesh;
    case 'poisonTower': return new PoisonTower(0, 0).mesh;
    case 'laserTower': return new LaserTower(0, 0).mesh;
    case 'windTower': return new WindTower(0, 0).mesh;
    case 'mageTower': return new MageTower(0, 0).mesh;
    case 'flamethrowerTower': return new FlamethrowerTower(0, 0).mesh;
    case 'barrierTower': return new BarrierTower(0, 0).mesh;
    case 'necromancerTower': return new NecromancerTower(0, 0).mesh;
    case 'earthquakeTower': return new EarthquakeTower(0, 0).mesh;
    case 'healTower': return new HealTower(0, 0).mesh;
    case 'landmine': return new Landmine(0, 0).mesh;
    case 'spikeTrap': return new SpikeTrap(0, 0).mesh;
    case 'frostMine': return new FrostMine(0, 0).mesh;
    case 'goldMine': return new GoldMine(0, 0).mesh;
    default: return new ArrowTower(0, 0).mesh;
  }
}

export function renderTowerIcons(): Map<WeaponKey, string> {
  const icons = new Map<WeaponKey, string>();

  // Create offscreen renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(ICON_SIZE, ICON_SIZE);
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x88aacc, 0.4);
  fillLight.position.set(-2, 3, -1);
  scene.add(fillLight);

  // Camera - isometric-ish angle from above
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  const keys = Object.keys(BALANCE.weapons) as WeaponKey[];
  for (const key of keys) {
    // Clear previous meshes from scene (keep lights)
    const toRemove: THREE.Object3D[] = [];
    scene.traverse(obj => {
      if (obj instanceof THREE.Group && obj.parent === scene) toRemove.push(obj);
    });
    toRemove.forEach(obj => scene.remove(obj));

    // Create and add the weapon mesh
    const mesh = createWeaponMesh(key);
    // Reset scale - Weapon constructor sets 0.01 for placement animation
    mesh.scale.setScalar(1);
    scene.add(mesh);

    // Compute bounding box to center and frame the mesh
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Position camera to look at center from a nice angle
    const dist = maxDim * 1.8;
    camera.position.set(
      center.x + dist * 0.7,
      center.y + dist * 0.8,
      center.z + dist * 0.7
    );
    camera.lookAt(center.x, center.y - maxDim * 0.1, center.z);
    camera.updateProjectionMatrix();

    // Render
    renderer.render(scene, camera);

    // Extract data URL
    const dataUrl = renderer.domElement.toDataURL('image/png');
    icons.set(key, dataUrl);

    // Clean up mesh
    scene.remove(mesh);
  }

  // Dispose renderer
  renderer.dispose();

  return icons;
}
