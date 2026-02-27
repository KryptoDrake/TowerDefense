/**
 * Spielanleitung - In-Game Help Screen
 */

export class Spielanleitung {
  private overlay: HTMLDivElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'spielanleitung-overlay';
    this.overlay.style.cssText = `
      display: none;
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 300;
      justify-content: center;
      align-items: center;
      overflow-y: auto;
    `;
    this.overlay.innerHTML = this.buildContent();
    document.body.appendChild(this.overlay);

    // Close on click outside or close button
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  show(): void {
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  toggle(): void {
    if (this.overlay.style.display === 'flex') {
      this.hide();
    } else {
      this.show();
    }
  }

  private buildContent(): string {
    return `
      <div style="
        background: rgba(15,15,30,0.98);
        border: 2px solid rgba(255,204,68,0.4);
        border-radius: 16px;
        padding: 30px 40px;
        max-width: min(700px, 94vw);
        width: 94%;
        max-height: 85vh;
        overflow-y: auto;
        color: #ccc;
        font-size: 14px;
        line-height: 1.6;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h1 style="color: #ffcc44; font-size: 28px; margin: 0;">Spielanleitung</h1>
          <button id="anleitung-close" style="
            background: none; border: 1px solid #555; color: #888;
            border-radius: 50%; width: 32px; height: 32px; font-size: 18px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
          ">\u2715</button>
        </div>

        <!-- Spielidee -->
        <h2 style="color: #44aaff; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Die Idee
        </h2>
        <p>
          <strong>Zombie Tower Defense</strong> vereint drei Spielmodi in einem Spiel:
          Klassisches Tower Defense, Auto-Kampf im TFT-Stil und rundenbasierter Arena-Kampf.
          Zwischen den Expeditionen kehrst du in dein <strong>Hauptquartier</strong> zur\u00fcck,
          kaufst Waffen und dauerhafte Verbesserungen, r\u00fcstest deinen Rucksack aus und w\u00e4hlst
          die n\u00e4chste Expedition auf der Weltkarte.
        </p>

        <!-- 3 Spielmodi -->
        <h2 style="color: #44aaff; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Drei Spielmodi
        </h2>
        <div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 12px;">
          <div style="background: rgba(68,170,255,0.08); border: 1px solid rgba(68,170,255,0.3); border-radius: 8px; padding: 10px;">
            <h3 style="color: #44aaff; font-size: 14px; margin: 0 0 4px 0;">\u{1F3F0} Tower Defense</h3>
            <p style="font-size: 12px; margin: 0;">Platziere T\u00fcrme neben dem Pfad und Fallen darauf. Verteidige deine Basis gegen Zombiewellen. Upgrade T\u00fcrme bis Level 3 f\u00fcr maximale St\u00e4rke.</p>
          </div>
          <div style="background: rgba(255,136,0,0.08); border: 1px solid rgba(255,136,0,0.3); border-radius: 8px; padding: 10px;">
            <h3 style="color: #ff8800; font-size: 14px; margin: 0 0 4px 0;">\u2694\uFE0F Auto-Kampf (TFT-Stil)</h3>
            <p style="font-size: 12px; margin: 0;">Kaufe Einheiten im Shop, platziere sie auf dem 8\u00d78 Schlachtfeld. Einheiten k\u00e4mpfen automatisch! 3 gleiche Einheiten kombinieren = Stufe hoch. Gold sparen bringt Zinsen.</p>
          </div>
          <div style="background: rgba(255,68,170,0.08); border: 1px solid rgba(255,68,170,0.3); border-radius: 8px; padding: 10px;">
            <h3 style="color: #ff44aa; font-size: 14px; margin: 0 0 4px 0;">\u{1F3DF}\uFE0F Arena-Kampf (Rundenbasiert)</h3>
            <p style="font-size: 12px; margin: 0;">W\u00e4hle 4 Einheiten f\u00fcr dein Team. Rundenbasierter Kampf mit F\u00e4higkeiten und Mana. Elementar-Vorteile beachten! Zwischen K\u00e4mpfen: Rast, Shop oder Boss.</p>
          </div>
        </div>

        <!-- TD Spielablauf -->
        <h2 style="color: #44aaff; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Tower Defense \u2013 Spielablauf
        </h2>
        <ol style="padding-left: 20px; font-size: 13px;">
          <li><strong>Hauptquartier:</strong> Kaufe Waffen (\u{1F48E}), r\u00fcste Rucksack aus, starte durch das Portal.</li>
          <li><strong>Weltkarte:</strong> W\u00e4hle ein Level. 14 Level mit 5 einzigartigen Umgebungen.</li>
          <li><strong>Platzieren:</strong> T\u00fcrme neben Pfad, Fallen auf Pfad. Synergien beachten!</li>
          <li><strong>Welle starten:</strong> \u201EWelle Starten\u201C dr\u00fccken. Geschwindigkeit mit 1x/2x/3x anpassen.</li>
          <li><strong>Upgraden:</strong> Klick auf Turm \u2192 Upgrade (bis Lvl 3) oder Verkaufen.</li>
          <li><strong>Sieg:</strong> Alle Wellen \u00fcberstehen = Kristalle + Truhen-Chance!</li>
        </ol>

        <!-- Hauptquartier -->
        <h2 style="color: #ffcc44; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(255,204,68,0.3); padding-bottom: 4px;">
          Hauptquartier
        </h2>
        <ul style="padding-left: 20px; font-size: 13px;">
          <li><strong>H\u00e4ndler:</strong> Neue Waffen kaufen + <span style="color: #aa66ff;">dauerhafte Verbesserungen</span> (Turm-Schaden, Gold-Bonus, Basis-HP usw.)</li>
          <li><strong>Truhe:</strong> Truhen \u00f6ffnen nach Siegen (Bronze/Silber/Gold)</li>
          <li><strong>Rucksack:</strong> Waffen ausw\u00e4hlen f\u00fcr die n\u00e4chste Expedition</li>
          <li><strong>Portal:</strong> Weltkarte \u00f6ffnen und Level starten</li>
        </ul>

        <!-- Synergien -->
        <h2 style="color: #ff8844; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(255,136,68,0.3); padding-bottom: 4px;">
          Synergien
        </h2>
        <p style="font-size: 12px;">Platziere bestimmte Turm-Paare nahe beieinander f\u00fcr Bonus-Effekte:</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px;">
          <span>\u2744\uFE0F+\u{1F525} <strong>Frostbrand:</strong> +30% Schaden</span>
          <span>\u26A1+\u{1F3F9} <strong>Blitzableiter:</strong> Kettenblitz</span>
          <span>\u2620\uFE0F+\u2744\uFE0F <strong>Giftiger Nebel:</strong> DoT +50%</span>
          <span>\u{1F4A3}+\u{1F4A5} <strong>Artillerie-Netz:</strong> +20% Splash</span>
          <span>\u{1F3AF}+\u{1F525} <strong>Pr\u00e4zisionsfeuer:</strong> Sniper DoT</span>
          <span>\u26A1+\u2744\uFE0F <strong>Sturmfront:</strong> Blitz friert ein</span>
        </div>

        <!-- Waffentypen -->
        <h2 style="color: #44aaff; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Waffentypen
        </h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
            <h3 style="color: #ffcc44; font-size: 14px; margin: 0 0 6px 0;">T\u00fcrme (neben Pfad)</h3>
            <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
              <li><strong>Pfeil-Turm:</strong> Schneller Allrounder</li>
              <li><strong>Kanonen-Turm:</strong> Fl\u00e4chenschaden</li>
              <li><strong>Eis-Turm:</strong> Verlangsamt Gegner</li>
              <li><strong>Feuer-Turm:</strong> Schaden \u00fcber Zeit</li>
              <li><strong>Sniper-Turm:</strong> Extreme Reichweite</li>
              <li><strong>Tesla-Turm:</strong> Kettenblitz</li>
              <li><strong>M\u00f6rser-Turm:</strong> Gro\u00dfer Splash</li>
              <li><strong>Gift-Turm:</strong> Giftwolke (DoT + AoE)</li>
              <li><strong>Laser-Turm:</strong> Steigender Strahl</li>
              <li><strong>Wind-Turm:</strong> St\u00f6\u00dft zur\u00fcck</li>
              <li><strong>Magier-Turm:</strong> Homing-Projektile</li>
              <li><strong>Flammenwerfer:</strong> Nahbereich-Feuer</li>
              <li><strong>Barriere-Turm:</strong> Verlangsamungsfeld</li>
              <li><strong>Nekromant-Turm:</strong> Dunkle Magie</li>
              <li><strong>Erdbeben-Turm:</strong> AoE-Stun</li>
              <li><strong>Heilturm:</strong> Heilt die Basis</li>
            </ul>
          </div>
          <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
            <h3 style="color: #ff8844; font-size: 14px; margin: 0 0 6px 0;">Fallen (auf dem Pfad)</h3>
            <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
              <li><strong>Landmine:</strong> Einmalige Explosion</li>
              <li><strong>Stachelfalle:</strong> Dauerschaden + Slow</li>
              <li><strong>Frostmine:</strong> Friert alle ein (3s)</li>
              <li><strong>Goldmine:</strong> +3 Gold pro Sekunde</li>
            </ul>

            <h3 style="color: #aa88ff; font-size: 14px; margin: 16px 0 6px 0;">Tipps</h3>
            <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
              <li>Kombiniere Verlangsamung + Schaden</li>
              <li>Upgrade lohnt sich \u2013 Level 3 ist sehr stark</li>
              <li>Goldmine bringt passive Einnahmen</li>
              <li>Heilturm rettet bei knapper HP</li>
              <li>Hotkeys 1-0 f\u00fcr schnelles Platzieren</li>
              <li>Rechte Maustaste: Kamera drehen</li>
              <li>Mausrad: Zoomen</li>
            </ul>
          </div>
        </div>

        <!-- Gegnertypen -->
        <h2 style="color: #ff4444; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(255,68,68,0.3); padding-bottom: 4px;">
          Gegnertypen
        </h2>
        <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
          <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
            <li><strong style="color: #2d8a4e;">Normal:</strong> Standard-Zombie. Mittlere Werte.</li>
            <li><strong style="color: #8a2d2d;">Schnell:</strong> Rennt schnell, aber wenig HP.</li>
            <li><strong style="color: #4a2d8a;">Tank:</strong> Langsam, massig HP und hoher Schaden.</li>
            <li><strong style="color: #8a0000;">Boss:</strong> Riesiger Zombie. Sehr viel HP und verheerend.</li>
            <li><strong style="color: #44aaff;">Flieger:</strong> Fliegt \u00fcber dem Pfad. Nur T\u00fcrme mit Reichweite \u22655 k\u00f6nnen ihn treffen. Fallen ignoriert er.</li>
            <li><strong style="color: #44ff88;">Heiler:</strong> Heilt Verb\u00fcndete in der N\u00e4he (+10 HP/s). Zuerst ausschalten!</li>
            <li><strong style="color: #ffaa44;">Splitter:</strong> Spaltet sich beim Tod in 2 Mini-Splitter auf.</li>
          </ul>
        </div>

        <!-- Turm-Zielmodi -->
        <h2 style="color: #44aaff; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Turm-Zielmodi
        </h2>
        <p style="font-size: 13px; margin-bottom: 8px;">Jeder Turm kann seinen Zielmodus \u00e4ndern:</p>
        <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
          <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
            <li><strong style="color: #44ff88;">Erster (Standard):</strong> Zielt auf den Feind, der am weitesten auf dem Pfad ist</li>
            <li><strong style="color: #ff8844;">Letzter:</strong> Zielt auf den neuesten Feind</li>
            <li><strong style="color: #ff4444;">St\u00e4rkster:</strong> Zielt auf den Feind mit den meisten HP</li>
            <li><strong style="color: #44aaff;">N\u00e4chster:</strong> Zielt auf den n\u00e4chstgelegenen Feind</li>
          </ul>
          <p style="font-size: 11px; color: #999; margin: 8px 0 0 0;">T-Taste oder Klick auf den Ziel-Button im Turm-Info-Panel</p>
        </div>

        <!-- Kombo-System -->
        <h2 style="color: #ff8844; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(255,136,68,0.3); padding-bottom: 4px;">
          Kombo-System
        </h2>
        <div style="background: rgba(255,136,68,0.08); border: 1px solid rgba(255,136,68,0.3); border-radius: 8px; padding: 10px;">
          <p style="font-size: 13px; margin: 0 0 6px 0;">Schnelle Kills in Folge = Kombo-Multiplikator!</p>
          <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
            <li><strong>5 Kills:</strong> +5 Gold</li>
            <li><strong>10 Kills:</strong> +15 Gold</li>
            <li><strong>20 Kills:</strong> +30 Gold</li>
            <li><strong>50 Kills:</strong> +50 Gold</li>
          </ul>
          <p style="font-size: 11px; color: #999; margin: 8px 0 0 0;">Kombo verf\u00e4llt nach 3 Sekunden ohne Kill</p>
        </div>

        <!-- Zinsen -->
        <h2 style="color: #ffcc44; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(255,204,68,0.3); padding-bottom: 4px;">
          Zinsen
        </h2>
        <div style="background: rgba(255,204,68,0.08); border: 1px solid rgba(255,204,68,0.3); border-radius: 8px; padding: 10px;">
          <p style="font-size: 13px; margin: 0 0 6px 0;">Spare Gold zwischen den Wellen f\u00fcr Zinsen!</p>
          <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
            <li><strong>1 Gold</strong> pro 20 gesparte Gold (max 5 pro Welle)</li>
          </ul>
          <p style="font-size: 11px; color: #ffcc44; margin: 8px 0 0 0;">Tipp: Nicht alles sofort ausgeben!</p>
        </div>

        <!-- Schwierigkeitsanpassung -->
        <h2 style="color: #aa88ff; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(170,136,255,0.3); padding-bottom: 4px;">
          Schwierigkeitsanpassung
        </h2>
        <div style="background: rgba(170,136,255,0.08); border: 1px solid rgba(170,136,255,0.3); border-radius: 8px; padding: 10px;">
          <p style="font-size: 13px; margin: 0 0 6px 0;">Das Spiel passt sich automatisch an deine Leistung an:</p>
          <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
            <li><strong style="color: #ff4444;">Perfekte Wellen</strong> \u2192 Feinde werden st\u00e4rker</li>
            <li><strong style="color: #44ff88;">Mehrere Niederlagen</strong> \u2192 Feinde werden schw\u00e4cher</li>
          </ul>
        </div>

        <!-- Turm-Upgrades -->
        <h2 style="color: #ffcc44; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(255,204,68,0.3); padding-bottom: 4px;">
          Turm-Upgrades
        </h2>
        <div style="background: rgba(255,204,68,0.08); border: 1px solid rgba(255,204,68,0.3); border-radius: 8px; padding: 10px;">
          <ul style="padding-left: 16px; font-size: 12px; margin: 0;">
            <li><strong style="color: #88ccff;">Stufe 2:</strong> Turm wird etwas gr\u00f6\u00dfer, leuchtender Ring an der Basis</li>
            <li><strong style="color: #ffcc44;">Stufe 3:</strong> Goldene Krone, st\u00e4rkerer Leuchteffekt, maximale St\u00e4rke</li>
          </ul>
        </div>

        <!-- Steuerung -->
        <h2 style="color: #44aaff; font-size: 18px; margin: 20px 0 8px 0; border-bottom: 1px solid rgba(68,170,255,0.3); padding-bottom: 4px;">
          Steuerung
        </h2>
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 13px;">
          <strong>1-0:</strong> <span>Waffe ausw\u00e4hlen (Hotkeys)</span>
          <strong>ESC:</strong> <span>Auswahl aufheben</span>
          <strong>Linksklick:</strong> <span>Platzieren / Turm ausw\u00e4hlen</span>
          <strong>Linksklick + Ziehen:</strong> <span>Kamera drehen</span>
          <strong>Mittlere Maus + Ziehen:</strong> <span>Kamera verschieben</span>
          <strong>Mausrad:</strong> <span>Zoomen</span>
          <strong>WASD / Pfeiltasten:</strong> <span>Kamera bewegen</span>
          <strong>H:</strong> <span>Spielanleitung \u00f6ffnen/schlie\u00dfen</span>
          <strong>U:</strong> <span>Ausgew\u00e4hlten Turm upgraden</span>
          <strong>S:</strong> <span>Ausgew\u00e4hlten Turm verkaufen</span>
          <strong>T:</strong> <span>Zielmodus wechseln</span>
          <strong>Leertaste:</strong> <span>N\u00e4chste Welle starten</span>
          <strong>Tab:</strong> <span>Zum n\u00e4chsten Turm wechseln</span>
          <strong>Geschwindigkeit:</strong> <span>Klick auf 1x/2x/3x Button oben rechts</span>
          <strong>Wellenvorschau:</strong> <span>Zeigt n\u00e4chste Welle automatisch an</span>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button id="anleitung-close-bottom" style="
            padding: 10px 30px; font-size: 14px; font-weight: bold;
            color: #fff; background: linear-gradient(135deg, #3498db, #2980b9);
            border: 2px solid #5dade2; border-radius: 8px; cursor: pointer;
          ">Verstanden!</button>
        </div>
      </div>
    `;
  }
}
