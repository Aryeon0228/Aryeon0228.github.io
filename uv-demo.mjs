// One rounded case, three UV layouts. Geometry and source vertex IDs stay identical.
export function createDemo(layout = 'loose') {
  const positions = [], uvs = [], vertexIds = [], materialIds = [], uvValid = [];
  const charts = [
    {label:'FRONT', origin:[0,0,.5], a:[1,0,0], b:[0,1,0], size:[2,1.4], packed:[.018,.018], loose:[.05,.08]},
    {label:'BACK', origin:[0,0,-.5], a:[-1,0,0], b:[0,1,0], size:[2,1.4], packed:[.51,.018], loose:[.59,.08]},
    {label:'TOP', origin:[0,.7,0], a:[1,0,0], b:[0,0,-1], size:[2,1], packed:[.018,.37], loose:[.11,.54]},
    {label:'BOTTOM', origin:[0,-.7,0], a:[1,0,0], b:[0,0,1], size:[2,1], packed:[.51,.37], loose:[.6,.42]},
    {label:'LEFT', origin:[-1,0,0], a:[0,0,1], b:[0,1,0], size:[1,1.4], packed:[.018,.635], loose:[.06,.74]},
    {label:'RIGHT', origin:[1,0,0], a:[0,0,-1], b:[0,1,0], size:[1,1.4], packed:[.277,.635], loose:[.75,.71]},
  ];
  const sourceIds = new Map();
  const divisions = 12;
  for (const [chartId, chart] of charts.entries()) {
    const scale = layout === 'loose' ? .158 : .239;
    const start = layout === 'loose' ? chart.loose : layout === 'stretched' && chartId === 5 ? [.72,.635] : chart.packed;
    let w = chart.size[0] * scale, h = chart.size[1] * scale;
    if (layout === 'stretched' && chartId === 4) { w *= 2.65; h *= .38; }
    chart.rect = [start[0],start[1],w,h];
    const point = (x,y) => {
      const p = chart.origin.map((n,k) => n + chart.a[k] * (x/divisions-.5)*chart.size[0] + chart.b[k]*(y/divisions-.5)*chart.size[1]);
      const key = p.map(n => n.toFixed(6)).join(',');
      if (!sourceIds.has(key)) sourceIds.set(key,sourceIds.size);
      const inner = p.map((n,k) => Math.max(-[.93,.63,.43][k],Math.min([.93,.63,.43][k],n)));
      const d = p.map((n,k) => n-inner[k]), len = Math.hypot(...d);
      return {p:inner.map((n,k) => n+d[k]/len*.07), uv:[start[0]+x/divisions*w,start[1]+y/divisions*h], id:sourceIds.get(key)};
    };
    for(let y=0;y<divisions;y++) for(let x=0;x<divisions;x++) {
      const corners=[point(x,y),point(x+1,y),point(x+1,y+1),point(x,y+1)];
      for(const tri of [[0,1,2],[0,2,3]]) {
        for(const i of tri) {positions.push(...corners[i].p);uvs.push(...corners[i].uv);vertexIds.push(corners[i].id);}
        materialIds.push(0);uvValid.push(1);
      }
    }
  }
  return {name:'수업 예제 · 라운드 케이스',positions:new Float32Array(positions),uvs:new Float32Array(uvs),vertexIds:new Uint32Array(vertexIds),materialIds:new Uint32Array(materialIds),uvValid:new Uint8Array(uvValid),materialNames:['하나의 텍스처'],warnings:[],demo:{layout,charts}};
}
