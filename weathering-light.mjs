import {Vector3} from './vendor/three/build/three.module.js';

const DEFAULT_X=-.58, DEFAULT_Y=.58, MAX_RADIUS=.98;
const HELP='화면 안의 조명 핸들을 드래그하세요. 방향키로도 움직일 수 있어요.';

// The handle is a screen-facing hemisphere: its edge produces grazing light.
// Keeping its direction relative to the camera makes it useful after orbiting.
export function createWeatheringLight({camera,controls,stage,light,handle,resetButton,output,note,invalidate,onStart=()=>{},onLightChange=()=>{}}){
  let x=DEFAULT_X,y=DEFAULT_Y,drag=null,maskMode=null,disposed=false;
  const anchor=new Vector3(0,.15,0),position=new Vector3(),listeners=[];
  light.target.position.copy(anchor);

  function listen(element,type,callback){
    element.addEventListener(type,callback);
    listeners.push(()=>element.removeEventListener(type,callback));
  }
  function dimensions(){
    const bounds=stage.getBoundingClientRect();
    return {width:bounds.width,height:bounds.height,rx:Math.max(1,bounds.width/2-38),ry:Math.max(1,bounds.height/2-68)};
  }
  function directionLabel(){
    const horizontal=Math.round(Math.abs(x)*100),vertical=Math.round(Math.abs(y)*100);
    return (horizontal?`${x<0?'왼쪽':'오른쪽'} ${horizontal}`:'좌우 중앙')+' · '+(vertical?`${y<0?'아래':'위'} ${vertical}`:'높이 중앙');
  }
  function update(){
    if(disposed)return;
    const {width,height,rx,ry}=dimensions();
    handle.style.left=(width/2+x*rx)+'px';
    handle.style.top=(height/2-y*ry)+'px';
    stage.dataset.lightX=x.toFixed(4);
    stage.dataset.lightY=y.toFixed(4);
    const label=directionLabel();
    if(output.textContent!==label)output.textContent=label;
    handle.setAttribute('aria-label',`조명 방향: ${label}. 드래그하거나 방향키로 이동, Shift와 방향키로 미세 조절, Home으로 초기화`);
    position.set(x,y,Math.sqrt(Math.max(.04,1-x*x-y*y))).normalize().applyQuaternion(camera.quaternion).multiplyScalar(8).add(anchor);
    if(light.position.distanceToSquared(position)>1e-10){
      light.position.copy(position);
      onLightChange();
    }
  }
  function setPosition(nextX,nextY){
    const radius=Math.hypot(nextX,nextY),scale=radius>MAX_RADIUS?MAX_RADIUS/radius:1;
    x=nextX*scale;y=nextY*scale;
    update();invalidate();
  }
  function finishDrag(){
    if(!drag)return;
    const previous=drag;drag=null;
    controls.enabled=previous.controlsEnabled;
    stage.dataset.lightDragging='false';
    if(handle.hasPointerCapture(previous.id))handle.releasePointerCapture(previous.id);
  }
  function beginChange(){
    onStart();
    // Consume orbit inertia without moving the visible object under the handle.
    const cameraPosition=camera.position.clone(),target=controls.target.clone();
    const damping=controls.enableDamping;
    controls.enableDamping=false;controls.update();
    camera.position.copy(cameraPosition);controls.target.copy(target);controls.update();
    controls.enableDamping=damping;
  }
  function reset(){
    if(disposed)return;
    finishDrag();beginChange();setPosition(DEFAULT_X,DEFAULT_Y);
  }
  function setMaskMode(enabled){
    if(disposed||maskMode===Boolean(enabled))return;
    maskMode=Boolean(enabled);
    if(maskMode)finishDrag();
    handle.hidden=maskMode;
    handle.disabled=maskMode;
    resetButton.disabled=maskMode;
    note.textContent=maskMode?'마스크는 조명의 영향을 받지 않습니다. 표면 보기에서 조명 핸들을 사용할 수 있어요.':HELP;
  }

  listen(handle,'pointerdown',event=>{
    if(disposed||maskMode||drag||!event.isPrimary||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    beginChange();
    const {rx,ry}=dimensions();
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x,y,rx,ry,controlsEnabled:controls.enabled};
    controls.enabled=false;
    stage.dataset.lightDragging='true';
    handle.setPointerCapture(event.pointerId);
    handle.focus({preventScroll:true});
  });
  listen(handle,'pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    event.preventDefault();event.stopPropagation();
    setPosition(drag.x+(event.clientX-drag.startX)/drag.rx,drag.y-(event.clientY-drag.startY)/drag.ry);
  });
  const release=event=>{
    if(!drag||event.pointerId!==drag.id)return;
    event.preventDefault();event.stopPropagation();finishDrag();
  };
  listen(handle,'pointerup',release);
  listen(handle,'pointercancel',release);
  listen(handle,'lostpointercapture',release);
  // Avoid a synthesized click reaching any stage-level inspection handlers.
  listen(handle,'click',event=>event.stopPropagation());
  listen(handle,'keydown',event=>{
    if(disposed||maskMode)return;
    const step=event.shiftKey ? .012 : .06;
    const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,step],ArrowDown:[0,-step]};
    if(event.key!=='Home'&&!moves[event.key])return;
    event.preventDefault();event.stopPropagation();
    if(event.key==='Home'){reset();return;}
    finishDrag();beginChange();
    const [dx,dy]=moves[event.key];setPosition(x+dx,y+dy);
  });
  listen(resetButton,'click',()=>{if(!maskMode)reset();});

  stage.dataset.lightDragging='false';
  setMaskMode(false);update();
  return {update,reset,setMaskMode,dispose(){
    if(disposed)return;
    finishDrag();disposed=true;
    listeners.forEach(remove=>remove());
  }};
}
