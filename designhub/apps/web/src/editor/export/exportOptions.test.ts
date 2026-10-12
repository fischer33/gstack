import { describe, expect, it } from 'vitest';
import { blankDocument } from '@designhub/shared';
import { exportFileName, maxAllowedScale, pagesToExport, pixelSize, scaleAllowed } from './exportOptions';

describe('Export-Hilfen', () => {
  it('rechnet Pixelgrößen gerundet um', () => {
    expect(pixelSize(1080, 1350, 2)).toEqual({ width: 2160, height: 2700 });
    expect(pixelSize(101, 51, 0.5)).toEqual({ width: 51, height: 26 });
  });
  it('lehnt zu große Canvas ab', () => {
    expect(scaleAllowed(1080, 1080, 4)).toBe(true);
    expect(scaleAllowed(8000, 8000, 1)).toBe(true);
    expect(scaleAllowed(8000, 8000, 2)).toBe(false); // 256 Mio. Pixel
    expect(scaleAllowed(5000, 5000, 4)).toBe(false); // Kante > 16384
    expect(maxAllowedScale(8000, 8000)).toBe(1);
    expect(maxAllowedScale(1080, 1080)).toBe(4);
  });
  it('bereinigt Dateinamen', () => {
    expect(exportFileName('Mein/Design: neu?', 'png')).toBe('Mein Design neu.png');
    expect(exportFileName('', 'pdf')).toBe('Design.pdf');
    expect(exportFileName('..versteckt', 'svg', 2)).toBe('versteckt-3.svg');
    expect(exportFileName('x'.repeat(200), 'png').length).toBe(84);
  });
  it('wählt Seiten', () => {
    const doc = blankDocument(100, 100);
    doc.pages.push({ ...doc.pages[0]!, id: 'p2' });
    expect(pagesToExport(doc, 'all', 'p2')).toHaveLength(2);
    expect(pagesToExport(doc, 'current', 'p2').map((p) => p.id)).toEqual(['p2']);
    expect(pagesToExport(doc, 'current', 'weg')[0]!.id).toBe(doc.pages[0]!.id);
  });
});
