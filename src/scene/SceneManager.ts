import * as THREE from 'three';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x78b8e0);

    // Gradient sky via fog
    this.scene.fog = new THREE.FogExp2(0xa8d8ea, 0.008);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      250
    );
    this.camera.position.set(25, 35, 35);
    this.camera.lookAt(0, 0, 5);

    // Renderer - high quality
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.setupLighting();

    window.addEventListener('resize', () => this.onResize());
  }

  private setupLighting(): void {
    // Soft ambient
    const ambient = new THREE.AmbientLight(0xc8d8f0, 0.5);
    this.scene.add(ambient);

    // Main sun - warm directional light
    const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
    sun.position.set(25, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    // Fill light from opposite side (cooler tone)
    const fill = new THREE.DirectionalLight(0x88aacc, 0.3);
    fill.position.set(-15, 20, -10);
    this.scene.add(fill);

    // Hemisphere light for natural sky/ground bounce
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x557733, 0.4);
    this.scene.add(hemi);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
