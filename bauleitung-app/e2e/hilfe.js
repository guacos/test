/** Gemeinsame Hilfen für die Ende-zu-Ende-Prüfung. */
const fs = require('fs');
const path = require('path');

const APP = 'http://localhost:8099';
const GRAPH = 'http://localhost:8790';
const ergebnisse = [];

async function schritt(name, fn) {
  const start = Date.now();
  try {
    await fn();
    ergebnisse.push({ name, ok: true });
    console.log(`  OK    ${name} (${Date.now() - start} ms)`);
  } catch (e) {
    ergebnisse.push({ name, ok: false, fehler: String(e && e.message ? e.message : e).split('\n').slice(0, 6).join(' | ') });
    console.log(`  FEHLER ${name}\n         ${ergebnisse[ergebnisse.length - 1].fehler}`);
  }
}

function erwarte(bedingung, text) {
  if (!bedingung) throw new Error(`Erwartung nicht erfüllt: ${text}`);
}

function gleich(ist, soll, text) {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  if (a !== b) throw new Error(`${text}: erwartet ${b}, erhalten ${a}`);
}

async function zustand() {
  return (await fetch(`${GRAPH}/__zustand`)).json();
}

async function neuerKontext(browser, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.viewport || { width: 412, height: 900 }, acceptDownloads: true, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  if (opt.token) await ctx.addInitScript((t) => window.localStorage.setItem('test-token', t), opt.token);
  const page = await ctx.newPage();
  page.setDefaultTimeout(opt.timeout || 12000);
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(`PAGEERROR ${String(e).slice(0, 300)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) fehler.push(m.text().slice(0, 300));
  });
  return { ctx, page, fehler };
}

/** Klick löst den Dateidialog aus; die Dateien werden gewählt. */
async function waehleDateien(page, klick, dateien) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), klick()]);
  await fc.setFiles(dateien);
}

/** Klick löst einen Download aus; die Datei wird gespeichert. */
async function ladeHerunter(page, klick, zielOrdner) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), klick()]);
  const ziel = path.join(zielOrdner, dl.suggestedFilename());
  await dl.saveAs(ziel);
  return { name: dl.suggestedFilename(), pfad: ziel, bytes: fs.statSync(ziel).size };
}

/** Sichtbares Element mit dieser Test-ID (verdeckte Bildschirme im Hintergrund zählen nicht). */
function v(page, id) {
  return page.locator(`[data-testid="${id}"]:visible`);
}

/** Entfernt Symbol-Zeichen der Icon-Schrift aus einem Text. */
function ohneSymbole(text) {
  return text.replace(/[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFF}]/gu, '').trim();
}

/** Schnellerfassung über den Plus-Knopf, wie am Handy. fertig=false lässt die Ergebnisanzeige offen. */
async function erfasse(page, text, fertig = true) {
  if (!(await v(page, 'plus-knopf').count())) await page.goto(APP);
  await v(page, 'plus-knopf').click();
  await v(page, 'erfassen-text').fill(text);
  await v(page, 'erfassen-absenden').click();
  await v(page, 'erfassung-ergebnis').waitFor();
  const r = ohneSymbole(await v(page, 'erfassung-ergebnis').innerText());
  if (fertig) {
    await v(page, 'erfassen-fertig').click();
    await v(page, 'plus-knopf').waitFor();
  }
  return r;
}

/** Wechselt über die untere Leiste bzw. Seitenleiste den Reiter. */
async function reiter(page, name) {
  await page.getByRole('tab', { name }).click({ timeout: 3000 }).catch(async () => {
    await page.getByText(name, { exact: true }).last().click();
  });
  await page.waitForTimeout(250);
}

async function abgleich(page) {
  await page.goto(`${APP}/sync`);
  await page.getByTestId('jetzt-abgleichen').click();
  await page.getByTestId('toast').filter({ hasText: 'Abgleich fertig' }).waitFor({ timeout: 30000 });
  const t = await page.getByTestId('toast').innerText();
  await page.waitForTimeout(300);
  return t;
}

function bericht() {
  const fehler = ergebnisse.filter((e) => !e.ok);
  console.log(`\n${ergebnisse.length - fehler.length} von ${ergebnisse.length} Schritten in Ordnung`);
  for (const f of fehler) console.log(`  ✗ ${f.name}: ${f.fehler}`);
  return fehler.length;
}

module.exports = { APP, GRAPH, schritt, erwarte, gleich, zustand, neuerKontext, waehleDateien, ladeHerunter, erfasse, abgleich, bericht, ergebnisse, v, reiter, ohneSymbole };
