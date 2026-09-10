(function(){
  const header=document.querySelector('.site-header');
  if(!header)return;
  const toggle=header.querySelector('.menu-toggle');
  const panel=header.querySelector('.site-links');
  const label=toggle.querySelector('.menu-toggle-label');
  const mobile=window.matchMedia('(max-width:999px)');
  function setOpen(open){
    open=mobile.matches && open;
    header.classList.toggle('menu-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    label.textContent=open?'닫기':'메뉴';
    panel.hidden=mobile.matches && !open;
  }
  toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));
  panel.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && toggle.getAttribute('aria-expanded')==='true'){
      setOpen(false);toggle.focus();
    }
  });
  document.addEventListener('click',event=>{if(!header.contains(event.target))setOpen(false);});
  header.addEventListener('focusout',()=>{
    requestAnimationFrame(()=>{if(!header.contains(document.activeElement))setOpen(false);});
  });
  mobile.addEventListener('change',()=>setOpen(false));
  setOpen(false);
})();