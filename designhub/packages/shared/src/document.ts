/**
 * Dokumentmodell von DesignHub. Wird von Editor (Zustand-Store), Server (JSON-Spalte
 * `Design.pages`) und Export gemeinsam genutzt. Rein datenbasiert, keine Konva-Typen.
 * Änderungen hier sind Schema-Änderungen: `DOCUMENT_VERSION` erhöhen + Migration schreiben.
 */
export const DOCUMENT_VERSION = 1;

export type ID = string;

/** Gemeinsame Felder aller Objekte. Koordinaten in Design-Pixeln, Ursprung oben links. */
export interface BaseElement {
  id: ID;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Grad, im Uhrzeigersinn, um die Objektmitte */
  rotation: number;
  opacity: number; // 0..1
  locked: boolean;
  visible: boolean;
}

export interface Shadow { color: string; blur: number; offsetX: number; offsetY: number; opacity: number }

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow' | 'star';

export interface ShapeElement extends BaseElement {
  type: 'shape';
  kind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number; // rect
  points?: number; // star
  shadow?: Shadow;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 700;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  fill: string;
  lineHeight: number;
  letterSpacing: number;
  stroke?: string;
  strokeWidth?: number;
  shadow?: Shadow;
}

export interface ImageFilters { brightness: number; contrast: number; saturation: number; blur: number }

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  /** Zuschnitt in Pixeln des Quellbilds */
  crop?: { x: number; y: number; width: number; height: number };
  flipX: boolean;
  flipY: boolean;
  filters: ImageFilters;
  cornerRadius?: number;
}

/** SVG-Icon oder Sticker: Pfaddaten bzw. SVG-Quelle, einfärbbar. */
export interface IconElement extends BaseElement {
  type: 'icon';
  svg: string;
  fill: string;
}

export interface GroupElement extends BaseElement {
  type: 'group';
  children: Element[];
}

export type Element = ShapeElement | TextElement | ImageElement | IconElement | GroupElement;

export interface GradientStop { offset: number; color: string }
export type Background =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; angle: number; stops: GradientStop[] }
  | { type: 'image'; src: string; fit: 'cover' | 'contain' };

export interface Page {
  id: ID;
  background: Background;
  /** Z-Reihenfolge: Index 0 = ganz hinten */
  elements: Element[];
}

export interface DesignDocument {
  version: number;
  width: number;
  height: number;
  pages: Page[];
}

export const FORMATS = {
  instagramPost: { label: 'Instagram Post', width: 1080, height: 1080 },
  story: { label: 'Story', width: 1080, height: 1920 },
  presentation: { label: 'Präsentation', width: 1920, height: 1080 },
  poster: { label: 'Poster', width: 1587, height: 2245 }, // A3 @ ~96 dpi
  flyer: { label: 'Flyer', width: 1240, height: 1754 }, // A5 @ ~150 dpi
  businessCard: { label: 'Visitenkarte', width: 1050, height: 600 }, // 85x50 mm @ 300 dpi
  logo: { label: 'Logo', width: 500, height: 500 },
} as const;

export type FormatKey = keyof typeof FORMATS;
