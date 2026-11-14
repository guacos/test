# Installation – Schritt für Schritt

Diese Anleitung ist für dich, wenn du so etwas noch nie gemacht hast.
Du brauchst keine Vorkenntnisse. Nimm dir beim ersten Mal etwa **1 Stunde** Zeit
(davon ca. 20 Minuten Wartezeit).

**Du brauchst:**
- deinen Mac mit Internet
- dein Android-Handy
- eine E-Mail-Adresse

**Was am Ende funktioniert:** Die App läuft auf deinem Handy, auch ohne Netz.
OneDrive, den Mac im Browser und die KI richtest du später ein (Teil 6).

> **Wenn etwas nicht klappt:** Mach ein Bildschirmfoto der Meldung und schick es mir.
> Du kannst nichts kaputt machen – jeden Schritt kannst du einfach wiederholen.

---

## Teil 1: Den Programmcode auf den Mac holen (5 Minuten)

1. Öffne im Browser: <https://github.com/guacos/test>
2. Oben links steht ein Knopf mit dem Wort **master** (mit kleinem Pfeil). Klick darauf.
3. Wähle in der Liste: **claude/smart-app-bauleitung-phase1-b8u33y**
4. Klick rechts auf den grünen Knopf **Code** und dann auf **Download ZIP**.
5. Öffne im Finder den Ordner **Downloads** und klick doppelt auf die ZIP-Datei.
   Es entsteht ein neuer Ordner. Darin liegt der Ordner **bauleitung-app** – den brauchst du.
6. Zieh den Ordner **bauleitung-app** in deinen Ordner **Dokumente**.
   Dort bleibt er liegen. Bitte später nicht verschieben oder umbenennen.

## Teil 2: Das Hilfsprogramm „Node.js“ installieren (5 Minuten)

Node.js ist ein kostenloses Programm, das zum Bauen der App nötig ist.

1. Öffne <https://nodejs.org>
2. Klick auf den großen Knopf zum Herunterladen (dort steht **LTS**).
3. Öffne die heruntergeladene Datei und klick dich durch („Fortfahren“, „Installieren“).
   Der Mac fragt nach deinem Mac-Passwort – das ist normal.

## Teil 3: Das „Terminal“ öffnen und in den Ordner wechseln (5 Minuten)

Das Terminal ist ein Fenster, in das man Befehle tippt. Du tippst nur ab, was hier steht.

1. Drück **cmd + Leertaste**, tippe `Terminal` und drück **Enter**. Ein Fenster mit Text geht auf.
2. Tippe `cd` und dahinter **ein Leerzeichen**. Noch nicht Enter drücken.
3. Zieh jetzt den Ordner **bauleitung-app** aus dem Finder mit der Maus in das Terminal-Fenster
   und lass ihn los. Der Mac schreibt den Ort des Ordners selbst hin.
4. Drück **Enter**.
5. Prüfen: Tippe `node -v` und drück Enter. Es muss eine Nummer erscheinen (z. B. `v22.…`).
   Kommt „command not found“: Terminal schließen, neu öffnen und Schritt 2–5 wiederholen.

**So gibst du ab jetzt Befehle ein:** Befehl markieren und kopieren (cmd + C), ins Terminal
klicken, einfügen (cmd + V), **Enter** drücken. Immer warten, bis der Befehl fertig ist,
bevor du den nächsten eingibst.

Jetzt der erste Befehl. Er lädt alle Bausteine der App (dauert 1–3 Minuten):

```
npm install
```

Gelbe Zeilen mit „warn“ sind in Ordnung. Fertig ist es, wenn wieder eine leere Eingabezeile erscheint.

## Teil 4: Kurz am Mac ausprobieren (freiwillig, 3 Minuten)

So siehst du die App sofort, bevor du sie aufs Handy bringst.

```
npm run web
```

Warte, bis Text mit `http://localhost:8081` erscheint. Öffne dann im Browser:
<http://localhost:8081>

Leg ein Projekt an und probier den orangen Plus-Knopf aus.
Zum Beenden: ins Terminal klicken und **ctrl + C** drücken.

## Teil 5: Die App aufs Handy bringen (30 Minuten, davon 20 Warten)

Die App wird im Internet bei der Firma „Expo“ kostenlos zusammengebaut. Du bekommst
danach eine Installationsdatei für dein Handy.

**5.1 Konto anlegen**
1. Öffne <https://expo.dev> und klick auf **Sign up**.
2. Gib E-Mail, einen Benutzernamen und ein Passwort ein. Merk dir Benutzername und Passwort.

**5.2 Anmelden** – im Terminal:

```
npx eas-cli@latest login
```

- Fragt das Terminal `Ok to proceed? (y)`: tippe `y` und Enter.
- Gib Benutzername (oder E-Mail) und Passwort ein.
  Beim Passwort siehst du beim Tippen **nichts** – das ist normal. Einfach tippen und Enter.

**5.3 App bauen lassen** – im Terminal:

```
npx eas-cli@latest build -p android --profile preview
```

Das Programm stellt ein paar Fragen auf Englisch. Antworte jedes Mal mit `y` und Enter
(oder nur Enter, wenn schon „Yes“ markiert ist). Typische Fragen:
- ob ein Projekt angelegt werden soll → ja
- ob ein „Keystore“ (Signierschlüssel) erzeugt werden soll → ja

Dann heißt es warten: **10 bis 20 Minuten**. Lass das Terminal offen.
Am Ende erscheinen ein **Link** und ein **QR-Code** (schwarz-weißes Quadrat).

**5.4 Auf dem Handy installieren**
1. Öffne die Kamera am Handy und halte sie auf den QR-Code. Tippe auf den Link, der erscheint.
   (Alternativ: Am Handy bei <https://expo.dev> anmelden → dein Projekt → **Builds**.)
2. Tippe auf **Install** bzw. **Download**. Es wird eine Datei geladen, die auf `.apk` endet.
3. Tippe auf die geladene Datei. Android warnt, dass Apps aus dieser Quelle nicht erlaubt sind.
   Tippe auf **Einstellungen** und schalte **„Dieser Quelle vertrauen“** ein. Dann zurück und **Installieren**.
   (Die Wörter heißen je nach Handy etwas anders.)
4. Fertig: Auf dem Handy gibt es jetzt die App **Bauleitung**.

**5.5 Erster Start**
1. App öffnen → **Projekt anlegen** → Projekt-Nr. und Name eintragen → **Speichern**.
2. Oranger Plus-Knopf → `kw40 Estrich 1.OG` tippen → **Erfassen**.
3. Fragt die App nach Kamera oder Mikrofon: **Erlauben**.

Die App funktioniert jetzt vollständig auf dem Handy – auch im Keller ohne Netz.
Die Daten liegen aber **nur auf dem Handy**, bis du OneDrive einrichtest.

## Teil 6: Was du später einrichten kannst

Das steht ausführlich in der Datei **README.md** im selben Ordner. Mach es in dieser Reihenfolge:

| Was | Wozu | Wo in der README |
|---|---|---|
| **OneDrive verbinden** | Datensicherung, gleiche Daten auf Handy und Mac | Teil E |
| **App am Mac nutzen** | Protokolle am großen Bildschirm bearbeiten | Teil F |
| **Diktat** | Sprechen statt Tippen | Teil C |
| **Kollegen einladen** | gemeinsam am Projekt arbeiten | Teil G |
| **KI einschalten** | Texte ausformulieren, Fragen an Unterlagen | Teil D |

Empfehlung: Richte **OneDrive (Teil E) bald** ein. Geht das Handy vorher verloren oder
wird die App gelöscht, sind die Daten weg.

---

## Wenn es später eine neue Version gibt

1. Teil 1 wiederholen (neuen Code laden) und den alten Ordner **bauleitung-app** ersetzen.
2. Teil 3 wiederholen (Terminal, `cd`, `npm install`).
3. Schritt 5.3 und 5.4 wiederholen. Die neue App einfach **drüber installieren** –
   deine Daten bleiben erhalten. Die alte App vorher **nicht** löschen.

## Häufige Stolpersteine

| Meldung / Problem | Was tun |
|---|---|
| `command not found: node` oder `npm` | Node.js ist nicht installiert oder das Terminal war schon offen. Teil 2 prüfen, Terminal schließen und neu öffnen. |
| `no such file or directory` nach `cd` | Der Ordner wurde nicht richtig hineingezogen. Teil 3, Schritt 2–4 wiederholen. |
| `npm install` bricht mit rotem Text ab | Internet prüfen und denselben Befehl noch einmal eingeben. |
| Beim Passwort erscheint nichts | Normal. Blind tippen, dann Enter. |
| Der Bau bei Expo schlägt fehl („Build failed“) | Den Link aus dem Terminal öffnen, Bildschirmfoto der roten Meldung machen und mir schicken. |
| Das Handy installiert die Datei nicht | In den Handy-Einstellungen nach „Unbekannte Apps installieren“ suchen und es für deinen Browser erlauben. |
| GitHub zeigt die Seite nicht | Du musst bei GitHub mit dem Konto angemeldet sein, dem das Projekt gehört. |

Ehrlicher Hinweis: Diese Anleitung habe ich nicht an einem echten Mac und Handy durchspielen
können. Die Namen von Knöpfen bei GitHub, Expo und Android können leicht abweichen.
