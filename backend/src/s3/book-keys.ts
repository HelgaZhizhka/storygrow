/**
 * The single S3 key layout for a book (#380). Every producer and consumer of a
 * book artefact key goes through here — before this the same `books/<id>/…`
 * paths were hand-built in seven places, and `ReferenceSheetsService.load`
 * re-parsed them with its own regex.
 *
 *   books/<bookId>/upload                  raw child photo (deleted at generation)
 *   books/<bookId>/portrait.png            hero portrait (synthetic or photo-based)
 *   books/<bookId>/ref-cast-<id>.png       cast reference sheet
 *   books/<bookId>/ref-location-<id>.png   location establishing shot
 *   books/<bookId>/page-<n>.png            rendered page n (1-based)
 *   books/<bookId>/book.pdf                the assembled book
 */
export const bookKeys = (bookId: string) => {
  const root = `books/${bookId}`;
  return {
    prefix: `${root}/`,
    upload: `${root}/upload`,
    portrait: `${root}/portrait.png`,
    pdf: `${root}/book.pdf`,
    page: (pageNumber: number): string => `${root}/page-${pageNumber}.png`,
    castSheet: (castId: string): string => `${root}/ref-cast-${castId}.png`,
    locationSheet: (locationId: string): string => `${root}/ref-location-${locationId}.png`,
  };
};

export type SheetKind = 'cast' | 'location';

/** Inverse of `castSheet` / `locationSheet`; null for any other key. */
export const parseSheetKey = (key: string): { kind: SheetKind; id: string } | null => {
  const match = /\/ref-(cast|location)-(.+)\.png$/.exec(key);
  if (!match) return null;
  return { kind: match[1] as SheetKind, id: match[2] };
};
