/** Bautagebuch (ein Tag oder mehrere Tage) als PDF. */
import { datumDe, datumLang } from '../domain/datum';
import type { Bautag, Projekt } from '../domain/types';
import { wetterText } from '../domain/wetter';
import { FARBE, Pdf, type BildDaten } from './basis';

export function bautagebuchDateiname(von: string, bis: string): string {
  return von === bis ? `Bautagebuch_${von}.pdf` : `Bautagebuch_${von}_bis_${bis}.pdf`;
}

export async function bautagebuchPdf(opt: {
  projekt: Pick<Projekt, 'nr' | 'name' | 'bauherr' | 'adresse'>;
  tage: Bautag[];
  bild: (fotoId: string) => Promise<BildDaten | null>;
  autor: string;
}): Promise<Uint8Array> {
  const tage = [...opt.tage].sort((a, b) => a.datum.localeCompare(b.datum));
  const von = tage[0]?.datum ?? '';
  const bis = tage[tage.length - 1]?.datum ?? '';
  const pdf = await Pdf.neu('Bautagebuch', opt.autor);
  pdf.titel('Bautagebuch');
  pdf.angaben([
    ['Projekt', [opt.projekt.nr, opt.projekt.name].filter(Boolean).join(' · ')],
    ['Bauherr', opt.projekt.bauherr],
    ['Adresse', opt.projekt.adresse],
    ['Zeitraum', von === bis ? datumDe(von) : `${datumDe(von)} bis ${datumDe(bis)}`],
  ]);

  for (const tag of tage) {
    pdf.abstand(6);
    pdf.linie(FARBE.navy, 1);
    pdf.zwischentitel(datumLang(tag.datum));
    const summe = tag.firmen.reduce((s, f) => s + f.anzahl, 0);
    pdf.angaben([
      ['Wetter', wetterText(tag.wetter) + (tag.wetter?.quelle === 'dwd' ? ' (Quelle: Deutscher Wetterdienst)' : '')],
      ['Arbeitskräfte', `${summe} gesamt`],
    ]);
    if (tag.firmen.length) {
      pdf.abstand(4);
      const t = pdf.tabelle([
        { titel: 'Firma', breite: pdf.breite - 90 },
        { titel: 'Anzahl Arbeiter', breite: 90 },
      ]);
      for (const f of tag.firmen) t.zeile([[{ text: f.name }], [{ text: String(f.anzahl), fett: true }]]);
      t.ende();
      pdf.abstand(6);
    }
    if (tag.notiz) {
      pdf.text({ text: 'Notizen', fett: true, groesse: 9, farbe: FARBE.grau, oben: 4 });
      pdf.text({ text: tag.notiz, groesse: 10 });
    }
    const bilder: BildDaten[] = [];
    for (const id of tag.fotoIds) {
      const b = await opt.bild(id);
      if (b) bilder.push(b);
    }
    await pdf.bilder(bilder, { proZeile: 3, maxHoehe: 130 });
  }
  if (!tage.length) pdf.text({ text: 'Keine Einträge im Zeitraum.', farbe: FARBE.grau });
  return pdf.fertig(`${[opt.projekt.nr, opt.projekt.name].filter(Boolean).join(' ')} · Bautagebuch ${von === bis ? datumDe(von) : `${datumDe(von)}–${datumDe(bis)}`}`);
}
