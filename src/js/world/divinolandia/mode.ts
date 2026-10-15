// Map mode switch, kept import-free so the classic map never pulls in the ~1 MB of
// baked town data: Divinolândia is opt-in (?map=divinolandia, or the title-screen
// button) while the rest of the game migrates to the real town step by step.
export function divinoModeOn():boolean{
  try{return /[?&]map=divinolandia\b/.test(location.search);}catch{return false;}
}
