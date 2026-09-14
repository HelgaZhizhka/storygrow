import { bookKeys, parseSheetKey } from './book-keys';

describe('bookKeys (#380)', () => {
  const keys = bookKeys('b1');

  it('lays out every artefact of a book under one prefix', () => {
    expect(keys.prefix).toBe('books/b1/');
    expect(keys.upload).toBe('books/b1/upload');
    expect(keys.portrait).toBe('books/b1/portrait.png');
    expect(keys.pdf).toBe('books/b1/book.pdf');
    expect(keys.page(3)).toBe('books/b1/page-3.png');
    expect(keys.castSheet('brother')).toBe('books/b1/ref-cast-brother.png');
    expect(keys.locationSheet('living-room')).toBe('books/b1/ref-location-living-room.png');
  });

  it('parses the sheet keys it produces and nothing else', () => {
    expect(parseSheetKey(keys.castSheet('brother'))).toEqual({ kind: 'cast', id: 'brother' });
    expect(parseSheetKey(keys.locationSheet('living-room'))).toEqual({
      kind: 'location',
      id: 'living-room',
    });
    expect(parseSheetKey(keys.portrait)).toBeNull();
    expect(parseSheetKey(keys.page(1))).toBeNull();
  });
});
