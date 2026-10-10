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

```bash
brew install uv                         # falls noch nicht vorhanden
uv tool install --upgrade mflux         # installiert mflux-generate
cp .env.example .env.local              # enthält PROVIDER=local
npm run dev
```

- **Erster Lauf:** mflux lädt das Flux-schnell-Modell herunter (einmalig, einige zehn GB Speicherplatz). Das kann länger als 10 Minuten dauern. Teste es vorher einmal direkt im Terminal:
  `mflux-generate --model schnell --prompt "a red fox in snow" --steps 4 --width 512 --height 512 --quantize 4 --output test.png`
- **16 GB RAM:** Standard ist 4-Bit-Quantisierung und 768 px lange Seite. Mit `LOCAL_IMAGE_LONG_SIDE` und `LOCAL_IMAGE_QUANTIZE` stellst du Qualität gegen Geschwindigkeit und RAM.
- Jobs laufen nacheinander, damit der Speicher nicht überläuft.
- Ergebnisse liegen in `data/media/`.
- **Videos bleiben Platzhalter** (animierte SVGs). Lokale Videomodelle sind auf 16 GB zu langsam und instabil.

## Optional, kostenpflichtig: Replicate

Mit `PROVIDER=replicate` und `REPLICATE_API_TOKEN` in `.env.local` laufen Bilder über [Replicate](https://replicate.com) (Standard `black-forest-labs/flux-schnell`, nur Bilder). Eine Bremse (`REPLICATE_MAX_PER_HOUR`, Standard 30) begrenzt die Kosten. 4:3 und 3:4 werden auf 5:4 und 4:5 abgebildet.

Ohne `PROVIDER` und ohne Token entstehen Farbverlauf-Platzhalter (Mock).

Die Library liegt lokal in `data/library.json`. Die API hat keine Authentifizierung und ist nur für lokale Entwicklung gedacht.
