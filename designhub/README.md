# DesignHub

Browserbasierter Grafik-Editor (Vorlagen, Canvas, Export). Stand: **Etappe (b) – Dashboard** (zusätzlich zu Auth: Formate, Vorlagen-Galerie, Meine Designs, Ordner, Papierkorb, Suche).
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

## Google-Login einrichten (optional)

1. Google Cloud Console → APIs & Dienste → Anmeldedaten → OAuth-Client-ID (Typ „Webanwendung“).
2. Autorisierte Weiterleitungs-URI: `http://localhost:5173/api/auth/google/callback`.
3. `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in `.env` eintragen, API neu starten. Der Google-Button erscheint dann auf Login und Registrierung.

## Bekannte Einschränkungen

- `npm audit` meldet noch Funde in Tailwind 3 (`braces`/`chokidar`, nur Build-Zeit, kein Laufzeitcode). Ein Wechsel auf Tailwind 4 ist für später vorgemerkt.
- Rate-Limit liegt im Speicher (eine API-Instanz). Hinter einem Proxy muss später `trust proxy` gesetzt werden, sonst teilen sich alle Nutzer eine IP.
- Der Editor (`/design/:id`) ist noch ein Platzhalter; er kommt in Etappe (c).
