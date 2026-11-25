// Keep the live preview visible above controls on a phone. Move the original canvas,
// never a copy, so the existing renderer, controls and selection keep their state.
(function(){
  const panel=document.querySelector('[data-lab-sheet]');
  if(!panel)return;
  const phone=window.matchMedia('(max-width:760px)');
  const preview=document.querySelector('[data-lab-preview]');
  const sheet=document.createElement('div');sheet.className='lab-sheet';
  panel.before(sheet);
  const home=document.createComment('lab controls');sheet.before(home);
  const previewHome=document.createComment('lab preview');
  const view=document.createElement('div');view.className='lab-sheet-preview';
  const question=document.createElement('p');question.className='lab-sheet-question';question.hidden=true;
  const handle=document.createElement('button');handle.type='button';handle.className='lab-sheet-handle';
  if(!panel.id)panel.id='lab-sheet-panel';
  handle.setAttribute('aria-controls',panel.id);
  const title=panel.dataset.labSheet||'조절';
  const name=document.createElement('span');name.className='lab-sheet-title';name.textContent=title;
  const state=document.createElement('span');state.className='lab-sheet-state';state.setAttribute('aria-hidden','true');
  handle.append(name,state);
  const toolbar=document.createElement('div');toolbar.className='lab-sheet-toolbar';
  const resize=document.createElement('button');resize.type='button';resize.className='lab-sheet-resize';resize.hidden=true;resize.textContent='미리보기 확대';resize.setAttribute('aria-pressed','false');
  resize.addEventListener('click',()=>{const large=sheet.classList.toggle('is-preview-large');resize.setAttribute('aria-pressed',String(large));resize.textContent=large?'조절 영역 확대':'미리보기 확대';requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));});
  toolbar.append(handle,resize);sheet.append(question,view,toolbar,panel);
  let open=false,previousOverflow='',inertElements=[];
  function setOpen(next){
    next=phone.matches&&next;
    const changed=next!==open;
    if(next!==open){
      if(next){
        if(preview){preview.before(previewHome);view.append(preview);}
        question.textContent=document.getElementById('experiment-question')?.textContent||'';question.hidden=!question.textContent;
        document.body.append(sheet);
        inertElements=[...document.body.children].filter(el=>el!==sheet&&el.tagName!=='DIALOG'&&!el.inert);
        inertElements.forEach(el=>el.inert=true);
        previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
        sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label',title);
      }else{
        if(previewHome.parentNode){previewHome.replaceWith(preview);}
        home.after(sheet);inertElements.forEach(el=>el.inert=false);inertElements=[];
        document.body.style.overflow=previousOverflow;
        ['role','aria-modal','aria-label'].forEach(attr=>sheet.removeAttribute(attr));
      }
      open=next;
    }
    sheet.classList.toggle('is-open',open);
    handle.setAttribute('aria-expanded',String(open));
    handle.setAttribute('aria-label',title+(open?' 닫기':' 열기'));
    state.textContent=open?'닫기 ×':'열기 +';
    resize.hidden=!open||!preview;
    // Collapsed controls must not receive keyboard focus outside the visible handle.
    panel.inert=phone.matches&&!open;
    if(changed&&phone.matches)handle.focus({preventScroll:true});
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }
  handle.addEventListener('click',()=>setOpen(!open));
  document.addEventListener('keydown',event=>{
    if(!open||document.querySelector('dialog[open]'))return;
    if(event.key==='Escape'){setOpen(false);handle.focus();}
    if(event.key==='Tab'){
      const nodes=[...sheet.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"],summary')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  phone.addEventListener('change',()=>{document.body.classList.toggle('has-lab-sheet',phone.matches);setOpen(false);});
  document.body.classList.toggle('has-lab-sheet',phone.matches);setOpen(false);
})();
