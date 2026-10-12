import type { Element } from '@designhub/shared';

/** Alle Schriftfamilien, die in Elementen (auch in Gruppen) vorkommen. */
export function fontsOf(elements: readonly Element[], into = new Set<string>()): Set<string> {
  for (const e of elements) {
    if (e.type === 'text') into.add(e.fontFamily);
    else if (e.type === 'group') fontsOf(e.children, into);
  }
  return into;
}
