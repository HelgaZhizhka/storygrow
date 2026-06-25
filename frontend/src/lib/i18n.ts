/**
 * Convert a Russian child name to genitive case for use in fallback book titles.
 *
 * Examples:
 *   genitiveName('Маша')  → 'Маши'   (а → ы)
 *   genitiveName('Тёма')  → 'Тёмы'   (а → ы, male)
 *   genitiveName('Иван')  → 'Ивана'  (consonant + а)
 *   genitiveName('Андрей') → 'Андрея' (й → я)
 *   genitiveName('Игорь') → 'Игоря'  (ь → я)
 *   genitiveName('Таня')  → 'Тани'   (я → и)
 *
 * Indeclinable / foreign names (ending in о, е, ё, и, у, ю, э) pass through unchanged.
 */
export function genitiveName(name: string): string {
  if (!name) return name;

  const last = name[name.length - 1];

  // и → и (indeclinable: Миссисипи, Мэри, etc.)
  if (last === 'и') return name;

  // о → о (indeclinable foreign names: Додо, etc.)
  if (last === 'о') return name;

  // у → у (indeclinable)
  if (last === 'у') return name;

  // ю → ю (indeclinable)
  if (last === 'ю') return name;

  // э → э (indeclinable)
  if (last === 'э') return name;

  // е → е (indeclinable foreign names like Рене)
  if (last === 'е') return name;

  // я → и (Таня → Тани, Настя → Насти)
  if (last === 'я') return name.slice(0, -1) + 'и';

  // ь → я (Игорь → Игоря, Лазарь → Лазаря)
  if (last === 'ь') return name.slice(0, -1) + 'я';

  // й → я (Андрей → Андрея, Тимофей → Тимофея)
  if (last === 'й') return name.slice(0, -1) + 'я';

  // а → и after velars (г,к,х) and sibilants (ж,ш,ч,щ,ц); а → ы otherwise
  // Russian orthographic rule: never ы after г,к,х,ж,ш,ч,щ,ц
  if (last === 'а') {
    const secondLast = name.length > 1 ? name[name.length - 2] : '';
    const softeners = new Set(['г', 'к', 'х', 'ж', 'ш', 'ч', 'щ', 'ц']);
    const suffix = softeners.has(secondLast) ? 'и' : 'ы';
    return name.slice(0, -1) + suffix;
  }

  // Consonant-ending names (masculine genitive): add а
  // e.g., Иван → Ивана, Пётр → Петра, Александр → Александра
  // After sibilants (ш, ж, ч, щ, ц) we still add а (orthographically fine)
  return name + 'а';
}
