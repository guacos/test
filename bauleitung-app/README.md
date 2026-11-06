# Smart App Bauleitung

Begleit-App für die Bauleitung (Schlüsselfertigbau/TGA). Eine Codebasis für
**Android-Handy** und **Browser am Mac**. Alle Daten liegen zuerst auf dem Gerät
(offline nutzbar) und werden später mit deinem OneDrive abgeglichen.

Stand: **Phase 1 – Schritt 2 von 6** (Schnellerfassung).

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Grundgerüst, lokaler Speicher, Projekte | ✅ fertig |
| 2 | Schnellerfassung (Plus-Button, kw/jf, Wochentag, Diktat, Foto, KI-Backend) | ✅ fertig |
| 3 | Wochen-Board | offen |
| 4 | Fotodokumentation | offen |
| 5 | Jour Fixe mit PDF | offen |
| 6 | OneDrive-Sync | offen |

---

## Was du selbst erledigen musst

### A. Node.js installieren (am Mac, einmalig)
1. Auf <https://nodejs.org> die Version „LTS“ herunterladen und installieren.
2. Programm **Terminal** öffnen und prüfen: `node -v` muss eine Versionsnummer zeigen.

### B. App aufs Android-Handy bringen (APK)
Die App braucht eigene Bausteine (Kamera, Diktat, Datenbank). Deshalb geht es nicht mit
„Expo Go“, sondern mit einer eigenen Installationsdatei (APK). Gebaut wird sie kostenlos in der
Cloud von Expo.

1. Auf <https://expo.dev> ein kostenloses Konto anlegen.
2. Im Terminal, im Ordner `bauleitung-app`:
   ```bash
   npm install
   npx eas-cli@latest login            # mit dem Expo-Konto anmelden
   npx eas-cli@latest build -p android --profile preview
   ```
   Beim ersten Mal fragt das Programm, ob es ein Projekt und einen Signierschlüssel anlegen soll → jeweils **Ja**.
3. Nach ca. 10–20 Minuten erscheint ein Link bzw. QR-Code. Auf dem Handy öffnen, APK herunterladen
   und installieren („Installation aus unbekannten Quellen“ für den Browser einmalig erlauben).
4. Neue Version später: Schritt 2 wiederholen und die neue APK drüber installieren. Die Daten bleiben erhalten.

Hinweis: Der Paketname der App ist `de.bauleitung.app` (in `app.json`). Willst du einen anderen,
ändere ihn **vor** dem ersten Build.

### C. Diktat offline einrichten (Android 16, einmalig)
Das Diktat läuft nur **auf dem Handy** (keine Audiodaten an Google). Dafür braucht das Handy das
deutsche Offline-Sprachpaket. Fehlt es, zeigt die App beim Tippen auf „Diktat“ einen Knopf
„Deutsches Offline-Sprachpaket laden“. Falls das nicht klappt: Android-Einstellungen → System →
Sprachen → Spracherkennung (bzw. „Offline-Spracherkennung“) → Deutsch herunterladen.
Die genaue Menübezeichnung hängt vom Hersteller ab.

### D. KI-Backend einrichten (nur nötig, wenn du in einem Projekt „KI erlaubt“ einschaltest)
Ohne diesen Schritt funktioniert die App vollständig – nur ohne Ausformulierung durch die KI.

1. **Claude-API-Schlüssel:** Auf <https://platform.claude.com> ein Konto anlegen, Zahlungsmittel
   hinterlegen, unter „API Keys“ einen Schlüssel erzeugen (beginnt mit `sk-ant-`). Nicht weitergeben,
   nicht in die App eintragen.
   Bitte lies dort selbst nach, wie Anthropic mit API-Daten umgeht (Datenschutz/Aufbewahrung) – das
   kann ich nicht verbindlich für dich beurteilen.
2. **Cloudflare-Konto:** Auf <https://dash.cloudflare.com> kostenlos registrieren.
3. **Backend hochladen** – im Terminal, im Ordner `bauleitung-app/backend`:
   ```bash
   npm install
   npx wrangler login                        # Browser öffnet sich, bei Cloudflare bestätigen
   npx wrangler secret put ANTHROPIC_API_KEY # Claude-Schlüssel einfügen
   npx wrangler secret put APP_SCHLUESSEL    # selbst ausdenken: langes Passwort, z. B. 30 zufällige Zeichen
   npm run deploy
   ```
   Am Ende steht die Adresse da, z. B. `https://bauleitung-ki.<dein-name>.workers.dev`.
4. **In der App:** Reiter „Mehr“ → „KI-Backend“ → Adresse und App-Schlüssel eintragen → speichern.
   Am Mac im Browser genauso. Für die Web-Version zusätzlich in `backend/wrangler.toml` bei
   `ERLAUBTE_URSPRUENGE` die Web-Adresse eintragen und `npm run deploy` wiederholen.
5. **Modell ändern:** in `backend/wrangler.toml` die Zeile `CLAUDE_MODELL` anpassen, dann `npm run deploy`.
   Voreingestellt ist `claude-opus-5-5`. Lehnt die KI eine Anfrage aus Sicherheitsgründen ab, wird
   automatisch ein anderes Claude-Modell von Anthropic versucht („fallbacks“) – die Daten bleiben bei Anthropic.

Was an die KI geht: nur der Kurztext (ohne „kw40“/„jf“) und ob ein Foto dabei ist. Keine
Projekt-Nr., kein Projektname, kein Bauherr. Das Backend speichert und protokolliert nichts.

### Folgt in späteren Schritten
- **Microsoft-App-Registrierung** (für die OneDrive-Anmeldung) → Anleitung kommt in Schritt 6.

---

## So testest du Schritt 2

1. Plus-Knopf → `kw40 Estrich 1.OG` → **Erfassen**. Anzeige: „→ KW 40 · Bauleitung / Nachunternehmer“.
   Im Board erscheint der Reiter **KW 40** mit dem Eintrag.
2. `Donnerstag Lieferung Trockenbau` → landet in der aktuellen KW, Markierung „Donnerstag“.
   Gegenprobe: `Montage Trockenbau` bekommt **keinen** Montag.
3. `jf Brandschutz Schotts klären` → „Jour Fixe Nr. 1 (Entwurf)“. Reiter Jour Fixe zeigt den Punkt.
4. Nach einer Erfassung **Rückgängig** → Eintrag ist weg. **Bearbeiten** → Titel, KW, Wochentag, Rubrik ändern.
5. Android: **Foto** antippen, aufnehmen, ohne Text erfassen → „Foto · KW …“. Mit Text → Board-Eintrag mit Foto.
6. Android: **Diktat** antippen, sprechen → Text erscheint im Feld.
7. Offline-Test: Flugmodus an → Schritte 1–3 gehen genauso.
8. Mit KI (nach Teil D): Projekt → „KI erlaubt“ an → Kurztext erfassen → ausformulierter Titel.
   Im Flugmodus erfasst → „KI nicht erreichbar … wird nachgeholt“; nach Rückkehr des Netzes wird
   der Eintrag ausformuliert. Was du inzwischen selbst geändert hast, bleibt.

## App am Mac im Browser starten (zum Ausprobieren)

Im Terminal, im Ordner `bauleitung-app`:

```bash
npm install        # einmalig, lädt die Bibliotheken
npm run web        # startet die App, danach im Browser http://localhost:8081 öffnen
```

Die Daten werden im Browser gespeichert (IndexedDB). Sie bleiben erhalten, auch
ohne Internet. Achtung: „Browserdaten löschen“ löscht auch die App-Daten, solange
der OneDrive-Abgleich (Schritt 6) noch fehlt.

## Tests

```bash
npm test           # prüft die Kernlogik (KW, kw/jf, Wochentag, Zuordnung, Foto-KW, Übernahme, Erfassung)
npm run typecheck  # prüft den Code auf Tippfehler
cd backend && npm install && npm test   # prüft das KI-Backend (ohne echte KI-Aufrufe)
```

---

## Aufbau (für Entwickler)

```
src/app/        Screens (expo-router). (tabs) = Board, Fotos, Jour Fixe, Mehr
src/domain/     reine Logik ohne Oberfläche, mit Tests (__tests__)
src/data/       lokaler Speicher: store.ts (Android, SQLite), store.web.ts (Browser, IndexedDB)
src/state/      App-Zustand (zustand)
src/dienste/    Abläufe: Schnellerfassung, KI nachholen
src/foto/       Kamera/Galerie, Verkleinern (2048 px, JPEG 80 %), Bildspeicher, EXIF
src/ki/         Verbindung zum eigenen KI-Backend
src/ui/         Bausteine: große Knöpfe, Felder, Plus-Button, Diktat, Farben
backend/        KI-Backend (Cloudflare Worker, Hono, Anthropic SDK)
```

- Jeder Datensatz hat `id`, `erstelltVon/-Am`, `geaendertVon/-Am`, `version`, `geloescht`.
  Gelöscht wird nur durch Markieren, damit das Löschen später synchronisiert werden kann.
- Jede Änderung wird lokal als „noch nicht abgeglichen“ (`dirty`) markiert. Der
  OneDrive-Abgleich in Schritt 6 lädt genau diese Datensätze hoch.
- Neue Projekte haben **KI aus**. Ist die KI aus, verlässt nichts das Gerät und dein OneDrive.
