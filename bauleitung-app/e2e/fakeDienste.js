/**
 * Hilfsdienste für die Ende-zu-Ende-Prüfung im Browser:
 *  - liefert die gebaute Web-App aus (Port 8099)
 *  - simuliertes KI-Backend (Port 8788)
 *  - simulierter Wetterdienst (Port 8791)
 *  - simulierter Microsoft Graph (Port 8790)
 * Start: node e2e/fakeDienste.js <ordner-der-web-app>
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { erstelleFakeGraph } = require('./fakeGraph');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

// --- Web-App ---
const wurzel = path.resolve(process.argv[2] || 'dist-test');
const TYPEN = { '.js': 'application/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json', '.wasm': 'application/wasm' };
http
  .createServer((q, r) => {
    let p = path.join(wurzel, decodeURIComponent(q.url.split('?')[0]));
    if (!p.startsWith(wurzel) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(wurzel, 'index.html');
    r.writeHead(200, { 'content-type': TYPEN[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(r);
  })
  .listen(8099);

// --- KI-Backend ---
let kiOnline = true;
const kiAnfragen = [];
http
  .createServer((q, r) => {
    const kopf = { ...CORS, 'Content-Type': 'application/json' };
    if (q.url === '/__schalter') {
      kiOnline = !kiOnline;
      r.writeHead(200, kopf);
      return r.end(JSON.stringify({ online: kiOnline }));
    }
    if (q.url === '/__anfragen') {
      r.writeHead(200, kopf);
      return r.end(JSON.stringify(kiAnfragen));
    }
    if (q.method === 'OPTIONS') {
      r.writeHead(204, kopf);
      return r.end();
    }
    if (q.headers.authorization !== 'Bearer geheim') {
      r.writeHead(401, kopf);
      return r.end('{"fehler":"Nicht berechtigt"}');
    }
    if (!kiOnline) {
      r.writeHead(502, kopf);
      return r.end('{"fehler":"KI nicht erreichbar"}');
    }
    let b = '';
    q.on('data', (d) => (b += d));
    q.on('end', () => {
      const body = JSON.parse(b);
      // festhalten, WAS die App an die KI schickt (für die Vertraulichkeits-Prüfung)
      kiAnfragen.push({ pfad: q.url, schluessel: Object.keys(body), text: body.text, frage: body.frage, dokumente: body.dokumente ? body.dokumente.map((d) => d.name) : undefined, pdfKopf: body.dokumente ? Buffer.from(body.dokumente[0].pdf.slice(0, 8), 'base64').toString() : undefined, bildZeichen: body.bild ? body.bild.length : 0 });
      const text = body.text || '';
      const board = { bereich: 'bauleitung', rubrik: /liefer/i.test(text) ? 'Lieferungen' : 'Nachunternehmer', titel: `KI: ${text}`.slice(0, 60), beschreibung: `Ausformulierter Satz zu „${text}“.`, checkpunkte: ['Zuwegung prüfen', 'Lagerfläche definieren'], wochentag: null };
      const jourfixe = { thema: `KI-Thema: ${text}`.slice(0, 60), beschreibung: `Sachlicher Satz zu „${text}“.` };
      r.writeHead(200, kopf);
      if (q.url === '/v1/erfassung') r.end(JSON.stringify({ ziel: 'board', board, jourfixe }));
      else if (q.url === '/v1/board') r.end(JSON.stringify(board));
      else if (q.url === '/v1/jourfixe') r.end(JSON.stringify(jourfixe));
      else if (q.url === '/v1/foto') r.end(JSON.stringify({ gewerk: body.gewerke.includes('Elektro') ? 'Elektro' : body.gewerke[0], art: 'Übersicht' }));
      else if (q.url === '/v1/lieferschein') r.end(JSON.stringify({ lieferant: 'Baustoff Nord GmbH', datum: '2026-11-04', nummer: 'LS-4711', material: 'GK-Platten 12,5 mm', menge: '120 Stück' }));
      else if (q.url === '/v1/frage') {
        if (/stahltür/i.test(body.frage)) r.end(JSON.stringify({ gefunden: true, antwort: 'In der Halle sind 12 Stahltüren T30 vorgesehen.', quellen: [{ dokument: body.dokumente[0].name, seiteVon: 2, seiteBis: 2, zitat: 'Stahltür T30, Halle: 12 Stück' }] }));
        else r.end(JSON.stringify({ gefunden: false, antwort: 'Weiß ich nicht – nicht in den Unterlagen gefunden.', quellen: [] }));
      } else r.end('{}');
    });
  })
  .listen(8788);

// --- Wetter ---
const wetterAnfragen = [];
http
  .createServer((q, r) => {
    const url = new URL(q.url, 'http://x');
    if (url.pathname === '/__anfragen') {
      r.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
      return r.end(JSON.stringify(wetterAnfragen));
    }
    wetterAnfragen.push(q.url);
    const datum = url.searchParams.get('date');
    const weather = [7, 10, 13, 16].map((h, i) => ({
      timestamp: `${datum}T${String(h).padStart(2, '0')}:00:00+01:00`,
      temperature: [4.2, 6.5, 9.1, 7.0][i],
      precipitation: [0, 0.4, 1.8, 1.0][i],
      wind_speed: 14,
      wind_gust_speed: [20, 28, 35, 31][i],
      condition: i === 0 ? 'dry' : 'rain',
    }));
    r.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    r.end(JSON.stringify({ weather }));
  })
  .listen(8791);

// --- Microsoft Graph ---
const graph = erstelleFakeGraph();
graph.starte(8790).then(() => console.log('Dienste laufen: App 8099, KI 8788, Graph 8790, Wetter 8791'));
