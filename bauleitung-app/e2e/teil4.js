/** Teil 4: echte (nicht-Test-)Version – Start ohne Anmeldung und Aufbau der Microsoft-Anmeldung. */
const { chromium } = require('playwright');
const path = require('path');
const h = require('./hilfe');
const AUS = process.argv[2];

(async () => {
  const browser = await chromium.launch();
  const { ctx, page, fehler } = await h.neuerKontext(browser);
  await ctx.addInitScript(() => {
    window.__geoeffnet = [];
    window.open = (url) => {
      window.__geoeffnet.push(String(url));
      return { closed: false, close() {}, focus() {}, location: {} };
    };
  });

  await h.schritt('Ohne Anmeldung: App startet, Projekt anlegen, alles bleibt lokal', async () => {
    await page.goto(h.APP);
    await page.getByTestId('erstes-projekt').click();
    await page.getByTestId('feld-nr').fill('1');
    await page.getByTestId('feld-name').fill('Testprojekt');
    await page.getByTestId('projekt-speichern').click();
    await h.v(page, 'plus-knopf').waitFor();
    await h.erfasse(page, 'kw40 Estrich 1.OG');
    h.erwarte((await page.locator('body').innerText()).includes('OneDrive nicht verbunden'), 'Hinweis: nicht verbunden');
  });

  await h.schritt('Microsoft-Anmeldung: ohne Anwendungs-ID klare Meldung; mit ID korrekter Aufruf (PKCE, Rechte, Rücksprung-Adresse)', async () => {
    await page.goto(`${h.APP}/sync`);
    h.erwarte((await h.v(page, 'sync-status').innerText()) === 'Nicht verbunden', 'Status');
    h.erwarte((await page.locator('body').innerText()).includes('http://localhost:8099/auth'), 'Rücksprung-Adresse wird angezeigt');
    await h.v(page, 'anmelden').click();
    await page.getByTestId('toast').filter({ hasText: 'Bitte zuerst die Anwendungs-ID eintragen' }).waitFor();
    await h.v(page, 'feld-client-id').fill('11111111-2222-3333-4444-555555555555');
    await h.v(page, 'schalter-outlook').click();
    await h.v(page, 'anmelden').click();
    await page.waitForFunction(() => window.__geoeffnet.length > 0, null, { timeout: 15000 });
    const url = new URL(await page.evaluate(() => window.__geoeffnet[0]));
    h.erwarte(url.origin + url.pathname === 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', url.origin + url.pathname);
    const p = url.searchParams;
    h.erwarte(p.get('client_id') === '11111111-2222-3333-4444-555555555555', 'client_id');
    h.erwarte(p.get('response_type') === 'code' && p.get('code_challenge_method') === 'S256' && (p.get('code_challenge') || '').length > 20, 'PKCE');
    h.erwarte(p.get('redirect_uri') === 'http://localhost:8099/auth', `redirect_uri ${p.get('redirect_uri')}`);
    const scopes = (p.get('scope') || '').split(' ');
    for (const s of ['offline_access', 'User.Read', 'Files.ReadWrite.All', 'Mail.Send', 'Calendars.ReadWrite']) h.erwarte(scopes.includes(s), `Recht ${s} angefragt (${p.get('scope')})`);
    h.erwarte(!url.search.includes('client_secret'), 'kein Geheimnis in der App');
  });

  await h.schritt('Rücksprung-Seite /auth ist vorhanden', async () => {
    await page.goto(`${h.APP}/auth`);
    await page.getByText('Anmeldung wird abgeschlossen').waitFor();
  });

  await page.goto(`${h.APP}/sync`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(AUS, 'e-konto.png'), fullPage: true });
  if (fehler.length) console.log('Konsolenfehler:', fehler);
  const n = h.bericht();
  await browser.close();
  process.exit(n ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
