import {createDemo} from './uv-demo.mjs?v=fab0c3718363';
import {createPreview,makeAtlas,islandColor,metricColor} from './uv-preview.mjs?v=621c380ff531';

const $=id=>document.getElementById(id);
const percent=value=>`${(value*100).toFixed(1)}%`;
const number=value=>Number.isFinite(value)?value.toLocaleString('ko-KR',{maximumFractionDigits:1}):'—';
const state={model:null,analysis:null,resolution:64,mode:'texture',selected:-1,materialId:-1,listLimit:24};
let preview=null,atlas=null,paths=[],boundaryPaths=[],jobId=0,worker=null,uvTransform=null;
const viewport={zoom:1,panX:0,panY:0};
const canvas=$('uv-canvas'),context=canvas.getContext('2d');

function status(message,error=false){$('load-status').textContent=message;$('load-status').classList.toggle('error',error);}
function busy(value){document.querySelectorAll('[data-demo],#atlas-scope,#model-file').forEach(e=>e.disabled=value);$('drop-zone').setAttribute('aria-busy',String(value));}
function createWorker(){
  worker=new Worker(new URL('./uv-worker.mjs?v=a41c6492696d',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id!==jobId)return;busy(false);
    if(data.error){status(data.error,true);return;}
    if(data.model){state.model=data.model;state.materialId=-1;syncScope();}
    state.analysis=data.result;state.selected=-1;state.listLimit=24;
    buildPaths();resetUV();
    try{if(preview){preview.setModel(state.model,state.analysis);preview.setAppearance(state);atlas=preview.textureCanvas;}else atlas=makeAtlas(state.model,state.resolution,undefined,state.mode==='checker');}catch(error){console.error(error);$('render-error').hidden=false;atlas=makeAtlas(state.model,state.resolution,undefined,state.mode==='checker');}
    sync();status(`${state.model.demo?'예제 준비 완료':'검사 완료'} · ${number(state.analysis.stats.triangles)}개 삼각형 · ${state.analysis.islands.length}개 아일랜드`);
  };
  worker.onerror=()=>{busy(false);status('파일을 읽는 중 문제가 생겼어요. 다른 파일이나 예제를 선택해 다시 시도해주세요.',true);worker.terminate();worker=null;};
}
function analyze({file}={}){if(!worker)createWorker();jobId++;busy(true);status(file?'파일을 읽고 UV를 검사하고 있어요…':'UV 배치를 검사하고 있어요…');worker.postMessage({id:jobId,model:file?null:state.model,file,options:{materialId:file?-1:state.materialId,resolution:state.resolution}});}
function syncScope(){
  $('file-name').textContent=state.model.name;
  const select=$('atlas-scope');select.replaceChildren(new Option('전체 · 하나의 텍스처로 보기','-1'));
  const usedMaterials=new Set(state.model.materialIds);
  state.model.materialNames.forEach((name,id)=>{if(usedMaterials.has(id))select.add(new Option(name,String(id)));});select.value=String(state.materialId);
  document.querySelectorAll('[data-demo]').forEach(button=>button.setAttribute('aria-pressed',String(state.model.demo?.layout===button.dataset.demo)));
  $('demo-note').textContent=state.model.demo?({loose:'먼저 64픽셀로 관찰하고 ‘공간 정리’와 비교해보세요.',packed:'같은 무늬, 같은 해상도. 조각에 배정된 픽셀이 늘어납니다.',stretched:'왼쪽 면의 UV를 가로로 늘렸어요. ‘늘어짐’에서 비율을 확인하세요.'}[state.model.demo.layout]):'수업 예제 버튼을 누르면 언제든 비교로 돌아갈 수 있어요.';
  $('model-tag').textContent=state.model.demo?'ROUND CASE':'LOCAL MODEL';
}
function useDemo(layout){if(layout==='stretched')state.mode='checker';state.model=createDemo(layout);state.materialId=-1;syncScope();analyze();}
function openFile(file){if(!file)return;if(!/\.(obj|fbx)$/i.test(file.name)){status('OBJ 또는 FBX 파일을 선택해주세요.',true);return;}if(file.size>20*1024*1024){status('20 MiB 이하 파일을 사용해주세요. 큰 모델은 나누어 가져올 수 있어요.',true);return;}analyze({file});}

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
  if(['texture','checker'].includes(state.mode)&&atlas){context.imageSmoothingEnabled=false;context.drawImage(atlas,ox,oy,side,side);}
  context.save();context.translate(ox,oy+side);context.scale(side,-side);
  context.beginPath();context.rect(-ox/side,(oy+side-h)/side,w/side,h/side);context.clip();
  if(state.analysis){
    state.analysis.islands.forEach(island=>{
      if(!['texture','checker'].includes(state.mode)){context.fillStyle=state.mode==='islands'?islandColor(island.id):metricColor(state.mode,island);context.globalAlpha=.82;context.fill(paths[island.id]);context.globalAlpha=1;}
      context.strokeStyle=state.selected===island.id?'#f3fff2':state.mode==='texture'?'#b4c9b8':'#15251d';context.lineWidth=(state.selected===island.id?2.5:1)/side;context.stroke(boundaryPaths[island.id]);
    });
    if(state.selected>=0){context.fillStyle='#c2f6c3';context.globalAlpha=.2;context.fill(paths[state.selected]);context.globalAlpha=1;}
  }
  if($('pixel-grid').checked&&side/state.resolution>=4){context.strokeStyle='#ffffff20';context.lineWidth=.5/side;context.beginPath();for(let i=0;i<=state.resolution;i++){const t=i/state.resolution;context.moveTo(t,0);context.lineTo(t,1);context.moveTo(0,t);context.lineTo(1,t);}context.stroke();}
  context.strokeStyle='#b3b9b3';context.lineWidth=1/side;context.strokeRect(0,0,1,1);context.restore();
  context.fillStyle='#949b97';context.font='10px monospace';context.fillText('0',ox-13,oy+side+14);context.fillText('1',ox+side+5,oy+side+14);context.fillText('1',ox-13,oy+4);
  context.fillStyle='#9aaa9f';context.fillText(state.resolution+' × '+state.resolution+' PX',16,h-12);
}
function select(id){state.selected=id>=0&&state.analysis?.islands[id]?id:-1;preview?.setAppearance({selected:state.selected});drawUV();renderList();renderSelection();}
function renderList(){
  const list=$('island-list'),focusId=list.contains(document.activeElement)?document.activeElement.dataset.islandId:null;list.replaceChildren();const islands=state.analysis.islands;
  for(const island of islands.slice(0,state.listLimit)){
    const button=document.createElement('button');button.className='island-row';button.type='button';button.dataset.islandId=String(island.id);button.style.setProperty('--island-color',islandColor(island.id));button.setAttribute('aria-pressed',String(island.id===state.selected));
    const label=document.createElement('span'),dot=document.createElement('i');dot.setAttribute('aria-hidden','true');label.append(dot,document.createTextNode(String(island.id+1).padStart(2,'0')));button.append(label);
    for(const text of [`${number(island.uvArea*state.resolution**2)} px²`,`${island.densityRatio.toFixed(2)}×`,`${island.stretch.toFixed(2)}×`]){const span=document.createElement('span');span.textContent=text;button.append(span);}
    button.setAttribute('aria-label',`아일랜드 ${island.id+1}, 배정 영역 ${number(island.uvArea*state.resolution**2)} 픽셀 제곱, 상대 밀도 ${island.densityRatio.toFixed(2)}배, 늘어짐 ${island.stretch.toFixed(2)}배`);button.onclick=()=>select(island.id);list.append(button);
  }
  if(focusId!==null)list.querySelector('[data-island-id="'+focusId+'"]')?.focus({preventScroll:true});
  $('list-range').textContent=`${Math.min(islands.length,state.listLimit)} / ${islands.length}`;$('more-islands').hidden=islands.length<=state.listLimit;
  if(!islands.length){const p=document.createElement('p');p.className='fine-print';p.textContent='검사할 UV 아일랜드가 없어요. 모델에서 UV를 편 뒤 다시 내보내주세요.';list.append(p);}
}
function renderSelection(){
  const island=state.analysis.islands[state.selected];$('selection-values').hidden=!island;
  $('selection-title').textContent=island?`아일랜드 ${String(island.id+1).padStart(2,'0')}`:'조각 하나를 골라보세요.';
  if(!island){$('selection-description').textContent='UV, 3D 또는 목록을 누르면 같은 부위가 함께 표시됩니다.';return;}
  const b=island.bounds;
  $('selected-size').textContent=`${number((b.maxU-b.minU)*state.resolution)} × ${number((b.maxV-b.minV)*state.resolution)} px`;
  $('selected-density').textContent=`${island.densityRatio.toFixed(2)}×`;$('selected-stretch').textContent=`${island.stretch.toFixed(2)}×`;
  $('selection-description').textContent=`${number(island.faces.length)}개 삼각형 · 배정 영역 ${number(island.uvArea*state.resolution**2)} px². `+(island.stretch>1.3?'체크 무늬가 길어지는 방향을 3D에서 살펴보세요.':island.densityRatio<.75?'평균보다 픽셀을 적게 받는 부위예요. 중요한 부위인지 확인해보세요.':'해상도를 낮추면서 글자와 가는 선이 유지되는지 살펴보세요.');
}
function sync(){
  if(!state.analysis)return;
  document.querySelectorAll('[data-resolution]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.resolution===state.resolution)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
  const r=state.resolution,bytes=r*r*4,memory=bytes<1048576?`${number(bytes/1024)} KiB`:`${number(bytes/1048576)} MiB`;
  $('budget-note').textContent=`${r} × ${r} · ${number(r*r)} pixels · RGBA8 ${memory} · ${r===4096?'4K 픽셀 수':`4K의 ${number(4096**2/r**2)}분의 1 픽셀`}`;
  $('resolution-label').textContent=`${r} × ${r}`;
  $('view-legend').textContent={texture:'같은 테스트 무늬 · 최근접 샘플링',checker:'정사각 체커 · 길어지거나 휘는 방향을 확인하세요.',islands:'같은 색은 UV가 이어지는 하나의 아일랜드',stretch:'회녹색 1× → 주황색 4× 이상 · 비율이 달라진 정도',density:'파랑 0.5× 이하 · 회색 1× · 주황 2× 이상 · 전체 대비'}[state.mode];
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
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>useDemo(b.dataset.demo));
document.querySelectorAll('[data-resolution]').forEach(b=>b.onclick=()=>{state.resolution=+b.dataset.resolution;if(preview){preview.setAppearance({resolution:state.resolution});atlas=preview.textureCanvas;}else if(state.model)atlas=makeAtlas(state.model,state.resolution,atlas||undefined,state.mode==='checker');sync();});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;if(preview){preview.setAppearance({mode:state.mode});atlas=preview.textureCanvas;}else if(state.model)atlas=makeAtlas(state.model,state.resolution,atlas||undefined,state.mode==='checker');sync();});
$('model-file').onchange=event=>{openFile(event.target.files[0]);event.target.value='';};
$('atlas-scope').onchange=event=>{state.materialId=+event.target.value;analyze();};
$('more-islands').onclick=()=>{state.listLimit+=60;renderList();};$('clear-selection').onclick=()=>select(-1);
$('view-reset').onclick=()=>preview?.reset();$('uv-reset').onclick=resetUV;$('pixel-grid').onchange=drawUV;
function zoom(factor){viewport.zoom=Math.max(.2,Math.min(12,viewport.zoom*factor));drawUV();}
$('zoom-in').onclick=()=>zoom(1.4);$('zoom-out').onclick=()=>zoom(1/1.4);
canvas.addEventListener('keydown',event=>{if(['+','=','-','0'].includes(event.key)){event.preventDefault();if(event.key==='0')resetUV();else zoom(event.key==='-'?1/1.4:1.4);}});
let pointer=null;
canvas.addEventListener('pointerdown',event=>{pointer={id:event.pointerId,x:event.clientX,y:event.clientY,panX:viewport.panX,panY:viewport.panY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!pointer||event.pointerId!==pointer.id)return;viewport.panX=pointer.panX+event.clientX-pointer.x;viewport.panY=pointer.panY+event.clientY-pointer.y;drawUV();});
canvas.addEventListener('pointerup',event=>{if(!pointer)return;const moved=Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y);pointer=null;if(moved>5||!uvTransform||!state.analysis)return;const box=canvas.getBoundingClientRect(),{side,ox,oy}=uvTransform,u=(event.clientX-box.left-ox)/side,v=1-(event.clientY-box.top-oy)/side;context.save();context.setTransform(1,0,0,1,0,0);let hit=-1;for(let i=paths.length-1;i>=0;i--)if(context.isPointInPath(paths[i],u,v)){hit=i;break;}context.restore();select(hit);});
canvas.addEventListener('pointercancel',()=>pointer=null);
new ResizeObserver(drawUV).observe(canvas.parentElement);
const drop=$('drop-zone');drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('dragging');});drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('dragging');if(!$('model-file').disabled)openFile(event.dataTransfer.files[0]);});
window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>event.preventDefault());
try{preview=createPreview($('model-canvas'),{onSelect:select});}catch(error){console.warn('UV Lab 3D preview unavailable',error);$('render-error').hidden=false;}
useDemo('loose');
