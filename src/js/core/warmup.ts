import * as THREE from 'three';
import {renderer,scene,camera,sceneTarget,holdRendering} from '@/core/engine.ts';
import {interiors} from '@/world/interior.ts';

// GPU warmup, run in the BACKGROUND right after boot (startWarmup, at the bottom), so the
// game opens with no loading screen and still never hitches on first sight of something:
//  1. SHADERS: renderer.compileAsync() issues every program at once — the whole world plus
//     an off-screen copy of every model that only appears in play (combat FX, held
//     weapons, heli, minigame props) — and the GPU compiles them in parallel
//     (KHR_parallel_shader_compile). 3D drawing is held until they're ready (~1 s), so the
//     first frames don't compile synchronously.
//  2. GEOMETRY: meshes only reach the GPU on their first render. The whole scene is
//     uploaded in small slices (~4 ms of work per frame), so turning the camera
//     toward a far chunk or entering a building never uploads in the middle of play.
//  3. INTERIORS: each has its own point lights (a different shader variant), so each gets
//     its own compileAsync with only that interior shown — the light state it has in play.

const MODELS=import.meta.glob('../../assets/models/**/*.ts',{eager:true});

function builders(d:any){
  const out:Array<()=>any>=[];
  if(!d)return out;
  const variants=Array.isArray(d.variants)?d.variants:[{build:d.build}];
  for(const v of variants){
    const build=v.build||d.build;
    if(typeof build==='function')out.push(()=>build(v.opts||{}));
  }
  return out;
}
function addTo(bag:THREE.Group,out:any){
  if(!out)return;
  if(out.isObject3D){bag.add(out);return;}
  for(const part of Object.values(out))if(part&&(part as any).isObject3D)bag.add(part as THREE.Object3D);
}

// All models that only appear in play, gathered off-screen so compile() sees them.
function modelBag(): THREE.Group{
  const bag=new THREE.Group();
  bag.position.set(0,-9000,0);
  for(const mod of Object.values(MODELS))
    for(const make of builders((mod as any).default))
      try{addTo(bag,make());}catch{} // modelo em edição/quebrado não derruba o boot
  return bag;
}

// Interiors carry their own point lights, which change the shader variant (light count is
// part of the program key). Compile each one's variants ASYNC with only that interior shown
// — the same light state as when the player is inside — one interior at a time. Their meshes
// were already uploaded by the slices, so entering one no longer freezes.
async function warmInteriorsAsync(): Promise<void>{
  for(const it of interiors||[]){
    const g=it.group,parent=g?.parent;
    if(!g||!parent)continue; // só os que já estão na cena (a casa só após comprar)
    // Compile ONLY this interior's objects, lit by the scene's lights + its own (the
    // targetScene form). It's detached while compiling so its lights aren't counted twice.
    const was=g.visible;
    parent.remove(g);g.visible=true;
    let p:Promise<unknown>=Promise.resolve();
    withSceneTarget(()=>{try{p=renderer.compileAsync(g,camera,scene);}catch{}});
    g.visible=was;parent.add(g);
    await Promise.race([p.catch(()=>{}),new Promise<void>(r=>setTimeout(r,4000))]); // never stall
    await new Promise<void>(r=>setTimeout(r,16));
  }
}

// Run `fn` with the game's scene render target bound (the post-processing buffer), so the
// programs compiled/cached are the exact variants used in play.
function withSceneTarget(fn: ()=>void): void{
  const prev=renderer.getRenderTarget();
  renderer.setRenderTarget(sceneTarget());
  try{fn();}finally{renderer.setRenderTarget(prev);}
}

// ---- sliced GPU upload -----------------------------------------------------------------
// Geometry only reaches the GPU on its first render. Rather than one giant render of the
// whole map at boot, upload it in small batches of meshes, a few ms per frame: each
// slice draws ONLY its batch (everything else hidden, frustum culling off), so its buffers
// reach the GPU; then everything is restored exactly.
const SLICE=20;
function drawableList(): THREE.Object3D[]{
  const out:THREE.Object3D[]=[];
  scene.traverse(o=>{const a=o as any;if((a.isMesh||a.isSprite||a.isLine||a.isPoints)&&a!==camera)out.push(o);});
  return out;
}
function renderOnly(batch: THREE.Object3D[]): void{
  const saved:[THREE.Object3D,boolean][]=[];
  scene.traverse(o=>{saved.push([o,o.visible]);o.visible=false;});
  const culled:[THREE.Object3D,boolean][]=[];
  for(const m of batch){
    culled.push([m,m.frustumCulled]);m.frustumCulled=false;
    let p:THREE.Object3D|null=m;while(p){p.visible=true;p=p.parent;}
  }
  const shadowWas=renderer.shadowMap.needsUpdate;renderer.shadowMap.needsUpdate=false;
  try{renderer.render(scene,camera);}catch{}
  renderer.shadowMap.needsUpdate=shadowWas;
  for(const [m,c] of culled)m.frustumCulled=c;
  for(const [o,v] of saved)o.visible=v;
}
// NON-BLOCKING warmup: the game (title/menu or play) starts IMMEDIATELY and this runs in
// the background.
//  1. renderer.compileAsync() issues every shader compile at once (the world, every
//     in-play model, every interior) — the GPU driver compiles them in parallel
//     (KHR_parallel_shader_compile) while the main thread keeps running.
//  2. Once they're ready, geometry and interiors are warmed a few ms per frame.
export function startWarmup(): void{
  performance.mark('tg:warm-start');
  holdRendering(true);   // released as soon as the shaders are ready (or after a safety cap)
  const release=():void=>holdRendering(false);
  setTimeout(release,5000);
  const bag=modelBag();
  scene.add(bag);
  let ready:Promise<unknown>=Promise.resolve();
  withSceneTarget(()=>{try{ready=renderer.compileAsync(scene,camera);}catch{}});
  scene.remove(bag); // programs stay cached (usedTimes kept); nothing was uploaded for the bag
  performance.mark('tg:warm-issued');
  ready.catch(()=>{}).then(()=>{
    performance.mark('tg:warm-compiled');
    // Upload the scene in slices, then shadows + post-FX, and only THEN release drawing, so
    // the first visible frame is cheap. Interiors (far off-map) follow in the background.
    // Shaders are ready: let the game draw NOW (the first frame only uploads what's in view).
    // Everything else — the rest of the map, then the off-map interiors — uploads in small
    // time-budgeted slices, so a first look at any of it never hitches later.
    release();
    const list=drawableList();
    const steps:Array<()=>void>=[];
    for(let k=0;k<list.length;k+=SLICE){const b=list.slice(k,k+SLICE);steps.push(()=>renderOnly(b));}
    // Paced by a small time budget (~4 ms of upload work, then yield for a frame), so the
    // whole map is on the GPU within a few seconds without ever pausing play.
    const pump=():void=>{
      const t0=performance.now();
      do{
        const step=steps.shift();
        if(!step){void warmInteriorsAsync().then(()=>performance.mark('tg:warm-done'));return;}
        withSceneTarget(step);
      }while(performance.now()-t0<4);
      setTimeout(pump,16);
    };
    setTimeout(pump,16);
  });
}
