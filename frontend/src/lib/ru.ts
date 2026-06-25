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
