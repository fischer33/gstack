#!/usr/bin/env node
// MCP-Server: gibt Claude Zugriff auf die Replika-App (Bilder/Kurzvideos erzeugen, Library lesen).
// Voraussetzung: die App läuft (npm run dev). Ziel-URL über APP_URL (Standard http://localhost:3000).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const aspect = z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional();

async function api(path, init) {
  const res = await fetch(APP_URL + path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const asText = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const asError = (e) => ({ isError: true, content: [{ type: "text", text: `Fehler: ${e.message} (läuft die App unter ${APP_URL}?)` }] });

async function generate(args) {
  const item = await api("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args, source: "claude" }),
  });
  return asText({ ...item, absoluteUrl: APP_URL + item.url, hinweis: "Mock-Provider: Platzhalter-Medien" });
}

const server = new McpServer({ name: "higgsfield-clone", version: "0.1.0" });

server.tool(
  "generate_image",
  "Erzeugt ein Bild in der Replika-App und legt es in der Library ab.",
  { prompt: z.string().min(1).max(1000), aspect, model: z.string().optional() },
  async (a) => generate({ type: "image", ...a }).catch(asError),
);

server.tool(
  "generate_video",
  "Erzeugt ein Kurzvideo (5 oder 10 Sekunden) in der Replika-App und legt es in der Library ab.",
  { prompt: z.string().min(1).max(1000), aspect, duration: z.union([z.literal(5), z.literal(10)]).optional(), model: z.string().optional() },
  async (a) => generate({ type: "video", ...a }).catch(asError),
);

server.tool("list_library", "Listet die zuletzt erzeugten Medien der App.", { limit: z.number().int().min(1).max(100).optional() }, async ({ limit }) => {
  try {
    const all = await api("/api/library");
    return asText(all.slice(0, limit ?? 20).map((i) => ({ ...i, absoluteUrl: APP_URL + i.url })));
  } catch (e) {
    return asError(e);
  }
});

await server.connect(new StdioServerTransport());
