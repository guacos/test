/** Teil 1: Projekt, Schnellerfassung, Board, Fotos (ohne KI). */
const { chromium } = require('playwright');
const path = require('path');
const h = require('./hilfe');
const BILDER = process.argv[2];
const AUS = process.argv[3];

(async () => {
  const browser = await chromium.launch();
  const { page, fehler } = await h.neuerKontext(browser);

  await h.schritt('Projekt anlegen (Pflichtfelder, KI standardmäßig aus)', async () => {
    await page.goto(h.APP);
    await page.getByTestId('erstes-projekt').click();
    await page.getByTestId('projekt-speichern').click();
    await page.getByText('Bitte Projekt-Nr. eingeben.').waitFor();
    await page.getByTestId('feld-nr').fill('2026-014');
    await page.getByTestId('feld-name').fill('Neubau Halle Nord');
    await page.getByTestId('feld-bauherr').fill('Muster Logistik GmbH');
    await page.getByTestId('feld-adresse').fill('Industriestraße 12, 48155 Münster');
    h.erwarte((await page.getByRole('switch', { name: 'KI erlaubt' }).innerText()).includes('AUS'), 'KI aus');
    await page.getByTestId('schalter-wetter').click();
    await page.getByTestId('feld-lat').fill('51.96');
    await page.getByTestId('feld-lon').fill('7.63');
    await page.getByTestId('projekt-speichern').click();
    await page.getByText('KW ', { exact: false }).first().waitFor();
    h.erwarte((await page.getByTestId('projekt-umschalter').innerText()).includes('Neubau Halle Nord'), 'Projekt in der Kopfzeile');
  });

  await h.schritt('Schnellerfassung: "kw40 Estrich 1.OG" landet in KW 40', async () => {
    const r = await h.erfasse(page, 'kw40 Estrich 1.OG');
    h.erwarte(r.includes('Estrich 1.OG') && r.includes('KW 40 · Bauleitung / Nachunternehmer'), `Ergebnis: ${r}`);
    h.erwarte(!/kw40/i.test(r), '"kw40" wurde aus dem Text entfernt');
    await h.reiter(page, 'Board');
    await page.getByTestId('kw-2026-W40').waitFor();
    h.erwarte((await page.getByTestId('board-zeitraum').innerText()).startsWith('KW 40'), 'Board zeigt KW 40');
    h.erwarte(await page.getByTestId('rubrik-Nachunternehmer').getByText('Estrich 1.OG').isVisible(), 'Eintrag unter Nachunternehmer');
  });

  await h.schritt('Schnellerfassung: Wochentag erkannt, "Montage" ist kein Montag', async () => {
    const r1 = await h.erfasse(page, 'Donnerstag Lieferung Trockenbau');
    h.erwarte(r1.includes('Bauleitung / Lieferungen · Donnerstag'), r1);
    const r2 = await h.erfasse(page, 'Montage Trockenbau 2.OG');
    h.erwarte(!r2.includes('Montag ·') && !/· Montag$/.test(r2), r2);
  });

  await h.schritt('Schnellerfassung: Rückgängig entfernt den Eintrag', async () => {
    await h.erfasse(page, 'Bauzaun falsch erfasst', false);
    await h.v(page, 'rueckgaengig').click();
    await page.getByText('Erfassung rückgängig gemacht.').waitFor();
    await page.goto(`${h.APP}/board`);
    await page.getByTestId('rubrik-Baustelleneinrichtung').waitFor();
    h.erwarte((await page.getByText('Bauzaun falsch erfasst').count()) === 0, 'Eintrag ist weg');
  });

  await h.schritt('Schnellerfassung: Fehlermeldungen (kw ohne Inhalt, KW 54)', async () => {
    await h.v(page, 'plus-knopf').click();
    await h.v(page, 'erfassen-text').fill('kw40');
    await h.v(page, 'erfassen-absenden').click();
    await page.getByText('Bitte zusätzlich einen Inhalt angeben.').waitFor();
    await h.v(page, 'erfassen-text').fill('kw54 Estrich');
    await page.getByText('KW 54 gibt es nicht.').first().waitFor();
  });

  await h.schritt('Board: Eintrag bearbeiten (Checkpunkte abhaken/hinzufügen/löschen, Prüfkette, Notiz, Wochentag)', async () => {
    await page.goto(`${h.APP}/board`);
    await page.getByTestId('kw-2026-W40').click();
    const karte = page.getByTestId('rubrik-Nachunternehmer');
    await karte.getByTestId('haken-Vorleistung prüfen').click(); // direkt auf der Karte abhaken
    await page.waitForTimeout(300);
    await karte.getByTestId('eintrag-oeffnen').click();
    await page.getByTestId('feld-titel').waitFor();
    h.erwarte(await h.v(page, 'haken-Vorleistung prüfen').isChecked(), 'Haken von der Karte ist gespeichert');
    await page.getByTestId('feld-neuer-punkt').fill('Belegreife messen');
    await page.getByTestId('punkt-hinzu').click();
    await h.v(page, 'haken-Belegreife messen').waitFor();
    await page.getByTestId('punkt-loeschen-Planunterlagen prüfen').click();
    await page.waitForTimeout(300);
    h.erwarte((await h.v(page, 'haken-Planunterlagen prüfen').count()) === 0, 'Checkpunkt gelöscht');
    await page.getByTestId('pruef-vorleistung').click();
    await page.getByTestId('pruef-material').click();
    await page.getByTestId('feld-titel').fill('Estrich 1.OG einbringen');
    await page.getByTestId('feld-notiz').fill('Heizestrich, Trocknung beachten');
    await page.getByTestId('tag-Mittwoch').click();
    await page.getByTestId('speichern').click();
    await page.getByTestId('rubrik-Nachunternehmer').getByText('Estrich 1.OG einbringen').waitFor();
    const text = await page.getByTestId('rubrik-Nachunternehmer').innerText();
    h.erwarte(text.includes('Mittwoch') && text.includes('Prüfkette 2/4') && text.includes('Belegreife messen') && text.includes('Heizestrich'), text.replace(/\n/g, ' | '));
    h.erwarte(!text.includes('Planunterlagen prüfen'), 'gelöschter Checkpunkt nicht mehr sichtbar');
  });

  await h.schritt('Board: Eintrag in andere KW verschieben und "+ Neue Woche"', async () => {
    await page.getByTestId('rubrik-Nachunternehmer').getByTestId('eintrag-oeffnen').click();
    await page.getByTestId('kw-vor').click();
    h.erwarte((await page.getByTestId('kw-anzeige').innerText()) === 'KW 41', 'KW 41 gewählt');
    await page.getByTestId('speichern').click();
    await page.getByTestId('kw-2026-W41').waitFor();
    h.erwarte((await page.getByTestId('board-zeitraum').innerText()).startsWith('KW 41'), 'Board springt in KW 41');
    await page.getByTestId('neue-woche').click();
    await page.waitForTimeout(400);
    h.erwarte((await page.locator('[data-testid^="kw-2026-W"]').count()) >= 4, 'neue Woche angelegt');
  });

  await h.schritt('Board: Eintrag löschen', async () => {
    await h.erfasse(page, 'Container umsetzen', false);
    await h.v(page, 'bearbeiten').click();
    page.once('dialog', (d) => d.accept());
    await h.v(page, 'loeschen').click();
    await page.getByTestId('toast').filter({ hasText: 'Eintrag gelöscht' }).waitFor();
    await page.goto(`${h.APP}/board`);
    await page.getByTestId('rubrik-Baustelleneinrichtung').waitFor();
    h.erwarte((await page.getByText('Container umsetzen').count()) === 0, 'gelöscht');
  });

  await h.schritt('Fotos: Import aus Dateien – KW aus EXIF, aus Dateiname, sonst Unbekannt', async () => {
    await page.goto(`${h.APP}/fotos`);
    await h.waehleDateien(page, () => page.getByTestId('foto-galerie').click(), ['DSC0001.jpg', 'IMG_20261028_101010.jpg', 'Foto.jpg', 'IMG_20261105_gross.jpg'].map((n) => path.join(BILDER, n)));
    await page.getByTestId('toast').filter({ hasText: '4 Fotos hinzugefügt' }).waitFor({ timeout: 30000 });
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '4 Fotos', 'vier Fotos');
    const seite = await page.locator('body').innerText();
    h.erwarte(seite.includes('KW 45') && seite.includes('KW 44') && seite.includes('Unbekannt'), 'Gruppen KW 45 (EXIF), KW 44 (Dateiname), Unbekannt');
  });

  await h.schritt('Fotos: KI aus → Gewerk und Art für mehrere Fotos von Hand setzen', async () => {
    // nach dem Import sind die neuen Fotos ausgewählt
    h.erwarte((await page.getByTestId('auswahl-leiste').innerText()).includes('4 ausgewählt'), 'vier ausgewählt');
    await page.getByTestId('auswahl-gewerk').click();
    await page.getByTestId('tag-Trockenbau').click();
    await page.getByTestId('toast').filter({ hasText: '4 Fotos geändert' }).waitFor();
    await page.getByTestId('auswahl-art').click();
    await page.getByTestId('tag-Detail').click();
    await page.waitForTimeout(500);
    await page.getByTestId('foto-auswaehlen').click(); // Auswahl beenden
    h.erwarte((await page.locator('body').innerText()).includes('Trockenbau'), 'Gewerk-Gruppe Trockenbau');
  });

  await h.schritt('Fotos: einzelnes Foto – Tags ändern, Geschoss, freie Tags, Notiz', async () => {
    await page.locator('[data-testid^="foto-"]').filter({ has: page.locator('img') }).first().click();
    await page.getByTestId('gewerk-Elektro').click();
    await page.getByTestId('art-Übersicht').click();
    await page.getByTestId('geschoss-EG').click();
    await page.getByTestId('feld-tags').fill('gespachtelt, Abnahme');
    await page.getByTestId('feld-notiz').fill('Revisionsklappe Flur');
    await page.getByTestId('speichern').click();
    await page.getByTestId('foto-anzahl').waitFor();
    h.erwarte((await page.locator('body').innerText()).includes('Elektro'), 'Gruppe Elektro');
  });

  await h.schritt('Fotos: Filter kombinierbar (Gewerk + Art + KW + Geschoss) und Suche', async () => {
    await page.getByTestId('foto-filter').click();
    await page.getByTestId('filter-gewerk-Trockenbau').click();
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '3 Fotos', 'Trockenbau: 3');
    await page.getByTestId('filter-art-Detail').click();
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '3 Fotos', 'Trockenbau + Detail: 3');
    await page.getByTestId('filter-kw-unbekannt').click();
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '1 Foto', '+ KW unbekannt: 1');
    await page.getByTestId('foto-filter-loeschen').click();
    await page.getByTestId('filter-geschoss-EG').click();
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '1 Foto', 'Geschoss EG: 1');
    await page.getByTestId('foto-filter-loeschen').click();
    await page.getByTestId('foto-suche').fill('revisionsklappe');
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '1 Foto', 'Suche Notiz: 1');
    await page.getByTestId('foto-suche').fill('GESPACHTELT');
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '1 Foto', 'Suche freier Tag: 1');
    await page.getByTestId('foto-suche').fill('');
  });

  await h.schritt('Fotos: KW von Hand ändern', async () => {
    await page.getByTestId('foto-filter').click().catch(() => {});
    await page.goto(`${h.APP}/fotos`);
    await page.getByText('Unbekannt').first().waitFor();
    await page.getByTestId('foto-filter').click();
    await page.getByTestId('filter-kw-unbekannt').click();
    await page.locator('[data-testid^="foto-"]').filter({ has: page.locator('img') }).first().click();
    h.erwarte((await page.getByTestId('foto-kw').innerText()) === 'Unbekannt', 'KW unbekannt');
    await page.getByTestId('kw-vor').click();
    await page.waitForTimeout(400);
    h.erwarte(/^KW \d+/.test(await page.getByTestId('foto-kw').innerText()), 'KW gesetzt');
    h.erwarte((await page.locator('body').innerText()).includes('von Hand gesetzt'), 'Quelle: von Hand');
  });

  await page.goto(`${h.APP}/fotos`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(AUS, 'e-fotos.png') });
  await page.goto(`${h.APP}/board`);
  await page.getByTestId('kw-2026-W41').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(AUS, 'e-board.png') });

  if (fehler.length) console.log('Konsolenfehler:', fehler);
  const n = h.bericht();
  await page.context().storageState({ path: path.join(AUS, 'handy-zustand.json'), indexedDB: true }).catch(() => {});
  await browser.close();
  process.exit(n ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
