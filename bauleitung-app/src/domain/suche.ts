/** Volltextsuche über alle Bereiche (nur lokal auf dem Gerät) und Hilfen zur Anzeige von Datensätzen. */
import { datumDe } from './datum';
import { textPasst } from './fotoFilter';
import { kwTextAusSchluessel } from './kw';
import { wetterText } from './wetter';
import type {
  BaseRecord,
  Bautag,
  BoardEintrag,
  Firma,
  Foto,
  Lieferschein,
  Mangel,
  Plan,
  Projekt,
  Protokoll,
  ProtokollPunkt,
  RecordTyp,
} from './types';

export const TYP_NAME: Record<RecordTyp, string> = {
  projekt: 'Projekt',
  woche: 'Woche',
  board: 'Board-Eintrag',
  foto: 'Foto',
  protokoll: 'Protokoll',
  protokollpunkt: 'Jour-Fixe-Punkt',
  einstellungen: 'Einstellungen',
  firma: 'Firma',
  bautag: 'Bautagebuch',
  mangel: 'Mangel',
  plan: 'Grundriss',
  lieferschein: 'Lieferschein',
};

/** Kurze, lesbare Bezeichnung eines Datensatzes. */
export function bezeichnung(r: BaseRecord): string {
  switch (r.typ) {
    case 'projekt':
      return `${(r as Projekt).nr} ${(r as Projekt).name}`.trim();
    case 'board':
      return (r as BoardEintrag).titel;
    case 'protokoll':
      return `Protokoll Nr. ${(r as Protokoll).nr}`;
    case 'protokollpunkt':
      return (r as ProtokollPunkt).thema;
    case 'foto': {
      const f = r as Foto;
      return [f.gewerk, f.art, f.geschoss, kwTextAusSchluessel(f.kw)].filter(Boolean).join(' · ') || 'Foto';
    }
    case 'firma':
      return (r as Firma).name;
    case 'bautag':
      return `Bautagebuch ${datumDe((r as Bautag).datum)}`;
    case 'mangel':
      return `Mangel ${(r as Mangel).nr}: ${(r as Mangel).titel}`;
    case 'plan':
      return (r as Plan).name;
    case 'lieferschein':
      return `Lieferschein ${(r as Lieferschein).lieferant || (r as Lieferschein).nummer || ''}`.trim();
    case 'woche':
      return kwTextAusSchluessel((r as unknown as { kw: string }).kw);
    default:
      return TYP_NAME[r.typ];
  }
}

/** Text, in dem gesucht wird. */
export function suchtext(r: BaseRecord): string {
  switch (r.typ) {
    case 'board': {
      const e = r as BoardEintrag;
      return [e.titel, e.text, e.notiz, e.rubrik, e.wochentag, kwTextAusSchluessel(e.kw), ...e.checkpunkte.map((c) => c.text)].filter(Boolean).join(' ');
    }
    case 'protokollpunkt': {
      const p = r as ProtokollPunkt;
      return [p.thema, p.beschreibung, p.verantwortlich, ...p.ergaenzungen.map((e) => e.text)].join(' ');
    }
    case 'foto': {
      const f = r as Foto;
      return [f.gewerk, f.art, f.geschoss, kwTextAusSchluessel(f.kw), ...f.tags, f.notiz, f.originalName].filter(Boolean).join(' ');
    }
    case 'firma': {
      const f = r as Firma;
      return [f.name, f.gewerk, f.ansprechpartner, f.telefon, f.email, f.notiz].join(' ');
    }
    case 'bautag': {
      const b = r as Bautag;
      return [datumDe(b.datum), b.notiz, wetterText(b.wetter), ...b.firmen.map((f) => f.name)].join(' ');
    }
    case 'mangel': {
      const m = r as Mangel;
      return [m.titel, m.beschreibung, m.firmaName, m.ort, `Mangel ${m.nr}`].join(' ');
    }
    case 'lieferschein': {
      const l = r as Lieferschein;
      return [l.lieferant, l.nummer, l.material, l.menge, l.firmaName, l.lagerort, l.schaeden, datumDe(l.datum)].join(' ');
    }
    default:
      return bezeichnung(r);
  }
}

export const SUCH_TYPEN: RecordTyp[] = ['board', 'protokollpunkt', 'foto', 'mangel', 'bautag', 'lieferschein', 'firma'];

export interface Treffer {
  typ: RecordTyp;
  rec: BaseRecord;
}

/** Alle Suchwörter müssen vorkommen. Leere Suche liefert nichts. */
export function suche(datensaetze: BaseRecord[], frage: string): Treffer[] {
  if (!frage.trim()) return [];
  return datensaetze
    .filter((r) => !r.geloescht && SUCH_TYPEN.includes(r.typ) && textPasst(suchtext(r), frage))
    .filter((r) => r.typ !== 'foto' || !(r as Foto).ablage || (r as Foto).ablage === 'fotos')
    .map((rec) => ({ typ: rec.typ, rec }))
    .sort((a, b) => SUCH_TYPEN.indexOf(a.typ) - SUCH_TYPEN.indexOf(b.typ) || b.rec.geaendertAm.localeCompare(a.rec.geaendertAm));
}

const VERWALTUNG = new Set(['id', 'typ', 'projektId', 'erstelltVon', 'erstelltAm', 'geaendertVon', 'geaendertAm', 'version']);

const FELD_NAME: Record<string, string> = {
  titel: 'Titel',
  text: 'Text',
  notiz: 'Notiz',
  kw: 'Kalenderwoche',
  wochentag: 'Wochentag',
  bereich: 'Bereich',
  rubrik: 'Rubrik',
  checkpunkte: 'Checkpunkte',
  pruefkette: 'Prüfkette',
  fotoIds: 'Fotos',
  thema: 'Thema',
  beschreibung: 'Beschreibung',
  verantwortlich: 'Verantwortlich',
  frist: 'Frist',
  status: 'Status',
  ergaenzungen: 'Ergänzungen',
  gewerk: 'Gewerk',
  art: 'Art',
  geschoss: 'Geschoss',
  tags: 'Tags',
  geloescht: 'Gelöscht',
  name: 'Name',
  nr: 'Nr.',
  bauherr: 'Bauherr',
  adresse: 'Adresse',
  kiErlaubt: 'KI erlaubt',
  teilnehmer: 'Teilnehmer',
  datum: 'Datum',
  firmen: 'Firmen',
  wetter: 'Wetter',
  geliefert: 'Geliefert',
  oneDrivePfad: 'OneDrive-Pfad',
};

function kurz(v: unknown): string {
  if (v === null || v === undefined || v === '') return '–';
  if (typeof v === 'boolean') return v ? 'ja' : 'nein';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return v.join(', ') || '–';
    const texte = v.map((x) => {
      const o = x as { text?: string; erledigt?: boolean; name?: string; anzahl?: number };
      if (o && typeof o.text === 'string') return `${o.erledigt ? '☑' : '☐'} ${o.text}`;
      if (o && typeof o.name === 'string') return `${o.name}${typeof o.anzahl === 'number' ? ` (${o.anzahl})` : ''}`;
      return JSON.stringify(x);
    });
    return texte.join(' · ') || '–';
  }
  const o = v as Record<string, unknown>;
  return Object.entries(o)
    .map(([k, w]) => `${FELD_NAME[k] ?? k}: ${kurz(w)}`)
    .join(', ');
}

export interface Unterschied {
  feld: string;
  meine: string;
  andere: string;
}

/** Felder, in denen sich zwei Stände eines Datensatzes unterscheiden (für die Konflikt-Anzeige). */
export function unterschiede(meine: BaseRecord, andere: BaseRecord): Unterschied[] {
  const a = meine as unknown as Record<string, unknown>;
  const b = andere as unknown as Record<string, unknown>;
  const r: Unterschied[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (VERWALTUNG.has(k)) continue;
    if (JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null)) continue;
    r.push({ feld: FELD_NAME[k] ?? k, meine: kurz(a[k]), andere: kurz(b[k]) });
  }
  return r;
}
