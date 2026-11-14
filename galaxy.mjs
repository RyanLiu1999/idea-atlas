/** Deterministic world-pixel simulation. No DOM, timers, storage or input mutation.
 * Edges: {a:{id},b:{id},value:0..100} or {source:id,target:id,weight:0..1}.
 * Strong similarity changes both spring stiffness and ideal distance; screen
 * distance remains a layout approximation because collisions/other edges compete.
 */
import { hashId } from './motion.mjs?v=5';
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const endpoint=n=>n&&typeof n==='object'?n.id:n;
function idsOf(link){return [endpoint(link?.a??link?.source),endpoint(link?.b??link?.target)].map(id=>id==null?null:String(id));}
export function linkPhysics(link) {
  const weight=Number.isFinite(link?.value)?clamp(link.value/100,0,1):clamp(finite(link?.weight),0,1);
  return {weight,idealDistance:240-150*weight,stiffness:.004+.056*weight*weight};
}
function uniqueLinks(links,ids,maxEdges=4000){
 const pairs=new Map();
 for(const link of Array.isArray(links)?links:[]){
  const [a,b]=idsOf(link);if(a===null||b===null||a===b||!ids.has(a)||!ids.has(b))continue;
  const p=linkPhysics(link);if(p.weight<=0)continue;
  const key=JSON.stringify(a<b?[a,b]:[b,a]),old=pairs.get(key);
  if(!old||p.weight>old.weight)pairs.set(key,{a,b,...p});
 }
 return [...pairs.values()].sort((a,b)=>a.a.localeCompare(b.a)||a.b.localeCompare(b.b)).slice(0,maxEdges);
}
/** Compute from ALL corpus links before filtering; duplicate edges count once.
 * Size and light encode distinct-neighbor count only, so more connections always
 * means larger/brighter and equal degrees have identical light. Weighted strength
 * is informational; edge weight affects physics, not visual node prominence.
 * Returned coreSize/haloSize are CSS px, brightness is a 0.7–1.5 multiplier.
 */
export function computeCentralityMetrics(nodes,allCorpusLinks){
 const result=new Map();
 for(const node of Array.isArray(nodes)?nodes:[]){if(node?.id!=null)result.set(String(node.id),{degree:0,strength:0,centrality:0,coreSize:20,haloSize:48,brightness:.7});}
 const edges=uniqueLinks(allCorpusLinks,new Set(result.keys()),Number.MAX_SAFE_INTEGER);
 for(const edge of edges)for(const id of [edge.a,edge.b]){const m=result.get(id);m.degree++;m.strength+=edge.weight;}
 const maxDegree=Math.max(1,...[...result.values()].map(m=>m.degree));
 for(const m of result.values()){
  m.centrality=m.degree/maxDegree;
  m.coreSize=20+14*Math.sqrt(m.centrality);m.haloSize=48+46*m.centrality;m.brightness=.7+.8*m.centrality;
 }
 return result;
}

export class GalaxySimulation {
 constructor(options={}){
  this.options={orbitSpeed:4.5,minSpeed:2,maxSpeed:8,damping:1.15,springScale:1,repulsion:1400,collisionDistance:58,collisionStrength:.38,centerStrength:.00032,padding:64,maxNodes:500,maxEdges:4000,...options};
  for(const key of ['orbitSpeed','minSpeed','maxSpeed','damping','springScale','repulsion','collisionDistance','collisionStrength','centerStrength','padding'])this.options[key]=Math.max(0,finite(this.options[key]));
  this.options.maxSpeed=Math.max(.1,this.options.maxSpeed);this.options.minSpeed=Math.min(this.options.minSpeed,this.options.maxSpeed);
  this.options.maxNodes=clamp(Math.floor(finite(this.options.maxNodes,500)),1,1000);this.options.maxEdges=clamp(Math.floor(finite(this.options.maxEdges,4000)),0,10000);
  this.bodies=new Map();this.links=[];this.width=820;this.height=520;this.zoom=1;this.stats={nodes:0,links:0,truncated:0};
 }
 get positions(){return new Map([...this.bodies].map(([id,b])=>[id,{x:b.x,y:b.y}]));}
 getPosition(id){const b=this.bodies.get(String(id));return b?{x:b.x,y:b.y}:undefined;}
 getVelocity(id){const b=this.bodies.get(String(id));return b?{x:b.vx,y:b.vy}:undefined;}
 bounds(){const px=Math.min(this.options.padding,Math.max(0,(this.width-1)/2)),py=Math.min(this.options.padding,Math.max(0,(this.height-1)/2));return {left:px,right:this.width-px,top:py,bottom:this.height-py};}
 sync(nodes,links,{width=this.width,height=this.height}={}){
  this.width=Math.max(1,finite(width,this.width));this.height=Math.max(1,finite(height,this.height));
  const input=new Map();for(const node of Array.isArray(nodes)?nodes:[])if(node?.id!=null&&!input.has(String(node.id)))input.set(String(node.id),node);
  const selected=[...input].sort(([a],[b])=>a.localeCompare(b)).slice(0,this.options.maxNodes),ids=new Set(selected.map(([id])=>id));
  for(const id of this.bodies.keys())if(!ids.has(id))this.bodies.delete(id);
  const bounds=this.bounds();
  for(const [id,node] of selected){
   let b=this.bodies.get(id);
   if(!b){const seed=hashId(id);b={id,x:finite(node.x,bounds.left+(seed%997)/997*(bounds.right-bounds.left)),y:finite(node.y,bounds.top+((seed>>>10)%991)/991*(bounds.bottom-bounds.top)),vx:0,vy:0,pinned:Boolean(node.pinned),speed:this.options.orbitSpeed*(.82+(seed%37)/100)};this.bodies.set(id,b);this.seedVelocity(b);}
   else b.pinned=Boolean(node.pinned); // Existing simulated coordinates are authoritative.
  }
  this.links=uniqueLinks(links,ids,this.options.maxEdges);this.stats={nodes:this.bodies.size,links:this.links.length,truncated:Math.max(0,input.size-selected.length)};
  return this;
 }
 seedVelocity(b){
  const dx=b.x-this.width/2,dy=b.y-this.height/2,r=Math.hypot(dx,dy),angle=hashId(b.id)%6283/1000;
  b.vx=(r>1?-dy/r:Math.cos(angle))*b.speed;b.vy=(r>1?dx/r:Math.sin(angle))*b.speed;
 }
 /** An explicit user move may position even a pinned node. Passive methods never do. */
 setPosition(id,position,{preserveVelocity=false}={}){
  const b=this.bodies.get(String(id));if(!b||!Number.isFinite(position?.x)||!Number.isFinite(position?.y))return false;
  b.x=position.x;b.y=position.y;if(!preserveVelocity){b.vx=0;b.vy=0;}return true;
 }
 setZoom(scale){if(Number.isFinite(scale)&&scale>0)this.zoom=clamp(scale,.1,10);return this;}
 resize(width,height,{scalePositions=false,frozenIds=new Set()}={}){
  const oldWidth=this.width,oldHeight=this.height;this.width=Math.max(1,finite(width,this.width));this.height=Math.max(1,finite(height,this.height));
  if(scalePositions)for(const b of this.bodies.values())if(!b.pinned&&!frozenIds.has(b.id)){b.x*=this.width/oldWidth;b.y*=this.height/oldHeight;}
  return this;
 }
 translate(dx,dy,{ids=null,frozenIds=new Set(),includePinned=false}={}){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return this;
  for(const b of this.bodies.values())if((!ids||ids.has(b.id))&&!frozenIds.has(b.id)&&(!b.pinned||includePinned)){b.x+=dx;b.y+=dy;}
  return this;
 }
 /** dt is seconds; a long/background frame advances at most 50 ms. */
 step(dt,{frozenIds=new Set(),paused=false}={}){
  if(paused||!Number.isFinite(dt)||dt<=0)return this.positions;
  const elapsed=Math.min(.05,dt),steps=Math.max(1,Math.ceil(elapsed/(1/60))),h=elapsed/steps;
  for(let i=0;i<steps;i++)this.integrate(h,{frozenIds});
  return this.positions;
 }
 integrate(dt,{frozenIds=new Set(),forceScale=1,orbit=true,speedLimit=this.options.maxSpeed}={}){
  const bodies=[...this.bodies.values()],forces=new Map(bodies.map(b=>[b.id,{x:0,y:0}])),degree=new Map(bodies.map(b=>[b.id,0])),o=this.options;
  const add=(id,x,y)=>{const f=forces.get(id);if(f){f.x+=x;f.y+=y;}};
  for(const edge of this.links){degree.set(edge.a,degree.get(edge.a)+1);degree.set(edge.b,degree.get(edge.b)+1);}
  for(const edge of this.links){
   const a=this.bodies.get(edge.a),b=this.bodies.get(edge.b),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<.001)continue;
   const force=(d-edge.idealDistance)*edge.stiffness*o.springScale;
   add(a.id,dx/d*force/Math.sqrt(Math.max(1,degree.get(a.id))),dy/d*force/Math.sqrt(Math.max(1,degree.get(a.id))));
   add(b.id,-dx/d*force/Math.sqrt(Math.max(1,degree.get(b.id))),-dy/d*force/Math.sqrt(Math.max(1,degree.get(b.id))));
  }
  const collisionDistance=o.collisionDistance/this.zoom;
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],b=bodies[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d<.001){const angle=(hashId(a.id+'|'+b.id)%6283)/1000;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const repulsion=o.repulsion/Math.max(144,d*d)+Math.max(0,collisionDistance-d)*o.collisionStrength;
   add(a.id,-dx/d*repulsion,-dy/d*repulsion);add(b.id,dx/d*repulsion,dy/d*repulsion);
  }
  const cx=this.width/2,cy=this.height/2,bounds=this.bounds();
  for(const b of bodies){
   if(b.pinned||frozenIds.has(b.id))continue;
   const f=forces.get(b.id),rx=b.x-cx,ry=b.y-cy,r=Math.hypot(rx,ry),angle=(hashId(b.id)%6283)/1000;
   const speed=orbit?b.speed:0,tx=(r>1?-ry/r:Math.cos(angle))*speed,ty=(r>1?rx/r:Math.sin(angle))*speed;
   let ax=(f.x-rx*o.centerStrength)*forceScale+(tx-b.vx)*o.damping;
   let ay=(f.y-ry*o.centerStrength)*forceScale+(ty-b.vy)*o.damping;
   // Soft walls steer already-outside nodes inward after a resize; no teleport.
   ax+=(b.x<bounds.left?bounds.left-b.x:b.x>bounds.right?bounds.right-b.x:0)*.15;
   ay+=(b.y<bounds.top?bounds.top-b.y:b.y>bounds.bottom?bounds.bottom-b.y:0)*.15;
   b.vx=finite(b.vx+ax*dt);b.vy=finite(b.vy+ay*dt);
   let magnitude=Math.hypot(b.vx,b.vy);if(magnitude>speedLimit){b.vx*=speedLimit/magnitude;b.vy*=speedLimit/magnitude;magnitude=speedLimit;}
   if(orbit&&speed>0&&magnitude<o.minSpeed){const direction=magnitude>.001?{x:b.vx/magnitude,y:b.vy/magnitude}:{x:r>1?-ry/r:Math.cos(angle),y:r>1?rx/r:Math.sin(angle)};b.vx=direction.x*o.minSpeed;b.vy=direction.y*o.minSpeed;}
   const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;
   // Prevent outward crossing when already inside; preserve frozen positions exactly.
   b.x=b.x>=bounds.left&&b.x<=bounds.right?clamp(nx,bounds.left,bounds.right):nx;
   b.y=b.y>=bounds.top&&b.y<=bounds.bottom?clamp(ny,bounds.top,bounds.bottom):ny;
  }
 }
 /** Initial-only accelerated layout. Bounded pair-work, no saved-anchor mutation.
  * Call once, not on each sync/filter. Preserves pinned/frozen coordinates.
  */
 settle({iterations=80,pairBudget=1_000_000,frozenIds=new Set()}={}){
  const n=this.bodies.size,pairs=n*(n-1)/2+this.links.length;
  const count=n<2?0:Math.max(0,Math.min(120,Math.floor(finite(iterations,80)),Math.floor(Math.max(0,finite(pairBudget,1_000_000))/Math.max(1,pairs))));
  for(let i=0;i<count;i++)this.integrate(.04,{frozenIds,forceScale:24,orbit:false,speedLimit:130});
  for(const b of this.bodies.values())if(!b.pinned&&!frozenIds.has(b.id))this.seedVelocity(b);
  return {iterations:count,pairChecks:count*pairs,nodes:n,positions:this.positions};
 }
}
