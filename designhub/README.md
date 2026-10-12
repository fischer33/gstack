# DesignHub

Browserbasierter Grafik-Editor (Vorlagen, Canvas, Export). Stand: **Etappe (c) – Canvas-Editor-Kern** (zusätzlich zu Auth und Dashboard: Elemente hinzufügen, auswählen, verschieben, skalieren, drehen, Textbearbeitung, Zoom/Pan, Undo/Redo, Tastenkürzel).
Architektur und Etappenplan: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Voraussetzungen
Node 20+, Docker (für Postgres und RustFS (S3)).

## Starten

```bash
cp .env.example .env          # danach JWT_SECRET ersetzen: openssl rand -hex 32
npm install
npm run db:up                 # Postgres :5432, RustFS (S3) :9000 (Konsole :9001)
npm run db:migrate            # legt die Tabellen an
npm run dev                   # Web http://localhost:5173, API http://localhost:4000
```

Ohne Docker: eine eigene PostgreSQL-16-Instanz genügt. Lege Benutzer `designhub` (Passwort `designhub`) und Datenbank `designhub` an oder passe `DATABASE_URL` in `.env` an.

## Testen

```bash
npm run typecheck && npm test && npm run build
```

Die Server-Tests für das Dashboard laufen gegen die echte Datenbank aus `.env` (Docker: `npm run db:up && npm run db:migrate`). Ist keine DB erreichbar, werden sie übersprungen. Für die Vorlagen einmalig `npm run db:seed` ausführen.

Manuell im Browser (`http://localhost:5173`):
1. Landing-Seite öffnen, oben rechts Hell/System/Dunkel umschalten.
2. „Kostenlos starten“, Konto anlegen. Du landest in `/app` und siehst „Hallo, <Name>!“.
3. Seite neu laden: du bleibst angemeldet. „Abmelden“, dann mit falschem Passwort anmelden: Fehlermeldung erscheint.
4. `/app` ohne Anmeldung öffnen: Weiterleitung zu `/login`.
5. Dashboard: Format-Kachel anklicken legt ein Design an und öffnet den (noch leeren) Editor-Platzhalter. Eine Vorlage anklicken erzeugt ein Design mit deren Inhalt.
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

**Wichtig:** Der Editor speichert noch nicht (kommt in Etappe f). Beim Verlassen warnt der Browser vor ungespeicherten Änderungen.

## Ende-zu-Ende-Tests

Skripte unter `apps/web/e2e/` steuern einen echten Browser (Playwright). Voraussetzung: `npm run dev` läuft, die Datenbank ist migriert und geseedet.

```bash
# einmalig
npx playwright install chromium
# in .env setzen und API neu starten, sonst greift das Rate-Limit der Registrierung:
#   AUTH_RATE_LIMIT_MAX=1000
cd apps/web && npm run e2e         # Auth, Dashboard, Editor, Transformationen (~2 Min.)
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
- Der Editor speichert noch nicht und hat noch keine Schrift-/Ebenen-/Ausrichten-Werkzeuge (Etappe d und f). Mobil/Touch ist noch nicht für Gesten (Pinch, Zwei-Finger-Pan) ausgelegt.
