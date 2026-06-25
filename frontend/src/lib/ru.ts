// After these consonants a final -а declines to -и, not -ы (spelling rule).
const SIBILANT_VELAR = new Set(['г', 'к', 'х', 'ж', 'ч', 'ш', 'щ']);
const INDECLINABLE_ENDINGS = new Set(['о', 'е', 'э', 'у', 'ю', 'и', 'ы']);

/**
 * Decline a Russian first name to the genitive case ("for X" → "для Маши").
 * Heuristic — covers the common given-name endings; foreign/indeclinable
 * names (Лео, Майю) pass through unchanged.
 */
export function genitiveName(name: string): string {
  const n = name.trim();
  if (n.length < 2) return n;

  const last = n[n.length - 1].toLowerCase();
  const prev = n[n.length - 2].toLowerCase();
  const head = n.slice(0, -1);

  if (last === 'а') return head + (SIBILANT_VELAR.has(prev) ? 'и' : 'ы');
  if (last === 'я') return head + 'и';
  if (last === 'й') return head + 'я';
  if (last === 'ь') return head + 'я';
  if (INDECLINABLE_ENDINGS.has(last)) return n;
  return n + 'а'; // consonant ending (Иван → Ивана)
}

/** Russian plural for "year": 1 год, 2–4 года, 5–20 лет. */
export function pluralYears(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'год';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'года';
  return 'лет';
}
