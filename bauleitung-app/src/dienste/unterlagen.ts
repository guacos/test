/** Unterlagen (Pläne, LV, Verträge): hinzufügen, offline bereithalten, Fragen an die KI mit Quellenpflicht. */
import * as DocumentPicker from 'expo-document-picker';
import type { Projekt, Unterlage } from '../domain/types';
import { MAX_FRAGE_BYTES, groesseText, mimeVon } from '../domain/unterlagen';
import type { Repo } from '../data/repo';
import { bildBytes, existiertDatei, speichereBild } from '../foto/dateien';
import { ki as kiStandard, type Ki, type KiEinstellungen, type KiFrageAntwort } from '../ki/client';
import { neueId } from '../lib/id';
import { zuBase64 } from '../ms/outlook';
import { unterlageNachladen } from '../sync/dienst';

/** Dateien auswählen (PDF oder Bild) und als Unterlagen anlegen. */
export async function unterlagenHinzufuegen(repo: Repo, projekt: Pick<Projekt, 'id'>): Promise<Unterlage[]> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
  if (r.canceled) return [];
  const neu: Unterlage[] = [];
  for (const a of r.assets) {
    const datei = `unterlage-${neueId()}`;
    await speichereBild(a.uri, datei);
    neu.push(
      await repo.neu<Unterlage>('unterlage', projekt.id, {
        name: a.name,
        datei,
        mime: a.mimeType || mimeVon(a.name),
        groesse: a.size ?? null,
        art: /\.pdf$/i.test(a.name) ? 'Sonstiges' : 'Plan',
        planNr: '',
        index: '',
        notiz: '',
        oneDrivePfad: null,
      }),
    );
  }
  return neu;
}

/** Sorgt dafür, dass die Datei auf diesem Gerät liegt (lädt sie bei Bedarf aus OneDrive). */
export async function sichereLokal(u: Unterlage): Promise<boolean> {
  return (await existiertDatei(u.datei)) || (await unterlageNachladen(u));
}

export class FrageFehler extends Error {}

/**
 * Stellt eine Frage an die gewählten Unterlagen. Die Antwort enthält immer Quellen
 * (Dokument, Seite) – sonst lautet sie "Weiß ich nicht – nicht in den Unterlagen gefunden."
 */
export async function frageUnterlagen(opt: {
  frage: string;
  unterlagen: Unterlage[];
  kiEinst: KiEinstellungen | null;
  bytes?: (u: Unterlage) => Promise<Uint8Array | null>;
  ki?: Ki;
}): Promise<KiFrageAntwort> {
  const pdfs = opt.unterlagen.filter((u) => u.mime === 'application/pdf');
  if (!pdfs.length) throw new FrageFehler('Bitte mindestens eine PDF-Unterlage auswählen.');
  const hole = opt.bytes ?? (async (u: Unterlage) => ((await sichereLokal(u)) ? bildBytes(u.datei) : null));
  const dokumente: { name: string; pdf: string }[] = [];
  let summe = 0;
  for (const u of pdfs) {
    const b = await hole(u);
    if (!b || !b.length) throw new FrageFehler(`„${u.name}“ liegt nicht auf diesem Gerät und konnte nicht geladen werden.`);
    summe += b.length;
    if (summe > MAX_FRAGE_BYTES) {
      throw new FrageFehler(`Die gewählten Unterlagen sind zusammen zu groß (über ${groesseText(MAX_FRAGE_BYTES)}). Bitte weniger Dokumente auswählen.`);
    }
    dokumente.push({ name: u.name, pdf: zuBase64(b) });
  }
  return (opt.ki ?? kiStandard).frage(opt.kiEinst, opt.frage.trim(), dokumente);
}
