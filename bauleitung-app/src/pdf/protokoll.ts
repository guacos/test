/** Jour-Fixe-Protokoll als PDF – auch für Dritte leicht verständlich. */
import type { RGB } from 'pdf-lib';
import { datumDe } from '../domain/datum';
import { ergaenzungFarbe, istNeu, istUeberfaellig, punktFarbe, punktNr, sortierePunkte } from '../domain/farblogik';
import type { Projekt, Protokoll, ProtokollPunkt } from '../domain/types';
import { FARBE, Pdf, type Absatz, type BildDaten } from './basis';

const FARBEN: Record<'rot' | 'blau' | 'schwarz', RGB> = { rot: FARBE.rot, blau: FARBE.blau, schwarz: FARBE.schwarz };

export async function protokollPdf(opt: {
  projekt: Pick<Projekt, 'nr' | 'name' | 'bauherr' | 'adresse'>;
  protokoll: Protokoll;
  punkte: ProtokollPunkt[];
  /** Liefert das Bild zu einer Foto-ID (oder null, wenn es nicht auf dem Gerät liegt) */
  bild: (fotoId: string) => Promise<BildDaten | null>;
  autor: string;
}): Promise<Uint8Array> {
  const { projekt, protokoll } = opt;
  // Im PDF gilt immer das Protokolldatum als Stichtag – ein altes PDF ändert sich nicht nachträglich.
  const stichtag = protokoll.datum;
  const pdf = await Pdf.neu(`Jour-Fixe-Protokoll Nr. ${protokoll.nr}`, opt.autor);

  pdf.titel(`Jour-Fixe-Protokoll Nr. ${protokoll.nr}`, protokoll.status === 'entwurf' ? 'ENTWURF' : undefined);
  pdf.angaben([
    ['Projekt', [projekt.nr, projekt.name].filter(Boolean).join(' · ')],
    ['Bauherr', projekt.bauherr],
    ['Adresse', projekt.adresse],
    ['Datum', datumDe(protokoll.datum)],
    ['Teilnehmer', protokoll.teilnehmer],
  ]);
  pdf.abstand(8);
  pdf.linie();
  pdf.abstand(8);

  pdf.text({ text: 'Legende', fett: true, groesse: 9, farbe: FARBE.grau });
  pdf.abstand(2);
  pdf.legende([
    { farbe: FARBE.blau, text: 'Dunkelblau: neu in diesem Protokoll (auch neue Ergänzungen)' },
    { farbe: FARBE.schwarz, text: 'Schwarz: aus einem Vorprotokoll übernommen, mit Hinweis „offen seit Nr. …“' },
    { farbe: FARBE.rot, text: 'Rot: Frist überschritten und noch offen (steht oben)' },
  ]);
  pdf.abstand(10);

  const punkte = sortierePunkte(
    opt.punkte.filter((p) => !p.geloescht),
    stichtag,
  );
  if (!punkte.length) {
    pdf.text({ text: 'Keine Punkte erfasst.', farbe: FARBE.grau });
    return pdf.fertig(fuss(projekt, protokoll));
  }

  const t = pdf.tabelle([
    { titel: 'Nr.', breite: 38 },
    { titel: 'Thema / Beschreibung', breite: pdf.breite - 38 - 92 - 62 - 52 },
    { titel: 'Verantwortlich', breite: 92 },
    { titel: 'Frist', breite: 62 },
    { titel: 'Status', breite: 52 },
  ]);

  for (const p of punkte) {
    const farbe = punktFarbe(p, protokoll.nr, stichtag);
    const f = FARBEN[farbe];
    const ueberfaellig = istUeberfaellig(p, stichtag);
    const inhalt: Absatz[] = [{ text: p.thema || '(ohne Thema)', fett: true, farbe: f, groesse: 10.5 }];
    const hinweise: string[] = [];
    if (ueberfaellig) hinweise.push('Überfällig');
    if (!istNeu(p, protokoll.nr)) hinweise.push(`Offen seit Nr. ${p.ursprungNr}`);
    else hinweise.push('Neu');
    inhalt.push({ text: hinweise.join(' · '), groesse: 8, farbe: f, oben: 1 });
    if (p.beschreibung) inhalt.push({ text: p.beschreibung, farbe: f, oben: 3 });
    for (const e of p.ergaenzungen) {
      const ef = farbe === 'rot' ? FARBE.rot : FARBEN[ergaenzungFarbe(e, protokoll.nr)];
      inhalt.push({ text: `Ergänzung vom ${datumDe(e.datum)}: ${e.text}`, farbe: ef, oben: 4 });
    }
    t.zeile([
      [{ text: punktNr(p), fett: true, farbe: f }],
      inhalt,
      [{ text: p.verantwortlich || '–', farbe: f }],
      [{ text: p.frist ? datumDe(p.frist) : '–', farbe: f, fett: ueberfaellig }],
      [{ text: p.status === 'erledigt' ? 'Erledigt' : 'Offen', farbe: p.status === 'erledigt' ? FARBE.gruen : f, fett: true }],
    ]);
    const bilder: BildDaten[] = [];
    for (const id of [...p.fotoIds, ...p.planausschnittIds]) {
      const b = await opt.bild(id);
      if (b) bilder.push(b);
    }
    await t.bilder(bilder);
  }
  t.ende();
  return pdf.fertig(fuss(projekt, protokoll));
}

function fuss(projekt: Pick<Projekt, 'nr' | 'name'>, protokoll: Protokoll): string {
  return `${[projekt.nr, projekt.name].filter(Boolean).join(' ')} · Jour-Fixe-Protokoll Nr. ${protokoll.nr} vom ${datumDe(protokoll.datum)}`;
}
