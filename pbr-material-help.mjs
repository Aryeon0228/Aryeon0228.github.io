export function createMaterialHelp(notes,labels){
 const panel=document.createElement('section');panel.id='materialNote';panel.className='material-note';panel.hidden=true;
 panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','materialNoteTitle');panel.setAttribute('aria-describedby','materialNoteDescription');
 const header=document.createElement('div');header.className='material-note-heading';
 const title=document.createElement('h2');title.id='materialNoteTitle';
 const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='material-note-close';dismiss.textContent='×';dismiss.setAttribute('aria-label','재질 설명 닫기');
 header.append(title,dismiss);
 const mechanism=document.createElement('span');mechanism.className='material-note-mechanism';
 const description=document.createElement('p');description.id='materialNoteDescription';
 const simulation=document.createElement('p');simulation.className='material-note-simulation';
 const source=document.createElement('a');source.target='_blank';source.rel='noopener noreferrer';
 panel.append(header,mechanism,description,simulation,source);document.body.append(panel);
 let trigger=null,pinned=false,hideTimer=0;
 function cancelHide(){clearTimeout(hideTimer);}
 function close(restoreFocus=false){
  cancelHide();const previous=trigger;trigger=null;pinned=false;panel.hidden=true;
  if(previous){previous.setAttribute('aria-expanded','false');previous.removeAttribute('aria-describedby');}
  // Suppress focus-open while returning from the popup with Escape or Close.
  if(restoreFocus&&previous?.isConnected){previous.dataset.returningFocus='true';previous.focus({preventScroll:true});delete previous.dataset.returningFocus;}
 }
 function position(){
  if(!trigger||panel.hidden)return;
  const rect=trigger.getBoundingClientRect(),width=document.documentElement.clientWidth,height=window.innerHeight;
  if(rect.bottom<0||rect.top>height||rect.right<0||rect.left>width){close();return;}
  const box=panel.getBoundingClientRect(),gap=10,edge=12;
  let left=rect.left-box.width-gap,top=rect.top-16;
  if(left<edge){left=Math.min(width-box.width-edge,Math.max(edge,rect.left));top=rect.bottom+gap;if(top+box.height>height-edge)top=rect.top-box.height-gap;}
  panel.style.left=Math.max(edge,Math.min(left,width-box.width-edge))+'px';
  panel.style.top=Math.max(edge,Math.min(top,height-box.height-edge))+'px';
 }
 function show(id,button,pin=false){
  cancelHide();if(trigger!==button)close();
  const note=notes[id];if(!note)return;
  trigger=button;pinned=pin;title.textContent=labels[id];mechanism.textContent=note.mechanism;description.textContent=note.description;simulation.textContent='이 랩에서는 · '+note.simulation.replace(/^여기서는 /,'');
  source.textContent=note.source.label+' ↗';source.href=note.source.url;
  panel.hidden=false;button.setAttribute('aria-expanded','true');button.setAttribute('aria-describedby',description.id);position();
 }
 function scheduleHide(){
  cancelHide();if(pinned)return;
  hideTimer=setTimeout(()=>{if(!panel.matches(':hover')&&!panel.contains(document.activeElement)&&document.activeElement!==trigger)close();},180);
 }
 function createButton(id){
  const button=document.createElement('button');button.type='button';button.className='preset-help';button.textContent='?';
  button.setAttribute('aria-label',labels[id]+' 색의 원리');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');
  button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'&&!pinned)show(id,button);});
  button.addEventListener('pointerleave',scheduleHide);
  button.addEventListener('focus',()=>{if(!button.dataset.returningFocus&&!(trigger===button&&pinned))show(id,button);});
  button.addEventListener('blur',scheduleHide);
  button.addEventListener('click',()=>{if(trigger===button&&pinned)close();else{show(id,button,true);dismiss.focus({preventScroll:true});}});
  return button;
 }
 panel.addEventListener('pointerenter',cancelHide);panel.addEventListener('pointerleave',scheduleHide);panel.addEventListener('focusin',cancelHide);panel.addEventListener('focusout',scheduleHide);
 dismiss.addEventListener('click',()=>close(true));
 document.addEventListener('pointerdown',event=>{if(trigger&&!panel.contains(event.target)&&!trigger.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();close(panel.contains(document.activeElement));}});
 window.addEventListener('resize',position);document.addEventListener('scroll',event=>{if(!panel.contains(event.target))position();},true);
 return {createButton,close};
}
