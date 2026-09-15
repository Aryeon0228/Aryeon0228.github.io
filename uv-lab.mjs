import {createDemo} from './uv-demo.mjs?v=9fad2b96a670';
import {createPreview,makeAtlas,islandColor,metricColor} from './uv-preview.mjs?v=61e4d1bb67fd';
import {boundaryDeviation} from './uv-grid.mjs?v=04f82c311841';
import {pickAtlasIsland} from './uv-color-atlas.mjs?v=536a719a5512';

const $=id=>document.getElementById(id);
const percent=value=>`${(value*100).toFixed(1)}%`;
const number=value=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:1}):'—';
const state={source:'demo',model:null,analysis:null,resolution:64,mode:'texture',selected:-1,materialId:-1,listLimit:24,filter:'nearest',seed:123,padding:0};
let preview=null,atlas=null,paths=[],boundaryPaths=[],jobId=0,worker=null,uvTransform=null;
let analyzing=false,pendingAnalysis=null;
const sessions={demo:null,file:null};
let colorMap=null,colorWorker=null,colorJob=0,colorPending=false;
const viewport={zoom:1,panX:0,panY:0};
const canvas=$('uv-canvas'),context=canvas.getContext('2d');

function status(message,error=false){$('load-status').textContent=message;$('load-status').classList.toggle('error',error);$('source-feedback').textContent=error?message:'';$('source-feedback').hidden=!error;}
function syncSource(){
  const hasModel=!!state.analysis;document.querySelector('.quick-controls').dataset.ready=String(hasModel);
  document.querySelectorAll('[data-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===state.source)));
  $('example-controls').hidden=state.source!=='demo';$('file-controls').hidden=state.source!=='file';
  $('empty-model').hidden=hasModel;$('preview-content').hidden=!hasModel;$('analysis-results').hidden=!hasModel;
  $('file-action').textContent=state.source==='file'&&state.model?'파일 교체':'파일 열기';
  $('file-name').textContent=state.model?.name||'아직 가져온 모델이 없어요.';
  $('demo-note').hidden=state.source!=='demo';
  document.querySelectorAll('[data-source],[data-demo],#demo-layout,#model-file,#empty-open-file').forEach(e=>e.disabled=analyzing);
  document.querySelectorAll('[data-resolution],[data-mode],[data-filter],#view-mode,#atlas-padding,#shuffle-colors,#atlas-scope').forEach(e=>e.disabled=analyzing||!hasModel);
  $('drop-zone').setAttribute('aria-busy',String(analyzing));
}
function busy(value){analyzing=value;syncSource();}
function clearColorMap(){colorWorker?.terminate();colorWorker=null;colorJob++;colorMap=null;colorPending=false;atlas=null;setColorBusy(false);}
function rememberSource(){
  if(!state.model||!state.analysis)return;
  sessions[state.source]={model:state.model,analysis:state.analysis,materialId:state.materialId,selected:state.selected,listLimit:state.listLimit,viewport:{...viewport},camera:preview?.getView()};
}
function presentModel({preserveView=false,camera}={}){
  clearColorMap();syncSource();buildPaths();if(!preserveView)resetUV();
  try{if(preview){preview.setModel(state.model,state.analysis,{preserveView});if(camera)preview.setView(camera);}updateAppearance();}
  catch(error){console.error(error);$('render-error').hidden=false;atlas=state.mode==='bleed'?null:makeAtlas(state.model,state.resolution,undefined,state.mode==='checker');}
  if(state.mode==='bleed')requestColorAtlas();sync();
}
function setSource(source){
  if(analyzing||state.source===source)return;
  rememberSource();state.source=source;jobId++;clearColorMap();
  const saved=sessions[source];
  if(saved){Object.assign(state,{model:saved.model,analysis:saved.analysis,materialId:saved.materialId,selected:saved.selected,listLimit:saved.listLimit});Object.assign(viewport,saved.viewport);syncScope();presentModel({preserveView:true,camera:saved.camera});status('이전에 보던 모델과 시점을 불러왔어요.');}
  else{state.model=null;state.analysis=null;state.selected=-1;state.materialId=-1;syncSource();status('FBX 또는 OBJ를 열면 검사를 시작합니다.');}
}
function createWorker(){
  worker=new Worker(new URL('./uv-worker.mjs?v=c89b5225578c',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id!==jobId)return;
    const request=pendingAnalysis;pendingAnalysis=null;
    if(data.error){if(state.model)syncScope();busy(false);status(data.error,true);return;}
    if(request.file)rememberSource();
    state.model=data.model||request.model;state.materialId=request.materialId;
    state.source=state.model.demo?'demo':'file';state.analysis=data.result;state.selected=-1;state.listLimit=24;
    syncScope();busy(false);presentModel({preserveView:request.preserveView});
    status(`${state.model.demo?'예제 준비 완료':'검사 완료'} · ${number(state.analysis.stats.triangles)}개 삼각형 · ${state.analysis.islands.length}개 아일랜드`);
  };
  worker.onerror=()=>{pendingAnalysis=null;if(state.model)syncScope();busy(false);status('파일을 읽는 중 문제가 생겼어요. 다른 파일이나 예제를 선택해 다시 시도해주세요.',true);worker.terminate();worker=null;};
}
function analyze({file,model=state.model,materialId=state.materialId,preserveView=false}={}){
  if(!worker)createWorker();jobId++;pendingAnalysis={file,model,materialId:file?-1:materialId,preserveView};busy(true);
  status(file?'파일을 읽고 UV를 검사하고 있어요…':'UV 배치를 검사하고 있어요…');
  worker.postMessage({id:jobId,model:file?null:model,file,options:{materialId:pendingAnalysis.materialId,resolution:state.resolution}});
}
function syncScope(){
  const select=$('atlas-scope');select.replaceChildren(new Option('전체 · 하나의 텍스처로 보기','-1'));
  const usedMaterials=new Set(state.model.materialIds);
  state.model.materialNames.forEach((name,id)=>{if(usedMaterials.has(id))select.add(new Option(name,String(id)));});select.value=String(state.materialId);
  document.querySelectorAll('[data-demo]').forEach(button=>button.setAttribute('aria-pressed',String(state.model.demo?.layout===button.dataset.demo)));
  if(state.model.demo)$('demo-layout').value=state.model.demo.layout;
  $('demo-note').textContent=state.model.demo?({loose:'먼저 64픽셀로 관찰하고 ‘공간 정리’와 비교해보세요.',packed:'같은 무늬, 같은 해상도. 조각에 배정된 픽셀이 늘어납니다.',tilted:'직각 체크와 색 번짐에서 비스듬한 경계의 계단을 살펴보세요.',stretched:'왼쪽 면의 UV를 가로로 늘렸어요. ‘늘어짐’에서 비율을 확인하세요.'}[state.model.demo.layout]):'';
  $('model-tag').textContent=state.model.demo?'ROUND CASE':'LOCAL MODEL';
}
function useDemo(layout){analyze({model:createDemo(layout),materialId:-1,preserveView:!!state.model?.demo});}
function openFile(file){if(!file||analyzing)return;if(!/\.(obj|fbx)$/i.test(file.name)){status('OBJ 또는 FBX 파일을 선택해주세요.',true);return;}if(file.size>20*1024*1024){status('20 MiB 이하 파일을 사용해주세요. 큰 모델은 나누어 가져올 수 있어요.',true);return;}analyze({file});}

function updateAppearance(){
  preview?.setAppearance(state);
  atlas=state.mode==='bleed'?colorMap?.canvas||null:preview?preview.textureCanvas:makeAtlas(state.model,state.resolution,undefined,state.mode==='checker');
}
function setColorBusy(value){document.querySelectorAll('.canvas-wrap').forEach(element=>element.classList.toggle('is-busy',value&&state.mode==='bleed'));}
function requestColorAtlas(){
  if(!state.analysis||state.mode!=='bleed')return;
  const key=[jobId,state.resolution,state.seed,state.padding].join(':');
  if(colorMap?.key===key){updateAppearance();return;}
  colorWorker?.terminate();colorWorker=null;colorMap=null;colorPending=true;atlas=null;preview?.setColorAtlas(null);setColorBusy(true);
  $('atlas-status').textContent=`${state.resolution} × ${state.resolution} 컬러 맵 계산 중…`;$('atlas-status').classList.remove('error');
  const id=++colorJob;
  colorWorker=new Worker(new URL('./uv-atlas-worker.mjs?v=07da4b5ce9f6',import.meta.url),{type:'module'});
  const fail=message=>{if(id!==colorJob)return;colorPending=false;setColorBusy(false);colorWorker?.terminate();colorWorker=null;$('atlas-status').textContent=message;$('atlas-status').classList.add('error');sync();};
  colorWorker.onerror=()=>fail('컬러 맵을 만들지 못했어요. 해상도를 낮춰 다시 시도해주세요.');
  colorWorker.onmessage=({data})=>{
    if(data.id!==colorJob)return;
    if(data.error){fail(data.error);return;}
    const result=data.result,paint=document.createElement('canvas');paint.width=result.width;paint.height=result.height;
    paint.getContext('2d').putImageData(new ImageData(result.rgba,result.width,result.height),0,0);
    colorMap={key,canvas:paint,palette:result.palette,islandStats:result.islandStats,stats:result.stats};
    colorPending=false;setColorBusy(false);colorWorker.terminate();colorWorker=null;preview?.setColorAtlas(paint);updateAppearance();
    const missing=result.islandStats.filter(i=>i.texels===0).length;
    $('atlas-status').textContent=`자기 색을 받은 텍셀 ${number(result.stats.coveredTexels)}개 · 자기 색이 없는 섬 ${missing}개`;
    sync();
  };
  colorWorker.postMessage({id,model:state.model,analysis:state.analysis,options:{resolution:state.resolution,seed:state.seed,padding:state.padding}});
}

function buildPaths(){
  paths=[];boundaryPaths=[];
  const uv=state.model.uvs;
  for(const island of state.analysis.islands){
    const path=new Path2D(),boundary=new Path2D();
    for(const face of island.faces){const i=face*6;path.moveTo(uv[i],uv[i+1]);path.lineTo(uv[i+2],uv[i+3]);path.lineTo(uv[i+4],uv[i+5]);path.closePath();}
    for(const [[u,v],[x,y]] of island.boundary){boundary.moveTo(u,v);boundary.lineTo(x,y);}
    paths.push(path);boundaryPaths.push(boundary);
  }
}
function resetUV(){viewport.zoom=1;viewport.panX=viewport.panY=0;drawUV();}
function drawUV(){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=box.width,h=box.height;
  if(!w||!h)return;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);context.setTransform(dpr,0,0,dpr,0,0);context.fillStyle='#101315';context.fillRect(0,0,w,h);
  const side=(Math.min(w,h)-52)*viewport.zoom,ox=(w-side)/2+viewport.panX,oy=(h-side)/2+viewport.panY;
  uvTransform={side,ox,oy};
  context.fillStyle='#080a0b';context.fillRect(ox,oy,side,side);
  if(['texture','checker','bleed'].includes(state.mode)&&atlas){context.imageSmoothingEnabled=state.mode==='bleed'&&state.filter==='linear';context.imageSmoothingQuality='low';context.drawImage(atlas,ox,oy,side,side);}
  context.save();context.translate(ox,oy+side);context.scale(side,-side);
  context.beginPath();context.rect(-ox/side,(oy+side-h)/side,w/side,h/side);context.clip();
  if(state.analysis){
    state.analysis.islands.forEach(island=>{
      if(state.mode==='grid'){
        context.fillStyle='#28372f';context.fill(paths[island.id]);
        for(const [a,b] of island.boundary){const angle=boundaryDeviation(a,b);context.strokeStyle=angle<=2?'#8fbfa3':'#efa464';context.lineWidth=(state.selected===island.id?3:2)/side;context.beginPath();context.moveTo(...a);context.lineTo(...b);context.stroke();}
      }else{
        if(!['texture','checker','bleed'].includes(state.mode)){context.fillStyle=state.mode==='islands'?islandColor(island.id):metricColor(state.mode,island);context.globalAlpha=.82;context.fill(paths[island.id]);context.globalAlpha=1;}
        if(state.mode!=='bleed'||state.selected===island.id){context.strokeStyle=state.selected===island.id?'#f3fff2':state.mode==='texture'?'#b4c9b8':'#15251d';context.lineWidth=(state.selected===island.id?2:1)/side;context.stroke(boundaryPaths[island.id]);}
      }
    });
    if(state.selected>=0&&!['bleed','grid'].includes(state.mode)){context.fillStyle='#c2f6c3';context.globalAlpha=.2;context.fill(paths[state.selected]);context.globalAlpha=1;}
  }
  if($('pixel-grid').checked&&side/state.resolution>=4){context.strokeStyle='#ffffff20';context.lineWidth=.5/side;context.beginPath();for(let i=0;i<=state.resolution;i++){const t=i/state.resolution;context.moveTo(t,0);context.lineTo(t,1);context.moveTo(0,t);context.lineTo(1,t);}context.stroke();}
  context.strokeStyle='#b3b9b3';context.lineWidth=1/side;context.strokeRect(0,0,1,1);context.restore();
  context.fillStyle='#949b97';context.font='10px monospace';context.fillText('0',ox-13,oy+side+14);context.fillText('1',ox+side+5,oy+side+14);context.fillText('1',ox-13,oy+4);
  context.fillStyle='#9aaa9f';context.fillText(state.resolution+' × '+state.resolution+' PX',16,h-12);
}
function select(id){if(!state.analysis)return;state.selected=id>=0&&state.analysis?.islands[id]?id:-1;preview?.setAppearance({selected:state.selected});drawUV();renderList();renderSelection();}
function renderList(){
  const list=$('island-list'),focusId=list.contains(document.activeElement)?document.activeElement.dataset.islandId:null;list.replaceChildren();const islands=state.analysis.islands;
  $('allocation-title').textContent=state.mode==='bleed'?'실제 텍셀':'배정 영역';
  $('allocation-note').textContent=state.mode==='bleed'?'실제 텍셀은 각 아일랜드가 자기 색을 받은 픽셀 수예요. 패딩과 필터 보간은 포함하지 않으며, 겹치면 먼저 배정한 면이 우선합니다.':'배정 영역은 UV 면적 × 전체 픽셀 수입니다. 실제 포함된 픽셀 개수와는 조금 달라요.';
  for(const island of islands.slice(0,state.listLimit)){
    const raster=state.mode==='bleed'?colorMap?.islandStats[island.id]:null;
    const button=document.createElement('button');button.className='island-row';button.type='button';button.dataset.islandId=String(island.id);button.style.setProperty('--island-color',state.mode==='bleed'?colorMap?.palette[island.id]||'#666':islandColor(island.id));button.setAttribute('aria-pressed',String(island.id===state.selected));button.classList.toggle('lost-texels',raster?.texels===0);
    const label=document.createElement('span'),dot=document.createElement('i');dot.setAttribute('aria-hidden','true');label.append(dot,document.createTextNode(String(island.id+1).padStart(2,'0')));button.append(label);
    const allocation=state.mode==='bleed'?(raster?`${number(raster.texels)} px`:'—'):`${number(island.uvArea*state.resolution**2)} px²`;
    for(const [index,text] of [allocation,`${island.densityRatio.toFixed(2)}×`,`${island.stretch.toFixed(2)}×`].entries()){const span=document.createElement('span');span.textContent=text;if(index===0&&raster){span.className='pixel-count';if(raster.texels===0){const small=document.createElement('small');small.textContent='자기 색 없음';span.append(small);}}button.append(span);}
    button.setAttribute('aria-label',`아일랜드 ${island.id+1}, ${state.mode==='bleed'?'실제 텍셀':'배정 영역'} ${allocation}, 상대 밀도 ${island.densityRatio.toFixed(2)}배, 늘어짐 ${island.stretch.toFixed(2)}배`);button.onclick=()=>select(island.id);list.append(button);
  }
  if(focusId!==null)list.querySelector('[data-island-id="'+focusId+'"]')?.focus({preventScroll:true});
  $('list-range').textContent=`${Math.min(islands.length,state.listLimit)} / ${islands.length}`;$('more-islands').hidden=islands.length<=state.listLimit;
  if(!islands.length){const p=document.createElement('p');p.className='fine-print';p.textContent='검사할 UV 아일랜드가 없어요. 모델에서 UV를 편 뒤 다시 내보내주세요.';list.append(p);}
}
function renderSelection(){
  const island=state.analysis.islands[state.selected];$('selection-values').hidden=!island;
  $('clear-view-selection').hidden=!island;
  $('selection-title').textContent=island?`아일랜드 ${String(island.id+1).padStart(2,'0')}`:'조각 하나를 골라보세요.';
  if(!island){$('selection-description').textContent='UV, 3D 또는 목록을 누르면 같은 부위가 함께 표시됩니다.';$('view-selection').textContent=state.mode==='bleed'?'색이 작은 맵에서 어떻게 섞이는지 보세요. 조각을 누르면 실제 텍셀 수도 표시됩니다.':'아일랜드를 누르면 두 화면에서 같은 부위를 확인할 수 있어요.';return;}
  const b=island.bounds;
  $('selected-size').textContent=`${number((b.maxU-b.minU)*state.resolution)} × ${number((b.maxV-b.minV)*state.resolution)} px`;
  $('selected-density').textContent=`${island.densityRatio.toFixed(2)}×`;$('selected-stretch').textContent=`${island.stretch.toFixed(2)}×`;
  const grid=state.analysis.grid?.islands[island.id],raster=colorMap?.islandStats[island.id];
  const alignment=grid?.alignedFraction==null?'—':percent(grid.alignedFraction),shear=grid?.shearMean==null?'—':`${number(grid.shearMean)}° / ${number(grid.shearMax)}°`;
  $('selected-alignment').textContent=alignment;$('selected-shear').textContent=shear;
  $('selected-raster-row').hidden=state.mode!=='bleed';$('selected-texels').textContent=raster?`${number(raster.texels)} px`:'계산 중';
  $('view-selection').textContent=`아일랜드 ${String(island.id+1).padStart(2,'0')} · `+(state.mode==='bleed'?(raster?`자기 색 ${number(raster.texels)}텍셀 · 색 확장 ${number(raster.paddedTexels)}텍셀 · 흰 선은 원본 경계`:'컬러 맵 계산 중…'):state.mode==='grid'?`경계 정렬 ${alignment} · 직각 이탈 평균/최대 ${shear}`:`${number((b.maxU-b.minU)*state.resolution)} × ${number((b.maxV-b.minV)*state.resolution)} px · 상대 밀도 ${island.densityRatio.toFixed(2)}×`);
  $('selection-description').textContent=`${number(island.faces.length)}개 삼각형 · 배정 영역 ${number(island.uvArea*state.resolution**2)} px². `+(island.stretch>1.3?'체크 무늬가 길어지는 방향을 3D에서 살펴보세요.':island.densityRatio<.75?'평균보다 픽셀을 적게 받는 부위예요. 중요한 부위인지 확인해보세요.':'해상도를 낮추면서 글자와 가는 선이 유지되는지 살펴보세요.');
}
function sync(){
  syncSource();$('view-mode').value=state.mode;
  if(!state.analysis)return;
  document.querySelectorAll('[data-resolution]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.resolution===state.resolution)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));
  $('bleed-settings').hidden=state.mode!=='bleed';$('atlas-status').hidden=state.mode!=='bleed';$('grid-settings').hidden=state.mode!=='grid';setColorBusy(colorPending);
  const g=state.analysis.grid?.summary;
  $('grid-aligned').textContent=g?.alignedFraction==null?'—':percent(g.alignedFraction);$('grid-shear').textContent=g?.shearMean==null?'—':`${number(g.shearMean)}°`;
  const r=state.resolution,bytes=r*r*4,memory=bytes<1048576?`${number(bytes/1024)} KiB`:`${number(bytes/1048576)} MiB`;
  $('budget-note').textContent=`${r} × ${r} · ${number(r*r)} pixels · RGBA8 ${memory} · ${r===4096?'4K 픽셀 수':`4K의 ${number(4096**2/r**2)}분의 1 픽셀`}`;
  $('resolution-label').textContent=`${r} × ${r}`;
  $('resolution-brief').textContent=`${r} × ${r}`;
  $('view-legend').textContent={texture:'같은 테스트 무늬 · 최근접 샘플링',bleed:`실제 ${r} × ${r} 맵 · ${state.filter==='linear'?'주변 텍셀을 섞어 경계를 부드럽게':'텍셀 한 칸씩 또렷하게'} · 같은 색을 유지하며 해상도를 낮춰보세요.`,grid:'UV의 주황 경계 = 비스듬한 방향 · 3D의 주황 면 = 픽셀 축이 직각에서 벗어난 곳 (30° 이상).',checker:'정사각 체커 · 길어지거나 휘는 방향을 확인하세요.',islands:'같은 색은 UV가 이어지는 하나의 아일랜드 · 해상도와 무관한 구분 보기',stretch:'회녹색 1× → 주황색 4× 이상 · 비율이 달라진 정도',density:'파랑 0.5× 이하 · 회색 1× · 주황 2× 이상 · 전체 대비'}[state.mode];
  const s=state.analysis.stats;
  $('occupancy-value').textContent=percent(s.occupancy);$('occupancy-note').textContent=`빈 영역 ${percent(1-s.occupancy)} · 512² 표본 추정`;$('occupancy-meter').style.width=percent(s.occupancy);
  $('island-count').textContent=number(state.analysis.islands.length);$('island-note').textContent=`${number(s.triangles)}개 삼각형 · 첫 UV 세트`;
  $('overlap-value').textContent=s.overlap>0&&s.overlap<.001?'< 0.1%':percent(s.overlap);
  $('gap-value').textContent=s.minGapUV===null?'—':`${number(s.minGapUV*r)} px`;
  $('gap-note').textContent=s.gapStatus==='overlap'?'겹친 영역을 먼저 확인하세요.':s.gapStatus==='edge-limit'?'경계가 많아 간격 검사는 생략했어요.':s.gapStatus==='single-island'?'아일랜드가 하나인 범위입니다.':'서로 다른 아일랜드 사이';
  $('triangle-count').textContent=`${number(s.triangles)} TRI`;
  const notes=[];
  if(s.missingUV)notes.push(`UV 없는 면 ${number(s.missingUV)}개를 계산에서 제외했어요.`);
  if(s.degenerateUV)notes.push(`UV 면적이 0에 가까운 삼각형 ${number(s.degenerateUV)}개가 있어요.`);
  if(s.degenerate3D)notes.push(`3D 면적이 0에 가까운 삼각형 ${number(s.degenerate3D)}개가 있어요.`);
  if(s.outsideTriangles)notes.push(`0–1 타일 밖에 걸친 면 ${number(s.outsideTriangles)}개. UDIM이나 반복 배치인지 확인하세요.`);
  if(s.overlap)notes.push(`타일의 ${percent(s.overlap)}에서 중첩이 감지됐어요. 의도한 공유 UV인지 확인하세요.`);
  if(s.minGapUV!==null&&s.minGapUV*r<2)notes.push(`가장 좁은 간격이 ${number(s.minGapUV*r)}픽셀이에요. 텍스처 확장과 필터링 조건을 함께 확인하세요.`);
  if(s.edgeGapUV!==null&&Number.isFinite(s.edgeGapUV))notes.push(`타일 가장자리까지의 최소 거리는 ${number(s.edgeGapUV*r)}픽셀이에요.`);
  notes.push(...state.analysis.warnings.filter(text=>!s.missingUV||!text.startsWith('UV가 없거나 잘못된 삼각형')));
  if(!notes.length)notes.push('검출된 누락이나 겹침은 없어요. 필요한 부위에 픽셀이 충분한지 낮은 해상도로 확인해보세요.');
  $('check-list').replaceChildren(...[...new Set(notes)].map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  renderList();renderSelection();drawUV();
}
document.querySelectorAll('[data-source]').forEach(b=>b.onclick=()=>setSource(b.dataset.source));
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>useDemo(b.dataset.demo));
$('demo-layout').onchange=event=>useDemo(event.target.value);
$('empty-open-file').onclick=()=>$('model-file').click();
document.querySelectorAll('[data-resolution]').forEach(b=>b.onclick=()=>{state.resolution=+b.dataset.resolution;if(state.model){updateAppearance();if(state.mode==='bleed')requestColorAtlas();}sync();});
function setMode(mode){state.mode=mode;if(state.model){updateAppearance();if(state.mode==='bleed')requestColorAtlas();}sync();}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('view-mode').onchange=event=>setMode(event.target.value);
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;updateAppearance();sync();});
$('shuffle-colors').onclick=()=>{state.seed=(state.seed+0x9e3779b9)>>>0;requestColorAtlas();sync();};
$('atlas-padding').onchange=event=>{state.padding=+event.target.value;requestColorAtlas();sync();};
$('clear-view-selection').onclick=()=>select(-1);
$('model-file').onchange=event=>{openFile(event.target.files[0]);event.target.value='';};
$('atlas-scope').onchange=event=>analyze({materialId:+event.target.value,preserveView:true});
$('more-islands').onclick=()=>{state.listLimit+=60;renderList();};$('clear-selection').onclick=()=>select(-1);
$('view-reset').onclick=()=>preview?.reset();$('uv-reset').onclick=resetUV;$('pixel-grid').onchange=drawUV;
function zoom(factor){viewport.zoom=Math.max(.2,Math.min(12,viewport.zoom*factor));drawUV();}
$('zoom-in').onclick=()=>zoom(1.4);$('zoom-out').onclick=()=>zoom(1/1.4);
canvas.addEventListener('keydown',event=>{if(['+','=','-','0'].includes(event.key)){event.preventDefault();if(event.key==='0')resetUV();else zoom(event.key==='-'?1/1.4:1.4);}});
let pointer=null;
canvas.addEventListener('pointerdown',event=>{pointer={id:event.pointerId,x:event.clientX,y:event.clientY,panX:viewport.panX,panY:viewport.panY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!pointer||event.pointerId!==pointer.id)return;viewport.panX=pointer.panX+event.clientX-pointer.x;viewport.panY=pointer.panY+event.clientY-pointer.y;drawUV();});
canvas.addEventListener('pointerup',event=>{if(!pointer)return;const moved=Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y);pointer=null;if(moved>5||!uvTransform||!state.analysis)return;const box=canvas.getBoundingClientRect(),{side,ox,oy}=uvTransform,u=(event.clientX-box.left-ox)/side,v=1-(event.clientY-box.top-oy)/side;if(state.mode==='bleed'){if(!colorPending&&colorMap)select(pickAtlasIsland(state.model,state.analysis,{u,v,resolution:state.resolution,padding:state.padding}));return;}context.save();context.setTransform(1,0,0,1,0,0);let hit=-1;for(let i=paths.length-1;i>=0;i--)if(context.isPointInPath(paths[i],u,v)){hit=i;break;}context.restore();select(hit);});
canvas.addEventListener('pointercancel',()=>pointer=null);
new ResizeObserver(drawUV).observe(canvas.parentElement);
new ResizeObserver(entries=>{document.documentElement.style.setProperty('--uv-controls-height',`${entries[0].target.getBoundingClientRect().height}px`);}).observe(document.querySelector('.quick-controls'));
for(const drop of [$('drop-zone'),$('empty-model')]){
  drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('dragging');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
  drop.addEventListener('drop',event=>{event.preventDefault();event.stopPropagation();drop.classList.remove('dragging');openFile(event.dataTransfer.files[0]);});
}
window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>{event.preventDefault();openFile(event.dataTransfer.files[0]);});
try{preview=createPreview($('model-canvas'),{onSelect:select});}catch(error){console.warn('UV Lab 3D preview unavailable',error);$('render-error').hidden=false;}
useDemo('loose');
