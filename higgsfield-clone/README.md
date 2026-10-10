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

## Wichtig: Mock-Provider

Die Generierung ist simuliert (`src/lib/providers/index.ts`): Es entstehen Farbverlauf-Platzhalter, Videos sind animierte SVGs. Für echte Medien muss dort ein Provider mit einer echten Bild-/Video-API ergänzt werden (API-Key nur serverseitig in `.env.local`).

Die Library liegt lokal in `data/library.json`. Die API hat keine Authentifizierung und ist nur für lokale Entwicklung gedacht.
