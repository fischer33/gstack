# Higgs Clone

Nachbau-Prototyp einer KI-Bild-/Video-Plattform (Next.js 14, Tailwind, Zustand). Eigenständiges Projekt, nicht Teil von gstack. Keine Original-Assets oder Marken.

## Start

```bash
npm install
npm run dev        # http://localhost:3000
```

Seiten: Explore (Feed, Likes, Remix), Create (Bild/Video), Effects, Library, Profil, Pricing, Dark/Light-Switch.

## Claude-Zugriff (MCP)

Die App hat eine HTTP-API (`POST /api/generate`, `GET /api/library`) und einen MCP-Server (`mcp/server.mjs`) mit den Tools `generate_image`, `generate_video` und `list_library`. Von Claude erzeugte Medien erscheinen mit „Claude“-Badge in der Library.

1. App starten (`npm run dev`).
2. In diesem Ordner Claude Code starten, die mitgelieferte `.mcp.json` registriert den Server. Alternativ: `claude mcp add higgsfield-clone -- node /absoluter/pfad/mcp/server.mjs`.
3. Claude bitten: „Erzeuge ein Bild von …“ oder „Mach ein 5-Sekunden-Video von …“.

## Kostenlos: Bilder lokal auf dem Mac (mflux)

Mit `PROVIDER=local` entstehen Bilder auf deinem eigenen Rechner. Es kostet nichts, es gibt kein Limit und nichts verlässt den Mac.

Führe die Befehle einzeln aus und kopiere **keine** `#`-Kommentare mit (zsh behandelt sie im Terminal als Argumente).

```bash
brew install uv
uv tool install --upgrade mflux
cp .env.example .env.local
npm run dev
```

**Wichtig: FLUX.1-schnell ist bei Hugging Face zugangsbeschränkt.** Ohne Anmeldung bricht der Download mit `401 Unauthorized` / `GatedRepoError` ab. Einmalig, kostenlos:

1. Konto auf huggingface.co anlegen und auf https://huggingface.co/black-forest-labs/FLUX.1-schnell die Lizenz bestätigen.
2. Unter https://huggingface.co/settings/tokens einen Token vom Typ **Read** erstellen.
3. Den Token als `HF_TOKEN=...` in `.env.local` eintragen (nie committen, nie in Chats posten). Für den Erst-Download im Terminal: `read -s HF_TOKEN`, Token einfügen, Enter, dann `export HF_TOKEN`.

- **Erster Lauf:** mflux lädt das Flux-schnell-Modell herunter (einmalig, einige zehn GB Speicherplatz). Das kann länger als 10 Minuten dauern. Teste es vorher einmal direkt im Terminal:
  `mflux-generate --model schnell --prompt "a red fox in snow" --steps 4 --width 512 --height 512 --quantize 4 --output test.png`
- **16 GB RAM:** Standard ist 4-Bit-Quantisierung und 768 px lange Seite. Mit `LOCAL_IMAGE_LONG_SIDE` und `LOCAL_IMAGE_QUANTIZE` stellst du Qualität gegen Geschwindigkeit und RAM.
- Jobs laufen nacheinander, damit der Speicher nicht überläuft.
- Ergebnisse liegen in `data/media/`.
- **Videos bleiben Platzhalter** (animierte SVGs). Lokale Videomodelle sind auf 16 GB zu langsam und instabil.

## Eigene Bilder hochladen und Werbefilme erstellen

- **Upload:** In der Library auf „Bilder hochladen“ klicken oder Dateien ins Fenster ziehen (PNG, JPG, WebP, max. 15 MB). Der Dateityp wird am Inhalt geprüft.
- **Von Link hinzufügen:** In der Library Bild-Links einfügen (einer pro Zeile, bis zu 30). Erlaubt sind nur Adressen von `cdn.shopify.com`, also deine Shop-Bilder; weitere Hosts nur über `IMPORT_ALLOWED_HOSTS`. Weiterleitungen werden erneut geprüft, die Größe ist auf 15 MB begrenzt, der Dateityp wird am Inhalt erkannt.
- **Ad-Maker** (`/ads`): Bilder aus der Library auswählen, anordnen, pro Folie Überschrift und Unterzeile setzen und einen Call-to-Action für die letzte Folie. Ergebnis ist ein MP4 in 9:16, 1:1 oder 16:9 mit langsamem Zoom und Überblendung (2 bis 6 Sekunden pro Folie, bis zu 10 Folien).
- **Bild im Format:** „Füllen“ schneidet Ränder ab, „Einpassen“ zeigt das ganze Bild und füllt den Rest unscharf auf (sinnvoll für quadratische Produktbilder im 9:16-Reel).
- Läuft komplett lokal und kostenlos über ein mitgeliefertes ffmpeg (`@ffmpeg-installer/ffmpeg`). Eigenes ffmpeg per `FFMPEG_PATH`.
- **Das ist eine Bilder-Show, kein KI-Video.** Die Videos haben keinen Ton; Musik fügst du in der Ziel-App (Instagram, TikTok, CapCut) hinzu.
- Platzhalter-Bilder (Mock) lassen sich nicht verwenden, nur echte Dateien.

## Alternative ohne Download: Hugging Face Inference Providers

Mit `PROVIDER=huggingface` läuft die Berechnung beim Anbieter (Standard `nscale` mit `FLUX.1-schnell`), es ist kein Modell-Download auf dem Mac nötig. Der Token kommt aus `HF_TOKEN` in `.env.local` oder aus `~/.cache/huggingface/token`.

- **Das ist nicht automatisch gratis:** Hugging Face bietet ein kleines Guthaben, danach rechnet der Anbieter ab. Aktuellen Stand unter https://huggingface.co/settings/billing prüfen.
- Kostenbremse `HF_MAX_PER_HOUR` (Standard 30).
- Das Seitenverhältnis wird nicht gesendet (der Anbieter bestimmt die Größe), optional `HF_IMAGE_SIZE`.
- Getestet nur gegen einen Stub, nicht gegen den echten Dienst.

## Optional, kostenpflichtig: Replicate

Mit `PROVIDER=replicate` und `REPLICATE_API_TOKEN` in `.env.local` laufen Bilder über [Replicate](https://replicate.com) (Standard `black-forest-labs/flux-schnell`, nur Bilder). Eine Bremse (`REPLICATE_MAX_PER_HOUR`, Standard 30) begrenzt die Kosten. 4:3 und 3:4 werden auf 5:4 und 4:5 abgebildet.

Ohne `PROVIDER` und ohne Token entstehen Farbverlauf-Platzhalter (Mock).

Die Library liegt lokal in `data/library.json`. Die API hat keine Authentifizierung und ist nur für lokale Entwicklung gedacht.
