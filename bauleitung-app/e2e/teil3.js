/** Teil 3: Bautagebuch (Wetter), Mängel (Grundriss-Pin, PDF), Lieferscheine, KI-Pfad, Suche, Einstellungen, Vertraulichkeit. */
const { chromium } = require('playwright');
const path = require('path');
const h = require('./hilfe');
const BILDER = process.argv[2];
const AUS = process.argv[3];

const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const tagPlus = (n) => {
  const d = new Date(`${heute}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const P = 'Bauleitung-App/2026-014_Neubau Halle Nord';
const kiAnfragen = async () => (await fetch('http://localhost:8788/__anfragen')).json();
const wetterAnfragen = async () => (await fetch('http://localhost:8791/__anfragen')).json();

(async () => {
  const browser = await chromium.launch();
  const A = await h.neuerKontext(browser);
  const page = A.page;

  await h.schritt('Vorbereitung: Projekt (KI aus, Wetter an) und Firmen', async () => {
    await page.goto(h.APP);
    await page.getByTestId('erstes-projekt').click();
    await page.getByTestId('feld-nr').fill('2026-014');
    await page.getByTestId('feld-name').fill('Neubau Halle Nord');
    await page.getByTestId('feld-bauherr').fill('Muster Logistik GmbH');
    await page.getByTestId('schalter-wetter').click();
    await page.getByTestId('feld-lat').fill('51.96');
    await page.getByTestId('feld-lon').fill('7.63');
    await page.getByTestId('projekt-speichern').click();
    await h.v(page, 'plus-knopf').waitFor();
    for (const name of ['Trockenbau Yilmaz GmbH', 'Elektro Schmitz']) {
      await page.goto(`${h.APP}/firmen`);
      await h.v(page, 'firma-neu').click();
      await h.v(page, 'feld-firma-name').fill(name);
      await h.v(page, 'speichern').click();
      await page.getByTestId(`firma-${name}`).waitFor();
    }
  });

  await h.schritt('Firmen: Pflichtfeld und E-Mail-Prüfung', async () => {
    await h.v(page, 'firma-neu').click();
    await h.v(page, 'speichern').click();
    await page.getByText('Bitte den Firmennamen eingeben.').waitFor();
    await h.v(page, 'feld-firma-name').fill('Estrich Meier');
    await h.v(page, 'feld-email').fill('keine-adresse');
    await h.v(page, 'speichern').click();
    await page.getByText('Das ist keine gültige E-Mail-Adresse.').waitFor();
    await h.v(page, 'feld-email').fill('meier@example.com');
    await h.v(page, 'speichern').click();
    await page.getByTestId('firma-Estrich Meier').waitFor();
  });

  await h.schritt('Bautagebuch gestern: Firmen mit Plus/Minus-Zähler, Notiz', async () => {
    await page.goto(`${h.APP}/bautagebuch/${tagPlus(-1)}`);
    await h.v(page, 'firma-chip-Trockenbau Yilmaz GmbH').click();
    await h.v(page, 'zaehler-Trockenbau Yilmaz GmbH-plus').waitFor();
    for (let i = 0; i < 5; i++) await h.v(page, 'zaehler-Trockenbau Yilmaz GmbH-plus').click(); // schnell hintereinander
    await h.v(page, 'zaehler-Trockenbau Yilmaz GmbH-minus').click();
    await h.v(page, 'firma-chip-Elektro Schmitz').click();
    await h.v(page, 'zaehler-Elektro Schmitz-plus').click();
    await h.v(page, 'zaehler-Elektro Schmitz-plus').click();
    await page.waitForTimeout(600);
    h.erwarte((await h.v(page, 'zaehler-Trockenbau Yilmaz GmbH-wert').innerText()) === '5', 'Trockenbau: 1 + 5 − 1 = 5');
    h.erwarte((await h.v(page, 'zaehler-Elektro Schmitz-wert').innerText()) === '3', 'Elektro: 3');
    h.erwarte((await page.locator('body').innerText()).includes('8 GESAMT') || (await page.locator('body').innerText()).includes('8 gesamt'), 'Summe 8');
    await h.v(page, 'feld-bautag-notiz').fill('Estrich 1. OG eingebracht.');
    await h.v(page, 'feld-wetter').fill('trocken, 6 °C');
    await h.v(page, 'tag-fertig').focus();
    await page.waitForTimeout(500);
    h.erwarte((await wetterAnfragen()).every((u) => !u.includes(tagPlus(-1))), 'für gestern wird das Wetter nicht automatisch abgerufen');
  });

  await h.schritt('Bautagebuch heute: Wetter automatisch (nur Koordinaten + Datum), Firmen vom letzten Eintrag vorgeschlagen', async () => {
    await page.goto(`${h.APP}/bautagebuch/${heute}`);
    await h.v(page, 'wetter-text').waitFor({ timeout: 20000 });
    h.erwarte((await h.v(page, 'wetter-text').innerText()) === 'Regen · 4,2 bis 9,1 °C · 3,2 mm · Wind bis 35 km/h', await h.v(page, 'wetter-text').innerText());
    const anfragen = await wetterAnfragen();
    h.erwarte(anfragen.length === 1 && anfragen[0].includes('lat=51.960') && anfragen[0].includes('lon=7.630') && anfragen[0].includes(`date=${heute}`), JSON.stringify(anfragen));
    h.erwarte(!/Halle|Muster|2026-014/.test(anfragen[0]), 'keine Projektdaten in der Wetter-Anfrage');
    await h.v(page, 'vortag-Trockenbau Yilmaz GmbH').waitFor();
    await h.v(page, 'vortag-alle').click();
    await page.waitForTimeout(600);
    h.erwarte((await h.v(page, 'zaehler-Trockenbau Yilmaz GmbH-wert').innerText()) === '5', 'Anzahl vom Vortag übernommen');
    await h.v(page, 'feld-neue-firma').fill('Gerüstbau Kühn');
    await h.v(page, 'firma-hinzu').click();
    await h.v(page, 'zaehler-Gerüstbau Kühn-wert').waitFor();
    await page.screenshot({ path: path.join(AUS, 'e-bautag.png'), fullPage: true });
  });

  await h.schritt('Bautagebuch: nur ein Eintrag je Tag; PDF für den Zeitraum', async () => {
    await page.goto(`${h.APP}/bautagebuch`);
    await page.getByTestId(`bautag-${heute}`).waitFor();
    h.erwarte((await page.locator('[data-testid^="bautag-20"]').count()) === 2, 'zwei Tage, keine Doppelten');
    h.erwarte((await page.getByTestId(`bautag-${heute}`).innerText()).includes('9 Arbeiter (3 Firmen)'), await page.getByTestId(`bautag-${heute}`).innerText());
    await h.v(page, 'pdf-von').fill(tagPlus(-1));
    await h.v(page, 'pdf-bis').fill(heute);
    const pdf = await h.ladeHerunter(page, () => h.v(page, 'bautag-pdf').click(), AUS);
    h.erwarte(pdf.name === `Bautagebuch_${tagPlus(-1)}_bis_${heute}.pdf`, pdf.name);
  });

  await h.schritt('Mängel: Grundriss hinterlegen', async () => {
    await page.goto(`${h.APP}/maengel/plaene`);
    await h.v(page, 'feld-plan-name').fill('Grundriss 1. OG');
    await h.v(page, 'plan-geschoss-1.OG').click();
    await h.waehleDateien(page, () => h.v(page, 'plan-hinzu').click(), [path.join(BILDER, 'grundriss.png')]);
    await page.getByTestId('plan-Grundriss 1. OG').waitFor({ timeout: 20000 });
  });

  await h.schritt('Mängel: Mangel mit Foto, Firma, Frist und Pin im Grundriss; überfällig wird rot', async () => {
    await page.goto(`${h.APP}/maengel`);
    await h.v(page, 'mangel-neu').click();
    await h.v(page, 'feld-mangel-titel').fill('Revisionsklappe fehlt');
    await h.v(page, 'feld-mangel-beschreibung').fill('Im Flur fehlt die Revisionsklappe vor dem Brandschutzventil.');
    await h.waehleDateien(page, () => h.v(page, 'mangel-fotos-galerie').click(), [path.join(BILDER, 'DSC0001.jpg')]);
    await page.getByText('Fotos (1)').waitFor({ timeout: 20000 });
    await h.v(page, 'mangel-firma-Trockenbau Yilmaz GmbH').click();
    await h.v(page, 'mangel-frist').fill(tagPlus(-3));
    await h.v(page, 'feld-mangel-ort').fill('1.OG Flur');
    await h.v(page, 'plan-chip-Grundriss 1. OG').click();
    const plan = h.v(page, 'plan');
    await plan.waitFor();
    await page.waitForTimeout(800);
    const box = await plan.boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.6);
    await h.v(page, 'pin').waitFor();
    h.erwarte((await h.v(page, 'pin-status').innerText()).includes('Position gesetzt'), 'Pin gesetzt');
    const pin = await h.v(page, 'pin').boundingBox();
    const pinX = (pin.x + pin.width / 2 - box.x) / box.width;
    const pinY = (pin.y + pin.height - box.y) / box.height;
    h.erwarte(Math.abs(pinX - 0.25) < 0.03 && Math.abs(pinY - 0.6) < 0.04, `Pin sitzt an der angetippten Stelle (${pinX.toFixed(2)}, ${pinY.toFixed(2)})`);
    await page.screenshot({ path: path.join(AUS, 'e-mangel.png'), fullPage: true });
    await h.v(page, 'speichern').click();
    await page.getByTestId('mangel-1').filter({ hasText: 'Revisionsklappe fehlt' }).waitFor();
    const karte = await page.getByTestId('mangel-1').innerText();
    h.erwarte(karte.includes('Überfällig') && karte.includes('im Grundriss') && karte.includes('1.OG Flur'), karte.replace(/\n/g, ' | '));
    h.erwarte((await page.getByTestId('gruppe-Trockenbau Yilmaz GmbH').count()) === 1, 'nach Firma gruppiert');
  });

  await h.schritt('Mängel: zweiter Mangel erledigt; Ansichten offen/erledigt; Mängelliste als PDF je Firma', async () => {
    await h.v(page, 'mangel-neu').click();
    await h.v(page, 'feld-mangel-titel').fill('Fuge nicht verspachtelt');
    await h.v(page, 'mangel-firma-Trockenbau Yilmaz GmbH').click();
    await h.v(page, 'mangel-status-Erledigt').click();
    await h.v(page, 'speichern').click();
    await h.v(page, 'sicht-erledigt').click();
    await page.getByTestId('mangel-2').waitFor();
    h.erwarte((await page.getByTestId('mangel-1').count()) === 0, 'offener Mangel nicht in "Erledigt"');
    await h.v(page, 'sicht-alle').click();
    const pdf = await h.ladeHerunter(page, () => h.v(page, 'pdf-Trockenbau Yilmaz GmbH').click(), AUS);
    h.erwarte(pdf.name === `Maengelliste_${heute}.pdf`, pdf.name);
  });

  await h.schritt('Lieferscheine (KI aus): Foto, Angaben von Hand, Kurzprüfung, geplante Lieferung wird im Board "geliefert"', async () => {
    await h.erfasse(page, 'Donnerstag Lieferung Trockenbauplatten');
    await page.goto(`${h.APP}/lieferscheine`);
    await h.waehleDateien(page, () => h.v(page, 'ls-datei').click(), [path.join(BILDER, 'lieferschein.jpg')]);
    await h.v(page, 'ls-lieferant').waitFor({ timeout: 20000 });
    h.erwarte((await h.v(page, 'ls-lieferant').inputValue()) === '', 'KI aus: Felder bleiben leer');
    await h.v(page, 'ls-lieferant').fill('Baustoff Nord GmbH');
    await h.v(page, 'ls-nummer').fill('LS-4711');
    await h.v(page, 'ls-material').fill('GK-Platten 12,5 mm');
    await h.v(page, 'ls-menge').fill('120 Stück');
    await h.v(page, 'ls-firma-Trockenbau Yilmaz GmbH').click();
    await h.v(page, 'ls-menge-ok-Ja').click();
    await h.v(page, 'ls-lagerort').fill('Halle, Achse C');
    await h.v(page, 'ls-lieferung-Donnerstag Lieferung Trockenbauplatten').click();
    await page.waitForTimeout(500);
    await h.v(page, 'speichern').click();
    await page.getByTestId('ls-LS-4711').waitFor();
    h.erwarte((await page.getByTestId('ls-LS-4711').innerText()).includes('geprüft'), 'als geprüft markiert');
    await page.goto(`${h.APP}/board`);
    await page.getByTestId('rubrik-Lieferungen').getByText('geliefert').waitFor();
    h.erwarte((await kiAnfragen()).length === 0, 'KI aus: bis hierher wurde NICHTS an die KI geschickt');
  });

  await h.schritt('Suche: findet Einträge aus allen Bereichen', async () => {
    await page.goto(`${h.APP}/suche`);
    await h.v(page, 'suche-feld').fill('revisionsklappe');
    await page.getByText('1 Treffer').waitFor();
    await h.v(page, 'suche-feld').fill('yilmaz');
    await page.waitForTimeout(400);
    const text = await page.locator('body').innerText();
    h.erwarte(/MANGEL \(2\)/i.test(text) && /BAUTAGEBUCH \(2\)/i.test(text) && /LIEFERSCHEIN \(1\)/i.test(text) && /FIRMA \(1\)/i.test(text), text.replace(/\n/g, ' | ').slice(0, 400));
    await h.v(page, 'suche-feld').fill('trockenbauplatten');
    await h.v(page, 'treffer').first().click();
    await h.v(page, 'feld-titel').waitFor();
  });

  await h.schritt('Einstellungen: eigene Gewerke-Liste gilt sofort bei den Foto-Tags und liegt in OneDrive', async () => {
    await page.goto(`${h.APP}/einstellungen`);
    await h.v(page, 'feld-gewerke').fill('Rohbau\nTrockenbau\nElektro\nSprinkler\nSonstiges');
    await h.v(page, 'gewerke-speichern').click();
    await page.getByTestId('toast').filter({ hasText: '5 Gewerke gespeichert' }).waitFor();
    await page.goto(`${h.APP}/fotos`);
    await page.locator('[data-testid^="foto-"]').filter({ has: page.locator('img') }).first().click();
    await h.v(page, 'gewerk-Sprinkler').click();
    await page.waitForTimeout(300);
    await h.abgleich(page);
    const roh = await (await fetch(`${h.GRAPH}/__datei?konto=diego&pfad=${encodeURIComponent('Bauleitung-App/_Einstellungen/einstellungen.json')}`)).text();
    h.gleich(JSON.parse(roh).gewerke, ['Rohbau', 'Trockenbau', 'Elektro', 'Sprinkler', 'Sonstiges'], 'Gewerke in OneDrive');
  });

  await h.schritt('OneDrive: PDFs und Lieferschein-Foto liegen in den richtigen Ordnern', async () => {
    const dateien = Object.keys((await h.zustand()).laufwerke.diego.dateien);
    h.erwarte(dateien.includes(`${P}/06_Bautagebuch/Bautagebuch_${tagPlus(-1)}_bis_${heute}.pdf`), 'Bautagebuch-PDF in 06_Bautagebuch');
    h.erwarte(dateien.includes(`${P}/05_Maengel/Trockenbau-Yilmaz-GmbH/Maengelliste_${heute}.pdf`), `Mängelliste in 05_Maengel/{Firma}: ${dateien.filter((d) => d.includes('05_Maengel')).join(', ')}`);
    h.erwarte(dateien.some((d) => d.startsWith(`${P}/07_Lieferscheine/`) && d.includes('_Lieferschein_001.jpg')), `Lieferschein-Foto: ${dateien.filter((d) => d.includes('07_')).join(', ')}`);
    h.erwarte(dateien.some((d) => d.startsWith(`${P}/05_Maengel/_Grundrisse/`)), 'Grundriss unter 05_Maengel/_Grundrisse');
    h.erwarte(dateien.some((d) => /02_Fotos\/2026_KW45\/2026-11-04_KW45_Sprinkler_ohne-Art_001\.jpg$/.test(d)), `Mangel-Foto in der Fotodoku: ${dateien.filter((d) => d.includes('02_Fotos')).join(', ')}`);
  });

  // ---------- zweites Projekt mit KI ----------
  await h.schritt('KI an: zweites Projekt, KI-Backend eintragen, Umschalten oben', async () => {
    await page.goto(`${h.APP}/einstellungen`);
    await h.v(page, 'feld-ki-url').fill('http://localhost:8788');
    await h.v(page, 'feld-ki-schluessel').fill('geheim');
    await h.v(page, 'ki-speichern').click();
    await page.getByTestId('toast').filter({ hasText: 'Gespeichert' }).waitFor();
    await page.goto(h.APP);
    await h.v(page, 'projekt-umschalter').click();
    await h.v(page, 'wahl-neu').click();
    await h.v(page, 'feld-nr').fill('2026-020');
    await h.v(page, 'feld-name').fill('Umbau Schule Geheim');
    await h.v(page, 'feld-bauherr').fill('Stadt Musterhausen');
    await page.getByRole('switch', { name: 'KI erlaubt' }).click();
    await h.v(page, 'projekt-speichern').click();
    await page.getByTestId('projekt-umschalter').filter({ hasText: 'Umbau Schule Geheim' }).waitFor();
  });

  await h.schritt('KI an: Kurzeingabe wird ausformuliert (Titel, Satz, Checkpunkte); "jf" → sachlicher Satz ohne Checkliste', async () => {
    const r = await h.erfasse(page, 'kw47 Lieferung Lüftungskanäle', false);
    h.erwarte(r.includes('KI: Lieferung Lüftungskanäle') && r.includes('KW 47 · Bauleitung / Lieferungen'), r);
    await h.v(page, 'bearbeiten').click();
    h.erwarte((await h.v(page, 'feld-text').inputValue()).startsWith('Ausformulierter Satz'), 'ausformulierter Satz');
    await h.v(page, 'haken-Zuwegung prüfen').waitFor();
    await page.goto(h.APP);
    const j = await h.erfasse(page, 'jf Brandschutz klären');
    h.erwarte(j.includes('KI-Thema: Brandschutz klären') && j.includes('Jour Fixe Nr. 1'), j);
  });

  await h.schritt('KI nicht erreichbar: Stichwortzuordnung, Ausformulierung wird nachgeholt; eigene Änderungen bleiben', async () => {
    await fetch('http://localhost:8788/__schalter');
    const r = await h.erfasse(page, 'Estrich Aula', false);
    h.erwarte(r.includes('Estrich Aula') && r.includes('Nachunternehmer'), r);
    await page.getByText('Die Ausformulierung wird nachgeholt', { exact: false }).waitFor();
    await h.v(page, 'erfassen-fertig').click();
    await h.erfasse(page, 'Bauzaun Schulhof', false);
    await h.v(page, 'bearbeiten').click();
    await h.v(page, 'feld-titel').fill('Mein eigener Titel');
    await h.v(page, 'speichern').click();
    await page.waitForTimeout(500);
    await fetch('http://localhost:8788/__schalter');
    await page.goto(`${h.APP}/board`); // Neustart → wird nachgeholt
    await page.getByText('KI: Estrich Aula').waitFor({ timeout: 20000 });
    h.erwarte(await page.getByText('Mein eigener Titel').isVisible(), 'eigener Titel bleibt erhalten');
  });

  await h.schritt('KI an: Fotos bekommen Gewerk/Art als Vorschlag; Lieferschein wird gelesen', async () => {
    await page.goto(`${h.APP}/fotos`);
    await h.waehleDateien(page, () => h.v(page, 'foto-galerie').click(), [path.join(BILDER, 'IMG_20261028_101010.jpg')]);
    await page.getByText('Elektro').first().waitFor({ timeout: 30000 });
    await page.locator('[data-testid^="foto-"]').filter({ has: page.locator('img') }).first().click();
    await page.getByText('Gewerk/Art: Vorschlag der KI').waitFor();
    await h.v(page, 'ki-bestaetigen').click();
    await page.waitForTimeout(400);
    h.erwarte((await page.getByText('Gewerk/Art: Vorschlag der KI').count()) === 0, 'Vorschlag bestätigt');
    await page.goto(`${h.APP}/lieferscheine`);
    await h.waehleDateien(page, () => h.v(page, 'ls-datei').click(), [path.join(BILDER, 'lieferschein.jpg')]);
    await h.v(page, 'ls-lieferant').waitFor({ timeout: 30000 });
    h.erwarte((await h.v(page, 'ls-lieferant').inputValue()) === 'Baustoff Nord GmbH' && (await h.v(page, 'ls-nummer').inputValue()) === 'LS-4711', 'von der KI gelesen');
    h.erwarte((await h.v(page, 'ls-datum').inputValue()) === '2026-11-04', 'Datum gelesen');
  });

  await h.schritt('Vertraulichkeit: an die KI gehen nur Kurztext bzw. verkleinertes Bild – keine Projektdaten', async () => {
    const anfragen = await kiAnfragen();
    h.erwarte(anfragen.length >= 5, `${anfragen.length} Anfragen`);
    for (const a of anfragen) {
      const erlaubt = { '/v1/erfassung': ['text', 'hatFoto'], '/v1/board': ['text'], '/v1/jourfixe': ['text'], '/v1/foto': ['bild', 'gewerke'], '/v1/lieferschein': ['bild'] }[a.pfad];
      h.erwarte(erlaubt && a.schluessel.every((k) => erlaubt.includes(k)), `Felder in ${a.pfad}: ${a.schluessel}`);
      h.erwarte(!a.text || !/Schule|Geheim|Musterhausen|2026-020|kw47|^jf /i.test(a.text), `Text an die KI: ${a.text}`);
      h.erwarte(a.bildZeichen < 600000, `Bild verkleinert (${a.bildZeichen} Zeichen)`);
    }
    h.erwarte(anfragen.some((a) => a.text === 'Lieferung Lüftungskanäle'), '"kw47" wurde vor dem Senden entfernt');
  });

  await h.schritt('Projektübergreifende Fotosuche und Rückwechsel ins erste Projekt', async () => {
    await page.goto(`${h.APP}/fotos`);
    await page.getByTestId('foto-anzahl').filter({ hasText: '1 Foto' }).waitFor();
    await h.v(page, 'foto-alle-projekte').click();
    await page.getByText('2026-014 · Neubau Halle Nord').waitFor();
    h.erwarte((await page.getByTestId('foto-anzahl').innerText()) === '2 Fotos', await page.getByTestId('foto-anzahl').innerText());
    await page.goto(h.APP);
    await h.v(page, 'projekt-umschalter').click();
    await h.v(page, 'wahl-2026-014').click();
    await page.getByTestId('projekt-umschalter').filter({ hasText: 'Neubau Halle Nord' }).waitFor();
    await page.reload();
    await page.getByTestId('projekt-umschalter').filter({ hasText: 'Neubau Halle Nord' }).waitFor();
  });

  // ---------- Bildschirmfotos für die Sichtprüfung ----------
  await page.goto(h.APP);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(AUS, 'e-start.png'), fullPage: true });
  await page.goto(`${h.APP}/maengel`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(AUS, 'e-maengel.png') });
  await page.goto(`${h.APP}/sync`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(AUS, 'e-sync.png'), fullPage: true });
  await page.goto(`${h.APP}/mehr`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(AUS, 'e-mehr.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(h.APP);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(AUS, 'e-start-desktop.png') });
  await page.goto(`${h.APP}/fotos`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(AUS, 'e-fotos-desktop.png') });

  if (A.fehler.length) console.log('Konsolenfehler:', A.fehler);
  const n = h.bericht();
  await browser.close();
  process.exit(n ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
