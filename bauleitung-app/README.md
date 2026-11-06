# Smart App Bauleitung

Begleit-App für die Bauleitung (Schlüsselfertigbau/TGA). Eine Codebasis für
**Android-Handy** und **Browser am Mac**. Alle Daten liegen zuerst auf dem Gerät
(offline nutzbar) und werden später mit deinem OneDrive abgeglichen.

Stand: **Phase 1 – Schritt 1 von 6** (Grundgerüst + Projekte).

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | Grundgerüst, lokaler Speicher, Projekte | ✅ fertig |
| 2 | Schnellerfassung (Plus-Button, kw/jf, Wochentag, Diktat) | offen |
| 3 | Wochen-Board | offen |
| 4 | Fotodokumentation | offen |
| 5 | Jour Fixe mit PDF | offen |
| 6 | OneDrive-Sync | offen |

---

## Was du selbst erledigen musst

Wird mit jedem Schritt ergänzt. Bis Schritt 6 brauchst du kein Konto bei Microsoft oder Anthropic.

### Jetzt schon: Node.js installieren (am Mac, einmalig)
1. Auf <https://nodejs.org> die Version „LTS“ herunterladen und installieren.
2. Programm **Terminal** öffnen und prüfen: `node -v` muss eine Versionsnummer zeigen.

### Folgt in späteren Schritten
- **Android-App installieren (APK):** kostenloses Konto bei Expo (expo.dev) anlegen → Anleitung kommt in Schritt 2.
- **Microsoft-App-Registrierung** (für die OneDrive-Anmeldung) → Anleitung kommt in Schritt 6.
- **Claude-API-Schlüssel + Backend bei Cloudflare** (nur für Projekte mit KI an) → Anleitung kommt mit der KI-Anbindung.

---

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
npm test           # prüft die Kernlogik
npm run typecheck  # prüft den Code auf Tippfehler
```

---

## Aufbau (für Entwickler)

```
src/app/        Screens (expo-router). (tabs) = Board, Fotos, Jour Fixe, Mehr
src/domain/     reine Logik ohne Oberfläche, mit Tests (__tests__)
src/data/       lokaler Speicher: store.ts (Android, SQLite), store.web.ts (Browser, IndexedDB)
src/state/      App-Zustand (zustand)
src/ui/         Bausteine: große Knöpfe, Felder, Plus-Button, Farben
```

- Jeder Datensatz hat `id`, `erstelltVon/-Am`, `geaendertVon/-Am`, `version`, `geloescht`.
  Gelöscht wird nur durch Markieren, damit das Löschen später synchronisiert werden kann.
- Jede Änderung wird lokal als „noch nicht abgeglichen“ (`dirty`) markiert. Der
  OneDrive-Abgleich in Schritt 6 lädt genau diese Datensätze hoch.
- Neue Projekte haben **KI aus**. Ist die KI aus, verlässt nichts das Gerät und dein OneDrive.
