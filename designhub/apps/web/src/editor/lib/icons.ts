/**
 * Eigene, einfache Icons als Pfaddaten in einem 24×24-Raster (gefüllt, einfarbig, frei einfärbbar).
 * Sticker sind Emoji (Unicode) und werden als Text eingefügt.
 */
export interface IconDef { name: string; path: string }

export const ICON_VIEWBOX = 24;

export const ICONS: IconDef[] = [
  { name: 'Herz', path: 'M12 21C5 15.5 2 12 2 8.5 2 5.5 4.3 3.5 7 3.5c1.9 0 3.7 1 5 2.8 1.3-1.8 3.1-2.8 5-2.8 2.7 0 5 2 5 5C22 12 19 15.5 12 21Z' },
  { name: 'Haken', path: 'M9.2 17.6 4 12.4l1.9-1.9 3.3 3.3 8.9-8.9 1.9 1.9Z' },
  { name: 'Kreuz', path: 'm6.4 4.9 5.6 5.6 5.6-5.6 1.5 1.5-5.6 5.6 5.6 5.6-1.5 1.5-5.6-5.6-5.6 5.6-1.5-1.5 5.6-5.6-5.6-5.6Z' },
  { name: 'Plus', path: 'M10.5 3h3v7.5H21v3h-7.5V21h-3v-7.5H3v-3h7.5Z' },
  { name: 'Blitz', path: 'M13.5 2 5 13.5h5.5L9.5 22 19 9.5h-5.7Z' },
  { name: 'Sonne', path: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-1-5h2v3h-2Zm0 17h2v3h-2ZM2 11h3v2H2Zm17 0h3v2h-3ZM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4Zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4ZM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4ZM17.7 7.7l-1.4-1.4 2.1-2.1 1.4 1.4Z' },
  { name: 'Mond', path: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z' },
  { name: 'Wolke', path: 'M7 19a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9.5 4.7 4.7 0 0 1 17.5 19Z' },
  { name: 'Sprechblase', path: 'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z' },
  { name: 'Standort', path: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z' },
  { name: 'Fahne', path: 'M5 2h2v20H5Zm3 1h11l-3 4.5L19 12H8Z' },
  { name: 'Haus', path: 'M12 3 2 12h3v9h5v-6h4v6h5v-9h3Z' },
  { name: 'Pfeil rechts', path: 'M3 10.5h12.2l-4.6-4.6L12.5 4 21 12.5 12.5 21l-1.9-1.9 4.6-4.6H3Z' },
  { name: 'Pfeil hoch', path: 'M10.5 21V8.8l-4.6 4.6L4 11.5 12.5 3 21 11.5l-1.9 1.9-4.6-4.6V21Z' },
  { name: 'Kreis-Haken', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.8 14.6-4-4 1.4-1.4 2.6 2.6 6.2-6.2 1.4 1.4Z' },
  { name: 'Info', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2Zm0-8h-2V7h2Z' },
  { name: 'Krone', path: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5Z' },
  { name: 'Diamant', path: 'M6 3h12l4 6-10 12L2 9Z' },
  { name: 'Tropfen', path: 'M12 2C8 8 5 11.5 5 15a7 7 0 0 0 14 0c0-3.5-3-7-7-13Z' },
  { name: 'Blatt', path: 'M20 3C10 3 4 8 4 15c0 1.6.4 3 1 4.2C7 15 11 12 16 10.500c-4 2.600-7 5.500-8.700 9.500 1 .6 2.200 1 3.700 1 7 0 9-7 9-18Z' },
  { name: 'Musik', path: 'M9 3v12.3A3.500 3.500 0 1 0 11 18.500V8l8-2v7.300A3.500 3.500 0 1 0 21 16.500V3Z' },
  { name: 'Kamera', path: 'M9 3 7.200 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.200L15 3Zm3 5.500a4.500 4.500 0 1 1 0 9 4.500 4.500 0 0 1 0-9Z' },
  { name: 'Glühbirne', path: 'M9 21h6v-1.500H9ZM12 2a7 7 0 0 0-4 12.700V17h8v-2.300A7 7 0 0 0 12 2Z' },
  { name: 'Schloss', path: 'M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9Zm-8 0V7a3 3 0 0 1 6 0v2Z' },
];

export const STICKERS = ['😀', '😍', '🥳', '😎', '🤩', '🔥', '✨', '🎉', '🎈', '🎁', '💡', '🚀', '🌈', '🌸', '🍀', '☕', '🍕', '🎵', '📸', '💎', '🏆', '❤️', '👍', '👏'];
