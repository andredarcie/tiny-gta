// Filtro de palavrões para apelidos do ranking (pt-BR + inglês).
// Estratégia: normaliza o texto (minúsculas, leet -> letras, sem acentos,
// só a-z0-9 e colapsa repetições). Termos longos/inequívocos batem por
// substring (pra pegar evasão tipo "xxfuckxx", "sep_a_r_ado"); termos curtos
// ou ambíguos (cu, pau, pinto…) só batem se forem o apelido inteiro OU uma
// PALAVRA isolada do apelido (pega "CU ROXO" sem derrubar "CURITIBA"). Nomes
// têm no máx 12 chars.

// Termos longos: match por substring. Já em minúsculas/normalizados.
const BAD_SUBSTR = [
  // inglês
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'asshole', 'bastard', 'slut',
  'whore', 'faggot', 'nigger', 'nigga', 'retard', 'rapist', 'wanker',
  'jerkoff', 'jackoff', 'dildo', 'hitler',
  // português
  'caralho', 'porra', 'merda', 'buceta', 'boceta', 'viado', 'viadinho',
  'cuzao', 'cuzinho', 'foder', 'fodase', 'piroca', 'xoxota', 'punheta',
  'corno', 'vagabunda', 'vadia', 'arrombado', 'arrombada', 'desgraca',
  'filhodaputa', 'bosta', 'cacete', 'cabrao', 'siririca', 'gozada',
];

// Termos curtos/ambíguos: só batem se forem o apelido inteiro OU uma palavra
// isolada (após normalizar) — ver o loop por tokens em hasProfanity().
const BAD_EXACT = [
  'fck', 'fag', 'cum', 'jizz', 'cock', 'dick', 'twat', 'prick', 'boner',
  'nazi', 'cu', 'puta', 'puto', 'foda', 'pau', 'rola', 'pica',
  'pinto', 'xota', 'corna', 'fdp', 'pqp', 'vsf', 'preto', 'macaco',
  'gozar', 'pelado',
];

// Normaliza pra dificultar evasão: minúsculas, leetspeak comum, sem acentos,
// só a-z0-9 e colapsa letras repetidas ("merrrda" -> "merda"). As letras
// visualmente trocáveis i / l / 1 / ! / | viram todas "i" — é o que pega
// "HLTLER" (Hitler com L no lugar do I) e "CARAIHO" (caralho com I no lugar
// do L), já que o dicionário sofre a MESMA normalização ("hitler"->"hitier").
function normalize(s: unknown): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[@4]/g, 'a').replace(/[$5]/g, 's').replace(/0/g, 'o')
    .replace(/[1!|l]/g, 'i').replace(/3/g, 'e').replace(/7/g, 't')
    .replace(/[^a-z0-9]/g, '')
    .replace(/(.)\1+/g, '$1');
}

const SUBSTR = BAD_SUBSTR.map(normalize).filter(Boolean);
const EXACT = new Set(BAD_EXACT.map(normalize).filter(Boolean));

// true se o apelido contém/é um termo banido.
export function hasProfanity(raw: unknown): boolean {
  const n = normalize(raw);
  if (!n) return false;
  if (EXACT.has(n)) return true;
  if (SUBSTR.some(w => n.includes(w))) return true;
  // termo curto/ambíguo como PALAVRA isolada do apelido ("CU ROXO" -> "cu"),
  // sem derrubar nomes onde ele é só um pedaço ("CURITIBA", "PAULO").
  for (const tok of String(raw).split(/[^A-Za-z0-9]+/)) {
    const tn = normalize(tok);
    if (tn && EXACT.has(tn)) return true;
  }
  return false;
}
