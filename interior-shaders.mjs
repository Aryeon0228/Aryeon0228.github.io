// GLSL ES 1.00 sources for the fullscreen-triangle interior-mapping renderer.
// The source panel displays these same strings, so what you read is what runs.
export const shaders={
vertex:`
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0.,1.);}
`,
fragment:`
precision highp float;
varying vec2 v_uv;
uniform float u_yaw,u_pitch,u_depth,u_grid,u_aspect,u_seed,u_refl,u_dust,u_day;
uniform int u_mode;
float best,material;vec3 normal;float variant;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float rect(vec2 p,vec2 lo,vec2 hi,float e){vec2 a=smoothstep(lo-e,lo+e,p)*(1.-smoothstep(hi-e,hi+e,p));return a.x*a.y;}
vec3 safeRay(vec3 rd){return mix(vec3(-1.),vec3(1.),step(vec3(0.),rd))*max(abs(rd),vec3(.00001));}
void box(vec3 ro,vec3 rd,vec3 lo,vec3 hi,float mat){
 vec3 a=(lo-ro)/rd,b=(hi-ro)/rd;vec3 nearT=min(a,b),farT=max(a,b);
 float t=max(max(nearT.x,nearT.y),nearT.z),end=min(min(farT.x,farT.y),farT.z);
 if(t>.0001&&t<best&&end>=t){best=t;material=mat;normal=vec3(0);if(nearT.x>=nearT.y&&nearT.x>=nearT.z)normal.x=-sign(rd.x);else if(nearT.y>=nearT.z)normal.y=-sign(rd.y);else normal.z=-sign(rd.z);}
}
void ellipsoid(vec3 ro,vec3 rd,vec3 center,vec3 radius,float mat){
 vec3 q=(ro-center)/radius,r=rd/radius;float a=dot(r,r),b=dot(q,r),c=dot(q,q)-1.;float h=b*b-a*c;
 if(h>0.){float t=(-b-sqrt(h))/a;if(t>.0001&&t<best){best=t;material=mat;normal=normalize((ro+rd*t-center)/(radius*radius));}}
}
vec3 sky(vec3 rd){
 float elevation=clamp(rd.y*.7+.35,0.,1.);
 vec3 low=mix(vec3(.035,.053,.070),vec3(.37,.48,.56),u_day);
 vec3 high=mix(vec3(.018,.029,.048),vec3(.18,.31,.44),u_day);
 vec3 c=mix(low,high,elevation);
 float az=atan(rd.x,-rd.z);float skyline=.045+noise(vec2(floor(az*12.),4.))*.14;
 float building=1.-smoothstep(skyline-.012,skyline+.012,rd.y);
 c=mix(c,mix(vec3(.013,.020,.028),vec3(.12,.155,.17),u_day),building*.82);
 float band=pow(max(0.,1.-abs(rd.y-.20)*2.3),4.);c+=vec3(.15,.12,.085)*band*(1.-abs(u_day-.34))* .25;
 return c;
}
vec3 palette(float mat,vec3 p){
 vec3 col=vec3(.52,.485,.42);
 if(mat<.5){col=vec3(.56,.52,.45);float seam=1.-smoothstep(.003,.009,abs(fract(p.x*.75+.2)-.5));col*=1.-seam*.035;}
 else if(mat<1.5){
  float plank=floor(p.x*5.);float grain=noise(vec2(p.x*100.,p.z*5.));
  col=mix(vec3(.19,.126,.073),vec3(.29,.207,.128),grain*.55+hash(vec2(plank,1.))*.35);
  float joint=1.-smoothstep(.004,.012,abs(fract(p.x*5.)-.5));float end=1.-smoothstep(.006,.014,abs(fract(p.z*.54+hash(vec2(plank,3.)))-.5));col*=1.-joint*.25-end*.13;
 }
 else if(mat<2.5)col=vec3(.64,.62,.56);
 else if(mat<3.5)col=mix(vec3(.34,.30,.24),vec3(.49,.455,.38),variant);
 else if(mat<4.5){col=vec3(.105,.077,.046);col*=.9+.16*noise(p.xz*vec2(13.,80.));}
 else if(mat<5.5){col=vec3(.25,.24,.21);col*=.94+.08*sin(p.x*220.)*sin(p.z*190.);}
 else if(mat<6.5)col=vec3(.065,.074,.073);
 else if(mat<7.5)col=vec3(1.,.69,.32);
 else if(mat<8.5){
  vec2 uv=p.xy;float a=(1.-smoothstep(-.02,.02,length((uv-vec2(-.12,.31))*vec2(1.,1.3))-.23));
  float b=rect(uv,vec2(-.05,.0),vec2(.29,.48),.006);col=mix(vec3(.59,.555,.48),vec3(.13,.175,.17),a);col=mix(col,vec3(.29,.19,.12),b*.7);
 }
 else if(mat<9.5)col=vec3(.18,.225,.16);
 else col=vec3(.32,.345,.325);
 return col;
}
vec3 room(vec3 ro,vec3 rd,vec2 cell){
 float D=u_depth;variant=hash(cell+u_seed*1.17+8.1);float kind=hash(cell+u_seed+31.);
 vec3 a=(vec3(-1.32,-1.36,0.)-ro)/rd,b=(vec3(1.32,1.39,D)-ro)/rd;vec3 farT=max(a,b);
 best=min(min(farT.x,farT.y),farT.z);material=0.;normal=vec3(0.,0.,-1.);
 if(farT.y<farT.z&&farT.y<farT.x){normal=vec3(0.,-sign(rd.y),0.);material=rd.y<0.?1.:2.;}
 else if(farT.x<farT.z){normal=vec3(-sign(rd.x),0.,0.);}
 // Deep reveals and a recessed metal frame.
 box(ro,rd,vec3(-1.4,-1.6,0.),vec3(-1.14,1.6,.22),10.);
 box(ro,rd,vec3(1.14,-1.6,0.),vec3(1.4,1.6,.22),10.);
 box(ro,rd,vec3(-1.4,1.23,0.),vec3(1.4,1.6,.22),10.);
 box(ro,rd,vec3(-1.4,-1.6,0.),vec3(1.4,-1.24,.22),10.);
 // Baseboards and a slim perimeter ceiling cove.
 box(ro,rd,vec3(-1.32,-1.36,D-.05),vec3(1.32,-1.25,D),4.);
 box(ro,rd,vec3(-1.32,-1.36,0.),vec3(-1.29,-1.25,D),4.);
 box(ro,rd,vec3(1.29,-1.36,0.),vec3(1.32,-1.25,D),4.);
 box(ro,rd,vec3(-1.26,1.26,D-.13),vec3(1.26,1.29,D-.08),7.);
 // A rug and furniture at separate depths, all analytically intersected.
 box(ro,rd,vec3(-1.02,-1.349,D-2.8),vec3(1.04,-1.332,D-.4),5.);
 if(kind<.65){
  box(ro,rd,vec3(-.94,-1.20,D-1.24),vec3(.77,-.87,D-.49),6.);
  box(ro,rd,vec3(-.91,-.93,D-1.27),vec3(-.08,-.67,D-.49),3.);
  box(ro,rd,vec3(-.06,-.93,D-1.27),vec3(.77,-.67,D-.49),3.);
  box(ro,rd,vec3(-.91,-.75,D-.65),vec3(.77,-.18,D-.42),3.);
  box(ro,rd,vec3(-1.02,-1.10,D-1.28),vec3(-.85,-.47,D-.43),3.);
  box(ro,rd,vec3(.71,-1.10,D-1.28),vec3(.88,-.47,D-.43),3.);
  box(ro,rd,vec3(-.58,-.99,D-2.34),vec3(.61,-.91,D-1.76),4.);
  box(ro,rd,vec3(-.49,-1.34,D-2.27),vec3(-.43,-.99,D-1.83),6.);
  box(ro,rd,vec3(.44,-1.34,D-2.27),vec3(.50,-.99,D-1.83),6.);
  box(ro,rd,vec3(-.31,-.91,D-2.19),vec3(-.03,-.855,D-1.92),2.);
  ellipsoid(ro,rd,vec3(.28,-.88,D-2.03),vec3(.10,.045,.10),6.);
 }else{
  box(ro,rd,vec3(-.87,-1.24,D-2.45),vec3(.87,-.78,D-.44),4.);
  box(ro,rd,vec3(-.88,-.83,D-2.45),vec3(.88,-.60,D-.45),3.);
  box(ro,rd,vec3(-.96,-1.25,D-.53),vec3(.96,-.04,D-.39),4.);
  box(ro,rd,vec3(-.78,-.62,D-2.4),vec3(.78,-.58,D-1.40),5.);
  ellipsoid(ro,rd,vec3(-.43,-.56,D-.87),vec3(.36,.11,.29),2.);
  ellipsoid(ro,rd,vec3(.43,-.56,D-.87),vec3(.36,.11,.29),2.);
 }
 // Low storage, wall art, reading lamp, and a plant.
 box(ro,rd,vec3(-1.30,-1.32,.95),vec3(-.98,-.55,2.30),4.);
 box(ro,rd,vec3(-1.30,-.59,.93),vec3(-.95,-.53,2.32),4.);
 box(ro,rd,vec3(-.56,-.01,D-.06),vec3(.49,.85,D-.02),4.);
 box(ro,rd,vec3(-.52,.03,D-.07),vec3(.45,.81,D-.06),8.);
 box(ro,rd,vec3(.99,-1.33,D-1.35),vec3(1.015,.18,D-1.325),6.);
 ellipsoid(ro,rd,vec3(1.002,.18,D-1.338),vec3(.21,.15,.21),7.);
 ellipsoid(ro,rd,vec3(1.002,-1.32,D-1.338),vec3(.17,.025,.17),6.);
 box(ro,rd,vec3(-1.16,-.53,1.16),vec3(-1.03,-.33,1.29),10.);
 ellipsoid(ro,rd,vec3(-1.10,-.15,1.22),vec3(.14,.22,.13),9.);
 ellipsoid(ro,rd,vec3(-1.18,-.26,1.21),vec3(.13,.12,.13),9.);
 // Some rooms have partially drawn linen curtains, recessed behind the glass.
 float curtain=hash(cell+u_seed+7.);
 if(curtain>.30){float width=.14+.24*hash(cell+20.);box(ro,rd,vec3(-1.16,-1.27,.30),vec3(-1.16+width,1.22,.36),3.);}
 if(curtain>.72)box(ro,rd,vec3(.88,-1.27,.30),vec3(1.16,1.22,.36),3.);
 vec3 p=ro+rd*best;vec3 albedo=palette(material,p);
 if(u_mode==1){
  if(material<.5){if(normal.x>.5)return vec3(.28,.47,.39);if(normal.x<-.5)return vec3(.57,.31,.28);return vec3(.32,.48,.59);}
  if(material<1.5)return vec3(.63,.43,.23);if(material<2.5)return vec3(.65,.70,.63);return vec3(.16,.19,.19)*(.6+.4*abs(normal.y));
 }
 float occupied=hash(cell+u_seed+50.)>.17?1.:.24;
 vec3 lightPos=vec3(.15,1.20,D*.62);vec3 L=lightPos-p;float attenuation=1./(1.+.11*dot(L,L));
 float diffuse=max(dot(normal,normalize(L)),0.);
 vec3 warm=vec3(1.,.77,.48);vec3 cool=vec3(.56,.70,.88);
 vec3 illumination=cool*(.12+u_day*.32)+warm*(.30+diffuse*1.65)*attenuation*occupied;
 illumination+=cool*max(dot(normal,normalize(vec3(-1.8,3.,-3.))),0.)*u_day*.70*exp(-p.z*.10);
 float corner=min(1.32-abs(p.x),min(p.y+1.36,1.39-p.y));
 if(material<.5)illumination*=.72+.28*smoothstep(0.,.38,corner);
 if(material>1.5&&material<2.5)illumination*=.70;
 if(material<1.5&&material>.5){float shadow=rect(p.xz,vec2(-1.02,D-1.45),vec2(.98,D-.35),.30);illumination*=1.-shadow*.40;}
 if(p.z<.4&&material>2.5&&material<3.5)albedo*=.78+.22*sin(p.x*95.);
 vec3 col=albedo*illumination;
 if(material>6.5&&material<7.5)col=vec3(1.15,.75,.36)*(.32+occupied*.75);
 // Soft pool from the floor lamp.
 col+=albedo*warm*.13*occupied*exp(-length((p-vec3(1.,-.6,D-1.35))*vec3(1.,.8,1.))*2.);
 return col;
}
void main(){
 vec2 screen=v_uv*2.-1.;float D=max(16.8,u_grid*2.8/(.72*u_aspect)*1.15);
 vec3 camera=vec3(sin(u_yaw)*D,u_pitch*D,-cos(u_yaw)*D);
 vec3 forward=normalize(-camera);vec3 right=normalize(cross(vec3(0,1,0),forward));vec3 up=cross(forward,right);
 vec3 ray=normalize(forward+right*screen.x*u_aspect*.36+up*screen.y*.36);vec3 rd=safeRay(ray);
 float t=-camera.z/rd.z;vec3 world=camera+rd*t;
 vec3 color=mix(vec3(.026,.039,.050),vec3(.08,.113,.135),u_day)*(.82+.18*v_uv.y);
 float width=u_grid*2.8;vec2 xy=world.xy;
 if(abs(xy.x)<width*.5&&abs(xy.y)<4.725&&t>0.){
  vec2 grid=(xy+vec2(width*.5,4.725))/vec2(2.8,3.15);vec2 cell=floor(grid);vec2 q=(fract(grid)-.5)*vec2(2.8,3.15);
  bool stone=abs(q.x)>1.20||q.y< -1.29||q.y>1.29;
  bool metal=abs(q.x)>1.14||q.y< -1.24||q.y>1.23||abs(q.x)<.022||abs(q.y-.71)<.019;
  if(stone){
   float grain=noise(xy*170.);vec3 base=mix(vec3(.19,.217,.218),vec3(.27,.29,.28),grain*.35);
   float wallLight=.32+u_day*.8;float ledge=smoothstep(-1.57,-1.45,q.y);float joint=1.-smoothstep(.012,.027,abs(q.y+1.46));
   color=base*wallLight*(.72+.28*ledge)*(1.-joint*.52);
   if(q.y>1.29&&q.y<1.32)color+=vec3(.05,.06,.06)*(.5+u_day);
   float edge=1.-smoothstep(1.20,1.26,abs(q.x));color*=1.-edge*.20;
  }else if(metal){
   color=vec3(.075,.083,.078)*(.40+u_day*.7);
   float edge=max(1.-smoothstep(.020,.031,abs(q.x)),1.-smoothstep(.016,.026,abs(q.y-.71)));
   color+=vec3(.075,.064,.047)*edge*.55;
  }else{
   vec3 origin=vec3(q,0.);color=room(origin,rd,cell);
   if(u_mode==0){
    // Schlick Fresnel uses the actual viewing direction, independent of room depth.
    float F=.04+.96*pow(1.-abs(ray.z),5.);
    vec3 reflected=reflect(ray,vec3(0.,0.,-1.));
    float ripple=(noise(world.xy*vec2(.7,2.3))-.5)*.004;
    reflected=normalize(reflected+vec3(ripple,ripple*.5,0.));
    vec3 environment=sky(reflected);
    float reflection=clamp(u_refl*(.055+F*.86),0.,.85);
    color=color*(1.-reflection)+environment*reflection;
    // Broad area-light sheen; no painted white stripe or point-light hotspot.
    vec3 source=normalize(vec3(-.7,.65,-1.));float lobe=pow(max(dot(reflected,source),0.),90.);
    color+=vec3(.74,.80,.86)*lobe*u_refl*F*.32*u_day;
    float edge=1.-smoothstep(0.,.15,min(1.14-abs(q.x),min(q.y+1.24,1.23-q.y)));
    float streak=noise(vec2(world.x*65.,world.y*2.));float speck=pow(noise(world.xy*240.),14.);
    float dirt=(edge*.16+streak*.018+speck*.12)*u_dust;
    color=mix(color,vec3(.17,.18,.16),dirt);
   }
  }
 }
 // Restrained exposure and display conversion; no depth fog or bloom wash.
 color=1.-exp(-max(color,vec3(0.))*1.26);
 color=pow(color,vec3(1./2.2));
 float vignette=1.-.11*dot(screen*.55,screen*.55);color*=vignette;
 color+=(hash(gl_FragCoord.xy)-.5)/255.;gl_FragColor=vec4(color,1.);
}
`
};
