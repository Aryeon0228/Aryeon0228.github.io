// Shared lab shell. On phones, the panel marked [data-lab-sheet] becomes a bottom sheet so the
// stage stays in view while it is adjusted. The panel is wrapped rather than changed, because some
// labs rebuild their panel's contents; on wider screens the wrapper uses display: contents.
(function(){
  const panel=document.querySelector('[data-lab-sheet]');
  if(!panel)return;
  const phone=window.matchMedia('(max-width:760px)');
  const sheet=document.createElement('div');
  sheet.className='lab-sheet';
  panel.before(sheet);
  const handle=document.createElement('button');
  handle.type='button';
  handle.className='lab-sheet-handle';
  if(!panel.id)panel.id='lab-sheet-panel';
  handle.setAttribute('aria-controls',panel.id);
  const title=panel.dataset.labSheet||'조절';
  handle.innerHTML='<span class="lab-sheet-grip" aria-hidden="true"></span><span class="lab-sheet-title"></span><span class="lab-sheet-state" aria-hidden="true"></span>';
  handle.querySelector('.lab-sheet-title').textContent=title;
  sheet.append(handle,panel);
  function setOpen(open){
    open=phone.matches&&open;
    sheet.classList.toggle('is-open',open);
    handle.setAttribute('aria-expanded',String(open));
    handle.querySelector('.lab-sheet-state').textContent=open?'닫기 ▾':'열기 ▴';
    handle.setAttribute('aria-label',title+(open?' 닫기':' 열기'));
  }
  handle.addEventListener('click',()=>setOpen(!sheet.classList.contains('is-open')));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sheet.classList.contains('is-open')){setOpen(false);handle.focus();}});
  phone.addEventListener('change',()=>{document.body.classList.toggle('has-lab-sheet',phone.matches);setOpen(false);});
  document.body.classList.toggle('has-lab-sheet',phone.matches);
  setOpen(false);
})();
