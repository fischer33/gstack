# DesignHub – Architekturplan (Etappe 1)

Browserbasierter Grafik-Editor mit Vorlagen, Drag-and-Drop-Canvas und Export. Eigenständiges Produkt, keine Fremdmarken, -Schriften oder -Assets.

## 1. Technische Entscheidungen

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Frontend | React 18, TypeScript (strict), Vite | wie vorgegeben |
| Styling | Tailwind 3 + shadcn/ui (Radix), Dark/Light über CSS-Variablen | shadcn ist mit Tailwind 3 am stabilsten; Theme = nur Variablen tauschen |
| Canvas | **react-konva** (Konva 9) | Szenegraph mit Transformer, Hit-Regions, Layer-Caching; Hunderte Objekte bei 60 FPS machbar |
| State | **Zustand + Immer** | Dokument-Store mit Patch-basiertem Undo/Redo, feingranulare Selektoren |
| Backend | **Express** + Zod-Validierung | schlank, getrennt vom Frontend deploybar |
| DB | **PostgreSQL + Prisma** | Schema siehe `apps/server/prisma/schema.prisma`; Design-Inhalt als JSON-Spalte |
| Auth | E-Mail/Passwort (scrypt aus Node) + Google OAuth (Code-Flow mit PKCE und State, eigene ~60 Zeilen), Session als signiertes JWT (`jose`) im httpOnly-Cookie | keine Tokens im localStorage, keine nativen Zusatz-Abhängigkeiten |
| Storage | S3-kompatibel (lokal MinIO), Upload per Presigned-URL direkt vom Browser | API-Server bleibt frei von Dateitraffic |
| Export | PNG/JPG: `stage.toDataURL`; PDF: jsPDF; SVG: eigener Serializer (siehe Abschnitt 5) | |
| Tests | Vitest (Store-Logik, Serializer), später Playwright für den Editor | |

## 2. Ordnerstruktur

```
designhub/
├─ apps/
│  ├─ web/                       # React-SPA
│  │  └─ src/
│  │     ├─ pages/               # Landing, Login, Dashboard, Editor, Meine Designs, Settings
│  │     ├─ components/
│  │     │  ├─ ui/               # shadcn/ui-Bausteine
│  │     │  ├─ dashboard/        # Format-Schnellauswahl, Vorlagen-Galerie, Karten
│  │     │  └─ editor/           # Sidebar-Tabs, Toolbar, Seitenleiste, Lineale
│  │     ├─ editor/
│  │     │  ├─ store/            # Zustand: documentStore (+History), uiStore (Zoom, Auswahl, Tool)
│  │     │  ├─ engine/           # Konva-Rendering, Transformer, Smart Guides, Snapping
│  │     │  ├─ export/           # png/jpg, svg-Serializer, pdf
│  │     │  └─ templates/        # Vorlagen als JSON (mind. 20)
│  │     ├─ api/                 # typisierter Fetch-Client
│  │     └─ lib/                 # utils, fonts, shortcuts
│  └─ server/
│     ├─ prisma/                 # schema.prisma, Migrationen, seed.ts (Vorlagen)
│     └─ src/{routes,middleware,services,lib}
├─ packages/shared/              # Dokumentmodell (Typen), Zod-Schemas, Formate – von Web und Server genutzt
├─ docker-compose.yml            # Postgres + MinIO
└─ docs/
```

## 3. Dokumentmodell (`packages/shared/src/document.ts`)

`DesignDocument { version, width, height, pages[] }` → `Page { background, elements[] }` → `Element` = Shape | Text | Image | Icon | Group.
Z-Reihenfolge = Array-Reihenfolge. Das Modell kennt kein Konva; Rendering und Export lesen nur dieses JSON.
Schemaänderungen erhöhen `DOCUMENT_VERSION` und bekommen eine Migrationsfunktion.

## 4. Editor-Architektur

- **documentStore**: hält `DesignDocument`. Alle Änderungen laufen über Actions (`addElement`, `updateElements`, `reorder`, `group`, …), die mit Immer `produceWithPatches` arbeiten. History = Stack aus Patch/Inverse-Patch-Paaren; Drag und Resize werden zu **einem** History-Eintrag zusammengefasst (Commit bei `pointerup`, Live-Updates ohne History).
- **uiStore**: Auswahl, aktive Seite, Zoom (10–400 %), Pan, aktives Tool, Hilfslinien. Nicht in der History.
- **Rendering**: eine `Stage`, getrennte Layer für Seite/Inhalt, Overlay (Transformer, Smart Guides). Nur geänderte Elemente rendern neu (Selektor pro Element-ID). Bilder und komplexe Gruppen werden mit `cache()` gerastert.
- **Smart Guides**: Snapping auf Seitenmitte, Kanten und Mitten anderer Objekte, Schwelle 6 px / Zoom.
- **Panels** (Vorlagen, Elemente, Text, …) per `React.lazy` nachgeladen.
- **Autosave**: Debounce 5 s nach der letzten Änderung, `PUT /api/designs/:id` mit erwarteter `version` (Optimistic Locking, bei Konflikt Hinweis statt stilles Überschreiben). Status im Header: „Speichert… / Gespeichert“.
- **Fonts**: mind. 30 Google-Fonts, bei Auswahl on demand per `FontFace`/CSS geladen; vor Export `document.fonts.ready` abwarten.

## 5. Export

- **PNG/JPG**: `stage.toDataURL({ pixelRatio, mimeType, quality })`, Skalierung 1×/2×/3× und Qualität wählbar.
- **PDF**: jsPDF, eine PDF-Seite pro Design-Seite, Raster-Bild in gewählter Auflösung.
- **SVG**: Konva kann kein SVG. Plan: eigener Serializer `DesignDocument → SVG-String` (Formen, Text, Bilder als `<image>`, Verlauf, Schatten). Er ist reine Funktion und damit gut testbar.
- Vorgabe nennt `html-to-image`. Das rendert DOM, nicht das Konva-Canvas, und würde Ergebnis und Vorschau auseinanderlaufen lassen. Entscheidung: Abschnitt 9.

## 5a. Auth-Details (Etappe a)

- Passwörter: scrypt (N=2^15, r=8, p=1), Parameter im Hash gespeichert. Login rechnet auch für unbekannte E-Mails (kein Timing-Orakel).
- Session: JWT HS256, 7 Tage, Cookie `dh_session` (`HttpOnly`, `SameSite=Lax`, `Secure` in Produktion). `/me` lädt den User bei jedem Aufruf neu; gelöschte Konten verlieren sofort den Zugang.
- CSRF: schreibende Requests mit fremdem `Origin` bekommen 403; zusätzlich `SameSite=Lax`.
- Rate-Limit: 10 Versuche pro 15 min und IP auf Login/Registrierung (im Speicher; bei mehreren Instanzen durch Redis ersetzen).
- Google: State und PKCE-Verifier liegen signiert in einem 10-Minuten-Cookie. Konten werden nur über eine von Google **verifizierte** E-Mail verknüpft. Ohne `GOOGLE_CLIENT_ID/SECRET` ist der Button ausgeblendet.
- Die Auth-Logik hängt an `UserRepo` und `GoogleClient`-Schnittstellen und ist deshalb ohne Datenbank und Netzwerk getestet.

## 6. Backend

REST unter `/api`: `auth/*`, `designs` (CRUD, Ordner, Papierkorb, Duplizieren), `templates` (nur lesen), `assets` (Presigned-Upload), `share/:token`. Teilen: `ShareLink` mit Token und Rolle VIEW/EDIT; Zugriff über Token wird serverseitig gegen die Rolle geprüft. Zod validiert jeden Request. Hintergrund entfernen läuft über den Server (API-Key bleibt serverseitig).

## 7. Etappenplan

| Etappe | Inhalt | Fertig, wenn |
|---|---|---|
| (a) ✅ | Setup, Auth (E-Mail + Google), Landing/Login, Theme | Registrieren, Einloggen, Logout im Browser |
| (b) | Dashboard, Format-Schnellauswahl, „Zuletzt bearbeitet“, Meine Designs, Ordner, Papierkorb | Design anlegen und in der Liste sehen |
| (c) | Editor-Kern: Canvas, Zoom/Pan, Auswahl, Transformer, Formen/Text/Bild, Undo/Redo, Tastenkürzel, Store-Tests | 100+ Objekte flüssig, Undo/Redo getestet |
| (d) | Toolbar, Panels, Ebenen (Drag-Sortierung), Gruppieren, Ausrichten, Smart Guides, Bildfilter/Crop, Hintergründe, mehrseitig | Alle Muss-Funktionen bedienbar |
| (e) | 20+ Vorlagen, Export PNG/JPG/SVG/PDF | Vorlage anwenden und exportieren |
| (f) | Autosave, Speichern in DB, Teilen per Link, Einstellungen/Profil | Reload behält Design, Link öffnet Ansicht |

## 8. Risiken

- **Performance bei 100+ Objekten**: Messung per Benchmark-Szene in Etappe (c), nicht erst am Ende.
- **Text-Rendering**: Konva-Text und SVG/PDF-Export müssen identisch umbrechen; Zeilenumbruch einmal zentral berechnen.
- **Hintergrund entfernen**: braucht einen remove.bg-Key (Abschnitt 9).
- **Google OAuth/S3**: laufen lokal nur mit eigenen Zugangsdaten bzw. MinIO; Etappe (a) funktioniert vorab mit E-Mail-Login.

## 9. Entscheidungen zu Abweichungen von der Vorgabe

1. **SVG-Export**: eigener Serializer statt `html-to-image` (entschieden).
2. **Ablageort**: eigenes Repo. Bis es existiert, liegt der Code unter `designhub/` auf dem Branch `claude/dreamy-hawking-m38lph`; Umzug folgt, sobald das leere Repo bereitsteht.
3. **Hintergrund entfernen**: remove.bg, Aufruf nur serverseitig; `BG_REMOVAL_API_KEY` in `.env` (entschieden).
