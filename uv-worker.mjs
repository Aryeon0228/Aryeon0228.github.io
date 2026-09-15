import {analyzeUV} from './uv-analysis.mjs?v=d2b80ffc255f';
import {analyzeGrid} from './uv-grid.mjs?v=04f82c311841';
self.onmessage=async({data})=>{try{let model=data.model;if(data.file){const {importUVFile}=await import('./uv-import.mjs?v=7af6107200ec');model=await importUVFile(data.file);}const result=analyzeUV(model,data.options);result.grid=analyzeGrid(model,result);self.postMessage({id:data.id,result,model:data.file?model:null});}catch(error){self.postMessage({id:data.id,error:error.message||'UV를 계산하지 못했어요.'});}};
