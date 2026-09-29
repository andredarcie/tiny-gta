import PT_BR from '../../data/i18n/pt-BR.json';

// Minimal localisation for player-facing HUD text. The game is written in English; a
// language table translates what the HUD shows at its output points (hud.ts message /
// bigText / the E-prompt / weapon name / place name), so game code keeps its English
// strings. Tables grow ON DEMAND: a string is translated when a video (or the user)
// needs it — see .claude/skills/record-video/SKILL.md.
//
// Language: ?lang=pt-BR in the URL, else localStorage 'tinygta_lang', else English.
// Table format (src/data/i18n/<lang>.json):
//   exact    — { "ENGLISH TEXT": "TRADUÇÃO" }  (whole-string match)
//   patterns — [[ "regex", "replacement with $1" ], …]  for strings with numbers/names
// In dev, every HUD string with no translation is logged once as `[i18n-miss] …`
// (the video director collects these into output/video/<scene>/untranslated.txt).

type Table = { exact: Record<string, string>; patterns: [string, string][] };
const TABLES: Record<string, Table> = { 'pt-BR': PT_BR as unknown as Table };

function pickLang(): string {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q) return q;
    return localStorage.getItem('tinygta_lang') || 'en';
  } catch { return 'en'; }
}
export const lang = pickLang();
const table: Table | null = TABLES[lang] ?? null;
const compiled = (table?.patterns ?? []).map(([re, to]) => [new RegExp(re), to] as [RegExp, string]);
const missed = new Set<string>();

/** Translate one HUD string to the active language (identity in English). */
export function tr(s: string): string {
  if (!table || !s) return s;
  const hit = table.exact[s];
  if (hit !== undefined) return hit;
  for (const [re, to] of compiled) if (re.test(s)) return s.replace(re, to);
  if (import.meta.env.DEV && !missed.has(s)) { missed.add(s); console.log('[i18n-miss]', s); }
  return s;
}
