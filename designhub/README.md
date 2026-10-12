# DesignHub

Browserbasierter Grafik-Editor (Vorlagen, Canvas, Export). Stand: **alle sechs Etappen umgesetzt** (Auth, Dashboard, Editor, Vorlagen, Export, Speichern/Teilen/Einstellungen).
Architektur und Etappenplan: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Voraussetzungen
Node 20+, Docker (für Postgres und RustFS (S3)).

## Starten

```bash
cp .env.example .env          # danach JWT_SECRET ersetzen: openssl rand -hex 32
npm install
npm run db:up                 # Postgres :5432, RustFS (S3) :9000 (Konsole :9001)
npm run db:migrate            # legt die Tabellen an
npm run db:seed               # 35 Vorlagen einspielen
npm run dev                   # Web http://localhost:5173, API http://localhost:4000
```

Ohne Docker: eine eigene PostgreSQL-16-Instanz genügt. Lege Benutzer `designhub` (Passwort `designhub`) und Datenbank `designhub` an oder passe `DATABASE_URL` in `.env` an.

## Testen

```bash
npm run typecheck && npm test && npm run build
```

Die Server-Tests für das Dashboard laufen gegen die echte Datenbank aus `.env` (Docker: `npm run db:up && npm run db:migrate`). Ist keine DB erreichbar, werden sie übersprungen. Für die Vorlagen einmalig `npm run db:seed` ausführen (mehrfaches Ausführen ist unbedenklich). Eigene Vorlagen: `apps/server/prisma/build-templates.ts` anpassen, `npm run db:templates -w @designhub/server` erzeugt die JSON-Dateien, jede wird mit demselben Schema geprüft wie gespeicherte Designs.

Manuell im Browser (`http://localhost:5173`):
1. Landing-Seite öffnen, oben rechts Hell/System/Dunkel umschalten.
2. „Kostenlos starten“, Konto anlegen. Du landest in `/app` und siehst „Hallo, <Name>!“.
3. Seite neu laden: du bleibst angemeldet. „Abmelden“, dann mit falschem Passwort anmelden: Fehlermeldung erscheint.
4. `/app` ohne Anmeldung öffnen: Weiterleitung zu `/login`.
5. Dashboard: Format-Kachel anklicken legt ein Design an und öffnet den Editor. Eine Vorlage anklicken erzeugt ein Design mit deren Inhalt.
6. „Meine Designs“: im ⋯-Menü einer Karte umbenennen, duplizieren, in einen Ordner verschieben, in den Papierkorb legen. Ordner über das Ordner-Symbol in der Seitenleiste anlegen.
7. Papierkorb: wiederherstellen, endgültig löschen, leeren. Oben im Suchfeld nach Titel, Kategorie oder Stichwort suchen.

## Editor ausprobieren

Im Dashboard ein Format oder eine Vorlage anklicken. Dann:

| Aktion | So geht's |
|---|---|
| Element hinzufügen | links Text, Rechteck, Kreis, Linie, Pfeil, Stern, Bild (auch per Drag & Drop oder Einfügen) |
| Auswählen | Klick; Umschalt+Klick für mehrere; Rahmen aufziehen; Strg/Cmd+A für alles |
| Verschieben, Skalieren, Drehen | ziehen; Eckgriffe skalieren, der Punkt oben dreht (rastet bei 45°) |
| Text bearbeiten | Doppelklick oder Enter; Esc oder Klick daneben übernimmt |
| Rückgängig / Wiederholen | Strg/Cmd+Z, Strg/Cmd+Umschalt+Z (oder +Y) |
| Kopieren, Einfügen, Duplizieren, Löschen | Strg/Cmd+C, +V, +D, Entf |
| Feinschieben | Pfeiltasten (1 px), mit Umschalt 10 px |
| Zoom 10–400 % | Strg/Cmd+Mausrad oder Pinch, +/- Tasten, Klick auf den Prozentwert passt ein (Strg/Cmd+0) |
| Ansicht verschieben | Mausrad, Leertaste+Ziehen oder mittlere Maustaste |

**Etappe (d), Werkzeuge im Überblick**

| Bereich | Was geht |
|---|---|
| Seitenleiste | Vorlagen (Format wird angepasst), Elemente (Formen, 24 Icons, 24 Sticker), Text (3 Stile, 6 Schriftkombinationen), Uploads, Hintergrund (Farbe, Verlauf, Bild), Ebenen |
| Text | 38 Google-Schriften mit Suche, Größe, Farbe, Fett/Kursiv/Unterstrichen, Ausrichtung, Zeilen- und Buchstabenabstand, Schatten, Kontur |
| Farbwähler | Paletten, Markenfarben (pro Browser gespeichert), Hex, RGB, Farbfeld |
| Formen | Füllung, Kontur, Konturstärke, Eckenradius; Linien und Pfeile: Farbe und Stärke |
| Bilder | Helligkeit, Kontrast, Sättigung, Weichzeichnen, Spiegeln, Zuschneiden (Doppelklick oder Werkzeug, Enter beendet), Hintergrund entfernen |
| Anordnen | Ebenenreihenfolge, Ausrichten (an der Seite oder aneinander), Verteilen, Gruppieren (Strg/Cmd+G), Gruppierung aufheben (Strg/Cmd+Umschalt+G), Position und Größe numerisch |
| Smart Guides | Einrasten an Seitenmitte, Kanten und Mitten anderer Elemente und an Hilfslinien; mit Alt aus |
| Lineale und Hilfslinien | Lineale oben/links in Pixeln; aus einem Lineal eine Hilfslinie auf die Fläche ziehen, verschieben, zum Löschen zurück auf das Lineal ziehen; Umschalt+R blendet alles aus |
| Ebenenpanel | Reihenfolge per Drag & Drop, ein-/ausblenden, sperren, mehrere wählen |
| Seiten | unten hinzufügen, duplizieren, löschen, umsortieren (Ziehen oder Pfeile) |
| Vorlagen | 35 Stück in 6 Kategorien, darunter 14 handgestaltete (auch mehrseitige: Karussell, Pitch-Deck, Visitenkarte); Anwenden ist ein Undo-Schritt |
| Herunterladen | Knopf oben rechts oder Strg/Cmd+Umschalt+E: PNG, JPG (Qualität), SVG, PDF; aktuelle oder alle Seiten, Größe 0,5–4×; mehrere Dateien als ZIP, mehrseitig als PDF |

**Hintergrund entfernen einrichten:** API-Schlüssel bei [remove.bg](https://www.remove.bg/api) holen und in `.env` als `BG_REMOVAL_API_KEY` eintragen, dann den Server neu starten. Ohne Schlüssel zeigt der Editor einen Hinweis.

**Schriften und Datenschutz:** Die Schriften kommen von Google Fonts, dabei wird die IP des Nutzers an Google übertragen. Wer das vermeiden will, liefert sie selbst aus (`@fontsource-*`).

**Export-Hinweise:** PNG/JPG/PDF werden im Browser mit denselben Bausteinen wie der Editor gezeichnet (Aussehen identisch). SVG ist ein eigener Vektor-Export; Schriften werden darin nicht eingebettet. PDF-Seiten sind Rasterbilder in der gewählten Größe. Sehr große Flächen (Kante über 16 384 px oder über 64 Mio. Pixel) lehnt der Dialog ab, weil Browser sie nicht zeichnen können.

**Speichern:** Der Editor speichert automatisch 5 Sekunden nach der letzten Änderung (spätestens nach 30 Sekunden Dauerbearbeitung), sofort mit Strg/Cmd+S, beim Wechsel des Tabs und beim Zurück zum Dashboard. Der Status oben („Gespeichert“, „Speichert…“, „Ungespeicherte Änderungen“, „Speichern fehlgeschlagen, neuer Versuch folgt“) zeigt, ob etwas verloren gehen kann. Offline wird in wachsenden Abständen wiederholt. Wurde dasselbe Design inzwischen anderswo gespeichert (zweiter Tab, Link-Bearbeiter), hält das Speichern an und fragt: „Meine Version behalten“ oder „Neu laden“. Der Browser warnt beim Schließen nur, solange wirklich etwas nicht gespeichert ist. Die Dashboard-Vorschau ist ein PNG der ersten Seite.

**Teilen:** „Teilen“ im Editor-Kopf erzeugt je einen Link zum Ansehen oder Bearbeiten (`/s/<Token>`, 256 Bit Zufall, ohne Anmeldung nutzbar). Ansehen-Links öffnen einen schreibgeschützten Betrachter, Bearbeiten-Links den Editor; Link-Bearbeiter können Inhalte ändern, aber nicht Titel, Format oder Freigaben. „Link deaktivieren“ wirkt sofort. Ein Link stirbt auch, wenn das Design im Papierkorb liegt oder das Konto gelöscht wird.

**Einstellungen:** `/app/settings`: Name, Farbschema, Passwort ändern (Google-Konten können eines setzen), Konto löschen (E-Mail und Passwort zur Bestätigung; löscht Designs, Ordner und Bildverweise).

**Bilder:** Mit eingerichtetem Objektspeicher (S3-Werte in `.env`) lädt der Browser Bilder direkt hoch und das Design speichert nur die URL; das Uploads-Panel zeigt sie danach unter „Meine Bilder“. Ohne Speicher, ohne Anmeldung (Link-Bearbeiter) oder wenn der Upload scheitert, wird das Bild wie bisher im Dokument eingebettet. Der Bucket muss Browser-Zugriff erlauben: `GET` und `PUT` von `WEB_ORIGIN` (CORS) und lesenden öffentlichen Zugriff auf `S3_PUBLIC_URL`. Hochgeladene Dateien werden beim Löschen eines Designs nicht entfernt (ein Aufräum-Job ist ein sinnvoller nächster Schritt).

## Ende-zu-Ende-Tests

Skripte unter `apps/web/e2e/` steuern einen echten Browser (Playwright). Voraussetzung: `npm run dev` läuft, die Datenbank ist migriert und geseedet.

```bash
# einmalig
npx playwright install chromium
# in .env setzen und API neu starten, sonst greift das Rate-Limit der Registrierung:
#   AUTH_RATE_LIMIT_MAX=1000
cd apps/web && npm run e2e         # Auth, Dashboard, Editor, Transformationen, Werkzeuge, Inhalte, Lineale, Export, Vorlagen, Speichern/Teilen/Konto, Uploads (~15 Min.)
npm run e2e:bench                  # Leistungsmessung mit 100/300/1000 Objekten
```
Screenshots landen in `apps/web/e2e/out/`. Mit `E2E_CHROMIUM_PATH` lässt sich ein vorhandener Chromium-Browser verwenden.

## Google-Login einrichten (optional)

1. Google Cloud Console → APIs & Dienste → Anmeldedaten → OAuth-Client-ID (Typ „Webanwendung“).
2. Autorisierte Weiterleitungs-URI: `http://localhost:5173/api/auth/google/callback`.
3. `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in `.env` eintragen, API neu starten. Der Google-Button erscheint dann auf Login und Registrierung.

## Bekannte Einschränkungen

- `npm audit` meldet noch Funde in Tailwind 3 (`braces`/`chokidar`, nur Build-Zeit, kein Laufzeitcode). Ein Wechsel auf Tailwind 4 ist für später vorgemerkt.
- Rate-Limit liegt im Speicher (eine API-Instanz). Hinter einem Proxy muss später `trust proxy` gesetzt werden, sonst teilen sich alle Nutzer eine IP.
- Mobil/Touch ist noch nicht für Gesten (Pinch, Zwei-Finger-Pan) ausgelegt. Link-Bearbeiter sehen keine Live-Änderungen anderer (Konflikte werden beim Speichern erkannt, nicht live synchronisiert).
