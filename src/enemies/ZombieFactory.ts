import { Enemy } from './Enemy';
import { PathSystem } from '../map/PathSystem';
import { ZombieType } from '../systems/BalanceConfig';

export class ZombieFactory {
  private pathSystem: PathSystem;

  constructor(pathSystem: PathSystem) {
    this.pathSystem = pathSystem;
  }

  create(type: ZombieType): Enemy {
    return new Enemy(type, this.pathSystem);
  }
}
