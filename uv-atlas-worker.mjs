import {buildAtlasData} from './uv-color-atlas.mjs?v=536a719a5512';
self.onmessage=({data})=>{
  try {
    const result=buildAtlasData(data.model,data.analysis,data.options);
    self.postMessage({id:data.id,result},[result.rgba.buffer]);
  } catch(error) { self.postMessage({id:data.id,error:error.message||'컬러 맵을 만들지 못했어요.'}); }
};
