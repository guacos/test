/** Outlook über Microsoft Graph: E-Mail mit Anhang senden, Termin in den Kalender eintragen. */
import type { Graph } from './graph';

/** Größte Anhanggröße für den direkten Versand (Grenze von Microsoft für eine einzelne Anfrage). */
export const MAX_ANHANG_BYTES = 3_000_000;

export function zuBase64(bytes: Uint8Array): string {
  let s = '';
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) s += String.fromCharCode(...bytes.subarray(i, i + block));
  return btoa(s);
}

/** "a@b.de, c@d.de; e@f.de" → Liste gültiger Adressen + Liste ungültiger Angaben */
export function parseEmpfaenger(eingabe: string): { gueltig: string[]; ungueltig: string[] } {
  const teile = eingabe
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const gueltig: string[] = [];
  const ungueltig: string[] = [];
  for (const t of teile) {
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) {
      if (!gueltig.includes(t.toLowerCase())) gueltig.push(t.toLowerCase());
    } else ungueltig.push(t);
  }
  return { gueltig, ungueltig };
}

export interface MailDaten {
  an: string[];
  betreff: string;
  text: string;
  anhang?: { name: string; bytes: Uint8Array; typ: string };
}

export async function sendeMail(graph: Graph, mail: MailDaten): Promise<void> {
  if (mail.anhang && mail.anhang.bytes.length > MAX_ANHANG_BYTES) {
    throw new Error('Der Anhang ist zu groß für den direkten Versand. Bitte über „Teilen“ bzw. den Download senden.');
  }
  await graph.json('POST', '/me/sendMail', {
    body: {
      message: {
        subject: mail.betreff,
        body: { contentType: 'Text', content: mail.text },
        toRecipients: mail.an.map((address) => ({ emailAddress: { address } })),
        attachments: mail.anhang
          ? [
              {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: mail.anhang.name,
                contentType: mail.anhang.typ,
                contentBytes: zuBase64(mail.anhang.bytes),
              },
            ]
          : [],
      },
      saveToSentItems: true,
    },
  });
}

export interface TerminDaten {
  betreff: string;
  /** YYYY-MM-DD */
  datum: string;
  /** HH:MM */
  beginn: string;
  dauerMinuten: number;
  ort: string;
  text: string;
  teilnehmer: string[];
}

/** Lokale Zeit "2026-11-13T09:00:00" + Minuten, ohne Zeitzonen-Umrechnung. */
export function terminZeiten(datum: string, beginn: string, dauerMinuten: number): { start: string; ende: string } {
  const [h, m] = beginn.split(':').map(Number);
  const [j, mo, t] = datum.split('-').map(Number);
  const s = new Date(j, mo - 1, t, h, m);
  const e = new Date(s.getTime() + dauerMinuten * 60_000);
  const f = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  return { start: f(s), ende: f(e) };
}

export async function erstelleTermin(graph: Graph, termin: TerminDaten, zeitzone = 'Europe/Berlin'): Promise<void> {
  const { start, ende } = terminZeiten(termin.datum, termin.beginn, termin.dauerMinuten);
  await graph.json('POST', '/me/events', {
    body: {
      subject: termin.betreff,
      body: { contentType: 'Text', content: termin.text },
      start: { dateTime: start, timeZone: zeitzone },
      end: { dateTime: ende, timeZone: zeitzone },
      location: { displayName: termin.ort },
      attendees: termin.teilnehmer.map((address) => ({ emailAddress: { address }, type: 'required' })),
    },
  });
}
