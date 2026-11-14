/** Teil 2: Jour Fixe mit Farblogik und PDF, OneDrive-Abgleich, zweites Gerät, Konflikt, Outlook, Team, Offline. */
const { chromium } = require('playwright');
const path = require('path');
const h = require('./hilfe');
const BILDER = process.argv[2];
const AUS = process.argv[3];

const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const P = 'Bauleitung-App/2026-014_Neubau Halle Nord';
const ROT = 'rgb(176, 0, 32)';
const BLAU = 'rgb(10, 42, 107)';
const SCHWARZ = 'rgb(11, 18, 32)';

const farbeVon = (page, nr) => page.locator(`[data-testid="punkt-${nr}"]:visible [data-testid="punkt-thema"]`).evaluate((e) => getComputedStyle(e).color);
const hinweisVon = (page, nr) => page.locator(`[data-testid="punkt-${nr}"]:visible [data-testid="punkt-hinweis"]`).innerText();
const reihenfolge = (page) => page.locator('[data-testid^="punkt-"]:visible').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')).filter((t) => /^punkt-\d+\.\d+$/.test(t)));

async function neuerPunkt(page, text) {
  await h.v(page, 'jf-kurz').fill(text);
  await h.v(page, 'jf-erfassen').click();
  await page.getByTestId('toast').filter({ hasText: 'erfasst' }).waitFor();
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch();
  const A = await h.neuerKontext(browser);
  const page = A.page;

  await h.schritt('Vorbereitung: Projekt und zwei Firmen anlegen', async () => {
    await page.goto(h.APP);
    await page.getByTestId('erstes-projekt').click();
    await page.getByTestId('feld-nr').fill('2026-014');
    await page.getByTestId('feld-name').fill('Neubau Halle Nord');
    await page.getByTestId('feld-bauherr').fill('Muster Logistik GmbH');
    await page.getByTestId('feld-adresse').fill('Industriestraße 12, 48155 Münster');
    await page.getByTestId('projekt-speichern').click();
    await h.v(page, 'plus-knopf').waitFor();
    for (const [name, mail] of [['Trockenbau Yilmaz GmbH', 'yilmaz@example.com'], ['Elektro Schmitz', '']]) {
      await page.goto(`${h.APP}/firmen`);
      await h.v(page, 'firma-neu').click();
      await h.v(page, 'feld-firma-name').fill(name);
      if (mail) await h.v(page, 'feld-email').fill(mail);
      await h.v(page, 'speichern').click();
      await page.getByTestId(`firma-${name}`).waitFor();
    }
  });

  await h.schritt('Jour Fixe: Protokoll Nr. 1 anlegen, Punkte per Kurzeingabe erfassen (KI aus: Text unverändert)', async () => {
    await page.goto(`${h.APP}/jourfixe`);
    await h.v(page, 'jf-neu').click();
    await page.getByText('Jour-Fixe-Protokoll Nr. 1').waitFor();
    await h.v(page, 'jf-teilnehmer').fill('Hr. Lento (Bauleitung), Fr. Becker (Bauherr), Hr. Yilmaz (Trockenbau)');
    await neuerPunkt(page, 'estrich 1.OG noch nicht abgeschlossen');
    await neuerPunkt(page, 'Brandschutz Schotts Achse C');
    await neuerPunkt(page, 'Bauzaun Nordseite');
    h.gleich(await reihenfolge(page), ['punkt-1.01', 'punkt-1.02', 'punkt-1.03'], 'Punkt-Nummern');
    h.erwarte((await page.locator('[data-testid="punkt-1.01"]:visible').innerText()).includes('Estrich 1.OG noch nicht abgeschlossen'), 'Thema mit großem Anfangsbuchstaben');
    h.erwarte((await farbeVon(page, '1.01')) === BLAU, 'neuer Punkt ist dunkelblau');
    h.erwarte((await hinweisVon(page, '1.01')) === 'Neu in diesem Protokoll', 'Hinweis neu');
  });

  await h.schritt('Jour Fixe: Punkt bearbeiten (Verantwortlich, Frist, Bild), überfälliger Punkt wird rot und steht oben', async () => {
    await page.locator('[data-testid="punkt-1.02"]:visible').click();
    await h.v(page, 'feld-thema').waitFor();
    await page.getByText('Elektro Schmitz', { exact: true }).last().click();
    await h.v(page, 'feld-frist').fill('2026-11-01');
    await h.waehleDateien(page, () => h.v(page, 'bilder-galerie').click(), [path.join(BILDER, 'DSC0001.jpg')]);
    await page.getByText('Bilder (1)').waitFor({ timeout: 20000 });
    await h.v(page, 'speichern').click();
    await page.locator('[data-testid="punkt-1.02"]:visible').waitFor();
    h.gleich(await reihenfolge(page), ['punkt-1.02', 'punkt-1.01', 'punkt-1.03'], 'überfälliger Punkt oben');
    h.erwarte((await farbeVon(page, '1.02')) === ROT, 'überfälliger Punkt ist rot');
    h.erwarte((await hinweisVon(page, '1.02')) === 'Überfällig · Neu in diesem Protokoll', 'Hinweis überfällig');
    const karte = await page.locator('[data-testid="punkt-1.02"]:visible').innerText();
    h.erwarte(karte.includes('Elektro Schmitz') && karte.includes('Frist 01.11.2026'), karte.replace(/\n/g, ' | '));
  });

  await h.schritt('Jour Fixe: Punkt als erledigt abhaken', async () => {
    await h.v(page, 'erledigt-1.03').click();
    await page.waitForTimeout(400);
    h.erwarte(await h.v(page, 'erledigt-1.03').isChecked(), 'erledigt');
  });

  await h.schritt('Jour Fixe: neues Protokoll übernimmt nur die offenen Punkte; Farben schwarz/rot, "Offen seit Nr. 1"', async () => {
    await page.goto(`${h.APP}/jourfixe`);
    page.once('dialog', (d) => d.accept());
    await h.v(page, 'jf-neu').click();
    await page.getByTestId('toast').filter({ hasText: 'Protokoll Nr. 2 angelegt – 2 offene Punkte übernommen' }).waitFor();
    await page.getByText('Jour-Fixe-Protokoll Nr. 2').waitFor();
    h.gleich(await reihenfolge(page), ['punkt-1.02', 'punkt-1.01'], 'übernommen: 1.02 (überfällig, oben) und 1.01 – der erledigte 1.03 nicht');
    h.erwarte((await farbeVon(page, '1.01')) === SCHWARZ, 'übernommener Punkt ist schwarz');
    h.erwarte((await hinweisVon(page, '1.01')) === 'Offen seit Nr. 1', 'Hinweis offen seit');
    h.erwarte((await farbeVon(page, '1.02')) === ROT, 'überfällig hat Vorrang: rot');
    h.erwarte((await hinweisVon(page, '1.02')) === 'Überfällig · Offen seit Nr. 1', 'Hinweis überfällig + offen seit');
    h.erwarte((await h.v(page, 'jf-teilnehmer').inputValue()).includes('Fr. Becker'), 'Teilnehmer vom letzten Protokoll vorgeschlagen');
  });

  await h.schritt('Jour Fixe: übernommener Text ist gesperrt, Ergänzung mit Datum wird angehängt und ist dunkelblau', async () => {
    await page.locator('[data-testid="punkt-1.01"]:visible').click();
    await page.getByText('Aus Protokoll Nr. 1 übernommen').waitFor();
    h.erwarte((await h.v(page, 'feld-thema').count()) === 0, 'Thema nicht editierbar');
    await h.v(page, 'feld-ergaenzung').fill('Restflächen im Flur bis Freitag');
    await h.v(page, 'speichern').click();
    const erg = page.locator('[data-testid="punkt-1.01"]:visible [data-testid="punkt-ergaenzung"]');
    await erg.waitFor();
    h.erwarte((await erg.innerText()).includes('Restflächen im Flur bis Freitag') && /Ergänzung vom \d\d\.\d\d\.\d{4}/.test(await erg.innerText()), 'Ergänzung mit Datum');
    h.erwarte((await erg.evaluate((e) => getComputedStyle(e).color)) === BLAU, 'neue Ergänzung ist dunkelblau');
    h.erwarte((await farbeVon(page, '1.01')) === SCHWARZ, 'der Punkt selbst bleibt schwarz');
    h.erwarte((await page.locator('[data-testid="punkt-1.01"]:visible').innerText()).includes('Estrich 1.OG noch nicht abgeschlossen'), 'alter Text bleibt stehen');
  });

  await h.schritt('Jour Fixe: neuer Punkt im Protokoll 2 bekommt Nr. 2.01 und ist dunkelblau; Liste zeigt Zähler', async () => {
    await neuerPunkt(page, 'Fassade Musterachse');
    h.erwarte((await farbeVon(page, '2.01')) === BLAU, '2.01 blau');
    await page.goto(`${h.APP}/jourfixe`);
    const k2 = await page.getByTestId('protokoll-2').innerText();
    const k1 = await page.getByTestId('protokoll-1').innerText();
    h.erwarte(k2.includes('Entwurf') && k2.includes('3 Punkte') && k2.includes('3 offen') && k2.includes('1 überfällig'), `Nr. 2: ${k2.replace(/\n/g, ' | ')}`);
    h.erwarte(k1.includes('abgeschlossen') && k1.includes('3 Punkte') && k1.includes('2 offen'), `Nr. 1: ${k1.replace(/\n/g, ' | ')}`);
    const reihen = await page.locator('[data-testid^="protokoll-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    h.gleich(reihen, ['protokoll-2', 'protokoll-1'], 'neuestes Protokoll oben');
  });

  let pdf;
  await h.schritt('Jour Fixe: PDF erzeugen – Dateiname JF_002_<Datum>.pdf', async () => {
    await page.getByTestId('protokoll-2').click();
    pdf = await h.ladeHerunter(page, () => h.v(page, 'jf-pdf').click(), AUS);
    h.erwarte(pdf.name === `JF_002_${heute}.pdf`, `Dateiname ${pdf.name}`);
    h.erwarte(pdf.bytes > 3000, `Größe ${pdf.bytes}`);
  });

  await h.schritt('OneDrive: Abgleich legt Ordnerstruktur, Datensätze, Foto und PDF richtig ab', async () => {
    await h.abgleich(page);
    const z = (await h.zustand()).laufwerke.diego;
    for (const o of ['02_Fotos', '03_Protokolle', '04_Board', '05_Maengel', '06_Bautagebuch', '07_Lieferscheine', '_daten']) {
      h.erwarte(z.ordner.includes(`${P}/${o}`), `Ordner ${o}`);
    }
    h.erwarte(z.ordner.includes('Bauleitung-App/_Einstellungen'), '_Einstellungen');
    h.erwarte(z.ordner.includes('Bauleitung-App/_Kernteam/2026-014_Neubau Halle Nord/01_Unterlagen'), '01_Unterlagen getrennt unter _Kernteam');
    const dateien = Object.keys(z.dateien);
    const anzahl = (teil) => dateien.filter((d) => d.startsWith(`${P}/${teil}`)).length;
    h.erwarte(dateien.includes(`${P}/_daten/projekt.json`), 'projekt.json');
    h.gleich([anzahl('_daten/protokoll/'), anzahl('_daten/protokollpunkt/'), anzahl('_daten/firma/'), anzahl('_daten/foto/')], [2, 6, 2, 1], 'Datensätze je Typ (Protokolle, Punkte, Firmen, Fotos)');
    h.erwarte(dateien.includes(`${P}/03_Protokolle/JF_002_${heute}.pdf`), 'PDF in 03_Protokolle');
    const foto = dateien.find((d) => d.startsWith(`${P}/02_Fotos/`));
    h.erwarte(foto === `${P}/02_Fotos/2026_KW45/2026-11-04_KW45_ohne-Gewerk_ohne-Art_001.jpg`, `Foto-Name: ${foto}`);
    h.erwarte(z.dateien[foto] < 900000, `Foto wurde verkleinert (${z.dateien[foto]} Bytes)`);
    await page.goto(`${h.APP}/sync`);
    h.erwarte((await h.v(page, 'sync-karte').innerText()).includes('0 warten auf Upload'), 'nichts mehr offen');
  });

  await h.schritt('OneDrive: Foto-Tags ändern → Datei wird umbenannt', async () => {
    await page.goto(`${h.APP}/fotos`);
    await page.locator('[data-testid^="foto-"]').filter({ has: page.locator('img') }).first().click();
    await h.v(page, 'gewerk-Brandschutz').click();
    await h.v(page, 'art-Detail').click();
    await h.v(page, 'geschoss-1.OG').click();
    await page.waitForTimeout(400);
    await h.abgleich(page);
    const dateien = Object.keys((await h.zustand()).laufwerke.diego.dateien).filter((d) => d.includes('/02_Fotos/'));
    h.gleich(dateien, [`${P}/02_Fotos/2026_KW45/2026-11-04_KW45_Brandschutz_Detail_1OG_001.jpg`], 'sprechender Dateiname');
  });

  await h.schritt('Outlook: Protokoll per E-Mail senden (Empfänger aus Firmen, PDF als Anhang)', async () => {
    await page.goto(`${h.APP}/jourfixe`);
    await page.getByTestId('protokoll-2').click();
    await h.v(page, 'jf-mail').click();
    await h.v(page, 'mail-senden').click();
    await page.getByText('Bitte mindestens einen Empfänger angeben.').waitFor();
    await h.v(page, 'mail-firma-Trockenbau Yilmaz GmbH').click();
    h.erwarte((await h.v(page, 'mail-an').inputValue()) === 'yilmaz@example.com', 'Adresse aus Firma übernommen');
    await h.v(page, 'mail-senden').click();
    await page.getByTestId('toast').filter({ hasText: 'Protokoll an 1 Empfänger gesendet' }).waitFor({ timeout: 20000 });
    const mails = (await h.zustand()).mails;
    h.erwarte(mails.length === 1, 'eine Mail');
    h.gleich(mails[0].an, ['yilmaz@example.com'], 'Empfänger');
    h.erwarte(mails[0].betreff === 'Jour-Fixe-Protokoll Nr. 2 – Neubau Halle Nord', mails[0].betreff);
    h.erwarte(mails[0].anhaenge[0].name === `JF_002_${heute}.pdf` && mails[0].anhaenge[0].kopf === '%PDF-', JSON.stringify(mails[0].anhaenge));
  });

  await h.schritt('Outlook: nächsten Jour Fixe in den Kalender eintragen', async () => {
    await h.v(page, 'jf-termin').click();
    await h.v(page, 'termin-beginn').fill('10:30');
    await h.v(page, 'termin-dauer').fill('90');
    await h.v(page, 'termin-anlegen').click();
    await page.getByTestId('toast').filter({ hasText: 'Termin in deinen Outlook-Kalender eingetragen' }).waitFor({ timeout: 20000 });
    const t = (await h.zustand()).termine[0];
    h.erwarte(t.betreff === 'Jour Fixe Nr. 3 – Neubau Halle Nord', t.betreff);
    h.erwarte(/T10:30:00$/.test(t.start.dateTime) && /T12:00:00$/.test(t.ende.dateTime) && t.start.timeZone === 'Europe/Berlin', JSON.stringify(t));
    h.erwarte(t.ort === 'Industriestraße 12, 48155 Münster', t.ort);
  });

  // ---------- zweites Gerät: Mac im Browser ----------
  const B = await h.neuerKontext(browser, { viewport: { width: 1440, height: 900 } });
  const mac = B.page;

  await h.schritt('Mac: dieselben Daten erscheinen nach dem Abgleich (Projekt, Protokolle, Farben, Foto wird nachgeladen)', async () => {
    await mac.goto(h.APP);
    await mac.getByTestId('projekt-umschalter').filter({ hasText: 'Neubau Halle Nord' }).waitFor({ timeout: 30000 });
    await mac.goto(`${h.APP}/jourfixe`);
    await mac.getByTestId('protokoll-2').click();
    await mac.locator('[data-testid="punkt-2.01"]:visible').waitFor();
    h.gleich(await reihenfolge(mac), ['punkt-1.02', 'punkt-1.01', 'punkt-2.01'], 'Punkte am Mac');
    h.erwarte((await farbeVon(mac, '1.02')) === ROT && (await farbeVon(mac, '1.01')) === SCHWARZ && (await farbeVon(mac, '2.01')) === BLAU, 'Farben am Mac');
    await mac.locator('[data-testid="punkt-1.02"]:visible').click();
    await mac.locator('img[src^="blob:"]:visible').first().waitFor({ timeout: 20000 });
    await mac.screenshot({ path: path.join(AUS, 'e-mac-punkt.png') });
  });

  await h.schritt('Mac: Änderung am Mac kommt auf dem Handy an', async () => {
    await mac.goto(`${h.APP}/jourfixe`);
    await mac.getByTestId('protokoll-2').click();
    await mac.locator('[data-testid="punkt-2.01"]:visible').click();
    await h.v(mac, 'feld-thema').fill('Fassade: Musterachse abstimmen');
    await h.v(mac, 'speichern').click();
    await mac.locator('[data-testid="punkt-2.01"]:visible').waitFor();
    await h.abgleich(mac);
    await h.abgleich(page);
    await page.goto(`${h.APP}/jourfixe`);
    await page.getByTestId('protokoll-2').click();
    await page.getByText('Fassade: Musterachse abstimmen').waitFor();
  });

  await h.schritt('Konflikt: beide Geräte ändern denselben Punkt → wird angezeigt, nichts wird still überschrieben', async () => {
    // Handy ist "im Keller": keine Verbindung zu Microsoft
    await A.ctx.route('**/localhost:8790/**', (r) => r.abort());
    await page.locator('[data-testid="punkt-2.01"]:visible').click();
    await h.v(page, 'feld-thema').fill('Fassade (Handy)');
    await h.v(page, 'speichern').click();
    await page.locator('[data-testid="punkt-2.01"]:visible').waitFor();
    // Mac ändert denselben Punkt und gleicht ab
    await mac.goto(`${h.APP}/jourfixe`);
    await mac.getByTestId('protokoll-2').click();
    await mac.locator('[data-testid="punkt-2.01"]:visible').click();
    await h.v(mac, 'feld-thema').fill('Fassade (Mac)');
    await h.v(mac, 'speichern').click();
    await mac.locator('[data-testid="punkt-2.01"]:visible').waitFor();
    await h.abgleich(mac);
    // Handy hat wieder Netz
    await A.ctx.unroute('**/localhost:8790/**');
    const t = await h.abgleich(page);
    h.erwarte(t.includes('1 Konflikt'), `Abgleich meldet Konflikt: ${t}`);
    const k = await h.v(page, 'konflikt').innerText();
    h.erwarte(k.includes('Meine: Fassade (Handy)') && k.includes('Andere: Fassade (Mac)'), k.replace(/\n/g, ' | '));
    const punktDatei = Object.keys((await h.zustand()).laufwerke.diego.dateien).filter((d) => d.includes('/_daten/protokollpunkt/'));
    let inOneDrive = [];
    for (const d of punktDatei) inOneDrive.push(JSON.parse(await (await fetch(`${h.GRAPH}/__datei?konto=diego&pfad=${encodeURIComponent(d)}`)).text()).thema);
    h.erwarte(inOneDrive.includes('Fassade (Mac)') && !inOneDrive.includes('Fassade (Handy)'), 'in OneDrive steht weiter die Version vom Mac');
    await page.screenshot({ path: path.join(AUS, 'e-konflikt.png'), fullPage: true });
  });

  await h.schritt('Konflikt lösen: "Meine Version behalten" → gilt danach auf beiden Geräten', async () => {
    await h.v(page, 'konflikt-meine').click();
    await page.getByTestId('toast').filter({ hasText: 'Deine Version gilt' }).waitFor();
    const t = await h.abgleich(page);
    h.erwarte(!t.includes('Konflikt'), t);
    await h.abgleich(mac);
    await mac.goto(`${h.APP}/jourfixe`);
    await mac.getByTestId('protokoll-2').click();
    await mac.getByText('Fassade (Handy)').waitFor();
  });

  await h.schritt('Offline: Erfassen ohne Verbindung funktioniert, Upload folgt automatisch nach Rückkehr des Netzes', async () => {
    await A.ctx.route('**/localhost:8790/**', (r) => r.abort());
    await page.goto(h.APP);
    const r = await h.erfasse(page, 'kw40 Gerüst Nordseite abbauen');
    h.erwarte(r.includes('KW 40'), r);
    await page.goto(`${h.APP}/sync`);
    // neue Woche + neuer Eintrag = 2 Datensätze warten
    await page.getByText('2 warten auf Upload').waitFor({ timeout: 15000 });
    h.erwarte((await h.v(page, 'sync-status').innerText()).includes('Kein Netz'), 'Status zeigt: kein Netz');
    const vorher = Object.keys((await h.zustand()).laufwerke.diego.dateien).filter((d) => d.includes('/_daten/board/')).length;
    await A.ctx.unroute('**/localhost:8790/**');
    await h.abgleich(page);
    const nachher = Object.keys((await h.zustand()).laufwerke.diego.dateien).filter((d) => d.includes('/_daten/board/')).length;
    h.erwarte(nachher === vorher + 1, `Board-Dateien in OneDrive: ${vorher} → ${nachher}`);
  });

  // ---------- Team: Kollege mit eigenem Konto ----------
  const C = await h.neuerKontext(browser, { token: 'test-kollege' });
  const kol = C.page;

  await h.schritt('Team: Kollege fügt das geteilte Projekt per Freigabe-Link hinzu, sieht die Daten und arbeitet mit', async () => {
    const { link } = await (await fetch(`${h.GRAPH}/__teile`, { method: 'POST', body: JSON.stringify({ konto: 'diego', pfad: P }) })).json();
    await kol.goto(`${h.APP}/sync`);
    await h.v(kol, 'konto-karte').filter({ hasText: 'Kollege' }).waitFor({ timeout: 20000 });
    await h.v(kol, 'feld-link').fill(link);
    await h.v(kol, 'beitreten').click();
    await kol.getByTestId('toast').filter({ hasText: 'Projekt „Neubau Halle Nord“ hinzugefügt' }).waitFor({ timeout: 30000 });
    await kol.goto(`${h.APP}/board`);
    await kol.getByTestId('kw-2026-W40').click();
    await kol.getByText('Gerüst Nordseite abbauen').waitFor();
    const r = await h.erfasse(kol, 'kw40 Abnahme Gerüst mit Kollege');
    h.erwarte(r.includes('KW 40'), r);
    await h.abgleich(kol);
    const z = await h.zustand();
    h.erwarte(!z.laufwerke.kollege || Object.keys(z.laufwerke.kollege.dateien).every((d) => !d.includes('Halle Nord')), 'kein eigener Projektordner beim Kollegen');
    const boardDateien = Object.keys(z.laufwerke.diego.dateien).filter((d) => d.includes('/_daten/board/'));
    const inhalte = [];
    for (const d of boardDateien) inhalte.push(JSON.parse(await (await fetch(`${h.GRAPH}/__datei?konto=diego&pfad=${encodeURIComponent(d)}`)).text()));
    const vomKollegen = inhalte.find((e) => e.titel.includes('Abnahme Gerüst'));
    h.erwarte(vomKollegen && vomKollegen.erstelltVon === 'Kollege' && !!vomKollegen.geaendertAm, `Ersteller und Änderungszeit in der Datei: ${JSON.stringify(vomKollegen && { von: vomKollegen.erstelltVon, am: vomKollegen.geaendertAm })}`);
    await h.abgleich(page);
    await page.goto(`${h.APP}/board`);
    await page.getByTestId('kw-2026-W40').click();
    await page.getByText('Abnahme Gerüst mit Kollege').waitFor();
  });

  for (const [name, k] of [['Handy', A], ['Mac', B], ['Kollege', C]]) if (k.fehler.length) console.log(`Konsolenfehler ${name}:`, k.fehler);
  const n = h.bericht();
  await browser.close();
  process.exit(n ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
