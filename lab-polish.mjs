// Quiet adaptations of Lucian 048 / 464. See licenses/lucian-uxui.txt.
import {focusToScale,scaleToFocus} from './focus-optics.mjs?v=59306f6569d2';

// Keep the original sliders and their event handlers as the source of truth.
const fields = [
 ['exposure','exposure-out','공통 노출 보정','스톱'],
 ['room-exposure','room-exposure-out','실내 공통 노출 보정','스톱'],
 ['left-offset','left-offset-out','왼쪽 개별 노출 보정','스톱'],
 ['right-offset','right-offset-out','오른쪽 개별 노출 보정','스톱'],
 ['roughness','roughnessValue','거칠기',''],
 ['metallic','metallicValue','금속성',''],
 ['focus','focus-out','초점 거리','cm'],
];
for (const [id,outputId,name,unit] of fields) {
 const range=document.getElementById(id),output=document.getElementById(outputId);
 if(!range||!output)continue;
 const focus=id==='focus',fromRaw=v=>focus?scaleToFocus(v/1000)*100:v,toRaw=v=>focus?focusToScale(v/100)*1000:v;
 const input=document.createElement('input');input.type='number';input.id=id+'-exact';input.className='lab-exact-input';
 input.min=String(fromRaw(+range.min));input.max=String(fromRaw(+range.max));input.step=focus?'0.1':range.step==='any'?'0.1':range.step;
 input.setAttribute('aria-label',name+' 숫자 입력'+(unit?' · '+unit:''));
 const wrapper=document.createElement('span');wrapper.className='lab-exact';
 const suffix=document.createElement('span');suffix.textContent=unit;
 output.after(wrapper);wrapper.append(input,suffix);output.classList.add('lab-readout-source');output.setAttribute('aria-hidden','true');
 const sync=()=>{if(document.activeElement!==input)input.value=String(Number(fromRaw(+range.value).toFixed(focus?1:2)));input.disabled=range.disabled;};
 const commit=()=>{
  if(input.value.trim()===''||!Number.isFinite(input.valueAsNumber)){input.value=String(Number(fromRaw(+range.value).toFixed(2)));return;}
  const value=Math.min(+input.max,Math.max(+input.min,input.valueAsNumber));
  range.value=String(toRaw(value));range.dispatchEvent(new Event('input',{bubbles:true}));
  input.value=String(Number(fromRaw(+range.value).toFixed(focus?1:2)));
 };
 input.addEventListener('change',commit);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();}if(e.key==='Escape'){input.value=String(Number(fromRaw(+range.value).toFixed(2)));input.blur();}});
 range.addEventListener('input',sync);
 new MutationObserver(sync).observe(output,{childList:true,subtree:true,characterData:true});
 new MutationObserver(sync).observe(range,{attributes:true,attributeFilter:['disabled']});sync();
 if(unit==='스톱'){
  const ticks=document.createElement('div');ticks.className='lab-range-scale';ticks.setAttribute('aria-hidden','true');
  for(const v of [range.min,'0',range.max]){const mark=document.createElement('span');mark.textContent=Number(v)>0?'+'+v:v;ticks.append(mark);}
  // Zero is placed at its actual position, not at the middle of an asymmetric range.
  ticks.children[1].style.left=((0-Number(range.min))/(Number(range.max)-Number(range.min))*100)+'%';range.after(ticks);
 }
}
// Reveal the focused tab without scrolling the entire page or altering tab behavior.
for(const tabs of document.querySelectorAll('[role="tablist"]'))tabs.addEventListener('focusin',e=>{
 const rect=e.target.getBoundingClientRect(),box=tabs.getBoundingClientRect();
 if(rect.left<box.left)tabs.scrollLeft+=rect.left-box.left;
 if(rect.right>box.right)tabs.scrollLeft+=rect.right-box.right;
});
