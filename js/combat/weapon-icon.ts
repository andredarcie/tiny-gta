// 2D (canvas) glyph for each weapon — SHARED by the HUD panel (js/hud.js) and the
// selection wheel (js/weapon-wheel.js). It paints the weapon glyph CENTERED on the
// context's current origin, filling roughly ±28px; the caller does the
// translate/scale and clears the canvas. Neon house style: cyan→pink body sheen,
// gold accents, dark ink outline. Each weapon has a distinct, detailed silhouette.
export function paintWeaponGlyph(c: CanvasRenderingContext2D,id: string){
  const grad=c.createLinearGradient(-24,-22,24,22);
  grad.addColorStop(0,'#8ceefb');grad.addColorStop(1,'#ff9bd1');
  const gold=c.createLinearGradient(-20,-22,22,24);
  gold.addColorStop(0,'#fff1a6');gold.addColorStop(1,'#f5a63a');
  const dark='#09030d';
  const ink='rgba(9,3,13,.92)';
  // fill the current path with the body sheen + ink outline
  const fillP=()=>{c.fill();c.strokeStyle=ink;c.lineWidth=2.2;c.stroke();};
  const body=()=>{c.fillStyle=grad;fillP();};
  const rr=(x: number,y: number,w: number,h: number,r: number)=>{c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);};
  const poly=(...p: number[])=>{c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.closePath();};
  const detail=(w=2)=>{c.strokeStyle=dark;c.lineWidth=w;};
  // generic handgun, reused by 'pistol' and the default fallback
  const drawPistol=()=>{
    rr(-22,-12,38,9,2);body();                       // slide
    c.fillStyle=gold;rr(13,-11,12,6,1.5);fillP();     // barrel/muzzle
    poly(-8,-4,5,-4,-1,18,-15,18);body();             // angled grip
    detail(2.6);c.beginPath();c.arc(-6,2,6,.1,Math.PI*.92);c.stroke(); // trigger guard
    detail(2.2);c.beginPath();c.moveTo(-6,0);c.lineTo(-7,5);c.stroke();// trigger
    detail(1.5);c.beginPath();c.moveTo(-19,-7.5);c.lineTo(11,-7.5);c.stroke(); // slide line
  };
  c.lineCap='round';c.lineJoin='round';c.fillStyle=grad;c.strokeStyle=ink;
  switch(id){
    case'fist':{
      // clenched fist seen from the side: back of hand + 4 knuckles + thumb
      rr(-20,-14,28,28,8);body();
      c.fillStyle=grad;
      for(let i=0;i<4;i++){c.beginPath();c.arc(7,-9+i*6.2,5.4,-1.9,1.9);fillP();}
      c.fillStyle=grad;c.beginPath();c.ellipse(-4,-12,8,5.2,-.5,0,Math.PI*2);fillP();
      detail(1.6);
      for(let i=0;i<3;i++){c.beginPath();c.moveTo(2,-6+i*6.2);c.lineTo(11,-6+i*6.2);c.stroke();}
      break;
    }
    case'bat':{
      // tapered baseball bat: thin handle → fat barrel, knob + grip tape
      c.save();c.rotate(-.62);
      c.fillStyle=grad;
      c.beginPath();
      c.moveTo(-23,3.4);c.lineTo(-22,1.6);
      c.lineTo(6,-5.2);c.quadraticCurveTo(24,-7.4,25,1.6);c.quadraticCurveTo(24,9.2,6,7);
      c.lineTo(-22,4.2);c.closePath();fillP();
      c.fillStyle=gold;c.beginPath();c.arc(22.5,1,5.4,0,Math.PI*2);fillP(); // rounded head
      detail(2);for(let i=0;i<3;i++){c.beginPath();c.moveTo(-20+i*5,1.6);c.lineTo(-22+i*5,4.4);c.stroke();}
      c.fillStyle=gold;c.beginPath();c.arc(-23,3,3,0,Math.PI*2);fillP();   // knob
      c.restore();
      break;
    }
    case'pistol':drawPistol();break;
    case'uzi':{
      // boxy SMG: receiver, stubby barrel, straight magazine, rear grip
      rr(-20,-9,30,12,2);body();
      c.fillStyle=gold;rr(10,-7,16,5,1.5);fillP();      // barrel/muzzle
      c.fillStyle=grad;rr(-14,-13,6,4,1);fillP();        // top sight
      c.fillStyle=grad;rr(-7,3,8,18,1.5);fillP();        // magazine
      poly(-20,3,-13,3,-15,16,-21,16);body();            // rear grip
      detail(2.4);c.beginPath();c.arc(-9,5,4.4,.2,Math.PI*.95);c.stroke();
      detail(1.4);for(let i=0;i<3;i++){c.beginPath();c.moveTo(-6,7+i*4);c.lineTo(0,7+i*4);c.stroke();}
      break;
    }
    case'shotgun':{
      // pump shotgun: long barrel, forend, receiver, angled stock
      c.save();c.rotate(-.04);
      c.fillStyle=grad;rr(-26,-9,40,6,2);fillP();        // barrel
      c.fillStyle=gold;rr(11,-9,5,6,1);fillP();          // muzzle
      c.fillStyle=grad;rr(-19,-2,16,6,2);fillP();        // forend (pump)
      c.fillStyle=grad;rr(-3,-9,12,13,2);fillP();        // receiver
      poly(9,-7,25,-2,25,9,9,4);body();                  // stock
      detail(2.4);c.beginPath();c.arc(3,6,4,.1,Math.PI*.95);c.stroke();   // trigger guard
      detail(1.6);for(let i=0;i<3;i++){c.beginPath();c.moveTo(-16+i*5,-1);c.lineTo(-16+i*5,3);c.stroke();}
      c.restore();
      break;
    }
    case'ak47':{
      // AK silhouette: wooden stock, receiver, gas tube, and the signature
      // curved banana magazine + front sight post
      c.save();c.rotate(-.05);
      c.fillStyle=gold;poly(-10,-7,-26,-3,-26,3,-10,1);fillP();   // wood stock
      c.fillStyle=grad;rr(-10,-8,24,8,1.5);fillP();               // receiver
      c.fillStyle=grad;rr(2,-12,16,3,1);fillP();                  // gas tube
      c.fillStyle=grad;rr(14,-6,12,4,1);fillP();                  // barrel
      c.fillStyle=gold;rr(24,-7,4,5,1);fillP();                   // muzzle
      c.fillStyle=grad;poly(20,-7,22,-13,24.5,-13,24.5,-7);fillP();// front sight
      c.fillStyle=grad;                                           // curved magazine
      c.beginPath();c.moveTo(-4,0);c.lineTo(8,0);
      c.quadraticCurveTo(10,16,2,22);c.quadraticCurveTo(-8,18,-6,4);c.closePath();fillP();
      c.fillStyle=grad;poly(-8,0,-2,0,-5,12,-11,12);fillP();      // pistol grip
      c.restore();
      break;
    }
    case'm16':{
      // M16: carry handle on top, straight magazine, long thin barrel
      c.save();c.rotate(-.03);
      c.fillStyle=grad;poly(-10,-6,-25,-3,-25,4,-10,1);fillP();   // stock
      c.fillStyle=grad;rr(-12,-7,24,8,1.5);fillP();               // receiver
      c.fillStyle=grad;poly(-8,-7,6,-7,2,-14,-4,-14);fillP();     // carry handle
      c.fillStyle=grad;rr(12,-5,16,4,1);fillP();                  // barrel
      c.fillStyle=gold;rr(26,-6,3,5,1);fillP();                   // muzzle
      c.fillStyle=grad;poly(20,-5,22,-12,24,-12,24,-5);fillP();   // front sight tower
      c.fillStyle=grad;poly(-4,1,4,1,3,18,-5,18);fillP();         // magazine
      c.fillStyle=grad;poly(-10,1,-4,1,-7,12,-13,12);fillP();     // grip
      detail(2.2);c.beginPath();c.arc(-6,4,4,.1,Math.PI*.95);c.stroke();
      c.restore();
      break;
    }
    case'sniper':{
      // sniper rifle: very long barrel + big scope with bright lenses
      c.save();c.rotate(-.03);
      c.fillStyle=grad;poly(-12,-3,-26,1,-26,9,-12,5);fillP();    // stock
      c.fillStyle=grad;rr(-26,-5,46,5,2);fillP();                 // long barrel
      c.fillStyle=gold;rr(17,-6,4,4,1);fillP();                   // muzzle
      c.fillStyle=grad;rr(-12,-15,22,6,3);fillP();                // scope tube
      detail(2.4);c.beginPath();c.moveTo(-8,-9);c.lineTo(-8,-4);c.moveTo(6,-9);c.lineTo(6,-4);c.stroke();
      c.fillStyle=gold;c.beginPath();c.arc(-12,-12,2.4,0,Math.PI*2);fillP();   // rear lens
      c.fillStyle=gold;c.beginPath();c.arc(10,-12,2.4,0,Math.PI*2);fillP();    // front lens
      c.fillStyle=grad;poly(-6,0,2,0,-1,12,-9,12);fillP();        // grip
      detail(2.2);c.beginPath();c.arc(-3,4,4,.1,Math.PI*.95);c.stroke();
      c.restore();
      break;
    }
    case'grenade':{
      // pineapple grenade: oval body, top fuse, safety lever, ring + grid
      c.fillStyle=grad;c.beginPath();c.ellipse(0,7,15,18,0,0,Math.PI*2);fillP();
      c.fillStyle=gold;rr(-7,-15,14,8,2);fillP();                 // fuse cap
      detail(2.4);c.beginPath();c.moveTo(7,-13);c.lineTo(14,-9);c.lineTo(13,1);c.stroke(); // lever
      detail(2.2);c.beginPath();c.arc(-10,-13,4,0,Math.PI*2);c.stroke();                   // pin ring
      detail(1.5);
      for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*9,-6);c.lineTo(i*9,22);c.stroke();}
      for(let i=0;i<3;i++){c.beginPath();c.moveTo(-13,-1+i*8);c.lineTo(13,-1+i*8);c.stroke();}
      break;
    }
    case'molotov':{
      // bottle with a flaming rag in the neck
      c.fillStyle=grad;
      c.beginPath();
      c.moveTo(-5,-12);c.lineTo(5,-12);c.lineTo(8,-2);
      c.quadraticCurveTo(11,2,11,9);c.quadraticCurveTo(11,24,0,24);
      c.quadraticCurveTo(-11,24,-11,9);c.quadraticCurveTo(-11,2,-8,-2);
      c.closePath();fillP();
      detail(1.6);c.beginPath();c.moveTo(-9,7);c.lineTo(9,7);c.stroke();   // liquid line
      c.fillStyle=gold;rr(-5,-16,10,5,1.5);fillP();                        // neck/cap
      detail(2.4);c.beginPath();c.moveTo(0,-16);c.lineTo(3,-23);c.stroke();// rag
      c.fillStyle='#ff5a2e';
      c.beginPath();c.moveTo(3,-22);c.quadraticCurveTo(13,-18,4,-9);c.quadraticCurveTo(0,-15,3,-22);c.closePath();fillP();
      break;
    }
    case'rocket':{
      // RPG tube: conical warhead, rear venturi + fin, pistol grip, sight
      c.save();c.rotate(-.05);
      c.fillStyle=grad;rr(-24,-7,40,12,3);fillP();        // tube
      c.fillStyle=gold;poly(16,-9,30,-1,16,7);fillP();    // warhead cone
      c.fillStyle=grad;poly(-24,-9,-30,-12,-30,11,-24,7);fillP(); // rear venturi
      c.fillStyle=grad;poly(-20,-7,-14,-13,-11,-7);fillP();// rear fin
      c.fillStyle=grad;poly(-6,5,2,5,-1,18,-9,18);fillP(); // grip
      detail(2.4);c.beginPath();c.arc(-3,9,4,.1,Math.PI*.95);c.stroke();
      detail(2);c.beginPath();c.moveTo(6,-7);c.lineTo(6,-13);c.lineTo(9,-13);c.stroke(); // sight
      c.restore();
      break;
    }
    case'flame':{
      // flamethrower: fuel tank, body, nozzle, and a burst of flame at the tip
      c.fillStyle=grad;rr(-23,-13,13,28,5);fillP();        // fuel tank
      detail(2.4);c.beginPath();c.arc(-16.5,-13,4,Math.PI,0);c.stroke(); // valve handle
      c.fillStyle=grad;rr(-10,-6,22,9,2);fillP();          // body
      c.fillStyle=grad;rr(10,-4,13,5,1.5);fillP();         // nozzle
      c.fillStyle=grad;poly(-8,3,0,3,-3,15,-11,15);fillP();// grip
      detail(2.2);c.beginPath();c.arc(-5,6,4,.1,Math.PI*.95);c.stroke();
      c.fillStyle='#ffb43a';
      c.beginPath();c.moveTo(22,-4);c.quadraticCurveTo(33,-6,30,0);c.quadraticCurveTo(34,3,27,5);
      c.quadraticCurveTo(31,1,22,2);c.closePath();fillP();
      c.fillStyle='#ff5a2e';
      c.beginPath();c.moveTo(22,-2);c.quadraticCurveTo(29,-3,27,1);c.quadraticCurveTo(24,1,22,2);c.closePath();c.fill();
      break;
    }
    case'detonator':{
      // plunger detonator box: T-handle plunger, indicator light, wire
      c.fillStyle=gold;rr(-3,-20,6,16,2);fillP();          // plunger shaft
      c.fillStyle=gold;rr(-11,-23,22,5,2.5);fillP();       // T-handle
      c.fillStyle=grad;rr(-15,-4,30,22,3);fillP();         // box
      c.fillStyle=dark;rr(-11,2,13,9,2);c.fill();          // display
      c.fillStyle='#ff5a2e';c.beginPath();c.arc(9,6,3,0,Math.PI*2);fillP(); // light
      detail(2.2);c.beginPath();c.moveTo(15,12);c.quadraticCurveTo(26,12,24,22);c.stroke(); // wire
      break;
    }
    default:drawPistol();
  }
}
