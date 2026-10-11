# DesignHub

Browserbasierter Grafik-Editor (Vorlagen, Canvas, Export). Stand: **Etappe 1 – Architektur + Setup**.
Architektur und Etappenplan: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Voraussetzungen
Node 20+, Docker (für Postgres und MinIO).

## Starten

```bash
cp .env.example .env
npm install
npm run db:up                 # Postgres :5432, MinIO :9000 (Konsole :9001)
npm run dev                   # Web http://localhost:5173, API http://localhost:4000
```

## Prüfen

```bash
npm run typecheck && npm test && npm run build
curl localhost:4000/api/health      # -> {"ok":true}
```

Die Startseite zeigt „DesignHub“ mit dem Violett/Türkis-Verlauf. Datenbank-Migration (`npm run db:migrate`) wird ab Etappe (a) benötigt.
