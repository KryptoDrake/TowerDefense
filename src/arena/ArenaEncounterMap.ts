// Slay the Spire-ähnliche Begegnungskarte zwischen Kämpfen

export type EncounterType = 'kampf' | 'elite' | 'laden' | 'rast' | 'boss';

export interface MapNode {
  id: number;
  row: number;       // 0 = Start, maxRow = Boss
  col: number;       // Position in der Reihe
  type: EncounterType;
  connections: number[];  // IDs der Knoten in der NÄCHSTEN Reihe
  completed: boolean;
  current: boolean;
}

export interface EncounterMapDef {
  nodes: MapNode[];
  totalRows: number;
}

// ─── Deutsche Bezeichnungen ─────────────────────────────────────────────────

const NODE_LABELS: Record<EncounterType, string> = {
  kampf: 'Kampf',
  elite: 'Elite-Kampf',
  laden: 'Händler',
  rast: 'Rast',
  boss: 'Boss',
};

const NODE_COLORS: Record<EncounterType, string> = {
  kampf: '#ff4444',
  elite: '#ff8800',
  laden: '#44aaff',
  rast: '#44ff44',
  boss: '#cc44ff',
};

const NODE_ICONS: Record<EncounterType, string> = {
  kampf: '\u2694',   // crossed swords
  elite: '\u2620',   // skull
  laden: '\u{1F6D2}', // shopping cart
  rast: '\u2665',    // heart
  boss: '\u{1F451}', // crown
};

// ─── Begegnungskarte ────────────────────────────────────────────────────────

export class ArenaEncounterMap {
  private mapDef: EncounterMapDef;
  private container: HTMLDivElement | null = null;

  onNodeSelect: ((node: MapNode) => void) | null = null;

  constructor() {
    this.mapDef = { nodes: [], totalRows: 0 };
  }

  /** Generiert eine neue zufällige Karte */
  generate(difficulty: number): void {
    const totalRows = 7;
    const nodes: MapNode[] = [];
    let nextId = 0;

    // Knotenstruktur pro Reihe definieren
    const rowSizes = [1, 3, 3, this.randomInt(2, 3), 3, 3, 1];

    // Knoten erstellen
    for (let row = 0; row < totalRows; row++) {
      const count = rowSizes[row];
      for (let col = 0; col < count; col++) {
        const type = this.determineNodeType(row, totalRows, difficulty);
        nodes.push({
          id: nextId++,
          row,
          col,
          type,
          connections: [],
          completed: false,
          current: row === 0,
        });
      }
    }

    // Verbindungen erstellen: jeder Knoten verbindet sich zu 1-2 Knoten der nächsten Reihe
    for (let row = 0; row < totalRows - 1; row++) {
      const currentRowNodes = nodes.filter(n => n.row === row);
      const nextRowNodes = nodes.filter(n => n.row === row + 1);

      if (nextRowNodes.length === 0) continue;

      // Stelle sicher, dass jeder Knoten in der aktuellen Reihe mindestens 1 Verbindung hat
      for (const node of currentRowNodes) {
        // Bevorzuge nahe Spalten
        const sortedNextNodes = [...nextRowNodes].sort((a, b) => {
          const colRatioA = currentRowNodes.length > 1
            ? (node.col / (currentRowNodes.length - 1))
            : 0.5;
          const colRatioB = nextRowNodes.length > 1
            ? (a.col / (nextRowNodes.length - 1))
            : 0.5;
          const colRatioC = nextRowNodes.length > 1
            ? (b.col / (nextRowNodes.length - 1))
            : 0.5;
          return Math.abs(colRatioB - colRatioA) - Math.abs(colRatioC - colRatioA);
        });

        // Mindestens 1, bis zu 2 Verbindungen
        const numConnections = Math.min(
          nextRowNodes.length,
          Math.random() < 0.6 ? 2 : 1
        );

        for (let i = 0; i < numConnections; i++) {
          if (!node.connections.includes(sortedNextNodes[i].id)) {
            node.connections.push(sortedNextNodes[i].id);
          }
        }
      }

      // Stelle sicher, dass jeder Knoten in der nächsten Reihe erreichbar ist
      for (const nextNode of nextRowNodes) {
        const isReachable = currentRowNodes.some(n => n.connections.includes(nextNode.id));
        if (!isReachable) {
          // Verbinde den nächstgelegenen Knoten der aktuellen Reihe
          const closest = currentRowNodes.reduce((best, curr) => {
            const currColRatio = currentRowNodes.length > 1
              ? (curr.col / (currentRowNodes.length - 1))
              : 0.5;
            const bestColRatio = currentRowNodes.length > 1
              ? (best.col / (currentRowNodes.length - 1))
              : 0.5;
            const nextColRatio = nextRowNodes.length > 1
              ? (nextNode.col / (nextRowNodes.length - 1))
              : 0.5;
            return Math.abs(currColRatio - nextColRatio) < Math.abs(bestColRatio - nextColRatio)
              ? curr
              : best;
          });
          if (!closest.connections.includes(nextNode.id)) {
            closest.connections.push(nextNode.id);
          }
        }
      }
    }

    this.mapDef = { nodes, totalRows };
  }

  /** Bestimmt den Knotentyp basierend auf Reihe und Schwierigkeit */
  private determineNodeType(row: number, totalRows: number, _difficulty: number): EncounterType {
    // Erste Reihe ist immer Kampf
    if (row === 0) return 'kampf';

    // Letzte Reihe ist immer Boss
    if (row === totalRows - 1) return 'boss';

    // Zufällige Verteilung: 50% Kampf, 15% Elite, 15% Laden, 20% Rast
    const roll = Math.random();
    if (roll < 0.50) return 'kampf';
    if (roll < 0.65) return 'elite';
    if (roll < 0.80) return 'laden';
    return 'rast';
  }

  /** Gibt aktuell verfügbare Knoten zurück (verbunden mit aktuellem Standort) */
  getAvailableNodes(): MapNode[] {
    // Finde alle aktuellen Knoten
    const currentNodes = this.mapDef.nodes.filter(n => n.current);

    if (currentNodes.length === 0) {
      // Am Anfang: gib den Startknoten zurück
      const startNodes = this.mapDef.nodes.filter(n => n.row === 0);
      return startNodes;
    }

    // Finde abgeschlossene aktuelle Knoten und deren Verbindungen
    const completedCurrent = currentNodes.filter(n => n.completed);
    if (completedCurrent.length === 0) {
      // Aktuelle Knoten noch nicht abgeschlossen: diese sind verfügbar
      return currentNodes;
    }

    // Sammle alle verbundenen Knoten der nächsten Reihe
    const nextIds = new Set<number>();
    for (const node of completedCurrent) {
      for (const connId of node.connections) {
        nextIds.add(connId);
      }
    }

    return this.mapDef.nodes.filter(n => nextIds.has(n.id));
  }

  /** Markiert einen Knoten als abgeschlossen und setzt den nächsten als aktuell */
  completeNode(nodeId: number): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    node.completed = true;

    // Alle vorherigen "current" Markierungen entfernen
    for (const n of this.mapDef.nodes) {
      n.current = false;
    }

    // Verbundene Knoten der nächsten Reihe als aktuell markieren
    for (const connId of node.connections) {
      const nextNode = this.getNode(connId);
      if (nextNode) {
        nextNode.current = true;
      }
    }
  }

  /** Prüft ob der Boss erreicht wurde */
  isBossReached(): boolean {
    const bossNodes = this.mapDef.nodes.filter(n => n.type === 'boss');
    return bossNodes.some(n => n.completed);
  }

  /** Zeigt die Karte als HTML-Overlay */
  show(): void {
    this.hide();

    this.container = document.createElement('div');
    this.container.id = 'arena-encounter-map';
    this.container.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;

    // Titel
    const title = document.createElement('h1');
    title.textContent = 'Begegnungskarte';
    title.style.cssText = `
      color: #ffd700;
      font-size: 28px;
      margin-bottom: 20px;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    `;
    this.container.appendChild(title);

    // Kartencontainer
    const mapContainer = document.createElement('div');
    mapContainer.style.cssText = `
      position: relative;
      width: 700px;
      height: 500px;
      background: rgba(20, 20, 40, 0.9);
      border: 2px solid #555;
      border-radius: 12px;
      overflow: hidden;
    `;
    this.container.appendChild(mapContainer);

    // SVG für Verbindungslinien
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '700');
    svg.setAttribute('height', '500');
    svg.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none;';
    mapContainer.appendChild(svg);

    const totalRows = this.mapDef.totalRows;
    const availableNodes = this.getAvailableNodes();
    const availableIds = new Set(availableNodes.map(n => n.id));

    // Knotenpositionen berechnen
    const nodePositions: Record<number, { x: number; y: number }> = {};
    for (let row = 0; row < totalRows; row++) {
      const rowNodes = this.mapDef.nodes.filter(n => n.row === row);
      const rowCount = rowNodes.length;
      const yPos = 40 + (row / (totalRows - 1)) * 420;

      for (let i = 0; i < rowCount; i++) {
        const xPos = rowCount === 1
          ? 350
          : 100 + (i / (rowCount - 1)) * 500;
        nodePositions[rowNodes[i].id] = { x: xPos, y: yPos };
      }
    }

    // Verbindungslinien zeichnen
    for (const node of this.mapDef.nodes) {
      const fromPos = nodePositions[node.id];
      if (!fromPos) continue;

      for (const connId of node.connections) {
        const toPos = nodePositions[connId];
        if (!toPos) continue;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(fromPos.x));
        line.setAttribute('y1', String(fromPos.y));
        line.setAttribute('x2', String(toPos.x));
        line.setAttribute('y2', String(toPos.y));

        // Hervorhebung verfügbarer Pfade
        const isActivePath = node.completed && availableIds.has(connId);
        line.setAttribute('stroke', isActivePath ? '#ffd700' : '#444');
        line.setAttribute('stroke-width', isActivePath ? '3' : '1.5');
        line.setAttribute('stroke-dasharray', isActivePath ? '' : '4,4');
        svg.appendChild(line);
      }
    }

    // Knoten rendern
    for (const node of this.mapDef.nodes) {
      const pos = nodePositions[node.id];
      if (!pos) continue;

      const nodeEl = document.createElement('div');
      const isAvailable = availableIds.has(node.id) && !node.completed;
      const color = NODE_COLORS[node.type];
      const icon = NODE_ICONS[node.type];
      const label = NODE_LABELS[node.type];

      nodeEl.style.cssText = `
        position: absolute;
        left: ${pos.x - 22}px;
        top: ${pos.y - 22}px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: ${node.completed ? '#333' : color};
        border: 3px solid ${node.completed ? '#666' : isAvailable ? '#fff' : color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: ${isAvailable ? 'pointer' : 'default'};
        opacity: ${node.completed ? 0.5 : isAvailable ? 1.0 : 0.6};
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: ${isAvailable ? `0 0 12px ${color}` : 'none'};
        user-select: none;
      `;
      nodeEl.textContent = icon;
      nodeEl.title = `${label}${node.completed ? ' (Abgeschlossen)' : ''}`;

      if (isAvailable) {
        nodeEl.addEventListener('mouseenter', () => {
          nodeEl.style.transform = 'scale(1.2)';
          nodeEl.style.boxShadow = `0 0 20px ${color}`;
        });
        nodeEl.addEventListener('mouseleave', () => {
          nodeEl.style.transform = 'scale(1.0)';
          nodeEl.style.boxShadow = `0 0 12px ${color}`;
        });
        nodeEl.addEventListener('click', () => {
          if (this.onNodeSelect) {
            this.onNodeSelect(node);
          }
        });
      }

      // Label unter dem Knoten
      const labelEl = document.createElement('div');
      labelEl.style.cssText = `
        position: absolute;
        left: ${pos.x - 40}px;
        top: ${pos.y + 26}px;
        width: 80px;
        text-align: center;
        font-size: 10px;
        color: ${node.completed ? '#666' : '#ccc'};
        pointer-events: none;
      `;
      labelEl.textContent = label;
      mapContainer.appendChild(labelEl);

      mapContainer.appendChild(nodeEl);
    }

    // Schließen-Button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Schließen';
    closeBtn.style.cssText = `
      margin-top: 16px;
      padding: 10px 30px;
      font-size: 16px;
      background: #444;
      color: #fff;
      border: 2px solid #888;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = '#666';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = '#444';
    });
    closeBtn.addEventListener('click', () => {
      this.hide();
    });
    this.container.appendChild(closeBtn);

    document.body.appendChild(this.container);
  }

  /** Versteckt die Karte */
  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /** Gibt einen Knoten anhand seiner ID zurück */
  getNode(id: number): MapNode | null {
    return this.mapDef.nodes.find(n => n.id === id) || null;
  }

  /** Gibt alle Knoten zurück */
  getAllNodes(): MapNode[] {
    return this.mapDef.nodes;
  }

  /** Zufällige Ganzzahl im Bereich [min, max] (inklusive) */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
