// Bloom uses exposed linear RGB before tone mapping. A bounded highlight response
// keeps an illustrative bright window from washing out the whole teaching scene.
export function bloomLinear(rgb,width,height){
 const bright=new Float32Array(rgb.length),scratch=new Float32Array(rgb.length);
 for(let i=0;i<rgb.length;i+=3){
  const y=.2126*rgb[i]+.7152*rgb[i+1]+.0722*rgb[i+2];
  if(y<=1)continue;
  const response=Math.min(2,y-1)/y;
  for(let c=0;c<3;c++)bright[i+c]=rgb[i+c]*response;
 }
 const radius=Math.max(1,Math.round(width/80)),size=2*radius+1;
 // Two separable box blurs; radius scales with the drag-preview resolution.
 for(let pass=0;pass<2;pass++){
  for(let y=0;y<height;y++)for(let c=0;c<3;c++){
   let sum=0;for(let dx=-radius;dx<=radius;dx++)sum+=bright[(y*width+Math.max(0,Math.min(width-1,dx)))*3+c];
   for(let x=0;x<width;x++){
    scratch[(y*width+x)*3+c]=sum/size;
    sum+=bright[(y*width+Math.min(width-1,x+radius+1))*3+c]-bright[(y*width+Math.max(0,x-radius))*3+c];
   }
  }
  for(let x=0;x<width;x++)for(let c=0;c<3;c++){
   let sum=0;for(let dy=-radius;dy<=radius;dy++)sum+=scratch[(Math.max(0,Math.min(height-1,dy))*width+x)*3+c];
   for(let y=0;y<height;y++){
    bright[(y*width+x)*3+c]=sum/size;
    sum+=scratch[(Math.min(height-1,y+radius+1)*width+x)*3+c]-scratch[(Math.max(0,y-radius)*width+x)*3+c];
   }
  }
 }
 const result=new Float32Array(rgb.length);
 for(let i=0;i<rgb.length;i++)result[i]=rgb[i]+Math.max(0,bright[i])*.08;
 return result;
}
