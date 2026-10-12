/** Antwort-Typen der REST-API, von Server und Web gemeinsam genutzt. Datumsfelder sind ISO-Strings. */

export interface DesignSummary {
  id: string;
  title: string;
  width: number;
  height: number;
  /** `data:`-URL (SVG, später PNG) oder null, wenn noch keine Vorschau existiert */
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

export interface TemplateCategory { name: string; count: number }

/** Papierkorb-Einträge werden nach dieser Zeit endgültig gelöscht. */
export const TRASH_RETENTION_DAYS = 30;
