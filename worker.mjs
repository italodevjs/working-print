import {processPixels} from './engine.mjs';
self.onmessage=({data})=>{try{const start=performance.now();const result=processPixels(data.pixels,data.adjustments);self.postMessage({id:data.id,...result,ms:performance.now()-start},[result.pixels.buffer,result.histogram.buffer]);}catch(e){self.postMessage({id:data.id,error:e.message});}};
