/**
 * Simulierter Microsoft-Graph-Server für automatische Tests (OneDrive, Outlook).
 * Bildet nur das nach, was die App benutzt – nach bestem Wissen über das Verhalten von
 * Microsoft Graph. Ein Test gegen diesen Server ersetzt NICHT den Test mit einem echten Konto.
 *
 * Konten: "Authorization: Bearer test-<konto>" → eigenes Laufwerk je Konto.
 * Start:  node e2e/fakeGraph.js [port]
 */
const http = require('http');

function erstelleFakeGraph(opt = {}) {
  const seitenGroesse = opt.seitenGroesse || 200;
  let nr = 0;
  const z = { laufwerke: new Map(), proId: new Map(), links: new Map(), nurLesen: new Set(), mails: [], termine: [], anfragen: 0, stoerung: 0 };

  function knoten(name, daten, eltern, drive) {
    const k = { id: `ID${++nr}`, name, eTag: `"{E${nr}},1"`, daten, kinder: new Map(), eltern, drive, typ: null, remote: null };
    z.proId.set(k.id, k);
    return k;
  }
  function wurzel(drive) {
    if (!z.laufwerke.has(drive)) z.laufwerke.set(drive, knoten('root', null, null, drive));
    return z.laufwerke.get(drive);
  }
  const neuesETag = (k) => (k.eTag = `"{E${++nr}},${nr}"`);
  function finde(start, pfad) {
    let k = start;
    for (const t of pfad.split('/').filter(Boolean)) {
      k = k.kinder.get(decodeURIComponent(t).toLowerCase());
      if (!k) return null;
    }
    return k;
  }
  function pfadVon(k) {
    const t = [];
    for (let x = k; x && x.eltern; x = x.eltern) t.unshift(x.name);
    return t.join('/');
  }
  function item(k) {
    const i = { id: k.id, name: k.name, eTag: k.eTag, parentReference: { driveId: k.drive, id: k.eltern ? k.eltern.id : undefined } };
    if (k.remote) i.remoteItem = { id: k.remote.itemId, folder: {}, parentReference: { driveId: k.remote.driveId } };
    else if (k.daten === null) i.folder = { childCount: k.kinder.size };
    else {
      i.file = { mimeType: k.typ || 'application/octet-stream' };
      i.size = k.daten.length;
    }
    return i;
  }
  const fehler = (res, status, code, message) => sende(res, status, { error: { code, message } });
  function sende(res, status, body, typ = 'application/json') {
    const daten = body === undefined ? '' : Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, { ...CORS, 'Content-Type': typ });
    res.end(daten);
  }
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'Retry-After',
  };

  /** Zerlegt eine Laufwerks-Adresse in Startknoten, Pfad und Anhang. */
  function adresse(pfad, konto) {
    let m;
    let start;
    let rest;
    if ((m = /^\/me\/drive\/root(.*)$/.exec(pfad))) {
      start = wurzel(konto);
      rest = m[1];
    } else if ((m = /^\/me\/drive\/items\/([^/:]+)(.*)$/.exec(pfad))) {
      start = z.proId.get(decodeURIComponent(m[1]));
      rest = m[2];
      if (start && start.drive !== konto) start = null;
    } else if ((m = /^\/drives\/([^/]+)\/items\/([^/:]+)(.*)$/.exec(pfad))) {
      start = z.proId.get(decodeURIComponent(m[2]));
      rest = m[3];
      if (start && start.drive !== decodeURIComponent(m[1])) start = null;
    } else return null;
    let unter = '';
    let anhang = rest;
    if ((m = /^:\/(.*?):(\/.*)?$/.exec(rest)) || (m = /^:\/(.*)$/.exec(rest))) {
      unter = m[1];
      anhang = m[2] || '';
    }
    return { start, unter, anhang };
  }

  function nurLesenFuer(k, konto) {
    for (let x = k; x; x = x.eltern) if (x.drive !== konto && z.nurLesen.has(x.id)) return true;
    return false;
  }
  function darfLesen(k, konto) {
    if (k.drive === konto) return true;
    for (let x = k; x; x = x.eltern) if ([...z.links.values()].some((l) => l.itemId === x.id)) return true;
    return false;
  }

  function behandle(req, res, body) {
    z.anfragen++;
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return sende(res, 204);

    // ----- Steuerung für Tests -----
    if (url.pathname === '/__zustand') {
      const laufwerke = {};
      for (const [name, w] of z.laufwerke) {
        const dateien = {};
        const ordner = [];
        (function lauf(k) {
          for (const kind of k.kinder.values()) {
            if (kind.daten === null) {
              ordner.push(pfadVon(kind));
              lauf(kind);
            } else dateien[pfadVon(kind)] = kind.daten.length;
          }
        })(w);
        laufwerke[name] = { dateien, ordner };
      }
      return sende(res, 200, { laufwerke, mails: z.mails, termine: z.termine, anfragen: z.anfragen });
    }
    if (url.pathname === '/__datei') {
      const k = finde(wurzel(url.searchParams.get('konto')), url.searchParams.get('pfad'));
      return k && k.daten ? sende(res, 200, k.daten, k.typ || 'application/octet-stream') : fehler(res, 404, 'itemNotFound', 'nicht gefunden');
    }
    if (url.pathname === '/__teile') {
      const p = JSON.parse(body.toString() || '{}');
      const k = finde(wurzel(p.konto), p.pfad);
      if (!k) return fehler(res, 404, 'itemNotFound', 'nicht gefunden');
      const link = `https://1drv.ms/f/s!${k.id}`;
      z.links.set(link, { driveId: p.konto, itemId: k.id });
      if (p.nurLesen) z.nurLesen.add(k.id);
      return sende(res, 200, { link });
    }
    if (url.pathname === '/__stoerung') {
      z.stoerung = Number(url.searchParams.get('anzahl') || 0);
      return sende(res, 200, {});
    }

    if (!url.pathname.startsWith('/v1.0/')) return fehler(res, 404, 'notFound', 'unbekannt');
    const auth = req.headers.authorization || '';
    const m = /^Bearer test-(.+)$/.exec(auth);
    if (!m) return fehler(res, 401, 'InvalidAuthenticationToken', 'Access token is empty.');
    const konto = m[1];
    if (z.stoerung > 0) {
      z.stoerung--;
      res.writeHead(503, { ...CORS, 'Retry-After': '0' });
      return res.end('{}');
    }
    const pfad = url.pathname.slice('/v1.0'.length);

    if (pfad === '/me' && req.method === 'GET') {
      return sende(res, 200, { displayName: konto.charAt(0).toUpperCase() + konto.slice(1), mail: `${konto}@example.com`, userPrincipalName: `${konto}@example.com` });
    }
    if (pfad === '/me/sendMail' && req.method === 'POST') {
      const mail = JSON.parse(body.toString());
      if (!mail.message || !mail.message.toRecipients || !mail.message.toRecipients.length) return fehler(res, 400, 'ErrorInvalidRecipients', 'At least one recipient is required.');
      z.mails.push({
        von: konto,
        an: mail.message.toRecipients.map((r) => r.emailAddress.address),
        betreff: mail.message.subject,
        text: mail.message.body.content,
        anhaenge: (mail.message.attachments || []).map((a) => ({ name: a.name, typ: a.contentType, bytes: Buffer.from(a.contentBytes, 'base64').length, kopf: Buffer.from(a.contentBytes, 'base64').subarray(0, 5).toString() })),
      });
      return sende(res, 202);
    }
    if (pfad === '/me/events' && req.method === 'POST') {
      const t = JSON.parse(body.toString());
      z.termine.push({ von: konto, betreff: t.subject, start: t.start, ende: t.end, ort: t.location && t.location.displayName, teilnehmer: (t.attendees || []).map((a) => a.emailAddress.address) });
      return sende(res, 201, { id: `EV${++nr}`, subject: t.subject });
    }
    let sm;
    if ((sm = /^\/shares\/([^/]+)\/driveItem$/.exec(pfad)) && req.method === 'GET') {
      let link;
      try {
        link = Buffer.from(sm[1].replace(/^u!/, '').replace(/_/g, '/').replace(/-/g, '+'), 'base64').toString();
      } catch {
        return fehler(res, 400, 'invalidRequest', 'ungültige Freigabe-Kennung');
      }
      const ref = z.links.get(link);
      if (!ref) return fehler(res, 404, 'itemNotFound', 'The sharing link no longer exists, or you do not have permission to access it.');
      return sende(res, 200, item(z.proId.get(ref.itemId)));
    }

    const a = adresse(pfad, konto);
    if (!a) return fehler(res, 400, 'invalidRequest', `unbekannte Adresse ${pfad}`);
    if (!a.start) return fehler(res, 404, 'itemNotFound', 'Item not found');
    if (!darfLesen(a.start, konto)) return fehler(res, 403, 'accessDenied', 'Access denied');
    const ziel = finde(a.start, a.unter);
    const schreibschutz = () => nurLesenFuer(ziel || a.start, konto);

    // Metadaten
    if (a.anhang === '' && req.method === 'GET') return ziel ? sende(res, 200, item(ziel)) : fehler(res, 404, 'itemNotFound', 'Item not found');

    // Ordnerinhalt (mit Seiten)
    if (a.anhang === '/children' && req.method === 'GET') {
      if (!ziel || ziel.daten !== null) return fehler(res, 404, 'itemNotFound', 'Item not found');
      const alle = [...ziel.kinder.values()];
      const ab = Number(url.searchParams.get('$skiptoken') || 0);
      const top = Math.min(Number(url.searchParams.get('$top') || 200), seitenGroesse);
      const seite = { value: alle.slice(ab, ab + top).map(item) };
      if (ab + top < alle.length) {
        const weiter = new URL(url);
        weiter.searchParams.set('$skiptoken', String(ab + top));
        seite['@odata.nextLink'] = `http://${req.headers.host}${weiter.pathname}${weiter.search}`;
      }
      return sende(res, 200, seite);
    }

    // Ordner anlegen
    if (a.anhang === '/children' && req.method === 'POST') {
      if (!ziel || ziel.daten !== null) return fehler(res, 404, 'itemNotFound', 'Item not found');
      if (schreibschutz()) return fehler(res, 403, 'accessDenied', 'Access denied');
      const p = JSON.parse(body.toString());
      if (ziel.kinder.has(p.name.toLowerCase())) return fehler(res, 409, 'nameAlreadyExists', 'Name already exists');
      const neu = knoten(p.name, null, ziel, ziel.drive);
      ziel.kinder.set(p.name.toLowerCase(), neu);
      return sende(res, 201, item(neu));
    }

    // Inhalt laden
    if (a.anhang === '/content' && req.method === 'GET') {
      return ziel && ziel.daten ? sende(res, 200, ziel.daten, ziel.typ || 'application/octet-stream') : fehler(res, 404, 'itemNotFound', 'Item not found');
    }

    // Inhalt schreiben
    if (a.anhang === '/content' && req.method === 'PUT') {
      if (schreibschutz()) return fehler(res, 403, 'accessDenied', 'Access denied');
      const ifMatch = req.headers['if-match'];
      const verhalten = url.searchParams.get('@microsoft.graph.conflictBehavior') || 'replace';
      if (ziel) {
        if (ziel.daten === null) return fehler(res, 409, 'nameAlreadyExists', 'Ein Ordner mit diesem Namen existiert');
        if (verhalten === 'fail') return fehler(res, 409, 'nameAlreadyExists', 'Name already exists');
        if (ifMatch && ifMatch !== ziel.eTag) return fehler(res, 412, 'resourceModified', 'ETag does not match current item');
        ziel.daten = body;
        ziel.typ = req.headers['content-type'];
        neuesETag(ziel);
        return sende(res, 200, item(ziel));
      }
      if (ifMatch) return fehler(res, 412, 'resourceModified', 'Item does not exist');
      const teile = a.unter.split('/').filter(Boolean).map(decodeURIComponent);
      const name = teile.pop();
      let eltern = a.start;
      for (const t of teile) {
        let n = eltern.kinder.get(t.toLowerCase());
        if (!n) {
          n = knoten(t, null, eltern, eltern.drive);
          eltern.kinder.set(t.toLowerCase(), n);
        }
        eltern = n;
      }
      const neu = knoten(name, body, eltern, eltern.drive);
      neu.typ = req.headers['content-type'];
      eltern.kinder.set(name.toLowerCase(), neu);
      return sende(res, 201, item(neu));
    }

    // Umbenennen / Verschieben
    if (a.anhang === '' && req.method === 'PATCH') {
      if (!ziel || !ziel.eltern) return fehler(res, 404, 'itemNotFound', 'Item not found');
      if (schreibschutz()) return fehler(res, 403, 'accessDenied', 'Access denied');
      const p = JSON.parse(body.toString());
      const neuEltern = p.parentReference && p.parentReference.id ? z.proId.get(p.parentReference.id) : ziel.eltern;
      const name = p.name || ziel.name;
      if (!neuEltern) return fehler(res, 404, 'itemNotFound', 'Zielordner nicht gefunden');
      const belegt = neuEltern.kinder.get(name.toLowerCase());
      if (belegt && belegt !== ziel) return fehler(res, 409, 'nameAlreadyExists', 'Name already exists');
      ziel.eltern.kinder.delete(ziel.name.toLowerCase());
      ziel.name = name;
      ziel.eltern = neuEltern;
      neuEltern.kinder.set(name.toLowerCase(), ziel);
      neuesETag(ziel);
      return sende(res, 200, item(ziel));
    }

    // Löschen
    if (a.anhang === '' && req.method === 'DELETE') {
      if (!ziel || !ziel.eltern) return fehler(res, 404, 'itemNotFound', 'Item not found');
      if (schreibschutz()) return fehler(res, 403, 'accessDenied', 'Access denied');
      ziel.eltern.kinder.delete(ziel.name.toLowerCase());
      return sende(res, 204);
    }

    return fehler(res, 400, 'invalidRequest', `nicht unterstützt: ${req.method} ${pfad}`);
  }

  const server = http.createServer((req, res) => {
    const teile = [];
    req.on('data', (d) => teile.push(d));
    req.on('end', () => {
      try {
        behandle(req, res, Buffer.concat(teile));
      } catch (e) {
        fehler(res, 500, 'generalException', String(e && e.stack ? e.stack : e));
      }
    });
  });

  return {
    server,
    zustand: z,
    /** Verknüpfung auf einen geteilten Ordner in "Meine Dateien" eines Kontos legen */
    verknuepfe(konto, link, name) {
      const ref = z.links.get(link);
      const w = wurzel(konto);
      const k = knoten(name, null, w, konto);
      k.remote = ref;
      w.kinder.set(name.toLowerCase(), k);
    },
    teile(konto, pfad, nurLesen) {
      const k = finde(wurzel(konto), pfad);
      const link = `https://1drv.ms/f/s!${k.id}`;
      z.links.set(link, { driveId: konto, itemId: k.id });
      if (nurLesen) z.nurLesen.add(k.id);
      return link;
    },
    pfade(konto) {
      const r = [];
      (function lauf(k) {
        for (const kind of k.kinder.values()) {
          if (kind.daten === null) lauf(kind);
          else r.push(pfadVon(kind));
        }
      })(wurzel(konto));
      return r.sort();
    },
    text(konto, pfad) {
      const k = finde(wurzel(konto), pfad);
      return k && k.daten ? k.daten.toString() : null;
    },
    starte(port = 0) {
      return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server.address().port)));
    },
    stoppe() {
      return new Promise((ok) => server.close(() => ok()));
    },
  };
}

module.exports = { erstelleFakeGraph };

if (require.main === module) {
  const port = Number(process.argv[2] || 8790);
  erstelleFakeGraph()
    .starte(port)
    .then((p) => console.log(`Fake-Graph läuft auf http://127.0.0.1:${p}/v1.0`));
}
