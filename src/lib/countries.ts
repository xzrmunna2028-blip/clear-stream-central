// Name → ISO-3166-1 alpha-2 map for FIFA World Cup 2026 nations + helpers.
// Used to render auto-flags next to team names. Flags come from flagcdn.com.

const MAP: Record<string, string> = {
  // FIFA WC 2026 confirmed/likely nations + extras
  argentina: "ar", australia: "au", austria: "at", belgium: "be",
  brazil: "br", canada: "ca", chile: "cl", colombia: "co",
  croatia: "hr", denmark: "dk", ecuador: "ec", egypt: "eg",
  england: "gb-eng", france: "fr", germany: "de", ghana: "gh",
  greece: "gr", hungary: "hu", iceland: "is", iran: "ir",
  italy: "it", japan: "jp", jordan: "jo", "ivory coast": "ci", "cote d'ivoire": "ci",
  mexico: "mx", morocco: "ma", netherlands: "nl", holland: "nl",
  "new zealand": "nz", nigeria: "ng", norway: "no",
  paraguay: "py", peru: "pe", poland: "pl", portugal: "pt",
  qatar: "qa", "republic of ireland": "ie", ireland: "ie",
  "saudi arabia": "sa", scotland: "gb-sct", senegal: "sn", serbia: "rs",
  "south africa": "za", "south korea": "kr", korea: "kr", spain: "es",
  sweden: "se", switzerland: "ch", tunisia: "tn", turkey: "tr",
  "united states": "us", usa: "us", uruguay: "uy", wales: "gb-wls",
  "czech republic": "cz", czechia: "cz", ukraine: "ua", russia: "ru",
  bangladesh: "bd", india: "in", pakistan: "pk", "sri lanka": "lk",
  afghanistan: "af", "united arab emirates": "ae", uae: "ae",
  bolivia: "bo", venezuela: "ve", panama: "pa", "costa rica": "cr",
  honduras: "hn", jamaica: "jm", cuba: "cu", "el salvador": "sv",
  guatemala: "gt", haiti: "ht", "trinidad and tobago": "tt",
  algeria: "dz", cameroon: "cm", "cape verde": "cv", "cabo verde": "cv",
  guinea: "gn", mali: "ml", uganda: "ug", kenya: "ke",
  finland: "fi", romania: "ro", slovakia: "sk", slovenia: "si",
  "bosnia and herzegovina": "ba", albania: "al", "north macedonia": "mk",
  georgia: "ge", armenia: "am", azerbaijan: "az", kazakhstan: "kz",
  uzbekistan: "uz", iraq: "iq", lebanon: "lb", syria: "sy",
  oman: "om", bahrain: "bh", kuwait: "kw", yemen: "ye",
  thailand: "th", vietnam: "vn", malaysia: "my", indonesia: "id",
  philippines: "ph", singapore: "sg", china: "cn",
};

export function isoForCountry(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = name.trim().toLowerCase();
  if (!k) return null;
  if (MAP[k]) return MAP[k];
  // Already an ISO code?
  if (/^[a-z]{2}(-[a-z]{3})?$/i.test(k)) return k.toLowerCase();
  return null;
}

export function flagUrl(iso: string | null | undefined, width = 160): string | null {
  if (!iso) return null;
  return `https://flagcdn.com/w${width}/${iso.toLowerCase()}.png`;
}

export const COUNTRY_OPTIONS = Object.entries(MAP)
  .map(([name, iso]) => ({
    name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    iso,
  }))
  // de-dupe by iso (keep first)
  .filter((opt, i, arr) => arr.findIndex((x) => x.iso === opt.iso) === i)
  .sort((a, b) => a.name.localeCompare(b.name));
