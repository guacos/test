import type { ImagePickerAsset } from 'expo-image-picker';

/** Browser: EXIF aus der Originaldatei lesen (vor dem Verkleinern, das EXIF entfernt). */
export async function exifDatum(asset: ImagePickerAsset): Promise<unknown> {
  if (!asset.file) return null;
  try {
    const exifr = await import('exifr');
    const daten = await exifr.parse(asset.file, ['DateTimeOriginal', 'CreateDate']);
    return daten?.DateTimeOriginal ?? daten?.CreateDate ?? null;
  } catch {
    return null;
  }
}
