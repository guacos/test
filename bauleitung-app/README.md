# Smart App Bauleitung

Begleit-App für die Bauleitung (Schlüsselfertigbau/TGA). **Eine** Codebasis für das
**Android-Handy** und den **Browser am Mac**. Alle Daten liegen zuerst auf dem Gerät
(ohne Netz voll nutzbar) und werden mit deinem **privaten OneDrive** abgeglichen.

## Was die App kann

| Bereich | Inhalt |
|---|---|
| **Start** | Kennzahlen (Einträge der Woche, offene Checkpunkte, Jour Fixe, Überfälliges, Mängel, Fotos ohne Tags), „Heute“, alle Bereiche |
| **Schnellerfassung** (Plus-Knopf überall) | Kurztext, Diktat (Android), Foto. `kw40 …` → KW 40, `jf …` → Jour Fixe, Wochentag wird markiert. Ergebnis mit „Rückgängig“ und „Bearbeiten“ |
| **Wochen-Board** | Reiter je ISO-KW, „Neue Woche“, Projektleitung/Bauleitung mit Rubriken, Checkpunkte abhaken/hinzufügen/löschen, Prüfkette, Foto, Notiz, Wochentag, „geliefert“ |
| **Fotos** | Kamera/Galerie (mehrere), KW aus EXIF → Dateiname → Unbekannt, Tags Gewerk/Art/Geschoss/frei, Mehrfachauswahl, kombinierbare Filter, Gruppierung KW → Gewerk, Suche auch über alle Projekte |
| **Jour Fixe** | Protokolle (neuestes oben) mit Zählern, fortlaufende Nr., Übernahme offener Punkte, Ergänzungen mit Datum, Farblogik blau/schwarz/rot, PDF, Versand per Outlook, nächster Termin im Kalender |
| **Bautagebuch** | je Tag: Wetter (automatisch oder von Hand), Firmen mit Plus/Minus-Zähler, Vorschlag vom letzten Eintrag, Notiz (Diktat), Fotos, PDF |
| **Mängel** | Foto, Firma, Frist, Ort, Stecknadel im Grundriss, Mängelliste je Firma als PDF |
| **Lieferscheine** | Foto, Angaben (mit KI: werden gelesen), Kurzprüfung, Verknüpfung mit geplanter Lieferung → im Board „geliefert“ |
| **Firmen** | Nachunternehmer mit Ansprechpartner, Telefon, E-Mail |
| **Suche** | alle Bereiche, nur auf dem Gerät, auch projektübergreifend |
| **OneDrive / Team** | Abgleich, Konflikt-Anzeige, geteilte Projekte über OneDrive-Freigaben |

**Noch nicht enthalten** (siehe unten „Offen“): KI-Assistent für Unterlagen, Plan-Viewer,
Vorlagen Behinderungsanzeige/Bedenkenanmeldung, Nachträge, Abnahmeprotokolle, Wochenbericht.

---

## Was du selbst erledigen musst

Reihenfolge: **A → B** reicht, um die App am Handy offline zu nutzen. **E** brauchst du für
OneDrive, **F** für den Mac, **D** nur für Projekte mit „KI erlaubt“.

### A. Node.js installieren (am Mac, einmalig)
1. Auf <https://nodejs.org> die Version „LTS“ herunterladen und installieren.
2. Programm **Terminal** öffnen und prüfen: `node -v` muss eine Versionsnummer zeigen.
3. Den Projektordner von GitHub laden und im Terminal in den Ordner `bauleitung-app` wechseln:
   ```bash
   cd bauleitung-app
   npm install
   ```

### B. App aufs Android-Handy bringen (APK)
Die App braucht eigene Bausteine (Kamera, Diktat, Datenbank). Deshalb geht es nicht mit
„Expo Go“, sondern mit einer eigenen Installationsdatei (APK). Gebaut wird sie kostenlos in
der Cloud von Expo.

1. Auf <https://expo.dev> ein kostenloses Konto anlegen.
2. Im Terminal, im Ordner `bauleitung-app`:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```
   Beim ersten Mal fragt das Programm, ob es ein Projekt und einen Signierschlüssel anlegen
   soll → jeweils **Ja**.
3. Nach ca. 10–20 Minuten erscheint ein Link bzw. QR-Code. Auf dem Handy öffnen, APK
   herunterladen und installieren („Installation aus unbekannten Quellen“ einmalig erlauben).
4. Neue Version später: Schritt 2 wiederholen und die neue APK drüber installieren. Die Daten bleiben erhalten.

Hinweis: Der Paketname der App ist `de.bauleitung.app` (in `app.json`). Willst du einen
anderen, ändere ihn **vor** dem ersten Build.

### C. Diktat offline einrichten (Android, einmalig)
Das Diktat läuft nur **auf dem Handy** (keine Audiodaten an Google). Dafür braucht das Handy
das deutsche Offline-Sprachpaket. Fehlt es, zeigt die App beim Tippen auf „Diktat“ einen
Knopf „Deutsches Offline-Sprachpaket laden“. Falls das nicht klappt: Android-Einstellungen →
System → Sprachen → Spracherkennung → Deutsch herunterladen (die Menüs heißen je nach
Hersteller etwas anders). Im Browser am Mac gibt es bewusst kein Diktat.

### D. KI-Backend einrichten (nur für Projekte mit „KI erlaubt“)
Ohne diesen Schritt funktioniert die App vollständig – nur ohne Ausformulierung, Foto-Vorschläge
und Lieferschein-Lesen durch die KI.

1. **Claude-API-Schlüssel:** Auf <https://platform.claude.com> ein Konto anlegen, Zahlungsmittel
   hinterlegen, unter „API Keys“ einen Schlüssel erzeugen (beginnt mit `sk-ant-`). Nicht
   weitergeben, nicht in die App eintragen. Bitte lies dort selbst nach, wie Anthropic mit
   API-Daten umgeht (Aufbewahrung) – das kann ich nicht verbindlich für dich beurteilen.
2. **Cloudflare-Konto:** Auf <https://dash.cloudflare.com> kostenlos registrieren.
3. **Backend hochladen** – im Terminal, im Ordner `bauleitung-app/backend`:
   ```bash
   npm install
   npx wrangler login                        # Browser öffnet sich, bei Cloudflare bestätigen
   npx wrangler secret put ANTHROPIC_API_KEY # Claude-Schlüssel einfügen
   npx wrangler secret put APP_SCHLUESSEL    # selbst ausdenken: langes Passwort, ca. 30 zufällige Zeichen
   npm run deploy
   ```
   Am Ende steht die Adresse da, z. B. `https://bauleitung-ki.<dein-name>.workers.dev`.
4. **In der App:** Mehr → Einstellungen → „KI-Backend“ → Adresse und App-Schlüssel eintragen.
   Am Mac genauso. Für die Web-Version zusätzlich in `backend/wrangler.toml` bei
   `ERLAUBTE_URSPRUENGE` die Web-Adresse eintragen (siehe F) und `npm run deploy` wiederholen.
5. **Modell ändern:** in `backend/wrangler.toml` die Zeile `CLAUDE_MODELL` anpassen, dann
   `npm run deploy`. Voreingestellt ist `claude-opus-5-5`. Lehnt das Modell eine Anfrage aus
   Sicherheitsgründen ab, wird automatisch ein anderes Claude-Modell von Anthropic versucht.

**Was an die KI geht** (nur bei „KI erlaubt“): der Kurztext ohne „kw40“/„jf“, bei Fotos und
Lieferscheinen ein auf 1024 px verkleinertes Bild ohne Aufnahmedaten, dazu die Gewerke-Liste.
**Nicht** übertragen werden Projekt-Nr., Projektname, Bauherr, Adresse. Das Backend speichert
und protokolliert nichts.

### E. Microsoft-App-Registrierung (für OneDrive und Outlook, einmalig)
Damit sich die App mit deinem Microsoft-Konto verbinden darf, braucht sie eine „Anwendungs-ID“.
Sie ist kein Passwort.

1. Öffne <https://entra.microsoft.com> und melde dich mit deinem privaten Microsoft-Konto an.
   Links: **Anwendungen → App-Registrierungen → Neue Registrierung**.
   *Kommt die Meldung, dass dafür ein „Verzeichnis“ nötig ist:* lege unter
   <https://azure.microsoft.com/free> ein kostenloses Azure-Konto mit demselben Microsoft-Konto
   an und wiederhole den Schritt. (Microsoft ändert diese Seiten öfter – die Bezeichnungen
   können leicht abweichen.)
2. Eintragen:
   - **Name:** `Bauleitung-App`
   - **Unterstützte Kontotypen:** „Konten in einem beliebigen Organisationsverzeichnis und
     persönliche Microsoft-Konten“
   - Umleitungs-URI vorerst leer lassen → **Registrieren**.
3. Links **Authentifizierung → Plattform hinzufügen**:
   - **Mobilgerät- und Desktopanwendungen** → benutzerdefinierte Umleitungs-URI:
     `bauleitung://auth`
   - **Single-Page-Anwendung** → `http://localhost:8081/auth` (für den Mac lokal). Wenn du die
     Web-Version später ins Internet stellst (F), hier zusätzlich `https://<deine-adresse>/auth`.
   Die App zeigt dir die passende Adresse unter Mehr → Microsoft-Konto an.
4. Links **API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph → Delegierte
   Berechtigungen**: `Files.ReadWrite.All`, `User.Read`, `offline_access`. Nur wenn du Outlook
   nutzen willst, zusätzlich `Mail.Send` und `Calendars.ReadWrite`.
5. Links **Übersicht**: die **Anwendungs-ID (Client)** kopieren.
6. **In der App:** Mehr → „Microsoft-Konto und Abgleich“ → Anwendungs-ID einfügen →
   optional „Outlook-Funktionen“ einschalten → **Mit Microsoft anmelden**. Beim ersten Mal
   fragt Microsoft, ob die App auf deine Dateien zugreifen darf → zustimmen.

Danach legt die App in deinem OneDrive den Ordner `Bauleitung-App` an und gleicht ab.

### F. Web-Version am Mac
**Einfach (lokal):** im Ordner `bauleitung-app`
```bash
npm run web
```
und im Browser <http://localhost:8081> öffnen. Dann dort mit Microsoft anmelden – die Daten
vom Handy erscheinen nach dem Abgleich.

**Bequemer (eigene Web-Adresse, kostenlos bei Cloudflare):**
```bash
npm run build:web
npx wrangler pages deploy dist --project-name bauleitung
```
Die angezeigte Adresse (z. B. `https://bauleitung.pages.dev`) als Lesezeichen speichern, in der
Microsoft-Registrierung `https://…/auth` als Single-Page-Umleitungs-URI ergänzen (E, Schritt 3)
und im KI-Backend unter `ERLAUBTE_URSPRUENGE` eintragen (D, Schritt 4).

Gut zu wissen: Im Browser hält Microsoft die Anmeldung nach meinem Kenntnisstand nur etwa
24 Stunden – am Mac meldest du dich also ungefähr täglich neu an. Am Handy bleibt die
Anmeldung bestehen. Die Web-Version braucht zum **Öffnen** Internet; die Daten liegen danach
im Browser.

### G. Team: Projekt mit Kollegen teilen
1. In OneDrive (Web oder App) den **Projektordner** `Bauleitung-App/{Nr}_{Name}` freigeben:
   „Bestimmte Personen“, Recht „Bearbeiten“ oder „Anzeigen“.
2. Der Kollege installiert die App, meldet sich mit **seinem** Microsoft-Konto an (dieselbe
   Anwendungs-ID) und fügt unter Mehr → „Microsoft-Konto und Abgleich“ → „Team“ den
   **Freigabe-Link** ein. Alternativ in OneDrive „Verknüpfung zu Meine Dateien hinzufügen“ –
   die App erkennt die Verknüpfung von selbst.
3. Rechte = OneDrive-Rechte. Wer nur „Anzeigen“ darf, sieht alles, seine eigenen Änderungen
   bleiben aber auf seinem Gerät (die App weist darauf hin).
4. Nachunternehmer, die nur Protokolle lesen sollen: nur den Unterordner `03_Protokolle`
   freigeben (lesend). Sie brauchen die App nicht – sie öffnen die PDFs.

**Wichtig:**
- **Firmen-Microsoft-Konten:** Nach meiner Recherche lässt sich ein privates OneDrive nicht an
  Firmenkonten freigeben. Kollegen brauchen ein (kostenloses) privates Microsoft-Konto. Das
  konnte ich nicht mit einem echten Firmenkonto testen.
- **Vertrauliche Unterlagen:** OneDrive vererbt Freigaben an Unterordner. Deshalb liegt
  `01_Unterlagen` **nicht** im Projektordner, sondern getrennt unter
  `Bauleitung-App/_Kernteam/{Projekt}/01_Unterlagen`.

### H. Wetter im Bautagebuch (optional)
Im Projekt „Wetter automatisch“ einschalten und den Standort eintragen (oder am Handy
„Aktuellen Standort übernehmen“). Die App holt dann für den heutigen Tag die Werte des
Deutschen Wetterdienstes über die offene Schnittstelle `api.brightsky.dev` (kein Konto nötig).
Übertragen werden nur Koordinaten und Datum. Die echte Schnittstelle war aus meiner
Entwicklungsumgebung nicht erreichbar – bitte beim ersten Einsatz prüfen, ob Werte ankommen;
sonst das Wetter von Hand eintragen.

---

## Ordner in deinem OneDrive

```
Bauleitung-App/
  _Einstellungen/einstellungen.json     Gewerke- und Geschoss-Liste
  _Kernteam/{Nr}_{Name}/01_Unterlagen/  Pläne, LV, Verträge – nicht mitgeteilt
  {Nr}_{Name}/
    02_Fotos/2026_KW45/                 2026-11-06_KW45_Trockenbau_Detail_1OG_001.jpg
    03_Protokolle/                      JF_001_2026-11-06.pdf, Anhaenge/ (Planausschnitte)
    04_Board/                           (für den späteren Wochenbericht)
    05_Maengel/{Firma}/                 Maengelliste_2026-11-10.pdf, _Grundrisse/
    06_Bautagebuch/                     Bautagebuch_2026-11-10.pdf
    07_Lieferscheine/2026_KW45/         2026-11-04_KW45_Lieferschein_001.jpg
    _daten/                             je Eintrag eine kleine Datei mit Ersteller und Änderungszeit
```
Die KW-Ordner tragen das Jahr, damit sich Projekte über den Jahreswechsel nicht mischen.
Ändern sich die Tags eines Fotos, benennt die App die Datei beim nächsten Abgleich um.

## So gleicht die App ab
- Jede Änderung wird sofort auf dem Gerät gespeichert und für OneDrive vorgemerkt.
- Abgleich: beim Start, wenn das Netz zurückkommt, alle paar Minuten bei offener App und per
  Knopf (Wolke oben rechts: grün = abgeglichen, gelb = wartet, rot = Konflikt).
- Ändern zwei Geräte **denselben** Eintrag gleichzeitig, wird nichts überschrieben. Der Eintrag
  erscheint unter „Konflikte“ mit beiden Versionen: meine behalten / andere übernehmen / beide behalten.
- Am zweiten Gerät werden Fotos erst geladen, wenn du sie ansiehst.

---

## So testest du (Kurzfassung)

1. **Offline erfassen:** Flugmodus an → Plus → `kw40 Estrich 1.OG` → „→ KW 40 · Bauleitung /
   Nachunternehmer“. Board → Reiter KW 40.
2. **Foto:** Fotos → „Aus Galerie“ (mehrere) → KW steht automatisch da → Gewerk und Art für alle
   wählen → Filter kombinieren.
3. **Jour Fixe:** Neues Protokoll → drei Punkte erfassen → bei einem eine Frist in der
   Vergangenheit setzen (wird rot, steht oben), einen abhaken → Neues Protokoll: nur die offenen
   Punkte sind da, schwarz mit „Offen seit Nr. 1“; Ergänzung anhängen (blau) → „PDF erzeugen“.
4. **OneDrive:** Flugmodus aus → Wolke antippen → „Jetzt abgleichen“ → in OneDrive nachsehen.
5. **Mac:** Web-Version öffnen, anmelden → dieselben Daten sehen und bearbeiten.

## Was geprüft ist – und was nicht

**Automatisch geprüft (bei jedem `npm test`):** 140 Tests der App (KW-Erkennung inkl.
Jahreswechsel, kw/jf/Wochentag, Stichwortzuordnung, Farblogik, Übernahme offener Punkte,
Foto-KW und Dateinamen, Filter/Suche, Abgleich mit zwei Geräten, Konflikte, Team-Freigaben,
PDF-Erzeugung, OneDrive- und Outlook-Zugriff gegen einen simulierten Microsoft-Server) und
12 Tests des KI-Backends.

**In der Oberfläche durchgeklickt (Browser, 52 Schritte, siehe `e2e/`):** alle Abläufe aller
Bereiche – mit **simuliertem** OneDrive/Outlook, KI- und Wetterdienst.

**Nicht geprüft, weil hier nicht möglich:**
- die App auf einem echten Android-Handy (Kamera, Diktat, Datums-Auswahl, Teilen-Dialog, PDF-Erzeugung auf dem Gerät),
- die Anmeldung und der Abgleich mit einem **echten** Microsoft-Konto,
- echte Antworten der Claude-API und des Wetterdienstes,
- Outlook-Versand mit einem Microsoft-Konto ohne Outlook-Postfach (z. B. Konto mit Gmail-Adresse) –
  falls das nicht geht: „PDF erzeugen“ und über den Teilen-Dialog senden.

Bitte gehe die Kurzfassung oben einmal am Handy durch und melde, was hakt.

## Offen (noch nicht gebaut)
- KI-Assistent für Unterlagen (Antwort nur mit Quelle) und Plan-Viewer offline
- Vorlagen für Behinderungsanzeige (VOB/B § 6) und Bedenkenanmeldung (VOB/B § 4 Abs. 3),
  Nachträge, Abnahmeprotokolle – dafür brauche ich deine Texte/Vorlagen, ich erfinde keine Rechtstexte
- Wochenbericht per Knopfdruck
- Grundrisse als PDF (derzeit als Bild), Abgleich im Hintergrund bei geschlossener App

---

## Für Entwickler

```bash
npm test                      # Kernlogik, Abgleich, PDF, Graph (Jest)
npm run typecheck             # TypeScript
cd backend && npm test        # KI-Backend (Vitest, ohne echte KI-Aufrufe)
```

Ende-zu-Ende-Prüfung im Browser (braucht Playwright):
```bash
EXPO_PUBLIC_GRAPH_URL=http://localhost:8790/v1.0 EXPO_PUBLIC_TEST_TOKEN=test-diego \
EXPO_PUBLIC_WETTER_URL=http://localhost:8791/wetter npx expo export --platform web --output-dir dist-test
node e2e/fakeDienste.js dist-test &          # App, simulierter Graph, KI, Wetter
node e2e/teil1.js <bilder-ordner> <ausgabe>  # ebenso teil2.js, teil3.js (Dienste vorher neu starten)
# teil4.js prüft die normale Version (dist): Start ohne Anmeldung, Aufbau der Microsoft-Anmeldung
```

```
src/app/        Bildschirme (expo-router); (tabs) = Start, Board, Fotos, Jour Fixe, Mehr
src/domain/     reine Logik mit Tests: kw, schnellerfassung, stichwortzuordnung, farblogik,
                uebernahme, fotoKw, fotoName, fotoFilter, suche, wetter, datum
src/dienste/    Abläufe: Erfassung, Jour Fixe, Fotos, Bautagebuch, Lieferscheine, KI nachholen, PDF-Ausgabe
src/data/       lokaler Speicher: store.ts (Android, SQLite), store.web.ts (Browser, IndexedDB)
src/sync/       Abgleich (engine.ts), App-Dienst (dienst.ts), Test-Laufwerk
src/ms/         Microsoft: Anmeldung (PKCE), Graph, OneDrive-Laufwerk, Outlook
src/pdf/        PDF mit pdf-lib: Protokoll, Mängelliste, Bautagebuch
src/foto/       Kamera/Galerie, Verkleinern (2048 px), Bildspeicher, EXIF
src/ki/         Verbindung zum eigenen KI-Backend
src/ui/         Gestaltung und Bausteine
backend/        KI-Backend (Cloudflare Worker, Hono, Anthropic SDK)
e2e/            simulierte Dienste und Prüfläufe für den Browser
```

- Jeder Datensatz hat `id`, `erstelltVon/-Am`, `geaendertVon/-Am`, `version`, `geloescht`
  (Löschen = Markieren, damit es übertragen werden kann).
- Hochladen nur mit dem zuletzt bekannten Stand der Datei (`If-Match`); weicht er ab → Konflikt.
- Neue Projekte haben **KI aus** und **Wetter aus**. Dann verlässt nichts das Gerät und dein OneDrive.
