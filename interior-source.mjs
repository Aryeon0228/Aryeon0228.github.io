// Read-only shader source inspector: tabs, highlighting, copy and download.
const $=id=>document.getElementById(id);

export function initSourcePanel(shaders){
 const tabs=[$('controlsTab'),$('sourceTab')];
 const panels=[$('controlsPanel'),$('sourcePanel')];
 let selectedShader='fragment';
 const sourceText=()=>shaders[selectedShader].trim();
 function selectPanel(index,focus=false){
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});
  $('study').classList.toggle('code-open',index===1);
  if(index===1&&!$('shaderCode').childNodes.length)showSource();
  if(focus)tabs[index].focus();
 }
 for(const [index,tab] of tabs.entries()){
  tab.addEventListener('click',()=>selectPanel(index));
  tab.addEventListener('keydown',event=>{
   let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;
   if(next!==undefined){event.preventDefault();selectPanel(next,true);}
  });
 }
 function highlight(source){
  const tokens=/\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b(?:precision|highp|attribute|varying|uniform|if|else|return|for|inout|void|int|float|bool|vec[234]|mat[234]|sampler2D)\b|(?:\b\d+\.\d*|\.\d+|\b\d+)\b/g;
  const escape=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let result='',end=0;
  for(const match of source.matchAll(tokens)){
   result+=escape(source.slice(end,match.index));const token=match[0];
   const kind=token.startsWith('//')||token.startsWith('/*')?'comment':/^[.\d]/.test(token)?'number':/^(float|int|bool|vec|mat|sampler)/.test(token)?'type':'keyword';
   result+='<span class="tok-'+kind+'">'+escape(token)+'</span>';end=match.index+token.length;
  }
  return result+escape(source.slice(end));
 }
 function showSource(){
  const source=sourceText();
  // Each displayed line comes from the same script element passed to gl.shaderSource.
  $('shaderCode').innerHTML=source.split('\n').map((line,i)=>'<span class="code-line" data-line="'+(i+1)+'">'+(highlight(line)||' ')+'</span>').join('');
  $('sourceMeta').textContent=source.split('\n').length+' lines';
  $('codeScroll').scrollTop=0;$('codeScroll').scrollLeft=0;
  $('sourceStatus').textContent='읽기 전용 · WebGL 1.0';
  for(const button of document.querySelectorAll('[data-shader]'))button.setAttribute('aria-pressed',String(button.dataset.shader===selectedShader));
 }
 for(const button of document.querySelectorAll('[data-shader]'))button.addEventListener('click',()=>{selectedShader=button.dataset.shader;showSource();});
 $('copyShader').addEventListener('click',async()=>{
  const source=sourceText(),filename=selectedShader+'.glsl';
  try{await navigator.clipboard.writeText(source);$('sourceStatus').textContent=filename+' 코드를 복사했습니다.';}
  catch{
   const range=document.createRange();range.selectNodeContents($('shaderCode'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   $('sourceStatus').textContent='코드를 선택했어요. Ctrl+C 또는 ⌘C로 복사하세요.';
  }
 });
 $('downloadShader').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([sourceText()+'\n'],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='penumbra-interior.'+(selectedShader==='fragment'?'frag':'vert');document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);$('sourceStatus').textContent=selectedShader+'.glsl 파일을 다운로드했습니다.';
 });
}
