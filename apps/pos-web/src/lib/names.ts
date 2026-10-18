// Display-name picker for entities that carry an Arabic and a French name.
// ar -> name_ar; fr/en -> name_fr, falling back to the other name only if missing.
export function pickName(
  lang: string,
  nameAr: string | null | undefined,
  nameFr: string | null | undefined,
): string {
  const primary = lang === 'ar' ? nameAr : nameFr;
  const secondary = lang === 'ar' ? nameFr : nameAr;
  return primary || secondary || '';
}
