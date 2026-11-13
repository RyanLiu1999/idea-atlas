import { PointField } from './point-field.js?v=3';
import { chooseOpenPosition } from './motion.mjs?v=3';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cats={'产品与体验':{color:'#7d93ca',tint:'#eef1fc',glyph:'◈'},'人工智能':{color:'#78ab98',tint:'#edf5f1',glyph:'✧'},'知识与思考':{color:'#a28bbf',tint:'#f3eef9',glyph:'⌘'},'未分类':{color:'#acb1ba',tint:'#f1f2f5',glyph:'○'}};
const seeds=[
['渐进式信息披露','产品与体验','交互机制','复杂工具','通过分层呈现信息，让用户在需要时才看到复杂功能，降低初次使用的认知负担。',['认知负荷','交互','信息层级'],.22,.38,'先展示关键动作；高级选项在上下文中逐层出现。'],
['空间化知识管理','知识与思考','空间交互','个人知识管理','用可保持的空间位置和语义邻域组织知识，帮助人建立长期的空间记忆。',['知识网络','空间记忆','交互'],.46,.51,'位置应稳定，新的内容只影响局部邻域。'],
['可解释的 AI 建议','人工智能','人机协作','辅助决策','为每条 AI 建议提供依据与可修改入口，让用户理解系统为何这样推荐。',['证据','透明度','人机协作'],.64,.29,'每一项推荐都应能回答：为什么出现，依据是什么？'],
['环境式灵感捕捉','产品与体验','低摩擦输入','日常记录','在最少打断的情况下快速记录灵感，稍后再整理结构与标签。',['灵感','低摩擦','输入'],.11,.61,'先捕捉，再组织；记录时不强迫用户完成全部属性。'],
['语义检索助手','人工智能','语义检索','个人知识管理','通过意图和语义寻找想法，而不要求用户记得原文中的精确关键词。',['检索','知识网络','语义'],.81,.36,'检索结果要展示命中片段，并允许回到原文。'],
['双向链接笔记','知识与思考','关联组织','个人知识管理','让每个想法都能看到引用它的其他想法，从孤立笔记形成可探索的网络。',['知识网络','链接','检索'],.62,.72,'一条链接对应两个方向的发现入口。'],
['以证据为中心的阅读','知识与思考','证据追溯','研究阅读','在提炼观点时保留原文位置、上下文与出处，使摘要始终可以回溯。',['证据','来源','研究'],.83,.67,'脱离上下文的摘要不应替代原始论述。'],
['人机协同审核','人工智能','人机协作','内容导入','由系统提取候选结构，用户确认关键分类与关系，再写入正式知识网络。',['证据','人机协作','审核'],.80,.16,'不确定的结论进入收件箱，人工修改应被保护。'],
['可逆的产品设计','产品与体验','容错机制','复杂工具','将撤销、版本与恢复视为基础交互，降低探索复杂系统时的试错成本。',['交互','信任','版本'],.29,.19,'在用户采取行动之前，设计好恢复路径。'],
['思维网络的留白','知识与思考','注意力管理','灵感探索','通过限制可见边与聚焦邻域，让关系更清楚，也为新想法保留空间。',['认知负荷','知识网络','注意力'],.44,.81,'更多连线并不等于更多理解。'],
['意图驱动的界面','产品与体验','自适应界面','复杂工具','围绕当前任务呈现操作，使工具的复杂性随用户意图而展开。',['交互','认知负荷','意图'],.09,.28,'上下文决定展示哪些动作，而不是一次展示全部功能。'],
['灵感的版本演化','知识与思考','版本管理','长期研究','保存一个想法在新证据与反思中如何变化，让知识的演进过程可见。',['版本','来源','研究'],.65,.89,'记录变化的原因，而不只记录变化后的结论。'],
['上下文感知推荐','人工智能','语义检索','灵感探索','根据正在探索的主题推荐相关但有差异的想法，支持跨领域发现。',['语义','意图','灵感'],.58,.11,'推荐应平衡相关性与新颖性，并解释匹配维度。'],
['安静的交互反馈','产品与体验','微交互','日常记录','通过克制的视觉变化传递保存与状态信息，避免打断思考。',['低摩擦','交互','注意力'],.31,.65,'反馈要明确，但不夺走内容的注意力。']
].map((a,i)=>({id:'demo-'+i,title:a[0],category:a[1],type:a[2],scenario:a[3],summary:a[4],tags:a[5],x:a[6],y:a[7],quote:a[8],source:'产品思考手记 · 示例 '+String(i+1).padStart(2,'0'),status:'示例',pinned:false}));
let state={nodes:structuredClone(seeds),pending:[]},storageOK=true;try{const old=JSON.parse(localStorage.getItem('idea-atlas-v1'));if(old&&Array.isArray(old.nodes)&&Array.isArray(old.pending))state=old;}catch(e){storageOK=false;}
state.trash=Array.isArray(state.trash)?state.trash:[];
let view='network',category='',selected=null,focus=false,listMode=false,toastTimer;
let field;
let detailReturnRowId = null;
function save(){try{localStorage.setItem('idea-atlas-v1',JSON.stringify(state));}catch(e){storageOK=false;toast('本机存储不可用，请导出备份保存内容');}$('.sidebar-bottom').firstChild.textContent='';$('.sidebar-bottom .statusdot').style.background=storageOK?'#7da88c':'#d4aa71';}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function score(a,b){const shared=a.tags.filter(t=>b.tags.includes(t));let value=(a.category===b.category?23:0)+(a.type===b.type?27:0)+(a.scenario===b.scenario?25:0)+Math.min(25,shared.length*13);const reasons=[];if(a.type===b.type)reasons.push('设计机制相同');if(a.scenario===b.scenario)reasons.push('适用场景相同');if(a.category===b.category)reasons.push('同一主题领域');if(shared.length)reasons.push('共同关键词：'+shared.join('、'));return {value,reasons};}
function links(){const out=[];for(let i=0;i<state.nodes.length;i++)for(let j=i+1;j<state.nodes.length;j++){const a=state.nodes[i],b=state.nodes[j],s=score(a,b);if(s.value>=+$('#threshold').value&&s.value>0)out.push({a,b,...s});}return out;}
function filtered(){const q=$('#search').value.trim().toLowerCase();let arr=state.nodes.filter(n=>(!category||n.category===category)&&(!q||[n.title,n.summary,n.category,n.type,n.scenario,...n.tags].join(' ').toLowerCase().includes(q)));if(focus&&selected){const id=new Set([selected,...links().filter(l=>l.a.id===selected||l.b.id===selected).flatMap(l=>[l.a.id,l.b.id])]);arr=arr.filter(n=>id.has(n.id));}return arr;}
function render() {
  renderNav();
  const graphVisible = view === 'network' && !listMode;
  $('#canvasShell').hidden = !graphVisible;
  $('#listPanel').hidden = view === 'inbox' || graphVisible;
  $('#inboxPanel').hidden = view !== 'inbox';
  $('#focusBtn').disabled = !graphVisible;
  $('.threshold').hidden = view === 'inbox';
  if (!graphVisible) field.hide();
  if (view === 'inbox') renderInbox();
  else if (view === 'library' || listMode) renderList();
  else renderGraph();
  const titles = {
    network: ['思想图谱', '让想法，连接成新的可能。', '让灵感轻轻流动。悬停认识，点击深入。'],
    library: ['全部 Ideas', '每一个想法，都值得被看见。', '从完整文库中，重新找到你的灵感。'],
    inbox: ['待审核', '让新的灵感，有序进入。', '确认原文、摘要与分类，再让想法进入网络。']
  };
  $('#mobileNav').value = view;
  const title = titles[view];
  $('#viewTitle').textContent = title[0];
  $('#pageTitle').textContent = title[1];
  $('#pageSubtitle').textContent = title[2];
  $('#footStats').textContent = `${state.nodes.length} 个 ideas · ${state.pending.length} 项待审核`;
  $('[data-view="network"] em').textContent = state.nodes.length;
  $('#pendingCount').textContent = state.pending.length;
  $('#focusBtn').style.background = focus ? '#edf0fb' : '';
  $('#thresholdValue').textContent = $('#threshold').value + '+';
  $('#graphBtn').classList.toggle('active', !listMode);
  $('#listBtn').classList.toggle('active', listMode);
  $$('.nav').forEach(element => element.classList.toggle('active', element.dataset.view === view));
}
function renderNav(){$('#categories').innerHTML=Object.entries(cats).map(([name,c])=>`<button class="category ${category===name?'active':''}" data-category="${name}"><i style="background:${c.color}"></i><span>${name}</span><span>${state.nodes.filter(n=>n.category===name).length}</span></button>`).join('');$$('.category').forEach(e=>e.onclick=()=>{category=category===e.dataset.category?'':e.dataset.category;render();});}
function renderGraph() {
  const nodes = filtered();
  const ids = new Set(nodes.map(node => node.id));
  const visibleLinks = links().filter(link => ids.has(link.a.id) && ids.has(link.b.id));
  $('#graphStats').textContent = `${nodes.length} 个想法 · ${visibleLinks.length} 条相似建议`;
  $('#emptyGraph').hidden = nodes.length > 0;
  field.sync(nodes, visibleLinks, selected);
}
function closeDetail(restoreFocus = false) {
  selected = null;
  focus = false;
  $('#detail').hidden = true;
  const rowId = detailReturnRowId;
  detailReturnRowId = null;
  field.closeSelection(restoreFocus && !rowId);
  render();
  if (restoreFocus && rowId) $$('.row[data-id]').find(row => row.dataset.id === rowId)?.focus({ preventScroll: true });
}
function renderList(){const ns=filtered();$('#listPanel').innerHTML='<div class="row header"><span>想法 / 摘要</span><span>主题领域</span><span>设计机制</span><span>适用场景</span></div>'+ns.map(n=>`<div class="row" tabindex="0" role="button" data-id="${esc(n.id)}"><span>${esc(n.title)}<small>${esc(n.summary.slice(0,35))}…</small></span><span><i class="dot" style="background:${(cats[n.category]||cats['未分类']).color}"></i> ${esc(n.category)}</span><span>${esc(n.type)}</span><span>${esc(n.scenario)}</span></div>`).join('')+(!ns.length?'<div class="empty">没有匹配的想法</div>':'');$$('.row[data-id]').forEach(el=>{el.onclick=()=>{detailReturnRowId=el.dataset.id;selected=el.dataset.id;showDetail(state.nodes.find(n=>n.id===selected));if(field.keyboardMode)$('#detail .close').focus({preventScroll:true});};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();field.keyboardMode=true;el.click();}};});}
function showDetail(n){if(!n)return;field.setSelected(n.id);const c=cats[n.category]||cats['未分类'],related=state.nodes.filter(b=>b.id!==n.id).map(b=>({b,...score(n,b)})).filter(l=>l.value>=+$('#threshold').value&&l.value>0).sort((a,b)=>b.value-a.value).slice(0,4);$('#detail').hidden=false;$('#detail').innerHTML=`<button class="close" aria-label="关闭详情">×</button><div class="eyebrow">IDEA INSPECTOR</div><span class="badge" style="background:${c.tint};color:${c.color}">${c.glyph} ${esc(n.category)}</span><h2>${esc(n.title)}</h2><p>${esc(n.summary)}</p><div class="field"><label>设计机制</label><span>${esc(n.type)}</span></div><div class="field"><label>适用场景</label><span>${esc(n.scenario)}</span></div><div class="field"><label>关键词</label><span>${n.tags.map(esc).join(' · ')}</span></div><div class="field"><label>状态</label><span>${esc(n.status)} · ${n.pinned?'位置已固定':'位置可调整'}</span></div><hr><div class="sectionlabel">✧ 相似的想法 <span style="float:right;color:#a4acba;font-weight:400">${related.length} 个</span></div>${related.map(l=>`<button class="related" data-id="${esc(l.b.id)}"><b>${l.value} / 100</b>${esc(l.b.title)}<small>${esc(l.reasons.join('；'))}</small></button>`).join('')||'<p>当前阈值下暂无相似建议。</p>'}<p class="score-note">原型按领域、机制、场景、关键词计算匹配分；不是 AI 置信概率。虚线均为相似建议。</p><div class="sectionlabel">↗ 原始来源</div><div class="source">${esc(n.source)}<blockquote>“${esc(n.quote||n.summary)}”</blockquote>${n.status==='示例'?'此内容为设计演示样例。':'原文随候选保留在本机；未经过 AI 语义校验。'}</div><div class="detail-actions"><button class="secondary" id="editNode">编辑 Idea</button><button class="secondary" id="pinNode">${n.pinned?'◇ 取消固定':'◆ 固定位置'}</button></div><div class="detail-actions"><button class="secondary" id="downloadNode">导出 Markdown</button><button class="secondary" id="deleteNode">移至待审核</button></div>`;$('#detail .close').onclick=()=>closeDetail(Boolean(field.returnFocusId)||Boolean(detailReturnRowId));$$('.related').forEach(el=>el.onclick=()=>{selected=el.dataset.id;showDetail(state.nodes.find(n=>n.id===selected));render();});$('#pinNode').onclick=()=>{if(!n.pinned)field.commitCurrentPosition(n.id);n.pinned=!n.pinned;save();showDetail(n);render();};$('#editNode').onclick=()=>editForm(n,false);$('#downloadNode').onclick=()=>download(n.title+'.md',`# ${n.title}\n\n${n.summary}\n\n- 领域：${n.category}\n- 设计机制：${n.type}\n- 场景：${n.scenario}\n- 关键词：${n.tags.join('、')}\n\n## 来源\n${n.source}\n\n> ${n.quote||n.summary}\n`,'text/markdown');$('#deleteNode').onclick=()=>{state.nodes=state.nodes.filter(b=>b.id!==n.id);state.pending.push({...n,status:'待复核'});selected=null;$('#detail').hidden=true;save();render();toast('已移至待审核，可随时确认恢复');};}
function modal(html){field.setModal(true);$('#modalBody').innerHTML=html;$('#modal').showModal();const b=$('#modal .close');if(b)b.onclick=()=>$('#modal').close();}const closer='<button class="close" aria-label="关闭弹窗">×</button>';
function editForm(n,pending){const fresh=!n;n=n||{title:'',summary:'',category:'未分类',type:'待定义',scenario:'待定义',tags:[]};modal(`${closer}<h2>${fresh?'捕捉一个新想法':pending?'审核候选 Idea':'编辑 Idea'}</h2><p>${pending?'请对照来源确认摘要与属性，当前内容由本地标题规则生成。':'从一个清晰的想法开始，让联系慢慢生长。'}</p><form id="ideaForm"><label for="ftitle">想法名称</label><input id="ftitle" required maxlength="60" value="${esc(n.title)}"><label for="fsummary">核心想法</label><textarea id="fsummary" required maxlength="5000">${esc(n.summary)}</textarea><div class="formgrid"><div><label for="fcat">主题领域</label><select id="fcat">${Object.keys(cats).map(c=>`<option ${n.category===c?'selected':''}>${c}</option>`).join('')}</select></div><div><label for="ftype">核心设计机制</label><input id="ftype" required value="${esc(n.type)}"></div></div><label for="fscenario">适用场景</label><input id="fscenario" required value="${esc(n.scenario)}"><label for="ftags">关键词，以逗号分隔</label><input id="ftags" value="${esc(n.tags.join('，'))}">${pending?`<label>原文对照 · ${esc(n.source)}</label><div class="source">${esc(n.quote||n.summary)}</div>`:''}<div class="modal-actions"><button type="button" class="secondary" id="cancelForm">取消</button><button class="primary" type="submit">${pending?'确认并加入图谱':'保存 Idea'}</button></div></form>`);$('#cancelForm').onclick=()=>$('#modal').close();$('#ideaForm').onsubmit=e=>{e.preventDefault();const value={...n,title:$('#ftitle').value.trim(),summary:$('#fsummary').value.trim(),category:$('#fcat').value,type:$('#ftype').value.trim(),scenario:$('#fscenario').value.trim(),tags:$('#ftags').value.split(/[,，、]/).map(s=>s.trim()).filter(Boolean),status:'已确认'};if(!value.title||!value.summary)return;if(fresh){value.id=crypto.randomUUID();Object.assign(value,chooseOpenPosition(state.nodes));value.source='手动创建';value.quote=value.summary;state.nodes.push(value);}else if(pending){state.pending=state.pending.filter(b=>b.id!==n.id);if(n.status!=='待复核')Object.assign(value,chooseOpenPosition(state.nodes));state.nodes.push(value);}else{state.nodes=state.nodes.map(b=>b.id===n.id?value:b);}save();$('#modal').close();if(!pending){selected=value.id;showDetail(value);}render();toast('已保存，已有节点位置保持不变');};}
function renderInbox(){$('#inboxPanel').innerHTML=`<div class="inbox-title"><div><h2>想法收件箱 <span style="color:#a4adbc">${state.pending.length}</span></h2><p>Markdown / 文本可提取标题段落，分类与关系需人工确认；PDF 等待真实解析服务。</p></div><div><button class="secondary" id="restoreRemoved">恢复已移除 (${state.trash.length})</button> <button class="secondary" id="inboxImport">↥ 导入文档</button></div></div>`+(state.pending.length?state.pending.map(n=>`<article class="pending"><div><span class="badge">${n.pdf?'等待 PDF 解析':'待人工审核'}</span><h3>${esc(n.title)}</h3><p>${esc(n.summary.slice(0,150))}</p><p>${esc(n.source)}</p></div>${!n.pdf?`<button class="primary review" data-id="${esc(n.id)}">审核并入图</button>`:''}<button class="secondary reject" data-id="${esc(n.id)}">移除</button></article>`).join(''):'<div class="empty"><span style="font-size:34px;color:#b8c5db">✧</span><strong>为下一次灵感，留一个位置</strong>导入 Markdown 或文本，或者直接新建一个 Idea。<br>所有候选将在确认后进入你的图谱。</div>');$('#inboxImport').onclick=showImport;$('#restoreRemoved').onclick=()=>{state.pending.push(...state.trash);state.trash=[];save();render();toast('已恢复全部移除记录');};$$('.review').forEach(b=>b.onclick=()=>editForm(state.pending.find(n=>n.id===b.dataset.id),true));$$('.reject').forEach(b=>b.onclick=()=>{state.trash.push(state.pending.find(n=>n.id===b.dataset.id));state.pending=state.pending.filter(n=>n.id!==b.dataset.id);save();render();toast('已移除，可在收件箱恢复');});}
function showImport(){modal(`${closer}<h2>给想法，一个新的入口。</h2><p>把零散的笔记带进来，逐步编织成你的思想网络。</p><div class="dropzone" id="dropzone" role="button" tabindex="0"><div style="font-size:30px">↥</div><strong>点击选择，或将文档拖到这里</strong><span>Markdown · TXT · PDF · JSON 备份 / 单个文件 ≤ 5 MB</span></div><div class="source"><strong>当前原型能力</strong><br>Markdown / TXT：每份最多 5000 字符、30 个标题段落；按标题产生候选，需人工补充分类。<br>PDF：只登记文件名与大小，尚未上传或解析内容。<br>JSON：恢复本平台导出的备份，以稳定 ID 合并。<br>内容仅保存在此浏览器；清除网站数据会删除记录，请导出备份。</div>`);const drop=$('#dropzone');drop.onclick=()=>$('#fileInput').click();drop.onkeydown=e=>{if(e.key==='Enter')$('#fileInput').click();};drop.ondragover=e=>{e.preventDefault();drop.style.background='#edf1fc';};drop.ondragleave=()=>drop.style.background='';drop.ondrop=e=>{e.preventDefault();handleFiles(e.dataTransfer.files);};}
async function handleFiles(files){let count=0;const notices=[];for(const file of files){if(file.size>5*1024*1024){notices.push(file.name+' 超过 5 MB，未导入');continue;}const ext=file.name.split('.').pop().toLowerCase();if(!['md','markdown','txt','pdf','json'].includes(ext)){notices.push(file.name+'：不支持该文件类型');continue;}if(ext==='pdf'){state.pending.push({id:crypto.randomUUID(),pdf:true,title:file.name,summary:'PDF 解析服务尚未接入。此记录只保存文件名及大小，接入服务后需重新选择原文件。',source:`${file.name} · ${(file.size/1024).toFixed(1)} KB`});count++;continue;}const raw=await file.text();if(ext==='json'){try{const backup=JSON.parse(raw);if(backup.format!=='idea-atlas-v1'||!Array.isArray(backup.nodes)||!Array.isArray(backup.pending)||backup.nodes.length+backup.pending.length>500)throw Error();const valid=n=>n&&typeof n.id==='string'&&typeof n.title==='string'&&typeof n.summary==='string'&&(n.pdf||typeof n.category==='string'&&typeof n.type==='string'&&typeof n.scenario==='string'&&Array.isArray(n.tags)&&n.tags.every(t=>typeof t==='string')&&Number.isFinite(n.x)&&n.x>=0&&n.x<=1&&Number.isFinite(n.y)&&n.y>=0&&n.y<=1);if(!backup.nodes.every(n=>valid(n)&&!n.pdf)||!backup.pending.every(valid)||(backup.trash&&!Array.isArray(backup.trash))||(backup.trash&&!backup.trash.every(valid)))throw Error();const ids=new Set([...state.nodes,...state.pending].map(n=>n.id));for(const k of ['nodes','pending','trash'])for(const n of (backup[k]||[]))if(!ids.has(n.id)){state[k].push(n);ids.add(n.id);count++;}}catch(e){notices.push(file.name+'：备份格式不正确，未导入');}continue;}if(!raw.trim()){notices.push(file.name+'：文件为空');continue;}if(raw.length>5000||raw.split(/^#{1,6}\s+/m).filter(p=>p.trim()).length>30){notices.push(file.name+'：原型每份文本最多 5000 字符、30 个标题段落，请拆分后重试；该文件未导入');continue;}const pieces=raw.split(/^#{1,6}\s+/m).filter(p=>p.trim()).slice(0,30);for(const [i,p] of pieces.entries()){const lines=p.trim().split('\n'),hasTitle=/^#{1,6}\s+/m.test(raw),title=hasTitle?lines[0].replace(/[#*`]/g,'').slice(0,60):file.name.replace(/\.[^.]+$/,'');const body=(hasTitle?lines.slice(1).join('\n'):p).trim();state.pending.push({id:crypto.randomUUID(),title:title||'未命名想法',summary:(body||lines[0]).slice(0,5000),category:'未分类',type:'待定义',scenario:'待定义',tags:[],quote:p.trim().slice(0,12000),source:file.name+' · 标题段落 '+(i+1),status:'待审核',x:Math.min(.9,.35+i*.06),y:Math.min(.85,.35+i*.05)});count++;}}save();$('#modal').close();view='inbox';$('#detail').hidden=true;render();toast(`已新增 ${count} 项记录，请审核后入图`);$('#fileInput').value='';if(notices.length)modal(`${closer}<h2>导入结果</h2><p>已新增 ${count} 项记录。以下文件未导入：</p><div class="source">${notices.map(esc).join('<br>')}</div>`);}
function download(name,body,type='application/json'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function guide(){modal(`${closer}<h2>一个可以慢慢生长的思想空间。</h2><p>以清晰、可信和稳定为核心，让你的想法能够被重新发现。</p><ol class="guide-list"><li>悬停光点：当前点停住并显示一句简介；点击后查看完整详情。</li><li>触屏轻点预览，再次轻点查看详情；键盘 Tab 聚焦、Enter 进入、Escape 返回。</li><li>拖动光点整理位置；固定位置后保持静止。可随时暂停整幅图谱的浮动。</li><li>调高关联强度，减少低匹配连线。</li><li>搜索、主题筛选、聚焦所选，缩小探索范围。</li><li>导入文档后，在待审核中确认摘要、机制和场景。</li><li>使用导出备份，保存当前节点、候选和布局。</li></ol><div class="source">这是一份可操作的产品原型，默认展示 14 条示例。匹配分采用属性规则，不含真实 AI 向量检索。图中距离可手动整理，尚未运行相似度力导向布局。<br>数据保存于当前浏览器，不在设备间同步。PDF/OCR、AI 语义理解、云端持久化与版本历史属于下一阶段能力。</div>`);}
field = new PointField({
  colors: cats,
  onOpen(id, keyboard) {
    detailReturnRowId = null;
    const node = state.nodes.find(item => item.id === id);
    if (!node) return;
    selected = id;
    showDetail(node);
    if (keyboard) $('#detail .close').focus({ preventScroll: true });
  },
  onMove(id, position) {
    const node = state.nodes.find(item => item.id === id);
    if (!node) return;
    node.x = position.x;
    node.y = position.y;
    save();
  },
  onClear() { selected = null; focus = false; $('#detail').hidden = true; render(); },
  onNotice: toast
});
$$('.nav').forEach(button => button.onclick = () => {
  view = button.dataset.view;
  if (view === 'network') listMode = false;
  category = ''; focus = false; selected = null;
  $('#detail').hidden = true;
  render();
});
$('#graphBtn').onclick = () => { view = 'network'; listMode = false; render(); };
$('#listBtn').onclick = () => { if (view === 'inbox') view = 'library'; listMode = true; render(); };
$('#newBtn').onclick = () => editForm();
$('#importBtn').onclick = showImport;
$('#fileInput').onchange = event => handleFiles(event.target.files);
$('#search').oninput = render;
$('#threshold').oninput = () => { render(); if (selected) showDetail(state.nodes.find(node => node.id === selected)); };
$('#focusBtn').onclick = () => {
  if (!selected) { toast('请先点击一个光点，选择要聚焦的想法'); return; }
  focus = !focus; render();
};
$('#resetView').onclick = () => {
  focus = false; category = ''; $('#search').value = '';
  render(); field.fitView();
};
$('#fit').onclick = () => field.fitView();
$('#zoomIn').onclick = () => field.zoomBy(1.16);
$('#zoomOut').onclick = () => field.zoomBy(1 / 1.16);
$('#guide').onclick = $('#help').onclick = guide;
$('#workspace').onclick = () => toast('个人示例空间 · 内容仅保存在当前浏览器');
$('#export').onclick = () => download('idea-atlas-backup.json', JSON.stringify({ format: 'idea-atlas-v1', ...state }, null, 2));
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('#modal').open) {
    event.preventDefault(); $('#search').focus();
  }
  if (event.key === 'Escape' && !$('#modal').open) {
    if (!$('#detail').hidden) closeDetail(true);
    else { field.clearPreview(); field.clearHover(); field.updateEmphasis(); field.wake(); }
  }
});
$('#modal').addEventListener('close', () => field.setModal(false));
$('#modal').onclick = event => { if (event.target === $('#modal')) $('#modal').close(); };
$('#mobileNav').onchange = event => {
  if (event.target.value === 'export') { $('#export').click(); event.target.value = view; return; }
  view = event.target.value;
  if (view === 'network') listMode = false;
  category = ''; focus = false; selected = null;
  $('#detail').hidden = true;
  render();
};
render();
