import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { fotoZeit, type FotoZeit } from '../domain/fotoKw';
import { neueId } from '../lib/id';
import { bildUri, speichereBild } from './dateien';
import { exifDatum } from './exif';

/** Im Browser gibt es keine Kamera-Aufnahme – dort werden Bilddateien gewählt. */
export const kameraVerfuegbar = Platform.OS !== 'web';

/** Längste Bildkante nach dem Verkleinern (Pixel) und JPEG-Qualität. */
export const MAX_KANTE = 2048;
export const QUALITAET = 0.8;

export interface NeuesBild extends FotoZeit {
  datei: string;
  breite: number;
  hoehe: number;
  originalName: string | null;
  /** Anzeige-URI direkt nach der Aufnahme */
  vorschau: string;
}

async function verarbeite(asset: ImagePicker.ImagePickerAsset, ausKamera: boolean): Promise<NeuesBild> {
  // Datum zuerst lesen – das Verkleinern entfernt EXIF.
  const zeit = fotoZeit({
    exifDatum: await exifDatum(asset),
    dateiname: asset.fileName ?? asset.file?.name ?? null,
    kameraJetzt: ausKamera ? new Date() : undefined,
  });
  const gross = Math.max(asset.width, asset.height) > MAX_KANTE;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (gross) ctx.resize(asset.width >= asset.height ? { width: MAX_KANTE } : { height: MAX_KANTE });
  const bild = await ctx.renderAsync();
  const ergebnis = await bild.saveAsync({ compress: QUALITAET, format: SaveFormat.JPEG });
  const datei = `${neueId()}.jpg`;
  await speichereBild(ergebnis.uri, datei);
  return {
    ...zeit,
    datei,
    breite: ergebnis.width,
    hoehe: ergebnis.height,
    originalName: asset.fileName ?? asset.file?.name ?? null,
    vorschau: ergebnis.uri,
  };
}

/** Foto mit der Kamera aufnehmen. null = abgebrochen. */
export async function fotoAufnehmen(): Promise<NeuesBild | null> {
  const recht = await ImagePicker.requestCameraPermissionsAsync();
  if (!recht.granted) throw new Error('Kein Zugriff auf die Kamera. Bitte in den Einstellungen erlauben.');
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], exif: true, quality: 1 });
  if (r.canceled || !r.assets?.[0]) return null;
  return verarbeite(r.assets[0], true);
}

/** Fotos aus der Galerie wählen (mehrere). */
export async function fotosAusGalerie(mehrere = true): Promise<NeuesBild[]> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: mehrere,
    exif: true,
    quality: 1,
  });
  if (r.canceled) return [];
  const bilder: NeuesBild[] = [];
  for (const a of r.assets) bilder.push(await verarbeite(a, false));
  return bilder;
}

/** Verkleinertes Bild (max. 1024 px, ohne EXIF) als Base64 – nur das Nötigste für die KI. */
export async function kiBild(datei: string): Promise<string> {
  const uri = await bildUri(datei);
  if (!uri) throw new Error('Bild nicht vorhanden');
  const bild = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
  const r = await bild.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!r.base64) throw new Error('Bild konnte nicht gelesen werden');
  return r.base64;
}

function ausBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Bild für PDFs: auf 1100 px verkleinert, damit die Datei klein bleibt (E-Mail-Versand). */
export async function pdfBild(datei: string): Promise<Uint8Array | null> {
  const uri = await bildUri(datei);
  if (!uri) return null;
  try {
    const bild = await ImageManipulator.manipulate(uri).resize({ width: 1100 }).renderAsync();
    const r = await bild.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    return r.base64 ? ausBase64(r.base64) : null;
  } catch {
    return null;
  }
}

/** Ein Bild aus der Galerie oder aus Dateien wählen (z. B. Grundriss, Planausschnitt). */
export async function bildWaehlen(): Promise<NeuesBild | null> {
  const liste = await fotosAusGalerie(false);
  return liste[0] ?? null;
}
