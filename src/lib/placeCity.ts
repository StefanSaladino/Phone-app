const regionOrCountryTokens = new Set([
  'ab',
  'alberta',
  'bc',
  'british columbia',
  'mb',
  'manitoba',
  'nb',
  'new brunswick',
  'nl',
  'newfoundland and labrador',
  'ns',
  'nova scotia',
  'nt',
  'northwest territories',
  'nu',
  'nunavut',
  'on',
  'ontario',
  'pe',
  'prince edward island',
  'qc',
  'quebec',
  'sk',
  'saskatchewan',
  'yt',
  'yukon',
  'ca',
  'ak',
  'al',
  'ar',
  'az',
  'co',
  'ct',
  'dc',
  'de',
  'fl',
  'ga',
  'hi',
  'ia',
  'id',
  'il',
  'in',
  'ks',
  'ky',
  'la',
  'ma',
  'md',
  'me',
  'mi',
  'mn',
  'mo',
  'ms',
  'mt',
  'nc',
  'nd',
  'ne',
  'nh',
  'nj',
  'nm',
  'nv',
  'ny',
  'oh',
  'ok',
  'or',
  'pa',
  'ri',
  'sc',
  'sd',
  'tn',
  'tx',
  'ut',
  'va',
  'vt',
  'wa',
  'wi',
  'wv',
  'wy',
  'usa',
  'us',
  'united states',
  'united states of america',
  'canada',
  'uk',
  'united kingdom',
]);

const canadianPostalCodePattern = /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/gi;
const usZipCodePattern = /\b\d{5}(?:-\d{4})?\b/g;

/**
 * Makes a conservative city guess from a comma-separated street address.
 * The result is only a convenience for the form and is always editable.
 */
export function inferCityFromAddress(address: string): string | null {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  // Start at the end so common region/country suffixes can be skipped.
  for (let index = parts.length - 1; index >= 1; index -= 1) {
    const candidate = parts[index]
      .replace(canadianPostalCodePattern, '')
      .replace(usZipCodePattern, '')
      .trim()
      .replace(/^[,\s]+|[,\s]+$/g, '');

    if (!candidate) continue;
    if (regionOrCountryTokens.has(candidate.toLowerCase())) continue;
    if (/^\d+$/.test(candidate)) continue;
    if (candidate.length > 120) continue;

    return candidate;
  }

  return null;
}
