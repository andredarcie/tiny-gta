// The file name of a line's dubbed clip: FNV-1a 32-bit over the UTF-8 bytes of
// "speaker|text", as 8 hex chars. Pure (no DOM), shared by the game (voices.ts) and the
// dubbing tool (tools/voice/export-lines.ts) so both always agree.
export function voiceKey(speaker: string,text: string): string{
  const bytes=new TextEncoder().encode(speaker+'|'+text);
  let h=0x811c9dc5;
  for(const b of bytes){h^=b;h=Math.imul(h,0x01000193)>>>0;}
  return h.toString(16).padStart(8,'0');
}
