import * as THREE from 'three';

export type HubStation = 'merchant' | 'chest' | 'backpack' | 'portal';

/**
 * 3D Hub scene (Path of Exile-style) with clickable stations.
 * All objects are placed in a Group named 'hub' which gets added/removed from the scene.
 */
export class BaseHub3D {
  readonly group: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private clickables = new Map<THREE.Object3D, HubStation>();
  private highlightedStation: HubStation | null = null;
  private highlightMeshes = new Map<HubStation, THREE.Mesh>();
  private labels = new Map<HubStation, HTMLDivElement>();
  private animationId: number | null = null;
  private fireParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private portalRing: THREE.Mesh | null = null;
  private portalInner: THREE.Mesh | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private clickHandler: (() => void) | null = null;

  // Animation references
  private merchantNpcBody: THREE.Mesh | null = null;
  private merchantNpcHead: THREE.Mesh | null = null;
  private torchFlames: { mesh: THREE.Mesh; light: THREE.PointLight; phaseOffset: number }[] = [];
  private chestGems: THREE.Mesh[] = [];
  private portalParticles: THREE.Points | null = null;
  private portalParticleAngles: Float32Array | null = null;
  private crystalParticles: THREE.Points | null = null;
  private groundFog: THREE.Mesh | null = null;
  private ambientDust: THREE.Points | null = null;

  onStationClick: ((station: HubStation) => void) | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'hub';

    this.buildFloor();
    this.buildMerchant();
    this.buildChest();
    this.buildBackpackStation();
    this.buildPortal();
    this.buildDecorations();
    this.createLabels();

    scene.add(this.group);
    this.setupInteraction();
  }

  // ─── Floor ────────────────────────────────────────
  private buildFloor(): void {
    // Main stone platform
    const floorGeo = new THREE.CylinderGeometry(12, 13, 0.5, 8);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x555566 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Stone tile pattern (rings)
    for (let r = 3; r <= 10; r += 3.5) {
      const ringGeo = new THREE.TorusGeometry(r, 0.04, 4, 32);
      const ringMat = new THREE.MeshLambertMaterial({ color: 0x444455 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      this.group.add(ring);
    }

    // Radial lines
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const lineGeo = new THREE.BoxGeometry(0.06, 0.02, 11);
      const lineMat = new THREE.MeshLambertMaterial({ color: 0x444455 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.y = angle;
      line.position.y = 0.01;
      this.group.add(line);
    }

    // Ambient ground fog ring
    const fogGeo = new THREE.RingGeometry(8, 14, 32);
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0x334466,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const fog = new THREE.Mesh(fogGeo, fogMat);
    fog.rotation.x = -Math.PI / 2;
    fog.position.y = 0.1;
    this.group.add(fog);
  }

  // ─── Merchant Stand ───────────────────────────────
  private buildMerchant(): void {
    const g = new THREE.Group();
    g.position.set(-6, 0, -2);

    // Table
    const tableMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 1.5), tableMat);
    tableTop.position.y = 1.0;
    tableTop.castShadow = true;
    g.add(tableTop);

    // Table legs
    for (const [x, z] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1), tableMat);
      leg.position.set(x, 0.5, z);
      g.add(leg);
    }

    // Canopy frame
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });
    const canopyGeo = new THREE.BoxGeometry(3.4, 0.08, 2);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 2.8, 0);
    canopy.castShadow = true;
    g.add(canopy);

    // Canopy poles
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x664422 });
    for (const [x, z] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8), poleMat);
      pole.position.set(x, 1.4, z);
      g.add(pole);
    }

    // Gold trim on canopy
    const goldTrim = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.12, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    goldTrim.position.set(0, 2.72, -1.0);
    g.add(goldTrim);

    // NPC body (store reference for idle sway animation)
    const npcBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.35, 1.2, 8),
      new THREE.MeshLambertMaterial({ color: 0x884422 })
    );
    npcBody.position.set(0, 1.7, 0.6);
    npcBody.castShadow = true;
    g.add(npcBody);
    this.merchantNpcBody = npcBody;

    // NPC head (store reference for idle sway animation)
    const npcHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xddaa77 })
    );
    npcHead.position.set(0, 2.55, 0.6);
    npcHead.castShadow = true;
    g.add(npcHead);
    this.merchantNpcHead = npcHead;

    // Items on table (decorative weapons)
    const itemColors = [0xff4400, 0x44aaff, 0xffcc00];
    for (let i = 0; i < 3; i++) {
      const item = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.15, 0),
        new THREE.MeshBasicMaterial({ color: itemColors[i] })
      );
      item.position.set(-0.8 + i * 0.8, 1.25, -0.2);
      item.rotation.set(0, i * 0.5, Math.PI / 4);
      g.add(item);
    }

    // Highlight ring (invisible by default)
    const highlight = this.createHighlightRing(2.5);
    highlight.position.y = 0.05;
    g.add(highlight);
    this.highlightMeshes.set('merchant', highlight);

    // Register clickable zone
    const clickZone = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 3, 2.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickZone.position.y = 1.5;
    g.add(clickZone);
    this.clickables.set(clickZone, 'merchant');

    this.group.add(g);
  }

  // ─── Chest ────────────────────────────────────────
  private buildChest(): void {
    const g = new THREE.Group();
    g.position.set(6, 0, -2);

    // Chest body
    const chestMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.2), chestMat);
    body.position.y = 0.5;
    body.castShadow = true;
    g.add(body);

    // Chest lid (slightly open)
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 1.2), chestMat);
    lid.position.set(0, 1.1, -0.3);
    lid.rotation.x = -0.3; // slightly open
    lid.castShadow = true;
    g.add(lid);

    // Gold bands
    const bandMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 });
    for (const x of [-0.6, 0, 0.6]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 1.25), bandMat);
      band.position.set(x, 0.5, 0);
      g.add(band);
    }

    // Lock
    const lock = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.08),
      bandMat
    );
    lock.position.set(0, 0.7, -0.65);
    g.add(lock);

    // Glow from inside
    const glowGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffee44,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(0, 1.0, 0);
    g.add(glow);

    // Point light for chest glow
    const light = new THREE.PointLight(0xffcc00, 0.8, 5);
    light.position.set(0, 1.2, 0);
    g.add(light);

    // 3 floating gems above the chest
    const gemColors = [0xff4466, 0x44ff88, 0x4488ff];
    for (let i = 0; i < 3; i++) {
      const gemMat = new THREE.MeshBasicMaterial({
        color: gemColors[i],
        transparent: true,
        opacity: 0.85,
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), gemMat);
      const angle = (i / 3) * Math.PI * 2;
      gem.position.set(Math.cos(angle) * 0.5, 1.8, Math.sin(angle) * 0.5);
      gem.castShadow = true;
      g.add(gem);
      this.chestGems.push(gem);
    }

    // Highlight ring
    const highlight = this.createHighlightRing(1.8);
    highlight.position.y = 0.05;
    g.add(highlight);
    this.highlightMeshes.set('chest', highlight);

    // Click zone
    const clickZone = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2, 2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickZone.position.y = 0.8;
    g.add(clickZone);
    this.clickables.set(clickZone, 'chest');

    this.group.add(g);
  }

  // ─── Backpack Station ─────────────────────────────
  private buildBackpackStation(): void {
    const g = new THREE.Group();
    g.position.set(0, 0, -5);

    // Table
    const tableMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 1.5), tableMat);
    table.position.y = 0.8;
    table.castShadow = true;
    g.add(table);

    // Table legs
    for (const [x, z] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), tableMat);
      leg.position.set(x, 0.4, z);
      g.add(leg);
    }

    // Backpack mesh (squashed sphere + straps)
    const bagMat = new THREE.MeshLambertMaterial({ color: 0x44aaff });
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), bagMat);
    bag.scale.set(0.8, 1, 0.6);
    bag.position.set(-0.5, 1.3, 0);
    bag.castShadow = true;
    g.add(bag);

    // Strap
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x336699 });
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.3), strapMat);
    strap.position.set(-0.5, 1.1, 0.25);
    strap.rotation.z = 0.2;
    g.add(strap);

    // Slot markers on table
    for (let i = 0; i < 3; i++) {
      const slotMat = new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.3,
      });
      const slot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8), slotMat);
      slot.rotation.x = -Math.PI / 2;
      slot.position.set(0.3 + i * 0.5, 0.87, 0);
      g.add(slot);
    }

    // Highlight ring
    const highlight = this.createHighlightRing(2.0);
    highlight.position.y = 0.05;
    g.add(highlight);
    this.highlightMeshes.set('backpack', highlight);

    // Click zone
    const clickZone = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickZone.position.y = 1;
    g.add(clickZone);
    this.clickables.set(clickZone, 'backpack');

    this.group.add(g);
  }

  // ─── Portal ───────────────────────────────────────
  private buildPortal(): void {
    const g = new THREE.Group();
    g.position.set(0, 0, 6);

    // Portal frame pillars
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x334455 });
    for (const x of [-1.8, 1.8]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.5), pillarMat);
      pillar.position.set(x, 2, 0);
      pillar.castShadow = true;
      g.add(pillar);
    }

    // Top arch
    const archGeo = new THREE.BoxGeometry(4.1, 0.5, 0.5);
    const arch = new THREE.Mesh(archGeo, pillarMat);
    arch.position.set(0, 4.0, 0);
    arch.castShadow = true;
    g.add(arch);

    // Glowing torus ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 12, 32), ringMat);
    ring.position.set(0, 2.2, 0);
    g.add(ring);
    this.portalRing = ring;

    // Portal inner glow
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x2266cc,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), innerMat);
    inner.position.set(0, 2.2, 0.01);
    g.add(inner);
    this.portalInner = inner;

    // Portal light
    const portalLight = new THREE.PointLight(0x4488ff, 1.5, 8);
    portalLight.position.set(0, 2.2, 1);
    g.add(portalLight);

    // Rune marks on pillars
    const runeMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 });
    for (const x of [-1.8, 1.8]) {
      for (let y = 0.8; y < 3.5; y += 0.8) {
        const rune = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.02), runeMat);
        rune.position.set(x, y, -0.27);
        rune.rotation.z = Math.PI / 4;
        g.add(rune);
      }
    }

    // Swirling particle ring around the portal
    const portalParticleCount = 40;
    const ppPositions = new Float32Array(portalParticleCount * 3);
    this.portalParticleAngles = new Float32Array(portalParticleCount);
    for (let i = 0; i < portalParticleCount; i++) {
      const a = (i / portalParticleCount) * Math.PI * 2;
      this.portalParticleAngles[i] = a;
      ppPositions[i * 3] = Math.cos(a) * 1.6;
      ppPositions[i * 3 + 1] = 2.2 + Math.sin(a) * 1.6;
      ppPositions[i * 3 + 2] = 0;
    }
    const ppGeo = new THREE.BufferGeometry();
    ppGeo.setAttribute('position', new THREE.BufferAttribute(ppPositions, 3));
    const ppMat = new THREE.PointsMaterial({
      color: 0x66bbff,
      size: 0.08,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalPts = new THREE.Points(ppGeo, ppMat);
    g.add(portalPts);
    this.portalParticles = portalPts;

    // Highlight ring
    const highlight = this.createHighlightRing(2.5);
    highlight.position.y = 0.05;
    g.add(highlight);
    this.highlightMeshes.set('portal', highlight);

    // Click zone
    const clickZone = new THREE.Mesh(
      new THREE.BoxGeometry(4, 5, 2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickZone.position.y = 2;
    g.add(clickZone);
    this.clickables.set(clickZone, 'portal');

    this.group.add(g);
  }

  // ─── Decorations ──────────────────────────────────
  private buildDecorations(): void {
    // Torches at the sides
    const torchPositions = [
      [-8, 0, 3], [8, 0, 3],
      [-4, 0, 6], [4, 0, 6],
      [-8, 0, -5], [8, 0, -5],
    ];

    for (const [x, _y, z] of torchPositions) {
      this.buildTorch(x, z);
    }

    // Stone pillars around the edge
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x445566 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const px = Math.cos(angle) * 11;
      const pz = Math.sin(angle) * 11;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 6), pillarMat);
      pillar.position.set(px, 1.5, pz);
      pillar.castShadow = true;
      this.group.add(pillar);

      // Pillar cap
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.4, 0.3, 6),
        pillarMat
      );
      cap.position.set(px, 3.1, pz);
      this.group.add(cap);
    }

    // Banner flags
    const bannerColors = [0xcc3333, 0x3344cc, 0xcc8833];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const bx = Math.cos(angle) * 9;
      const bz = Math.sin(angle) * 9;
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 1.5),
        new THREE.MeshLambertMaterial({ color: bannerColors[i], side: THREE.DoubleSide })
      );
      flag.position.set(bx, 3.5, bz);
      flag.rotation.y = angle;
      this.group.add(flag);

      // Flag pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 2),
        new THREE.MeshLambertMaterial({ color: 0x666666 })
      );
      pole.position.set(bx, 3.5, bz);
      this.group.add(pole);
    }

    // Floating crystal particles in a circle around the hub (~50 particles)
    const crystalCount = 50;
    const crystalPositions = new Float32Array(crystalCount * 3);
    for (let i = 0; i < crystalCount; i++) {
      const a = (i / crystalCount) * Math.PI * 2;
      const r = 6 + Math.random() * 4;
      crystalPositions[i * 3] = Math.cos(a) * r;
      crystalPositions[i * 3 + 1] = 1.5 + Math.random() * 2.5;
      crystalPositions[i * 3 + 2] = Math.sin(a) * r;
    }
    const crystalGeo = new THREE.BufferGeometry();
    crystalGeo.setAttribute('position', new THREE.BufferAttribute(crystalPositions, 3));
    const crystalMat = new THREE.PointsMaterial({
      color: 0x88ccff,
      size: 0.1,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.crystalParticles = new THREE.Points(crystalGeo, crystalMat);
    this.group.add(this.crystalParticles);

    // Ground fog plane with animated opacity
    const fogPlaneGeo = new THREE.CircleGeometry(11, 32);
    const fogPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x556688,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.groundFog = new THREE.Mesh(fogPlaneGeo, fogPlaneMat);
    this.groundFog.rotation.x = -Math.PI / 2;
    this.groundFog.position.y = 0.05;
    this.group.add(this.groundFog);

    // Subtle ambient particle dust
    const dustCount = 80;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 24;
      dustPositions[i * 3 + 1] = Math.random() * 5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xaabbcc,
      size: 0.04,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ambientDust = new THREE.Points(dustGeo, dustMat);
    this.group.add(this.ambientDust);
  }

  private buildTorch(x: number, z: number): void {
    const stickMat = new THREE.MeshLambertMaterial({ color: 0x553322 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8), stickMat);
    stick.position.set(x, 0.9, z);
    this.group.add(stick);

    // Flame base
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
    });
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), flameMat);
    flame.position.set(x, 1.9, z);
    this.group.add(flame);

    // Torch light
    const torchLight = new THREE.PointLight(0xff6622, 0.6, 6);
    torchLight.position.set(x, 2.0, z);
    this.group.add(torchLight);

    // Store flame reference with random phase offset for varied flickering
    this.torchFlames.push({
      mesh: flame,
      light: torchLight,
      phaseOffset: Math.random() * Math.PI * 2,
    });
  }

  // ─── Labels ───────────────────────────────────────
  private createLabels(): void {
    const labelData: { station: HubStation; text: string; x: number; z: number }[] = [
      { station: 'merchant', text: 'Händler', x: -6, z: -2 },
      { station: 'chest', text: 'Truhe', x: 6, z: -2 },
      { station: 'backpack', text: 'Rucksack', x: 0, z: -5 },
      { station: 'portal', text: 'Expedition starten', x: 0, z: 6 },
    ];

    for (const data of labelData) {
      const label = document.createElement('div');
      label.className = 'hub-label';
      label.textContent = data.text;
      label.style.cssText = `
        position: absolute;
        color: #fff;
        font-size: 13px;
        font-weight: bold;
        text-shadow: 0 0 8px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
        white-space: nowrap;
        transform: translateX(-50%);
      `;
      document.body.appendChild(label);
      this.labels.set(data.station, label);
    }
  }

  // ─── Helpers ──────────────────────────────────────
  private createHighlightRing(radius: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(radius - 0.1, radius, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  // ─── Interaction ──────────────────────────────────
  private setupInteraction(): void {
    const canvas = document.getElementById('game-canvas')!;

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (!this.group.parent) return;

      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      this.raycaster.setFromCamera(mouse, this.camera);

      let hitStation: HubStation | null = null;
      const clickableObjects = Array.from(this.clickables.keys());
      const intersects = this.raycaster.intersectObjects(clickableObjects);
      if (intersects.length > 0) {
        hitStation = this.clickables.get(intersects[0].object) ?? null;
      }

      if (hitStation !== this.highlightedStation) {
        if (this.highlightedStation) {
          const prevMesh = this.highlightMeshes.get(this.highlightedStation);
          if (prevMesh) (prevMesh.material as THREE.MeshBasicMaterial).opacity = 0;
          const prevLabel = this.labels.get(this.highlightedStation);
          if (prevLabel) prevLabel.style.opacity = '0';
        }

        this.highlightedStation = hitStation;

        if (hitStation) {
          const mesh = this.highlightMeshes.get(hitStation);
          if (mesh) (mesh.material as THREE.MeshBasicMaterial).opacity = 0.5;
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    };

    this.clickHandler = () => {
      if (!this.group.parent) return;
      if (this.highlightedStation && this.onStationClick) {
        this.onStationClick(this.highlightedStation);
      }
    };

    canvas.addEventListener('mousemove', this.mouseMoveHandler);
    canvas.addEventListener('click', this.clickHandler);
  }

  // ─── Animation Loop ───────────────────────────────
  startAnimation(): void {
    if (this.animationId !== null) return;

    let time = 0;
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      time += 0.016;

      // Portal ring rotation + color shifting (cycle blue shades)
      if (this.portalRing) {
        this.portalRing.rotation.z = time * 0.5;
        const mat = this.portalRing.material as THREE.MeshBasicMaterial;
        const hue = 0.55 + Math.sin(time * 0.8) * 0.08; // cycle between blue shades
        mat.color.setHSL(hue, 0.7, 0.55);
      }

      // Portal inner pulse
      if (this.portalInner) {
        const mat = this.portalInner.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.3 + Math.sin(time * 2) * 0.15;
      }

      // Swirling portal particles
      if (this.portalParticles && this.portalParticleAngles) {
        const posArr = (this.portalParticles.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
        const count = this.portalParticleAngles.length;
        for (let i = 0; i < count; i++) {
          this.portalParticleAngles[i] += 0.02;
          const a = this.portalParticleAngles[i];
          posArr[i * 3] = Math.cos(a) * 1.6;
          posArr[i * 3 + 1] = 2.2 + Math.sin(a) * 1.6;
          posArr[i * 3 + 2] = Math.sin(a * 0.7) * 0.3; // slight depth wobble
        }
        (this.portalParticles.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      }

      // Merchant NPC idle sway (rotate body back and forth +-0.05 radians)
      if (this.merchantNpcBody) {
        const sway = Math.sin(time * 1.5) * 0.05;
        this.merchantNpcBody.rotation.z = sway;
      }
      if (this.merchantNpcHead) {
        const headSway = Math.sin(time * 1.5 + 0.3) * 0.05;
        this.merchantNpcHead.rotation.z = headSway;
      }

      // Torch flame flickering (scale oscillation, randomized per torch)
      for (const torch of this.torchFlames) {
        const flicker = 0.8 + Math.sin(time * 8 + torch.phaseOffset) * 0.25 +
          Math.sin(time * 13 + torch.phaseOffset * 2.7) * 0.15;
        torch.mesh.scale.set(flicker, 0.7 + flicker * 0.5, flicker);
        const flameMat = torch.mesh.material as THREE.MeshBasicMaterial;
        flameMat.opacity = 0.6 + flicker * 0.25;
        torch.light.intensity = 0.4 + flicker * 0.4;
      }

      // Floating gems above chest (rotate and bob)
      for (let i = 0; i < this.chestGems.length; i++) {
        const gem = this.chestGems[i];
        const baseAngle = (i / this.chestGems.length) * Math.PI * 2;
        const orbAngle = baseAngle + time * 0.8;
        gem.position.x = Math.cos(orbAngle) * 0.5;
        gem.position.z = Math.sin(orbAngle) * 0.5;
        gem.position.y = 1.8 + Math.sin(time * 2 + i * 1.2) * 0.15;
        gem.rotation.y = time * 2 + i;
        gem.rotation.x = time * 1.5;
      }

      // Crystal particles orbit (slow rotation)
      if (this.crystalParticles) {
        this.crystalParticles.rotation.y = time * 0.1;
        const posArr = (this.crystalParticles.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
        const count = posArr.length / 3;
        for (let i = 0; i < count; i++) {
          posArr[i * 3 + 1] += Math.sin(time * 1.5 + i * 0.8) * 0.002;
        }
        (this.crystalParticles.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      }

      // Ground fog animated opacity
      if (this.groundFog) {
        const fogMat = this.groundFog.material as THREE.MeshBasicMaterial;
        fogMat.opacity = 0.08 + Math.sin(time * 0.5) * 0.04;
      }

      // Ambient dust drifting upward slowly
      if (this.ambientDust) {
        const posArr = (this.ambientDust.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
        const count = posArr.length / 3;
        for (let i = 0; i < count; i++) {
          posArr[i * 3 + 1] += 0.003; // drift up
          posArr[i * 3] += Math.sin(time + i) * 0.001; // gentle horizontal sway
          // Reset particle if it goes too high
          if (posArr[i * 3 + 1] > 6) {
            posArr[i * 3 + 1] = 0;
          }
        }
        (this.ambientDust.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      }

      // Update label positions (project 3D -> 2D)
      this.updateLabelPositions();

      // Show label for highlighted station
      for (const [station, label] of this.labels) {
        label.style.opacity = station === this.highlightedStation ? '1' : '0';
      }
    };
    animate();
  }

  stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private updateLabelPositions(): void {
    const positions: Record<HubStation, THREE.Vector3> = {
      merchant: new THREE.Vector3(-6, 3.5, -2),
      chest: new THREE.Vector3(6, 2, -2),
      backpack: new THREE.Vector3(0, 2.5, -5),
      portal: new THREE.Vector3(0, 5, 6),
    };

    for (const [station, pos] of Object.entries(positions) as [HubStation, THREE.Vector3][]) {
      const label = this.labels.get(station);
      if (!label) continue;

      const projected = pos.clone().project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    }
  }

  // ─── Cleanup ──────────────────────────────────────
  remove(): void {
    this.stopAnimation();

    // Remove event listeners
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      if (this.mouseMoveHandler) canvas.removeEventListener('mousemove', this.mouseMoveHandler);
      if (this.clickHandler) canvas.removeEventListener('click', this.clickHandler);
      canvas.style.cursor = 'default';
    }
    this.mouseMoveHandler = null;
    this.clickHandler = null;

    // Remove labels
    for (const label of this.labels.values()) {
      label.remove();
    }
    this.labels.clear();

    // Remove from scene
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
