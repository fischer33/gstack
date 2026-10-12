/** Antwort-Typen der REST-API, von Server und Web gemeinsam genutzt. Datumsfelder sind ISO-Strings. */

export interface DesignSummary {
  id: string;
  title: string;
  width: number;
  height: number;
  /** `data:`-URL (PNG vom Editor, SVG als Ersatz) oder null, wenn noch keine Vorschau existiert */
  thumbnail: string | null;
  folderId: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FolderSummary { id: string; name: string; designCount: number }

export interface TemplateSummary {
  id: string;
  title: string;
  category: string;
  tags: string[];
  width: number;
  height: number;
  thumbnail: string;
}

/** Vollständige Vorlage inkl. Inhalt (für „Vorlage anwenden“) */
export interface TemplateDetail extends Omit<TemplateSummary, 'thumbnail'> { data: import('./document').DesignDocument }

export interface TemplateCategory { name: string; count: number }

/** Papierkorb-Einträge werden nach dieser Zeit endgültig gelöscht. */
export const TRASH_RETENTION_DAYS = 30;

/** Vollständiges Design, wie der Editor es lädt und speichert. */
export interface DesignDetail extends DesignSummary { pages: import('./document').Page[]; version: number }

export type ShareRole = 'VIEW' | 'EDIT';

export interface ShareLinkSummary { id: string; token: string; role: ShareRole; expiresAt: string | null; createdAt: string }

/** Was ein Besucher über einen Freigabe-Link sieht (keine Besitzerdaten). */
export interface SharedDesign { title: string; width: number; height: number; pages: import('./document').Page[]; version: number; role: ShareRole }

export interface SaveResult { version: number; updatedAt: string }

export interface AssetSummary { id: string; url: string; mime: string; size: number; createdAt: string }
