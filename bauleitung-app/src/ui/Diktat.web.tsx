/**
 * Im Browser gibt es bewusst kein Diktat: Die Spracherkennung der Browser
 * schickt Audio an Google bzw. Apple. Am Mac wird getippt.
 */
export function DiktatKnopf(_: { onText: (text: string) => void }) {
  return null;
}

export const diktatVerfuegbar = false;
