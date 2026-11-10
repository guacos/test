/** Mängelliste einer Firma als PDF. */
import { datumDe } from '../domain/datum';
import type { Mangel, Projekt } from '../domain/types';
import { FARBE, Pdf, type Absatz, type BildDaten } from './basis';

export function mangelUeberfaellig(m: Pick<Mangel, 'status' | 'frist'>, stichtag: string): boolean {
  return m.status === 'offen' && !!m.frist && m.frist < stichtag;
}

export function maengelDateiname(firma: string, datum: string): string {
  return `Maengelliste_${datum}.pdf`;
}

export async function maengelPdf(opt: {
  projekt: Pick<Projekt, 'nr' | 'name' | 'bauherr' | 'adresse'>;
  firma: string;
  maengel: Mangel[];
  /** YYYY-MM-DD */
  stand: string;
  bild: (fotoId: string) => Promise<BildDaten | null>;
  autor: string;
}): Promise<Uint8Array> {
  const pdf = await Pdf.neu(`Mängelliste ${opt.firma}`, opt.autor);
  pdf.titel('Mängelliste');
  const offen = opt.maengel.filter((m) => m.status === 'offen').length;
  pdf.angaben([
    ['Projekt', [opt.projekt.nr, opt.projekt.name].filter(Boolean).join(' · ')],
    ['Bauherr', opt.projekt.bauherr],
    ['Adresse', opt.projekt.adresse],
    ['Firma', opt.firma],
    ['Stand', datumDe(opt.stand)],
    ['Anzahl', `${opt.maengel.length} Mängel, davon ${offen} offen`],
  ]);
  pdf.abstand(8);
  pdf.legende([{ farbe: FARBE.rot, text: 'Rot: Frist überschritten und noch offen' }]);
  pdf.abstand(8);

  const t = pdf.tabelle([
    { titel: 'Nr.', breite: 34 },
    { titel: 'Mangel', breite: pdf.breite - 34 - 96 - 62 - 62 },
    { titel: 'Ort', breite: 96 },
    { titel: 'Frist', breite: 62 },
    { titel: 'Status', breite: 62 },
  ]);
  const sortiert = [...opt.maengel].sort(
    (a, b) => Number(!mangelUeberfaellig(a, opt.stand)) - Number(!mangelUeberfaellig(b, opt.stand)) || a.nr - b.nr,
  );
  for (const m of sortiert) {
    const rot = mangelUeberfaellig(m, opt.stand);
    const f = rot ? FARBE.rot : FARBE.schwarz;
    const inhalt: Absatz[] = [{ text: m.titel || '(ohne Titel)', fett: true, farbe: f, groesse: 10.5 }];
    if (m.beschreibung) inhalt.push({ text: m.beschreibung, farbe: f, oben: 2 });
    t.zeile([
      [{ text: String(m.nr), fett: true, farbe: f }],
      inhalt,
      [{ text: m.ort || '–', farbe: f }],
      [{ text: m.frist ? datumDe(m.frist) : '–', farbe: f, fett: rot }],
      [
        { text: m.status === 'erledigt' ? 'Erledigt' : 'Offen', fett: true, farbe: m.status === 'erledigt' ? FARBE.gruen : f },
        ...(m.status === 'erledigt' && m.erledigtAm ? [{ text: datumDe(m.erledigtAm), groesse: 8, farbe: FARBE.grau }] : []),
      ],
    ]);
    const bilder: BildDaten[] = [];
    for (const id of m.fotoIds) {
      const b = await opt.bild(id);
      if (b) bilder.push(b);
    }
    await t.bilder(bilder);
  }
  t.ende();
  return pdf.fertig(`${[opt.projekt.nr, opt.projekt.name].filter(Boolean).join(' ')} · Mängelliste ${opt.firma} · Stand ${datumDe(opt.stand)}`);
}
