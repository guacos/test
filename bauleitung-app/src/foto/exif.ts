import type { ImagePickerAsset } from 'expo-image-picker';

/** Android: EXIF-Aufnahmedatum kommt direkt vom Bildauswahl-Dialog. */
export async function exifDatum(asset: ImagePickerAsset): Promise<unknown> {
  const e = asset.exif ?? {};
  return e.DateTimeOriginal ?? e.DateTimeDigitized ?? e.DateTime ?? null;
}
