/** PDFs erzeugen, anzeigen und für OneDrive vormerken. */
import { heuteIso } from '../domain/datum';
import { protokollDateiname } from '../domain/farblogik';
import { nameTeil } from '../domain/fotoName';
import type { Bautag, Foto, Mangel, Projekt, Protokoll } from '../domain/types';
import { pdfBild } from '../foto/aufnahme';
import { existiertDatei } from '../foto/dateien';
import type { BildDaten } from '../pdf/basis';
import { bautagebuchDateiname, bautagebuchPdf } from '../pdf/bautagebuch';
import { maengelPdf } from '../pdf/maengel';
import { protokollPdf } from '../pdf/protokoll';
import { holeRepo, useApp } from '../state/useApp';
import { dateiAblegen, fotoNachladen } from '../sync/dienst';
import { zeigeDatei } from './ausgabe';
import { punkteVon } from './jourfixe';

/** Bild für ein PDF holen (lädt es bei Bedarf aus OneDrive nach). */
export async function bildFuerPdf(fotoId: string): Promise<BildDaten | null> {
  const f = await holeRepo().holeAktiv<Foto>(fotoId);
  if (!f) return null;
  if (!(await existiertDatei(f.datei)) && !(await fotoNachladen(f))) return null;
  const bytes = await pdfBild(f.datei);
  return bytes ? { bytes } : null;
}

export interface PdfDatei {
  name: string;
  /** Pfad relativ zum Projektordner in OneDrive */
  pfad: string;
  bytes: Uint8Array;
}

export async function erzeugeProtokollPdf(projekt: Projekt, protokoll: Protokoll): Promise<PdfDatei> {
  const punkte = await punkteVon(holeRepo(), protokoll);
  const bytes = await protokollPdf({ projekt, protokoll, punkte, bild: bildFuerPdf, autor: useApp.getState().autor });
  const name = protokollDateiname(protokoll);
  return { name, pfad: `03_Protokolle/${name}`, bytes };
}

export async function erzeugeMaengelPdf(projekt: Projekt, firma: string, maengel: Mangel[]): Promise<PdfDatei> {
  const stand = heuteIso();
  const bytes = await maengelPdf({ projekt, firma, maengel, stand, bild: bildFuerPdf, autor: useApp.getState().autor });
  const name = `Maengelliste_${stand}.pdf`;
  return { name, pfad: `05_Maengel/${nameTeil(firma) || 'ohne-Firma'}/${name}`, bytes };
}

export async function erzeugeBautagebuchPdf(projekt: Projekt, tage: Bautag[]): Promise<PdfDatei> {
  const sortiert = [...tage].sort((a, b) => a.datum.localeCompare(b.datum));
  const bytes = await bautagebuchPdf({ projekt, tage: sortiert, bild: bildFuerPdf, autor: useApp.getState().autor });
  const name = bautagebuchDateiname(sortiert[0]?.datum ?? heuteIso(), sortiert[sortiert.length - 1]?.datum ?? heuteIso());
  return { name, pfad: `06_Bautagebuch/${name}`, bytes };
}

/** PDF anzeigen/teilen und zum Hochladen nach OneDrive vormerken. */
export async function gibPdfAus(projektId: string, pdf: PdfDatei): Promise<void> {
  await dateiAblegen(projektId, pdf.pfad, pdf.bytes);
  await zeigeDatei(pdf.name, pdf.bytes);
}
