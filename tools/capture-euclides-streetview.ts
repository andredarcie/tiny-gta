import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const OUTPUT='output/reference';
const PANORAMAS=[
  {name:'center',id:'7hRfPTKeTLGFzVkz9IzFeg'},
  {name:'west',id:'mVyORvSqddbhg1crSNCTbA'},
  {name:'east',id:'_th1TnmRzdt24jg7CQB3_A'},
];
const DIRECTIONS=[140,180,220];

await mkdir(OUTPUT,{recursive:true});
const browser=await chromium.launch({headless:false});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  for(const panorama of PANORAMAS)for(const yaw of DIRECTIONS){
    const image=`https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=1280&h=720&pitch=0&thumbfov=90&panoid=${panorama.id}&yaw=${yaw}`;
    const response=await page.goto(image,{waitUntil:'load'});
    if(response?.status()!==200||!response.headers()['content-type']?.startsWith('image/')){
      throw new Error(`Street View image unavailable: ${response?.status()} (${panorama.name}, ${yaw}°)`);
    }
    await page.screenshot({path:`${OUTPUT}/euclides-streetview-${panorama.name}-${yaw}.png`});
  }
}finally{
  await browser.close();
}
