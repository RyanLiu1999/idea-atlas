/** Deterministic world-pixel simulation. No DOM, timers, storage or input mutation.
 * Edges: {a:{id},b:{id},value:0..100} or {source:id,target:id,weight:0..1}.
 * Strong similarity changes both spring stiffness and ideal distance; screen
 * distance remains a layout approximation because collisions/other edges compete.
 */
import { hashId } from './motion.mjs?v=7';
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const endpoint=n=>n&&typeof n==='object'?n.id:n;
function idsOf(link){return [endpoint(link?.a??link?.source),endpoint(link?.b??link?.target)].map(id=>id==null?null:String(id));}
export function linkPhysics(link) {
  const weight=Number.isFinite(link?.value)?clamp(link.value/100,0,1):clamp(finite(link?.weight),0,1);
  return {weight,idealDistance:240-150*weight,stiffness:.004+.056*weight*weight};
}
/** Radial pair force in world coordinates. A missing direct edge means no edge
 * in the complete simulation graph, not an assertion of semantic unrelatedness.
 * The added non-edge force has finite range/cap. Callers may convert its range
 * from screen clearance to world units; camera zoom never changes connectedness.
 */
export function pairRepulsion(distance,{connected=false,crossCluster=false,repulsion=1400,collisionDistance=58,collisionStrength=.38,nonLinkedStrength=18,nonLinkedRange=210,crossClusterBoost=1.35}={}) {
 const d=Math.max(0,finite(distance)),range=Math.max(1,finite(nonLinkedRange,210));
 const base=Math.max(0,finite(repulsion))/Math.max(144,d*d);
 const collision=Math.max(0,finite(collisionDistance)-d)*Math.max(0,finite(collisionStrength));
 const falloff=Math.max(0,1-d/range);
 const nonLinked=connected?0:Math.max(0,finite(nonLinkedStrength))*falloff*falloff*(crossCluster?Math.max(1,finite(crossClusterBoost,1.35)):1);
 return {base,collision,nonLinked,total:base+collision+nonLinked,connected:Boolean(connected)};
}
function uniqueLinks(links,ids,maxEdges=4000){
 const pairs=new Map();
 for(const link of Array.isArray(links)?links:[]){
  let [a,b]=idsOf(link);if(a===null||b===null||a===b||!ids.has(a)||!ids.has(b))continue;if(a>b)[a,b]=[b,a];
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
 for(const node of Array.isArray(nodes)?nodes:[]){if(node?.id!=null)result.set(String(node.id),{degree:0,strength:0,centrality:0,coreSize:16,haloSize:38,brightness:.7});}
 const edges=uniqueLinks(allCorpusLinks,new Set(result.keys()),Number.MAX_SAFE_INTEGER);
 for(const edge of edges)for(const id of [edge.a,edge.b]){const m=result.get(id);m.degree++;m.strength+=edge.weight;}
 const maxDegree=Math.max(1,...[...result.values()].map(m=>m.degree));
 for(const m of result.values()){
  m.centrality=m.degree/maxDegree;
  m.coreSize=16+26*m.centrality**.9;m.haloSize=38+112*m.centrality**.9;m.brightness=.7+.8*m.centrality;
 }
 return result;
}

/** Greedy weighted modularity, not a semantic classification. A merge is accepted
 * only for positive modularity gain; no requested K and no threshold inflation.
 * Isolates stay separate. Sparse bridges need not merge otherwise dense groups.
 */
export function detectCommunities(nodes, links) {
 const ids=new Set((Array.isArray(nodes)?nodes:[]).filter(n=>n?.id!=null).map(n=>String(n.id))),edges=uniqueLinks(links,ids);
 const labels=new Map([...ids].sort().map(id=>[id,id])),totals=new Map([...ids].map(id=>[id,0]));
 const m=edges.reduce((sum,e)=>sum+e.weight,0);
 for(const e of edges){totals.set(e.a,totals.get(e.a)+e.weight);totals.set(e.b,totals.get(e.b)+e.weight);}
 if(m>0)for(let pass=0;pass<ids.size-1;pass++){
  const cross=new Map();
  for(const e of edges){let a=labels.get(e.a),b=labels.get(e.b);if(a===b)continue;if(a>b)[a,b]=[b,a];const key=JSON.stringify([a,b]);const old=cross.get(key);if(old)old.weight+=e.weight;else cross.set(key,{a,b,weight:e.weight,key});}
  let best=null,bestGain=1e-10;
  for(const edge of [...cross.values()].sort((a,b)=>a.key.localeCompare(b.key))){const gain=edge.weight/m-totals.get(edge.a)*totals.get(edge.b)/(2*m*m);if(gain>bestGain+1e-12){best=edge;bestGain=gain;}}
  if(!best)break;
  for(const [id,label] of labels)if(label===best.b)labels.set(id,best.a);
  totals.set(best.a,totals.get(best.a)+totals.get(best.b));totals.delete(best.b);
 }
 const groups=new Map();for(const [id,label] of labels){if(!groups.has(label))groups.set(label,[]);groups.get(label).push(id);}
 let modularity=0;
 if(m>0)for(const [label,members] of groups){const internal=edges.filter(e=>labels.get(e.a)===label&&labels.get(e.b)===label).reduce((s,e)=>s+e.weight,0);modularity+=internal/m-(totals.get(label)/(2*m))**2;}
 return {groups:[...groups.values()].map(members=>members.sort()),assignments:labels,modularity};
}

export class GalaxySimulation {
 constructor(options={}){
  this.options={orbitSpeed:4.5,minSpeed:2,maxSpeed:8,damping:1.15,springScale:1,repulsion:1400,collisionDistance:58,collisionStrength:.38,nonLinkedStrength:18,nonLinkedRange:210,crossClusterBoost:1.35,clusterBuffer:70,clusterRepulsion:.045,clusterCohesion:.065,clusterOrbitRadius:145,wallMargin:60,wallStrength:10,centerStrength:.00032,padding:64,maxNodes:500,maxEdges:4000,...options};
  for(const key of ['orbitSpeed','minSpeed','maxSpeed','damping','springScale','repulsion','collisionDistance','collisionStrength','nonLinkedStrength','nonLinkedRange','crossClusterBoost','clusterBuffer','clusterRepulsion','clusterCohesion','clusterOrbitRadius','wallMargin','wallStrength','centerStrength','padding'])this.options[key]=Math.max(0,finite(this.options[key]));
  this.options.maxSpeed=Math.max(.1,this.options.maxSpeed);this.options.minSpeed=Math.min(this.options.minSpeed,this.options.maxSpeed);
  this.options.maxNodes=clamp(Math.floor(finite(this.options.maxNodes,500)),1,1000);this.options.maxEdges=clamp(Math.floor(finite(this.options.maxEdges,4000)),0,10000);
  this.bodies=new Map();this.links=[];this._clusters=new Map();this.adjacency=new Map();this.topology='';this.width=820;this.height=520;this.zoom=1;this.stats={nodes:0,links:0,truncated:0,modularity:0};
 }
 get positions(){return new Map([...this.bodies].map(([id,b])=>[id,{x:b.x,y:b.y}]));}
 getPosition(id){const b=this.bodies.get(String(id));return b?{x:b.x,y:b.y}:undefined;}
 getVelocity(id){const b=this.bodies.get(String(id));return b?{x:b.vx,y:b.vy}:undefined;}
 get clusters(){return new Map([...this._clusters].map(([id,c])=>[id,{id,hubId:c.hubId,hubIds:[...c.hubIds],members:[...c.members],center:this.getPosition(c.hubId),anchor:{...c.anchor},radius:c.radius,gravity:this.bodies.get(c.hubId).gravity,degree:this.bodies.get(c.hubId).degree,positions:new Map(c.members.map(member=>[member,this.getPosition(member)])),attractors:c.hubIds.map(hubId=>{const b=this.bodies.get(hubId);return {id:hubId,center:{x:b.x,y:b.y},mass:b.mass,gravity:b.gravity,degree:b.degree};})}]));}
 bounds(){const px=Math.min(this.options.padding,Math.max(0,(this.width-1)/2)),py=Math.min(this.options.padding,Math.max(0,(this.height-1)/2));return {left:px,right:this.width-px,top:py,bottom:this.height-py};}
 sync(nodes,links,{width=this.width,height=this.height}={}){
  this.width=Math.max(1,finite(width,this.width));this.height=Math.max(1,finite(height,this.height));
  const input=new Map();for(const node of Array.isArray(nodes)?nodes:[])if(node?.id!=null&&!input.has(String(node.id)))input.set(String(node.id),node);
  const selected=[...input].sort(([a],[b])=>a.localeCompare(b)).slice(0,this.options.maxNodes),ids=new Set(selected.map(([id])=>id));
  for(const id of this.bodies.keys())if(!ids.has(id))this.bodies.delete(id);
  const bounds=this.bounds(),newIds=[];
  for(const [id,node] of selected){
   let b=this.bodies.get(id);
   if(!b){const seed=hashId(id);b={id,x:finite(node.x,bounds.left+(seed%997)/997*(bounds.right-bounds.left)),y:finite(node.y,bounds.top+((seed>>>10)%991)/991*(bounds.bottom-bounds.top)),vx:0,vy:0,pinned:Boolean(node.pinned),time:0,degree:0,mass:1,gravity:1,speed:this.options.orbitSpeed*(.82+(seed%37)/100),home:null};this.bodies.set(id,b);newIds.push(id);}
   else b.pinned=Boolean(node.pinned);
  }
  this.links=uniqueLinks(links,ids,this.options.maxEdges);
  const signature=JSON.stringify([[...ids].sort(),this.links.map(e=>[...([e.a,e.b].sort()),e.weight]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
  if(signature!==this.topology){this.rebuildClusters();this.topology=signature;}
  for(const id of newIds)this.seedVelocity(this.bodies.get(id));
  this.stats={...this.stats,nodes:this.bodies.size,links:this.links.length,truncated:Math.max(0,input.size-selected.length),clusters:this._clusters.size,hubs:[...this._clusters.values()].reduce((s,c)=>s+c.hubIds.length,0)};
  return this;
 }
 rebuildClusters(){
  const old=[...this._clusters.values()],metrics=computeCentralityMetrics([...this.bodies.values()],this.links);
  this.adjacency=new Map([...this.bodies.keys()].map(id=>[id,new Map()]));
  for(const e of this.links){this.adjacency.get(e.a).set(e.b,e.weight);this.adjacency.get(e.b).set(e.a,e.weight);}
  for(const b of this.bodies.values()){const m=metrics.get(b.id);b.degree=m.degree;b.strength=m.strength;b.mass=1+.65*m.degree;b.gravity=1+.32*m.degree;}
  const partition=detectCommunities([...this.bodies.values()],this.links);this.stats.modularity=partition.modularity;this._clusters=new Map();
  for(const members of partition.groups){
   const ranked=members.map(id=>this.bodies.get(id)).sort((a,b)=>b.degree-a.degree||b.strength-a.strength||a.id.localeCompare(b.id));
   const hub=ranked[0],hubIds=[hub.id],memberSet=new Set(members);
   // Several distinguishable high-degree local centers can coexist in a weak
   // community. Closed-neighborhood overlap suppresses fake hubs in a clique.
   for(const b of ranked.slice(1)){
    if(hubIds.length>=3||b.degree<3||b.degree<hub.degree*.75)continue;
    const own=new Set([b.id,...this.adjacency.get(b.id).keys()].filter(id=>memberSet.has(id)));
    const redundant=hubIds.some(id=>{const other=new Set([id,...this.adjacency.get(id).keys()].filter(n=>memberSet.has(n)));let shared=0;for(const n of own)if(other.has(n))shared++;return shared/(own.size+other.size-shared)>=.85;});
    if(!redundant)hubIds.push(b.id);
   }
   const previous=old.find(c=>c.hubId===hub.id)||old.map(c=>({c,shared:c.members.filter(id=>memberSet.has(id)).length})).sort((a,b)=>b.shared-a.shared)[0];
   const matched=previous?.c?(previous.shared>0?previous.c:null):previous;
   const anchor=matched?.anchor?{...matched.anchor}:{x:hub.x,y:hub.y};
   const c={id:'cluster-'+hub.id,hubId:hub.id,hubIds,members,anchor,radius:Math.min(155,62+Math.sqrt(members.length)*20)};
   this._clusters.set(c.id,c);
   for(const id of members){const b=this.bodies.get(id);b.clusterId=c.id;b.isHub=hubIds.includes(id);if(!b.home)b.home={x:b.x,y:b.y};}
  }
 }
 /** Weighted local equilibrium: high-mass linked neighbors plus local hub(s).
  * Cross-community links remain visible and contribute a small bridge influence.
  */
 getAttractor(id){
  const b=this.bodies.get(String(id));if(!b)return undefined;
  const c=this._clusters.get(b.clusterId),influences=new Map();
  if(b.isHub)return {clusterId:c.id,hubId:b.id,isHub:true,center:{...b.home},gravity:b.gravity,mass:b.mass,degree:b.degree,influences:[]};
  for(const [neighbor,weight] of this.adjacency.get(b.id)||[]){const n=this.bodies.get(neighbor),local=n.clusterId===b.clusterId,factor=local?1:.035;influences.set(neighbor,{id:neighbor,weight:weight*weight*factor,mass:n.mass});}
  for(const hubId of c.hubIds){const n=this.bodies.get(hubId),edge=this.adjacency.get(b.id)?.get(hubId)||.12;const old=influences.get(hubId);influences.set(hubId,{id:hubId,weight:(old?.weight||0)+.8*edge*edge,mass:n.mass});}
  let x=0,y=0,total=0,dominant=c.hubId,best=-1,gravity=0;
  for(const item of influences.values()){const n=this.bodies.get(item.id),w=item.weight*item.mass;x+=n.x*w;y+=n.y*w;total+=w;gravity+=n.gravity*w;if(c.hubIds.includes(item.id)&&w>best){dominant=item.id;best=w;}}
  const center=total>0?{x:x/total,y:y/total}:{...c.anchor};
  return {clusterId:c.id,hubId:dominant,isHub:false,center,gravity:b.gravity,equilibriumGravity:total?gravity/total:1,mass:b.mass,degree:b.degree,influences:[...influences.values()]};
 }
 seedVelocity(b){const a=this.getAttractor(b.id),center=a?.center??b.home??{x:b.x,y:b.y};const dx=b.x-center.x,dy=b.y-center.y,r=Math.hypot(dx,dy),angle=hashId(b.id)%6283/1000;const speed=b.isHub?Math.min(.7,b.speed*.14):b.speed;b.vx=(r>1?-dy/r:Math.cos(angle))*speed;b.vy=(r>1?dx/r:Math.sin(angle))*speed;}
 setPosition(id,position,{preserveVelocity=false}={}){
  const b=this.bodies.get(String(id));if(!b||!Number.isFinite(position?.x)||!Number.isFinite(position?.y))return false;
  const dx=position.x-b.x,dy=position.y-b.y;b.x=position.x;b.y=position.y;
  if(b.isHub){b.home=preserveVelocity?{x:b.home.x+dx,y:b.home.y+dy}:{x:b.x,y:b.y};const c=this._clusters.get(b.clusterId);if(c.hubId===b.id){c.anchor.x+=dx;c.anchor.y+=dy;}}
  if(!preserveVelocity){b.vx=0;b.vy=0;}return true;
 }
 setZoom(scale){if(Number.isFinite(scale)&&scale>0)this.zoom=clamp(scale,.1,10);return this;}
 resize(width,height,{scalePositions=false,frozenIds=new Set()}={}){
  const oldWidth=this.width,oldHeight=this.height;this.width=Math.max(1,finite(width,this.width));this.height=Math.max(1,finite(height,this.height));
  if(scalePositions)for(const b of this.bodies.values())if(!b.pinned&&!frozenIds.has(b.id)){const x=this.width/oldWidth,y=this.height/oldHeight;b.x*=x;b.y*=y;b.home.x*=x;b.home.y*=y;}
  return this;
 }
 translate(dx,dy,{ids=null,frozenIds=new Set(),includePinned=false}={}){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return this;
  for(const b of this.bodies.values())if((!ids||ids.has(b.id))&&!frozenIds.has(b.id)&&(!b.pinned||includePinned))this.setPosition(b.id,{x:b.x+dx,y:b.y+dy},{preserveVelocity:true});
  return this;
 }
 step(dt,{frozenIds=new Set(),paused=false}={}){
  if(paused||!Number.isFinite(dt)||dt<=0)return this.positions;
  const elapsed=Math.min(.05,dt),steps=Math.max(1,Math.ceil(elapsed/(1/60))),h=elapsed/steps;
  for(let i=0;i<steps;i++)this.integrate(h,{frozenIds});return this.positions;
 }
 integrate(dt,{frozenIds=new Set(),forceScale=1,orbit=true,speedLimit=this.options.maxSpeed}={}){
  const bodies=[...this.bodies.values()],forces=new Map(bodies.map(b=>[b.id,{x:0,y:0}])),o=this.options;
  const add=(id,x,y)=>{const f=forces.get(id);if(f){f.x+=x;f.y+=y;}};
  for(const edge of this.links){
   const a=this.bodies.get(edge.a),b=this.bodies.get(edge.b),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<.001)continue;
   const cross=a.clusterId!==b.clusterId,target=cross?Math.max(edge.idealDistance,220):edge.idealDistance;
   const force=(d-target)*edge.stiffness*o.springScale*(cross?.065:1);
   // Mass and degree are monotone; hubs accelerate less under identical forces.
   add(a.id,dx/d*force,dy/d*force);add(b.id,-dx/d*force,-dy/d*force);
  }
  const collisionDistance=o.collisionDistance/this.zoom;
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],b=bodies[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<.001){const angle=(hashId(a.id+'|'+b.id)%6283)/1000;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const connected=this.adjacency.get(a.id)?.has(b.id)===true;
   const repulsion=pairRepulsion(d,{connected,crossCluster:a.clusterId!==b.clusterId,repulsion:o.repulsion,collisionDistance,collisionStrength:o.collisionStrength,nonLinkedStrength:o.nonLinkedStrength,nonLinkedRange:o.nonLinkedRange/clamp(this.zoom,.35,2.2),crossClusterBoost:o.crossClusterBoost}).total;
   add(a.id,-dx/d*repulsion,-dy/d*repulsion);add(b.id,dx/d*repulsion,dy/d*repulsion);
  }
  // Community exclusion acts on centers, not on one global origin.
  const clusters=[...this._clusters.values()];
  for(let i=0;i<clusters.length;i++)for(let j=i+1;j<clusters.length;j++){
   const ca=clusters[i],cb=clusters[j],a=this.bodies.get(ca.hubId),b=this.bodies.get(cb.hubId);let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<1){const angle=hashId(ca.id+'|'+cb.id)%6283/1000;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
   const force=Math.max(0,ca.radius+cb.radius+o.clusterBuffer-d)*o.clusterRepulsion;
   for(const id of ca.members)add(id,-dx/d*force,-dy/d*force);for(const id of cb.members)add(id,dx/d*force,dy/d*force);
  }
  const attractors=new Map(bodies.map(b=>[b.id,this.getAttractor(b.id)])),bounds=this.bounds();
  for(const b of bodies){
   if(b.pinned||frozenIds.has(b.id))continue;b.time+=dt;
   const f=forces.get(b.id),a=attractors.get(b.id),rx=b.x-a.center.x,ry=b.y-a.center.y,r=Math.hypot(rx,ry),angle=hashId(b.id)%6283/1000;
   const speed=orbit?(b.isHub?Math.min(.7,b.speed*.14):b.speed):0;
   const driftAngle=angle+b.time/85;
   const tx=b.isHub?Math.cos(driftAngle)*speed:(r>1?-ry/r:Math.cos(angle))*speed;
   const ty=b.isHub?Math.sin(driftAngle)*speed:(r>1?rx/r:Math.sin(angle))*speed;
   const gravity=o.centerStrength*(b.isHub?2:Math.min(5,a.equilibriumGravity??a.gravity));
   let ax=(f.x/Math.sqrt(b.mass)-rx*gravity)*forceScale+(tx-b.vx)*o.damping;
   let ay=(f.y/Math.sqrt(b.mass)-ry*gravity)*forceScale+(ty-b.vy)*o.damping;
   // Non-linked siblings still share their local hub. This soft outer orbit
   // spring prevents stronger sibling repulsion from dissolving the cluster;
   // it never resets positions or changes a relationship weight.
   if(!b.isHub&&r>o.clusterOrbitRadius){const inward=(r-o.clusterOrbitRadius)*o.clusterCohesion;ax-=rx/r*inward*forceScale;ay-=ry/r*inward*forceScale;}
   ax+=(b.x<bounds.left?bounds.left-b.x:b.x>bounds.right?bounds.right-b.x:0)*.15;
   ay+=(b.y<bounds.top?bounds.top-b.y:b.y>bounds.bottom?bounds.bottom-b.y:0)*.15;
   // Anticipate boundaries rather than letting stronger repulsion pile up at
   // their exact coordinates. These forces do not edit stored or current x/y.
   const wall=distance=>o.wallStrength*Math.max(0,1-Math.max(0,distance)/Math.max(1,o.wallMargin))**2;
   ax+=wall(b.x-bounds.left)-wall(bounds.right-b.x);
   ay+=wall(b.y-bounds.top)-wall(bounds.bottom-b.y);
   b.vx=finite(b.vx+ax*dt);b.vy=finite(b.vy+ay*dt);
   const cap=orbit&&b.isHub?Math.min(speedLimit,1.4):speedLimit;let magnitude=Math.hypot(b.vx,b.vy);
   if(magnitude>cap){b.vx*=cap/magnitude;b.vy*=cap/magnitude;magnitude=cap;}
   const min=orbit&&speed>0?(b.isHub?Math.min(.25,o.minSpeed):o.minSpeed):0;
   if(magnitude<min){const direction=magnitude>.001?{x:b.vx/magnitude,y:b.vy/magnitude}:{x:r>1?-ry/r:Math.cos(angle),y:r>1?rx/r:Math.sin(angle)};b.vx=direction.x*min;b.vy=direction.y*min;}
   // Smooth outward velocity damping has a bounded step smaller than remaining
   // clearance. No coordinate clipping or snap when a boundary is approached.
   if(b.x>=bounds.left&&b.x<=bounds.right){const clearance=b.vx<0?b.x-bounds.left:bounds.right-b.x;if(clearance<o.wallMargin)b.vx/=1+Math.abs(b.vx)*dt/Math.max(1e-9,clearance);}
   if(b.y>=bounds.top&&b.y<=bounds.bottom){const clearance=b.vy<0?b.y-bounds.top:bounds.bottom-b.y;if(clearance<o.wallMargin)b.vy/=1+Math.abs(b.vy)*dt/Math.max(1e-9,clearance);}
   b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
 }
 /** First-entry layout only: deterministic community slots and local orbits.
  * No node.x/y writes. Existing sync/filter never invokes this method.
  */
 settle({iterations=80,pairBudget=1_000_000,frozenIds=new Set()}={}){
  const groups=[...this._clusters.values()].sort((a,b)=>a.id.localeCompare(b.id)),n=this.bodies.size,bounds=this.bounds();
  const columns=Math.max(1,Math.min(groups.length,Math.ceil(Math.sqrt(groups.length*this.width/this.height)))),rows=Math.max(1,Math.ceil(groups.length/columns));
  const cellWidth=(bounds.right-bounds.left)/columns,cellHeight=(bounds.bottom-bounds.top)/rows;
  // Explicit initial layout can move free points rapidly; passive step never teleports.
  for(const [index,c] of groups.entries()){
   c.anchor={x:bounds.left+cellWidth*((index%columns)+.5),y:bounds.top+cellHeight*(Math.floor(index/columns)+.5)};
   c.radius=Math.max(45,Math.min(155,Math.min(cellWidth,cellHeight)*.43));
   for(const [i,id] of c.hubIds.entries()){
    const b=this.bodies.get(id);if(b.pinned||frozenIds.has(id))continue;
    const angle=i*Math.PI*2/c.hubIds.length,r=c.hubIds.length>1?Math.min(60,c.radius*.42):0;
    b.x=c.anchor.x+Math.cos(angle)*r;b.y=c.anchor.y+Math.sin(angle)*r;b.home={x:b.x,y:b.y};
   }
   let satellite=0;
   for(const id of c.members){const b=this.bodies.get(id);if(b.isHub||b.pinned||frozenIds.has(id))continue;
    const a=this.getAttractor(id),hub=this.bodies.get(a.hubId),weight=this.adjacency.get(id)?.get(hub.id)??.5;
    const radius=Math.min(c.radius*.9,linkPhysics({weight}).idealDistance*.9),angle=hashId(id)%6283/1000+satellite++*2.399963229728653;
    b.x=clamp(hub.x+Math.cos(angle)*radius,bounds.left,bounds.right);b.y=clamp(hub.y+Math.sin(angle)*radius,bounds.top,bounds.bottom);b.home={x:b.x,y:b.y};
   }
  }
  const pairs=n*(n-1)/2+this.links.length+groups.length*(groups.length-1)/2;
  const count=n<2?0:Math.max(0,Math.min(120,Math.floor(finite(iterations,80)),Math.floor(Math.max(0,finite(pairBudget,1_000_000))/Math.max(1,pairs))));
  for(let i=0;i<count;i++)this.integrate(.04,{frozenIds,forceScale:24,orbit:false,speedLimit:130});
  for(const b of this.bodies.values())if(!b.pinned&&!frozenIds.has(b.id))this.seedVelocity(b);
  return {iterations:count,pairChecks:count*pairs,nodes:n,positions:this.positions};
 }
}
