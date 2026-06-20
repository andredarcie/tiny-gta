// Player-facing settings (graphics + audio), persisted to localStorage and applied
// to the live engine / audio graph. Kept dependency-light: it imports ONLY the leaf
// setters from engine / audio / radio (none of which import this back), so it never
// forms an import cycle with the systems it configures. The pause menu
// (js/ui/pause-menu.ts) renders the UI from a schema and writes back via setSetting().
import {setShadowsEnabled,setBrightness} from '@/core/engine.ts';
import {setMasterVolume} from '@/audio/audio.ts';
import {setMusicVolume} from '@/ui/radio.ts';

const KEY='tinygta_settings';

// Settings shape: audio/graphics knobs persisted to localStorage.
interface Settings {
  master: number;
  music: number;
  muted: boolean;
  shadows: boolean;
  brightness: number;
  fps: boolean;
  aimAssist: boolean;
  filmGrain: boolean;
}

// Single source of truth for defaults. They are picked to REPRODUCE the game's
// original tuning (master gain 0.5, radio gain ~0.26, tone-mapping exposure 1.25,
// shadows on, FPS shown), so a fresh player gets exactly what shipped before
// settings existed — changing a slider is the only thing that deviates.
export const DEFAULTS: Settings={
  master:50,      // 0..100 -> master gain 0..1   (50 = the original 0.5)
  music:50,       // 0..100 -> radio gain 0..0.5  (50 = ~0.25, ≈ the original 0.26)
  muted:false,    // kills the master bus (music + every SFX)
  shadows:true,   // directional-light shadows
  brightness:100, // 50..150 % -> toneMappingExposure (100 = the original 1.25)
  fps:true,       // show the FPS readout (top-left)
  aimAssist:true, // gentle aim assist while aiming/on touch (read live by weapons.ts)
  filmGrain:true, // animated film-grain overlay (#grain) + cinematic look
};

export const settings: Settings={...DEFAULTS};
try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null') as Record<string, unknown> | null;
  if(saved&&typeof saved==='object')
    for(const k of Object.keys(DEFAULTS) as (keyof Settings)[])
      if(saved[k]!==undefined&&typeof saved[k]===typeof DEFAULTS[k])(settings as unknown as Record<string, unknown>)[k]=saved[k];
}catch(e){}

function persist(){ try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(e){} }

// Map the 0..100 UI numbers to the actual engine/audio values and push them into
// the live graph. Safe to call before initAudio: the audio setters cache the value
// and no-op while the AudioContext / nodes are still null, then
// startGameFromUserGesture re-applies once the graph exists.
export function applyAudioSettings(){
  setMasterVolume(settings.muted?0:settings.master/100);
  setMusicVolume((settings.music/100)*0.5);
}
export function applyGraphicsSettings(){
  setShadowsEnabled(settings.shadows);
  setBrightness((settings.brightness/100)*1.25);
}
export function applyFpsSetting(){
  const el=document.getElementById('fps');
  if(el)el.style.display=settings.fps?'':'none';
}
export function applyFilmGrain(){
  document.body.classList.toggle('no-grain',!settings.filmGrain);
}
export function applySettings(){
  applyAudioSettings();
  applyGraphicsSettings();
  applyFpsSetting();
  applyFilmGrain();
}

// Set one key, persist, and re-apply only the affected group (so dragging a slider
// updates the live mix/render without touching the others).
export function setSetting(key: string,val: number|boolean){
  if(!(key in DEFAULTS))return;
  (settings as unknown as Record<string, unknown>)[key]=val;
  persist();
  if(key==='master'||key==='music'||key==='muted')applyAudioSettings();
  else if(key==='shadows'||key==='brightness')applyGraphicsSettings();
  else if(key==='fps')applyFpsSetting();
  else if(key==='filmGrain')applyFilmGrain();
}

export function resetSettings(){
  Object.assign(settings,DEFAULTS);
  persist();
  applySettings();
}
