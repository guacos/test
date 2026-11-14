/**
 * Kleiner Baukasten für PDFs (A4) mit pdf-lib: Text mit Umbruch, Tabellen mit
 * Seitenumbruch und wiederholtem Kopf, Bilder, Seitenzahlen in der Fußzeile.
 * Läuft ohne Browser-Funktionen – auf Android und im Web gleich.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib';

export const A4 = { b: 595.28, h: 841.89 };
export const RAND = 42;
const FUSS = 30;

export const FARBE = {
  schwarz: rgb(0, 0, 0),
  grau: rgb(0.36, 0.4, 0.45),
  hellgrau: rgb(0.86, 0.88, 0.91),
  zart: rgb(0.955, 0.962, 0.972),
  navy: rgb(0.043, 0.145, 0.251),
  blau: rgb(0.039, 0.165, 0.42),
  rot: rgb(0.69, 0, 0.125),
  gruen: rgb(0.106, 0.42, 0.204),
  weiss: rgb(1, 1, 1),
};

export interface Absatz {
  text: string;
  fett?: boolean;
  farbe?: RGB;
  groesse?: number;
  /** Abstand nach oben */
  oben?: number;
}

export interface Spalte {
  titel: string;
  breite: number;
}

export interface BildDaten {
  bytes: Uint8Array;
}

interface Box {
  text: string;
  font: PDFFont;
  farbe: RGB;
  groesse: number;
  h: number;
}

const ERSATZ: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '✓': 'x',
  '✔': 'x',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '‑': '-',
  '\t': ' ',
};

export class Pdf {
  doc!: PDFDocument;
  normal!: PDFFont;
  fett!: PDFFont;
  seite!: PDFPage;
  y = 0;
  private kodierbar = new Map<string, boolean>();
  /** Wird auf jeder neuen Seite aufgerufen (z. B. Tabellenkopf wiederholen) */
  private aufNeuerSeite: (() => void) | null = null;

  static async neu(titel: string, autor: string): Promise<Pdf> {
    const p = new Pdf();
    p.doc = await PDFDocument.create();
    p.doc.setTitle(titel);
    p.doc.setAuthor(autor);
    p.doc.setCreator('Bauleitung-App');
    p.normal = await p.doc.embedFont(StandardFonts.Helvetica);
    p.fett = await p.doc.embedFont(StandardFonts.HelveticaBold);
    p.neueSeite();
    return p;
  }

  get breite(): number {
    return A4.b - 2 * RAND;
  }

  neueSeite() {
    this.seite = this.doc.addPage([A4.b, A4.h]);
    this.y = A4.h - RAND;
    this.aufNeuerSeite?.();
  }

  /** Verbleibende Höhe auf der Seite */
  rest(): number {
    return this.y - (RAND + FUSS);
  }

  platz(h: number) {
    if (this.rest() < h) this.neueSeite();
  }

  abstand(h: number) {
    this.y -= h;
  }

  /** Entfernt Zeichen, die die PDF-Standardschrift nicht darstellen kann (z. B. Emojis). */
  sicher(text: string): string {
    let r = '';
    for (const z of text.replace(/\r\n?/g, '\n')) {
      const ch = ERSATZ[z] ?? z;
      if (ch === '\n') {
        r += ch;
        continue;
      }
      let ok = this.kodierbar.get(ch);
      if (ok === undefined) {
        try {
          this.normal.encodeText(ch);
          ok = true;
        } catch {
          ok = false;
        }
        this.kodierbar.set(ch, ok);
      }
      r += ok ? ch : '?';
    }
    return r;
  }

  /** Zeilenumbruch nach Wörtern; überlange Wörter werden getrennt. */
  umbrich(text: string, font: PDFFont, groesse: number, breite: number): string[] {
    const zeilen: string[] = [];
    for (const absatz of this.sicher(text).split('\n')) {
      let zeile = '';
      for (let wort of absatz.split(/ +/)) {
        if (!wort) continue;
        while (font.widthOfTextAtSize(wort, groesse) > breite) {
          // Wort passt nicht in eine Zeile → hart trennen
          let n = wort.length - 1;
          while (n > 1 && font.widthOfTextAtSize(wort.slice(0, n), groesse) > breite) n--;
          if (zeile) {
            zeilen.push(zeile);
            zeile = '';
          }
          zeilen.push(wort.slice(0, n));
          wort = wort.slice(n);
        }
        const probe = zeile ? `${zeile} ${wort}` : wort;
        if (font.widthOfTextAtSize(probe, groesse) <= breite) zeile = probe;
        else {
          zeilen.push(zeile);
          zeile = wort;
        }
      }
      zeilen.push(zeile);
    }
    return zeilen;
  }

  private boxen(absaetze: Absatz[], breite: number, standardGroesse = 9.5): Box[] {
    const r: Box[] = [];
    for (const a of absaetze) {
      if (!a.text) continue;
      const groesse = a.groesse ?? standardGroesse;
      const font = a.fett ? this.fett : this.normal;
      const zeilen = this.umbrich(a.text, font, groesse, breite);
      zeilen.forEach((text, i) =>
        r.push({ text, font, farbe: a.farbe ?? FARBE.schwarz, groesse, h: groesse * 1.32 + (i === 0 ? (a.oben ?? 0) : 0) }),
      );
    }
    return r;
  }

  private zeichne(b: Box, x: number, yOben: number) {
    if (b.text) this.seite.drawText(b.text, { x, y: yOben - b.h + b.groesse * 0.3, size: b.groesse, font: b.font, color: b.farbe });
  }

  /** Fließtext über die Breite, mit Seitenumbruch. */
  text(absaetze: Absatz[] | Absatz, opt: { x?: number; breite?: number; groesse?: number } = {}) {
    const x = opt.x ?? RAND;
    const breite = opt.breite ?? this.breite - (x - RAND);
    for (const b of this.boxen(Array.isArray(absaetze) ? absaetze : [absaetze], breite, opt.groesse)) {
      this.platz(b.h);
      this.zeichne(b, x, this.y);
      this.y -= b.h;
    }
  }

  linie(farbe: RGB = FARBE.hellgrau, dicke = 0.7) {
    this.seite.drawLine({ start: { x: RAND, y: this.y }, end: { x: RAND + this.breite, y: this.y }, thickness: dicke, color: farbe });
  }

  /** Dokumenttitel mit optionalem Zusatz rechts (z. B. "ENTWURF"). */
  titel(text: string, zusatz?: string) {
    this.platz(40);
    this.seite.drawRectangle({ x: RAND, y: this.y - 30, width: 4, height: 26, color: FARBE.navy });
    this.seite.drawText(this.sicher(text), { x: RAND + 12, y: this.y - 24, size: 18, font: this.fett, color: FARBE.navy });
    if (zusatz) {
      const z = this.sicher(zusatz);
      const w = this.fett.widthOfTextAtSize(z, 9) + 14;
      this.seite.drawRectangle({ x: RAND + this.breite - w, y: this.y - 26, width: w, height: 17, color: FARBE.zart, borderColor: FARBE.grau, borderWidth: 0.6 });
      this.seite.drawText(z, { x: RAND + this.breite - w + 7, y: this.y - 21, size: 9, font: this.fett, color: FARBE.grau });
    }
    this.y -= 40;
  }

  zwischentitel(text: string) {
    this.platz(26);
    this.y -= 6;
    this.seite.drawText(this.sicher(text), { x: RAND, y: this.y - 11, size: 11, font: this.fett, color: FARBE.navy });
    this.y -= 18;
  }

  /** Angaben als "Bezeichnung: Wert" in zwei Spalten. */
  angaben(paare: [string, string][], labelBreite = 92) {
    for (const [label, wert] of paare) {
      const boxen = this.boxen([{ text: wert || '–' }], this.breite - labelBreite, 10);
      const h = boxen.reduce((s, b) => s + b.h, 0);
      this.platz(h);
      this.seite.drawText(this.sicher(label), { x: RAND, y: this.y - 10 * 1.32 + 3, size: 10, font: this.fett, color: FARBE.grau });
      let y = this.y;
      for (const b of boxen) {
        this.zeichne(b, RAND + labelBreite, y);
        y -= b.h;
      }
      this.y -= h + 2;
    }
  }

  /** Farblegende: farbiges Kästchen + Text. */
  legende(eintraege: { farbe: RGB; text: string }[]) {
    for (const e of eintraege) {
      this.platz(14);
      this.seite.drawRectangle({ x: RAND, y: this.y - 10.5, width: 9, height: 9, color: e.farbe });
      this.seite.drawText(this.sicher(e.text), { x: RAND + 15, y: this.y - 9.5, size: 9, font: this.normal, color: e.farbe });
      this.y -= 14;
    }
  }

  /** Beginnt eine Tabelle; der Kopf wird auf jeder neuen Seite wiederholt. */
  tabelle(spalten: Spalte[]) {
    const innen = 5;
    const kopf = () => {
      const h = 19;
      this.seite.drawRectangle({ x: RAND, y: this.y - h, width: this.breite, height: h, color: FARBE.navy });
      let x = RAND;
      for (const s of spalten) {
        this.seite.drawText(this.sicher(s.titel), { x: x + innen, y: this.y - 13, size: 8.5, font: this.fett, color: FARBE.weiss });
        x += s.breite;
      }
      this.y -= h;
    };
    this.platz(60);
    kopf();
    this.aufNeuerSeite = kopf;

    return {
      /** Eine Zeile; passt sie nicht mehr auf die Seite, wird umgebrochen. */
      zeile: (zellen: Absatz[][], opt: { hintergrund?: RGB } = {}) => {
        const boxen = spalten.map((s, i) => this.boxen(zellen[i] ?? [], s.breite - 2 * innen));
        const hoehen = boxen.map((b) => b.reduce((s, x) => s + x.h, 0));
        const gesamt = Math.max(...hoehen, 12) + 2 * innen;
        const seitenHoehe = A4.h - 2 * RAND - FUSS - 19;
        if (gesamt > this.rest() && gesamt <= seitenHoehe) this.neueSeite();
        const zeiger = boxen.map(() => 0);
        // Zeile abschnittsweise zeichnen (sehr lange Zeilen laufen über mehrere Seiten)
        for (;;) {
          const verfuegbar = this.rest() - 2 * innen;
          const teil = boxen.map((b, i) => {
            let h = 0;
            let n = zeiger[i];
            while (n < b.length && h + b[n].h <= verfuegbar) h += b[n++].h;
            return { bis: n, h };
          });
          const teilHoehe = Math.max(...teil.map((t) => t.h), 12) + 2 * innen;
          if (opt.hintergrund) {
            this.seite.drawRectangle({ x: RAND, y: this.y - teilHoehe, width: this.breite, height: teilHoehe, color: opt.hintergrund });
          }
          let x = RAND;
          boxen.forEach((b, i) => {
            let y = this.y - innen;
            for (let n = zeiger[i]; n < teil[i].bis; n++) {
              this.zeichne(b[n], x + innen, y);
              y -= b[n].h;
            }
            zeiger[i] = teil[i].bis;
            x += spalten[i].breite;
          });
          this.y -= teilHoehe;
          const fertig = boxen.every((b, i) => zeiger[i] >= b.length);
          if (fertig) break;
          if (teil.every((t, i) => t.bis === zeiger[i] && t.h === 0) && this.rest() > seitenHoehe - 1) break; // Schutz vor Endlosschleife
          this.neueSeite();
        }
        this.linie();
      },
      /** Bilder unter der letzten Zeile, eingerückt um die erste Spalte. */
      bilder: async (bilder: BildDaten[], proZeile = 2, maxHoehe = 165) => {
        if (!bilder.length) return;
        const x0 = RAND + spalten[0].breite + innen;
        const breite = this.breite - spalten[0].breite - 2 * innen;
        await this.bilder(bilder, { x: x0, breite, proZeile, maxHoehe });
        this.linie();
      },
      ende: () => {
        this.aufNeuerSeite = null;
      },
    };
  }

  private async einbetten(b: BildDaten): Promise<PDFImage | null> {
    try {
      const png = b.bytes[0] === 0x89 && b.bytes[1] === 0x50;
      return png ? await this.doc.embedPng(b.bytes) : await this.doc.embedJpg(b.bytes);
    } catch {
      return null;
    }
  }

  /** Bilder im Raster, Seitenverhältnis bleibt erhalten. */
  async bilder(bilder: BildDaten[], opt: { x?: number; breite?: number; proZeile?: number; maxHoehe?: number } = {}) {
    const x0 = opt.x ?? RAND;
    const breite = opt.breite ?? this.breite;
    const proZeile = opt.proZeile ?? 2;
    const maxHoehe = opt.maxHoehe ?? 165;
    const luecke = 8;
    const zellenBreite = (breite - luecke * (proZeile - 1)) / proZeile;
    const eingebettet = (await Promise.all(bilder.map((b) => this.einbetten(b)))).filter((b): b is PDFImage => !!b);
    for (let i = 0; i < eingebettet.length; i += proZeile) {
      const reihe = eingebettet.slice(i, i + proZeile).map((bild) => {
        const f = Math.min(zellenBreite / bild.width, maxHoehe / bild.height);
        return { bild, w: bild.width * f, h: bild.height * f };
      });
      const h = Math.max(...reihe.map((r) => r.h));
      this.platz(h + 2 * luecke);
      this.y -= luecke;
      reihe.forEach((r, n) => {
        this.seite.drawImage(r.bild, { x: x0 + n * (zellenBreite + luecke), y: this.y - r.h, width: r.w, height: r.h });
      });
      this.y -= h + luecke;
    }
  }

  /** Schließt das Dokument ab: Fußzeile mit Text links und "Seite x von y" rechts. */
  async fertig(fussText: string): Promise<Uint8Array> {
    const seiten = this.doc.getPages();
    const links = this.sicher(fussText);
    seiten.forEach((s, i) => {
      const y = RAND + 8;
      s.drawLine({ start: { x: RAND, y: y + 12 }, end: { x: RAND + this.breite, y: y + 12 }, thickness: 0.6, color: FARBE.hellgrau });
      const rechts = `Seite ${i + 1} von ${seiten.length}`;
      const w = this.normal.widthOfTextAtSize(rechts, 8);
      let l = links;
      while (l.length > 4 && this.normal.widthOfTextAtSize(l, 8) > this.breite - w - 16) l = `${l.slice(0, -2)}…`;
      s.drawText(l, { x: RAND, y, size: 8, font: this.normal, color: FARBE.grau });
      s.drawText(rechts, { x: RAND + this.breite - w, y, size: 8, font: this.normal, color: FARBE.grau });
    });
    return this.doc.save();
  }
}
