import { describe, expect, it } from 'vitest';
import type { Element } from '@designhub/shared';
import { fontsOf } from './docFonts';

const base = { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, locked: false, visible: true };
const text = (id: string, fontFamily: string) => ({ ...base, id, type: 'text', text: 'x', fontFamily, fontSize: 10, fontWeight: 400, italic: false, underline: false, align: 'left', fill: '#000', lineHeight: 1.2, letterSpacing: 0 }) as Element;

describe('fontsOf', () => {
  it('sammelt Familien aus Text und Gruppen, ohne Doppelte', () => {
    const els: Element[] = [text('a', 'Inter'), text('b', 'Pacifico'), { ...base, id: 'g', type: 'group', children: [text('c', 'Inter'), text('d', 'Lora')] }, { ...base, id: 'r', type: 'shape', kind: 'rect', fill: '#000', stroke: '#000', strokeWidth: 0 }];
    expect([...fontsOf(els)].sort()).toEqual(['Inter', 'Lora', 'Pacifico']);
  });
  it('leer', () => expect(fontsOf([]).size).toBe(0));
});
