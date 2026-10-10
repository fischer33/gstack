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

## Echte Bilder mit Replicate

Bilder werden über [Replicate](https://replicate.com) erzeugt (Standard: `black-forest-labs/flux-schnell`), sobald ein Token gesetzt ist:

```bash
cp .env.example .env.local   # dann REPLICATE_API_TOKEN eintragen
npm run dev                  # Server nach Änderung an .env.local neu starten
```

- Replicate rechnet pro Bild ab. Eine Bremse (`REPLICATE_MAX_PER_HOUR`, Standard 30) begrenzt die Kosten, auch wenn Claude Bilder erzeugt.
- Ergebnisse werden lokal in `data/media/` gespeichert, weil Replicate-Links ablaufen.
- Ohne Token (oder mit `PROVIDER=mock`) entstehen Farbverlauf-Platzhalter.
- **Videos laufen weiterhin über den Mock** (animierte SVG-Platzhalter).
- 4:3 und 3:4 werden für flux-schnell auf 5:4 und 4:5 abgebildet.

Die Library liegt lokal in `data/library.json`. Die API hat keine Authentifizierung und ist nur für lokale Entwicklung gedacht.
