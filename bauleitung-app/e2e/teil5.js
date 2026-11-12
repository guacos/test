/** Teil 5: Unterlagen (Plan-Ansicht, offline, aktueller Planindex) und KI-Assistent mit Quellenpflicht. */
const { chromium } = require('playwright');
const path = require('path');
const h = require('./hilfe');
const BILDER = process.argv[2];
const AUS = process.argv[3];
const K = 'Bauleitung-App/_Kernteam/2026-030_Halle KI/01_Unterlagen';
const kiAnfragen = async () => (await fetch('http://localhost:8788/__anfragen')).json();

async function projekt(page, nr, name, ki) {
  if (await h.v(page, 'erstes-projekt').count()) await h.v(page, 'erstes-projekt').click();
  else {
    await h.v(page, 'projekt-umschalter').click();
    await h.v(page, 'wahl-neu').click();
  }
  await h.v(page, 'feld-nr').fill(nr);
  await h.v(page, 'feld-name').fill(name);
  if (ki) await page.getByRole('switch', { name: 'KI erlaubt' }).click();
  await h.v(page, 'projekt-speichern').click();
  await page.getByTestId('projekt-umschalter').filter({ hasText: name }).waitFor();
}

(async () => {
  const browser = await chromium.launch();
  const A = await h.neuerKontext(browser, { viewport: { width: 1280, height: 900 } });
  const page = A.page;

  await h.schritt('KI aus: der Assistent ist gesperrt, nichts geht an die KI', async () => {
    await page.goto(h.APP);
    await projekt(page, '2026-029', 'Projekt ohne KI', false);
    await page.goto(`${h.APP}/unterlagen/frage`);
    await page.getByText('In diesem Projekt ist die KI ausgeschaltet', { exact: false }).waitFor();
    h.erwarte((await h.v(page, 'frage-senden').count()) === 0, 'kein Senden-Knopf');
  });

  await h.schritt('Unterlagen hinzufügen (PDF) und Plan-Nr./Index setzen: älterer Index wird als veraltet erkannt', async () => {
    await page.goto(`${h.APP}/einstellungen`);
    await h.v(page, 'feld-ki-url').fill('http://localhost:8788');
    await h.v(page, 'feld-ki-schluessel').fill('geheim');
    await h.v(page, 'ki-speichern').click();
    await page.getByTestId('toast').filter({ hasText: 'Gespeichert' }).waitFor();
    await page.goto(h.APP);
    await projekt(page, '2026-030', 'Halle KI', true);
    await page.goto(`${h.APP}/unterlagen`);
    await h.waehleDateien(page, () => h.v(page, 'unterlage-hinzu').click(), ['Tuerliste_Index-A.pdf', 'Tuerliste_Index-B.pdf', 'LV_Trockenbau.pdf'].map((n) => path.join(BILDER, n)));
    await page.getByTestId('toast').filter({ hasText: '3 Unterlagen hinzugefügt' }).waitFor({ timeout: 20000 });
    for (const [name, index] of [['Tuerliste_Index-A.pdf', 'A'], ['Tuerliste_Index-B.pdf', 'B']]) {
      await page.getByTestId(`unterlage-${name}`).click();
      await h.v(page, 'unterlage-art-Plan').click();
      await h.v(page, 'feld-plan-nr').fill('T-100');
      await h.v(page, 'feld-plan-index').fill(index);
      await h.v(page, 'speichern').click();
      await page.getByTestId(`unterlage-${name}`).filter({ hasText: `Index ${index}` }).waitFor();
    }
    h.erwarte((await page.getByTestId('unterlage-Tuerliste_Index-A.pdf').innerText()).includes('veraltet'), 'Index A veraltet');
    h.erwarte((await page.getByTestId('unterlage-Tuerliste_Index-B.pdf').innerText()).includes('aktuell'), 'Index B aktuell');
    h.erwarte((await page.getByTestId('unterlage-LV_Trockenbau.pdf').innerText()).includes('offline verfügbar'), 'offline verfügbar');
  });

  await h.schritt('Plan-Ansicht: PDF wird im Bildschirm angezeigt', async () => {
    await page.getByTestId('unterlage-Tuerliste_Index-B.pdf').click();
    const rahmen = h.v(page, 'pdf-ansicht');
    await rahmen.waitFor();
    h.erwarte((await rahmen.getAttribute('src')).startsWith('blob:'), 'Anzeige aus dem lokalen Speicher (ohne Netz)');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(AUS, 'e-plan.png') });
  });

  await h.schritt('KI-Assistent: Antwort mit Quelle (Dokument, Seite); nur der aktuelle Planindex wird verwendet', async () => {
    await page.goto(`${h.APP}/unterlagen/frage`);
    await page.getByText('Nicht verwendet, weil es einen neueren Index gibt: Tuerliste_Index-A.pdf', { exact: false }).waitFor();
    h.erwarte((await h.v(page, 'frage-dok-Tuerliste_Index-A.pdf').count()) === 0, 'veralteter Index ist nicht wählbar');
    await h.v(page, 'frage-dok-LV_Trockenbau.pdf').click(); // abwählen
    await h.v(page, 'frage-feld').fill('Wie viele Stahltüren sind in der Halle?');
    await h.v(page, 'frage-senden').click();
    await h.v(page, 'antwort').first().waitFor({ timeout: 30000 });
    h.erwarte((await h.v(page, 'antwort-text').first().innerText()) === 'In der Halle sind 12 Stahltüren T30 vorgesehen.', 'Antwort');
    const quelle = await h.v(page, 'quelle').first().innerText();
    h.erwarte(quelle.includes('Quelle: Tuerliste_Index-B.pdf, Seite 2') && quelle.includes('Plan-Nr. T-100 · Index B') && quelle.includes('Stahltür T30, Halle: 12 Stück'), quelle.replace(/\n/g, ' | '));
    const a = (await kiAnfragen()).filter((x) => x.pfad === '/v1/frage');
    h.gleich(a[0].dokumente, ['Tuerliste_Index-B.pdf'], 'an die KI gingen nur die gewählten, aktuellen Dokumente');
    h.gleich(a[0].schluessel, ['frage', 'dokumente'], 'keine weiteren Angaben (kein Projektname)');
    h.erwarte(a[0].pdfKopf.startsWith('%PDF'), 'echtes PDF übertragen');
    await page.screenshot({ path: path.join(AUS, 'e-assistent.png'), fullPage: true });
  });

  await h.schritt('KI-Assistent: ohne Fundstelle lautet die Antwort "Weiß ich nicht – nicht in den Unterlagen gefunden."', async () => {
    await h.v(page, 'frage-feld').fill('Welche Farbe hat die Fassade?');
    await h.v(page, 'frage-senden').click();
    await h.v(page, 'antwort-text').first().filter({ hasText: 'Weiß ich nicht – nicht in den Unterlagen gefunden.' }).waitFor({ timeout: 30000 });
    h.erwarte((await h.v(page, 'antwort').first().locator('[data-testid="quelle"]').count()) === 0, 'keine Quelle');
  });

  await h.schritt('KI-Assistent: KI nicht erreichbar → klare Meldung, keine erfundene Antwort', async () => {
    await fetch('http://localhost:8788/__schalter');
    await h.v(page, 'frage-feld').fill('Wie viele Stahltüren gibt es?');
    await h.v(page, 'frage-senden').click();
    await page.getByText('KI nicht erreichbar').first().waitFor({ timeout: 30000 });
    await fetch('http://localhost:8788/__schalter');
  });

  await h.schritt('OneDrive: Unterlagen liegen unter _Kernteam; direkt in OneDrive abgelegte Datei erscheint und lässt sich offline laden', async () => {
    await h.abgleich(page);
    let dateien = Object.keys((await h.zustand()).laufwerke.diego.dateien);
    for (const n of ['Tuerliste_Index-A.pdf', 'Tuerliste_Index-B.pdf', 'LV_Trockenbau.pdf']) h.erwarte(dateien.includes(`${K}/${n}`), `${n} in 01_Unterlagen`);
    h.erwarte(!dateien.some((d) => d.includes('2026-030_Halle KI/') && !d.includes('_Kernteam') && /\.pdf$/.test(d)), 'keine Unterlage im geteilten Projektordner');
    // Datei am Mac direkt in den OneDrive-Ordner gelegt
    const fs = require('fs');
    const r = await fetch(`${h.GRAPH}/v1.0/me/drive/root:/${encodeURI(`${K}/Vertraege/Bauvertrag.pdf`)}:/content`, { method: 'PUT', headers: { Authorization: 'Bearer test-diego', 'Content-Type': 'application/pdf' }, body: fs.readFileSync(path.join(BILDER, 'LV_Trockenbau.pdf')) });
    h.erwarte(r.status === 201, `Datei abgelegt (${r.status})`);
    await h.abgleich(page);
    await page.goto(`${h.APP}/unterlagen`);
    const zeile = page.getByTestId('unterlage-Bauvertrag.pdf');
    await zeile.waitFor();
    h.erwarte((await zeile.innerText()).includes('nur in OneDrive'), 'noch nicht auf dem Gerät');
    await zeile.click();
    await h.v(page, 'unterlage-laden').click();
    await h.v(page, 'pdf-ansicht').waitFor({ timeout: 20000 });
    await page.goto(`${h.APP}/unterlagen`);
    await page.getByTestId('unterlage-Bauvertrag.pdf').filter({ hasText: 'offline verfügbar' }).waitFor();
  });

  await h.schritt('Offline: geladene Unterlage lässt sich ohne Verbindung zu OneDrive ansehen', async () => {
    await A.ctx.route('**/localhost:8790/**', (r) => r.abort());
    await page.getByTestId('unterlage-Bauvertrag.pdf').click();
    await h.v(page, 'pdf-ansicht').waitFor();
    await A.ctx.unroute('**/localhost:8790/**');
  });

  await h.schritt('Entfernen in der App lässt die Datei in OneDrive; sie taucht nicht wieder auf', async () => {
    page.once('dialog', (d) => d.accept());
    await h.v(page, 'loeschen').click();
    await page.getByTestId('unterlage-LV_Trockenbau.pdf').waitFor();
    await h.abgleich(page);
    await h.abgleich(page);
    await page.goto(`${h.APP}/unterlagen`);
    await page.getByTestId('unterlage-LV_Trockenbau.pdf').waitFor();
    h.erwarte((await page.getByTestId('unterlage-Bauvertrag.pdf').count()) === 0, 'Eintrag bleibt entfernt');
    h.erwarte(Object.keys((await h.zustand()).laufwerke.diego.dateien).includes(`${K}/Vertraege/Bauvertrag.pdf`), 'Datei noch in OneDrive');
  });

  if (A.fehler.length) console.log('Konsolenfehler:', A.fehler);
  const n = h.bericht();
  await browser.close();
  process.exit(n ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
