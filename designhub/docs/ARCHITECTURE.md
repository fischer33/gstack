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
| Storage | S3-kompatibel (lokal RustFS), Upload per Presigned-URL direkt vom Browser | API-Server bleibt frei von Dateitraffic |
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
├─ docker-compose.yml            # Postgres + RustFS
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

## 4a. Editor-Kern (Stand Etappe c)

**Koordinaten:** Das Modell speichert `x, y` als obere linke Ecke des *unrotierten* Rahmens und dreht um dessen Mitte. Konva-Knoten laufen ohne `offset` (der Transformer arbeitet so zuverlässig); `engine/geometry.ts` rechnet an den Grenzen um (Rendern, Drag-Ende, Transform-Ende). Ellipsen sind in Konva mittig verankert und bilden die einzige Ausnahme. Beide Richtungen sind per Rundreise-Test abgesichert.

**Ablauf einer Interaktion:** Während Ziehen, Skalieren und Drehen arbeitet Konva direkt auf den Knoten (kein React-Render pro Mausbewegung). Erst beim Loslassen schreibt der Editor *einen* Schritt in den Store (`updateEach`). Bei Mehrfachauswahl verschiebt der Konva-Transformer alle gewählten Knoten selbst; der Editor hängt sich nur an `dragend`.

**Store:** `documentStore` (Dokument + Verlauf) und `uiStore` (Auswahl, Zoom, Pan) sind getrennt; Auswahl und Zoom landen nicht in der History. Undo/Redo basiert auf Immer-Patches (Patch + Gegen-Patch je Schritt, max. 200). Schnell aufeinanderfolgende Änderungen mit gleichem `coalesce`-Schlüssel (Pfeiltasten, Farb- und Deckkraft-Regler) werden zu einem Schritt verschmolzen. `silent`-Änderungen (gemessene Texthöhe) erzeugen keinen Undo-Eintrag. Die `revision` zählt jede Änderung und ist die Grundlage für Autosave (Abschnitt 5b).

**Ebenen im Canvas:** (1) Seite, (2) Elemente, (3) Auswahl-Transformer und Aufziehrahmen. Elemente sind `memo`-Komponenten; durch das strukturelle Teilen von Immer rendert eine Änderung nur das betroffene Element neu.

**Textbearbeitung:** Ein `<textarea>` liegt deckungsgleich über dem Text (gleiche Schrift, Größe, Drehung, Zoom). Die Höhe misst Konva selbst und meldet sie ohne Undo-Eintrag zurück.

**Lazy Loading:** Der Editor (inkl. Konva, ~330 kB) ist ein eigener Chunk und lädt erst beim Öffnen eines Designs; das Haupt-Bundle bleibt bei ~290 kB.

**Leistung** (`npm run e2e:bench`, headless Chromium ohne GPU, also eher pessimistisch):

| Objekte | Neuzeichnen der Elemente-Ebene | Bildrate beim Ziehen eines Elements |
|---|---|---|
| 100 | 1,6 ms | 60 FPS |
| 300 | 5 ms | 60 FPS |
| 1000 | 30 ms | ~52 FPS (p95 33 ms) |

Nachstellen im Browser: `/design/<id>?bench=300` füllt das Design (nur im Speicher) mit Testobjekten.

## 4b. Toolbar, Panels und Werkzeuge (Stand Etappe d)

**Oberfläche:** Links sechs Tabs (Vorlagen, Elemente, Text, Uploads, Hintergrund, Ebenen); die Panels laden erst beim ersten Öffnen (`React.lazy`). Oben die Kontextleiste, die je nach Auswahl Text-, Form-, Icon-, Bild- oder Gruppenwerkzeuge zeigt, dazu allgemeine Funktionen (Transparenz, Position, Anordnen, Gruppieren, Sperren, Duplizieren, Löschen). Unten die Seitenübersicht. Fenster (Farbe, Schrift, Effekte, Position …) sind ein eigenes `Popover`-Bauteil, das per Portal und `position: fixed` gerendert wird, damit scrollende Leisten sie nicht abschneiden. Esc schließt nur das Fenster und hebt die Auswahl nicht zusätzlich auf.

**Smart Guides:** Beim Ziehen rastet die Auswahl (Kanten und Mitte) an der Seite und an anderen Elementen ein, Schwelle 6 Bildschirmpixel (zoomunabhängig); Alt schaltet es ab. `computeSnap` ist eine reine Funktion. Die Linien werden direkt auf Konva-Ebene gezeichnet, nicht über React.

**Gruppen:** Eine Gruppe speichert Kinder mit Koordinaten relativ zur Gruppen-Ecke. Skalieren der Gruppe skaliert die Kinder mit (`scaleElement`); Auflösen rechnet Drehung und Position wieder ein. Kinder bleiben anklickbar, geben Ereignisse aber an den Gruppenknoten weiter.

**Ausrichten/Verteilen:** Reine Funktionen auf den Umschlag-Rechtecken (gedrehte Elemente zählen mit ihrem Umschlag); ein einzelnes Element richtet sich an der Seite aus. Ein Aufruf ist ein Undo-Schritt.

**Ebenenpanel:** Drag-Sortierung per HTML5-Drag-and-Drop. Ziehen einer gewählten Zeile verschiebt die ganze Auswahl als Block. `layerDropIndex` rechnet die Einfügemarke des Panels (vorderstes oben) in einen Index der Dokumentreihenfolge um.

**Mehrere Seiten:** `activePageId` liegt im Dokument-Store, aber nicht in der History. Seitenoperationen (hinzufügen, duplizieren, löschen, verschieben) sind Undo-fähig; nach Undo/Redo fällt eine verschwundene aktive Seite auf die erste zurück. Vorschaubilder entstehen mit `pageToSvg` aus der Seite (400 ms nach der letzten Änderung).

**Text:** 38 Google-Fonts in 5 Kategorien. Eine Schrift wird *vor* der Zuweisung geladen (`ensureFont`, Zeitlimit 2,5 s), damit Konva gleich mit der echten Schrift misst; beim Öffnen eines Designs werden alle benutzten Schriften vorher geladen. Es werden nur aufrechte Schnitte (400/700) angefragt, Kursiv erzeugt der Browser. Zeilen-/Buchstabenabstand, Schatten und Kontur sind Teil des Modells und im SVG-Renderer enthalten. *Datenschutz:* Google Fonts lädt von Google-Servern (die IP des Nutzers wird übertragen). Zum Selbst-Hosten die Schriften über `@fontsource-*` ausliefern.

**Bilder:** Filter (Helligkeit, Kontrast, Sättigung, Weichzeichnen) laufen über Konva-Filter und werden nur gecacht, solange ein Filter aktiv ist. Die Sättigung ist so abgebildet, dass −100 wirklich Grau ergibt (Konva rechnet mit 2^s). Spiegeln passiert am Bild innerhalb des Gruppenknotens. **Zuschneiden** verschiebt Rahmenkanten, ohne zu strecken: `cropByEdges` rechnet die neuen Kanten (im lokalen Rahmen des Bildes) in einen Ausschnitt des Originals um und begrenzt ihn an den Bildgrenzen; das abgedunkelte Gesamtbild hinter dem Ausschnitt zeigt, was ausgeblendet ist.

**Hintergrund entfernen:** `POST /api/images/remove-background` (nur angemeldet, 10 Aufrufe/Minute) reicht PNG/JPEG/WebP als `data:`-URL an remove.bg weiter; der Schlüssel (`BG_REMOVAL_API_KEY`) bleibt auf dem Server. Ohne Schlüssel antwortet die Route mit 501 und der Editor sagt, was einzutragen ist. Der Anbieter steckt hinter der Schnittstelle `BackgroundRemover` und ist austauschbar.

**Icons und Sticker:** Icons sind einzelne Pfade (`d`) in einem 24×24-Raster, keine freie SVG-Quelle: Pfaddaten lassen sich streng prüfen (`isSafePathData`), fremdes SVG nicht. Sticker sind Emoji als Text.

**Vorlagen anwenden:** Das Format wird gleichmäßig angepasst und mittig platziert (`fitPageToSize`); bei belegter Seite fragt der Editor nach. Der Austausch ist ein Undo-Schritt.

**Lineale und Hilfslinien:** Lineale oben/links (20 px) zeigen Dokumentpixel mit adaptiver Teilung (1/2/5 × 10^n, mindestens 70 Bildschirmpixel Abstand), der Seitenbereich ist heller hinterlegt. Ziehen aus dem oberen Lineal erzeugt eine waagerechte, aus dem linken eine senkrechte Hilfslinie. Hilfslinien liegen in `uiStore` (pro geöffnetem Design, nicht im Dokument), sind verschiebbar, werden durch Zurückziehen auf das Lineal gelöscht und sind zusätzliche Einrastziele für `computeSnap`. Umschalt+R blendet Lineale samt Hilfslinien aus; die Lineal-Mathematik (`rulerTicks`, `guidePosition`) ist rein und getestet. Der Canvas wird um die Linealbreite versetzt; Textbearbeitung und Zeiger-Umrechnung berücksichtigen das.

**Gelernt (Fehlerklasse):** Konva-Knoten werden von React nur bei *geänderten* Eigenschaften aktualisiert. Endet eine Geste ohne Modelländerung (z. B. begrenzter Zuschnitt), bliebe der Knoten sonst verschoben stehen. Deshalb setzt `resetNodeToModel` die Knoten nach jeder Geste explizit auf den Modellzustand.

**Noch offen:** Touch-Gesten, Gruppen *innerhalb* von Gruppen bearbeiten.

## 5a. Export und Vorlagen (Etappe e)

**Raster (PNG/JPG/PDF):** `renderPageToCanvas` (`apps/web/src/editor/export/renderPage.tsx`) zeichnet eine Seite in einen unsichtbaren react-konva-Stage mit denselben `ElementNode`-Komponenten wie der Editor, daher stimmt das Ergebnis mit dem Bildschirm überein (inklusive Textumbruch und Filtern). Vorher laden `preparePages` alle Schriften und Bilder, damit synchron gerendert werden kann. JPG und PDF werden auf Weiß gesetzt. PDF: jsPDF, Seite = px × 0,75 pt, ein JPEG-Bild je Seite. Mehrere Dateien: ZIP über fflate. jsPDF und der Renderer werden erst beim Export per dynamischem Import geladen, sie liegen nicht im Editor-Bundle.

**SVG:** Eigener Serializer `pageToSvg` (`packages/shared`), kein DOM-Screenshot. Damit der Umbruch gleich bleibt, misst der Export die Zeilen mit `Konva.Text.textArr` und übergibt sie als `textLines`; Verläufe, Pfeilspitzen, Zuschnitt und Bildfilter (SVG-Filter: Helligkeit, Kontrast, Sättigung, Weichzeichnen) folgen den Konva-Formeln. Ein e2e-Test vergleicht das SVG pixelweise mit dem Editor (<1,5 % Abweichung). Grenze: Schriften werden nicht eingebettet.

**Grenzen:** Kante ≤ 16 384 px und ≤ 64 Mio. Pixel (`exportOptions.ts`); der Dialog sperrt zu große Faktoren, statt den Browser still scheitern zu lassen.

**Vorlagen:** 21 generierte (`prisma/seed.ts`) plus 14 handgestaltete als JSON (`prisma/templates/*.json`, erzeugt mit `build-templates.ts`), davon drei mehrseitig. Jede Vorlage läuft vor dem Speichern durch `parseDesignDocument` (zod-Schema in `packages/shared/src/schema.ts`: Farben, Schriftnamen, Bild-URLs, Pfaddaten, Größen- und Tiefenlimits); dasselbe Schema sichert auch das Speichern von Designs ab (Abschnitt 5b). Mehrseitige Vorlagen ersetzen die aktive Seite und fügen die übrigen dahinter ein (`applyTemplatePages`, ein Undo-Schritt).

## 5b. Speichern, Teilen, Uploads (Etappe f)

**Autosave** (`apps/web/src/editor/save/autosave.ts`): eine kleine Zustandsmaschine ohne React und Netzwerk (mit Fake-Timern getestet). Entprellt 5 s, höchstens 30 s Wartezeit bei Dauerbearbeitung, nie zwei Speichervorgänge gleichzeitig, Änderungen während des Speicherns lösen genau einen Folgevorgang aus, Fehler werden nach 5/10/20/60 s wiederholt. `useAutosave` hängt sie an `documentStore.revision`, Strg+S, `visibilitychange` und `beforeunload`; beim Verlassen der Seite wird ein letztes Mal gespeichert (der Controller hält dafür den letzten Dokumentstand, weil der Store dann schon geleert ist). Die Vorschau (PNG, 360 px, bei Fotos JPEG) wird mit dem Export-Renderer erzeugt und nur neu gerechnet, wenn sich die erste Seite geändert hat.

**Optimistic Locking:** `PUT /api/designs/:id` trägt die erwartete `version`; der Server aktualisiert mit `WHERE version = :erwartet` und erhöht sie atomar. Veraltet → `409 { error: 'conflict', version }`, nichts wird überschrieben. „Meine Version behalten“ speichert erneut mit der gemeldeten Serverversion. Zwei gleichzeitige Speichervorgänge: genau einer gewinnt (Integrationstest).

**Validierung:** Jedes gespeicherte Dokument läuft durch `parseDesignDocument` (Abschnitt 5a); ungültig → `400 invalid_document` mit den ersten Fundstellen. Der Server nimmt Vorschaubilder nur als PNG/JPEG/WebP-Data-URL bis 400 000 Zeichen an, sonst erzeugt er eine SVG-Vorschau. Das JSON-Limit liegt bei 15 MB (`413 too_large` mit verständlicher Meldung im Editor). Weil gespeicherte Dokumente später als Inline-SVG im Betrachter erscheinen, ist diese Prüfung auch die Grundlage gegen eingeschleusten Code.

**Freigabe-Links:** `POST/GET/DELETE /api/designs/:id/shares` (nur Besitzer; je Rolle ein Link, idempotent), öffentlich `GET /api/share/:token` und `PUT /api/share/:token` (nur Rolle EDIT; Maße bleiben die des Designs). Unbekannte, abgelaufene, widerrufene Tokens und Links auf Designs im Papierkorb antworten identisch mit 404. Die Antwort enthält keine Besitzerdaten. Öffentliche Routen haben ein IP-Limit (300/min). Der Betrachter (`/s/:token`) rendert die Seiten mit `pageToSvg` und den in Konva gemessenen Zeilenumbrüchen als Inline-SVG; Bearbeiten-Links öffnen denselben Editor, ohne Vorlagen-Tab und ohne Teilen/Umbenennen.

**Uploads:** `POST /api/assets/presign` (angemeldet, 60/min) prüft Typ (PNG/JPEG/WebP/GIF, kein SVG) und Größe (≤ 10 MB), vergibt den Schlüssel `u/<nutzer>/<uuid>.<ext>` (nie aus dem Dateinamen) und liefert eine 5 Minuten gültige PUT-URL, in deren Signatur Content-Type, Content-Length und Cache-Control stehen. Der Browser lädt direkt hoch und prüft danach, dass er die URL laden darf (CORS); sonst wird das Bild eingebettet und der Asset-Eintrag wieder gelöscht. Ohne konfigurierten Speicher antwortet die Route mit 501 und alles läuft wie vorher. Getestet gegen einen S3-Nachbau (`e2e/uploads.mjs`) und gegen die Signatur-Parameter; ein echter RustFS-/S3-Lauf steht aus.

**Konto:** `PATCH /api/auth/profile`, `POST /api/auth/password` (altes Passwort nötig, außer bei reinen Google-Konten), `DELETE /api/auth/account` (E-Mail und Passwort zur Bestätigung; Kaskade löscht Designs, Ordner, Bilder, Links).

## 6. Backend

REST unter `/api`: `auth/*`, `designs` (CRUD, Ordner, Papierkorb, Duplizieren), `templates` (nur lesen), `assets` (Presigned-Upload), `share/:token`. Teilen: `ShareLink` mit Token und Rolle VIEW/EDIT; Zugriff über Token wird serverseitig gegen die Rolle geprüft. Zod validiert jeden Request. Hintergrund entfernen läuft über den Server (API-Key bleibt serverseitig).

## 6a. API-Überblick (Stand Etappe b)

Alle Routen außer `/api/auth/*` und `/api/health` verlangen eine gültige Sitzung. Jede Datenabfrage ist auf den Besitzer begrenzt; fremde IDs antworten wie nicht vorhandene (404, nie 403), damit keine Existenz verraten wird.

| Route | Zweck |
|---|---|
| `GET /api/designs?q&folderId&trash&sort&limit` | Liste (ohne Seiteninhalt), Suche im Titel, `folderId=root` = ohne Ordner |
| `POST /api/designs` | leer (`width`,`height`) oder aus Vorlage (`templateId`); Vorschau wird serverseitig aus der ersten Seite gerendert |
| `GET /api/designs/:id` | vollständiges Design für den Editor (nicht für Papierkorb-Einträge) |
| `PATCH /api/designs/:id` | Titel ändern, in Ordner verschieben (`folderId: null` = zurück in den Hauptbereich) |
| `POST /api/designs/:id/duplicate`, `/trash`, `/restore` | Kopie, in den Papierkorb, wiederherstellen |
| `DELETE /api/designs/:id`, `DELETE /api/designs/trash` | endgültig löschen (nur aus dem Papierkorb), Papierkorb leeren |
| `GET/POST/PATCH/DELETE /api/folders` | flache Ordner mit Design-Zähler; Löschen lässt Designs im Hauptbereich |
| `GET /api/templates?category&q`, `/api/templates/categories` | Galerie mit Vorschau, Filter, Kategorien-Zähler |
| `PUT /api/designs/:id` | speichern (Schema-geprüft, `version` für Optimistic Locking, optionale PNG-Vorschau); 409 bei Konflikt |
| `GET/POST /api/designs/:id/shares`, `DELETE …/shares/:linkId` | Freigabe-Links (VIEW/EDIT) verwalten |
| `GET/PUT /api/share/:token` | öffentlich: Design über Link ansehen bzw. (EDIT) speichern |
| `GET /api/assets`, `POST /api/assets/presign`, `DELETE /api/assets/:id` | eigene Bilder, signierte Upload-URL |
| `PATCH /api/auth/profile`, `POST /api/auth/password`, `DELETE /api/auth/account` | Profil, Passwort, Konto |

Papierkorb: Einträge älter als 30 Tage werden beim nächsten Öffnen des Papierkorbs endgültig gelöscht (kein Cron nötig; ein Job kann später ergänzt werden).
Neue Designs bekommen zunächst eine SVG-Vorschau aus `pageToSvg`; sobald der Editor speichert, ersetzt er sie durch ein PNG (Abschnitt 5b).

## 7. Etappenplan

| Etappe | Inhalt | Fertig, wenn |
|---|---|---|
| (a) ✅ | Setup, Auth (E-Mail + Google), Landing/Login, Theme | Registrieren, Einloggen, Logout im Browser |
| (b) ✅ | Dashboard, Format-Schnellauswahl, „Zuletzt bearbeitet“, Meine Designs, Ordner, Papierkorb | Design anlegen und in der Liste sehen |
| (c) ✅ | Editor-Kern: Canvas, Zoom/Pan, Auswahl, Transformer, Formen/Text/Bild, Undo/Redo, Tastenkürzel, Store-Tests | 100+ Objekte flüssig, Undo/Redo getestet |
| (d) ✅ | Toolbar, Panels, Ebenen (Drag-Sortierung), Gruppieren, Ausrichten, Smart Guides, Bildfilter/Crop, Hintergründe, mehrseitig | Alle Muss-Funktionen bedienbar |
| (e) ✅ | 20+ Vorlagen, Export PNG/JPG/SVG/PDF | Vorlage anwenden und exportieren |
| (f) ✅ | Autosave, Speichern in DB, Teilen per Link, Einstellungen/Profil | Reload behält Design, Link öffnet Ansicht |

## 8. Risiken

- **Performance bei 100+ Objekten**: Messung per Benchmark-Szene in Etappe (c), nicht erst am Ende.
- **Text-Rendering**: Konva-Text und SVG/PDF-Export müssen identisch umbrechen; Zeilenumbruch einmal zentral berechnen.
- **Hintergrund entfernen**: braucht einen remove.bg-Key (Abschnitt 9).
- **Google OAuth/S3**: laufen lokal nur mit eigenen Zugangsdaten bzw. RustFS; Etappe (a) funktioniert vorab mit E-Mail-Login.

## 9. Entscheidungen zu Abweichungen von der Vorgabe

1. **SVG-Export**: eigener Serializer statt `html-to-image` (entschieden).
2. **Ablageort**: eigenes Repo. Bis es existiert, liegt der Code unter `designhub/` auf dem Branch `claude/dreamy-hawking-m38lph`; Umzug folgt, sobald das leere Repo bereitsteht.
3. **Hintergrund entfernen**: remove.bg, Aufruf nur serverseitig; `BG_REMOVAL_API_KEY` in `.env` (entschieden).
