import { PointField } from './point-field.js?v=4';
import { stageDocumentFiles, positionForIdea } from './ingest.mjs?v=4';
import { createWorkspaceStore } from './workspace-store.mjs?v=4';
import { renderDocument } from './document-view.mjs?v=4';
import { relationScore, buildSimilarityLinks } from './relations.mjs?v=4';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cats={'机器人与具身智能':{color:'#7d99bc',tint:'#edf2f8',glyph:'◈'},'强化学习':{color:'#aaa0ca',tint:'#f1eff8',glyph:'◇'},'人工智能':{color:'#78ab98',tint:'#edf5f1',glyph:'✧'},'产品与体验':{color:'#7d93ca',tint:'#eef1fc',glyph:'◈'},'知识与思考':{color:'#a28bbf',tint:'#f3eef9',glyph:'⌘'},'未分类':{color:'#acb1ba',tint:'#f1f2f5',glyph:'○'}};
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
const workspaceStore = createWorkspaceStore();
let state = await workspaceStore.load({nodes:structuredClone(seeds),pending:[],documents:[],showExamples:true});
let storageOK = true, saveRevision = 0, importing = false, mutating = false;
state.trash=Array.isArray(state.trash)?state.trash:[];
state.documents=Array.isArray(state.documents)?state.documents:[];
if (typeof state.showExamples !== 'boolean') state.showExamples = !state.documents.length;
let view='network',category='',selected=null,focus=false,listMode=false,toastTimer;
let field;
let detailReturnRowId = null;
async function save() {
  const revision = ++saveRevision;
  $('#storageLabel').textContent = '保存中…';
  try {
    await workspaceStore.save(state);
    storageOK = true;
    if (revision === saveRevision) $('#storageLabel').textContent = '已保存到本机';
    $('.sidebar-bottom .statusdot').style.background = '#7da88c';
    return true;
  } catch (error) {
    storageOK = false;
    $('#storageLabel').textContent = '尚未保存';
    $('.sidebar-bottom .statusdot').style.background = '#d4aa71';
    toast('本机保存失败，请先导出完整备份，再释放存储空间重试');
    return false;
  }
}
async function commitWorkspaceChange(change) {
  if (mutating || importing) return false;
  mutating = true;
  $('#storageLabel').textContent = '保存中…';
  try {
    const draft = structuredClone(state);
    change(draft);
    await workspaceStore.save(draft);
    state = draft; storageOK = true;
    $('#storageLabel').textContent = '已保存到本机';
    $('.sidebar-bottom .statusdot').style.background = '#7da88c';
    return true;
  } catch (error) {
    $('#storageLabel').textContent = storageOK ? '已有内容已保留' : '尚未保存';
    toast('本次修改未保存，已有内容保持保留。请导出备份后重试');
    return false;
  } finally { mutating = false; }
}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function collection() { return state.nodes.filter(node => state.showExamples || node.status !== '示例'); }
function score(a,b) { return relationScore(a,b,collection()); }
function links() { return buildSimilarityLinks(collection(), +$('#threshold').value, 3); }
function documentFor(node) { return state.documents.find(doc => doc.id === node?.documentId); }
function filtered(){const q=$('#search').value.trim().toLowerCase();let arr=collection().filter(n=>(!category||n.category===category)&&(!q||[n.title,n.summary,n.category,n.type,n.scenario,...n.tags,documentFor(n)?.text||''].join(' ').toLowerCase().includes(q)));if(focus&&selected){const id=new Set([selected,...links().filter(l=>l.a.id===selected||l.b.id===selected).flatMap(l=>[l.a.id,l.b.id])]);arr=arr.filter(n=>id.has(n.id));}return arr;}
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
  $('#footStats').textContent = `${collection().length} 个 ideas · ${state.documents.length} 份原文 · ${state.pending.length} 项待审核`;
  $('[data-view="network"] em').textContent = collection().length;
  $('#showExamples').checked = state.showExamples;
  $('.prototype').textContent = state.documents.length ? '研究文库 · 本机保存' : '开始探索 · 示例内容';
  $$('.cluster').forEach(element => element.hidden = state.documents.length > 0 || !state.showExamples);
  $('#pendingCount').textContent = state.pending.length;
  $('#focusBtn').style.background = focus ? '#edf0fb' : '';
  $('#thresholdValue').textContent = $('#threshold').value + '+';
  $('#graphBtn').classList.toggle('active', !listMode);
  $('#listBtn').classList.toggle('active', listMode);
  $$('.nav').forEach(element => element.classList.toggle('active', element.dataset.view === view));
}
function renderNav(){$('#categories').innerHTML=Object.entries(cats).map(([name,c])=>`<button class="category ${category===name?'active':''}" data-category="${name}"><i style="background:${c.color}"></i><span>${name}</span><span>${collection().filter(n=>n.category===name).length}</span></button>`).join('');$$('.category').forEach(e=>e.onclick=()=>{category=category===e.dataset.category?'':e.dataset.category;render();});}
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
function showDetail(n) {
  if (!n) return;
  field.setSelected(n.id);
  const c = cats[n.category] || cats['未分类'], doc = documentFor(n);
  const related = collection().filter(b => b.id !== n.id).map(b => ({b, ...score(n,b)}))
    .filter(link => link.value >= +$('#threshold').value && link.value > 0).sort((a,b) => b.value-a.value).slice(0,4);
  $('#detail').hidden = false;
  $('#detail').innerHTML = `<button class="close" aria-label="关闭详情">×</button>
    <div class="eyebrow">IDEA INSPECTOR</div><span class="badge" style="background:${c.tint};color:${c.color}">${c.glyph} ${esc(n.category)}</span>
    <h2>${esc(n.title)}</h2><p>${esc(n.summary)}</p>
    ${n.status === '自动整理 · 待核对' ? '<div class="review-note">摘要摘自原文，属性来自本地术语规则。请核对后编辑确认；研究假说尚未经过事实核验。</div>' : ''}
    <div class="field"><label>核心设计机制</label><span>${esc(n.type)}</span></div>
    <div class="field"><label>适用场景</label><span>${esc(n.scenario)}</span></div>
    <div class="field"><label>关键词</label><span>${n.tags.map(esc).join(' · ') || '待补充'}</span></div>
    <div class="field"><label>状态</label><span>${esc(n.status)} · ${n.pinned ? '位置已固定' : '位置可调整'}</span></div>
    ${doc && n.evidence?.length ? `<details class="extraction-evidence"><summary>查看属性提取依据</summary>${n.evidence.map(e => `<p><b>${esc(e.value || e.field)}</b><small>${esc(e.excerpt)}</small></p>`).join('')}</details>` : ''}
    <hr><div class="sectionlabel">相似的想法 <span style="float:right;color:#a4acba;font-weight:400">${related.length} 个</span></div>
    ${related.map(link => `<button class="related" data-id="${esc(link.b.id)}"><b>${link.value} / 100</b>${esc(link.b.title)}<small>${esc(link.reasons.join('；'))}</small></button>`).join('') || '<p>当前阈值下暂无相似建议。</p>'}
    <p class="score-note">按属性与共同术语计算的匹配分，常见术语权重较低；不是 AI 置信概率，也不代表支持、因果或反驳关系。图中每个想法最多推荐三个近邻，详情展示更多匹配。</p>
    <div class="sectionlabel">原始来源</div><div class="source">${esc(n.source)}
    <blockquote>${esc(n.quote || n.summary)}</blockquote>
    ${doc ? `<span>${doc.chars.toLocaleString()} 字符 · ${doc.sections.length} 个章节 · 完整原文保存在本机</span><button class="secondary source-open" id="readDocument">阅读完整文档 ↗</button>` : n.status === '示例' ? '此内容为设计演示样例。' : '手动记录或旧版候选；未关联完整文档。'}</div>
    <div class="detail-actions"><button class="secondary" id="editNode">${n.status === '自动整理 · 待核对' ? '核对并编辑' : '编辑 Idea'}</button><button class="secondary" id="pinNode">${n.pinned ? '取消固定' : '固定位置'}</button></div>
    <div class="detail-actions"><button class="secondary" id="downloadNode">导出 Markdown</button><button class="secondary" id="deleteNode">移至待审核</button></div>`;
  $('#detail .close').onclick = () => closeDetail(Boolean(field.returnFocusId) || Boolean(detailReturnRowId));
  $$('.related').forEach(button => button.onclick = () => { selected = button.dataset.id; showDetail(state.nodes.find(node => node.id === selected)); render(); });
  $('#pinNode').onclick = async () => {
    if (mutating || importing) return;
    if (!n.pinned) field.commitCurrentPosition(n.id);
    if (await commitWorkspaceChange(draft=>{const item=draft.nodes.find(node=>node.id===n.id);item.pinned=!item.pinned;})) { showDetail(state.nodes.find(node=>node.id===n.id)); render(); }
  };
  $('#editNode').onclick = () => editForm(n,false);
  if (doc) $('#readDocument').onclick = () => showDocument(doc, $('#search').value.trim());
  $('#downloadNode').onclick = () => download(safeFilename(n.title)+'.md', `# ${n.title}\n\n${n.summary}\n\n- 领域：${n.category}\n- 核心机制：${n.type}\n- 场景：${n.scenario}\n- 关键词：${n.tags.join('、')}\n\n## 来源\n${n.source}\n\n${doc ? '## 完整原文\n\n'+doc.text : '> '+(n.quote || n.summary)}\n`, 'text/markdown;charset=utf-8');
  $('#deleteNode').onclick = async () => {
    if (!await commitWorkspaceChange(draft=>{const node=draft.nodes.find(item=>item.id===n.id);if(!node)return;draft.nodes=draft.nodes.filter(item=>item.id!==n.id);draft.pending.push({...node,status:'待复核'});} )) return;
    closeDetail(); render(); toast('已移至待审核，可随时确认恢复');
  };
}

function modal(html, variant = '') {
  field.setModal(true);
  $('#modal').className = variant;
  $('#modalBody').innerHTML = html;
  if (!$('#modal').open) $('#modal').showModal();
  const close = $('#modal .close');
  if (close) close.onclick = () => { if (!importing) $('#modal').close(); };
}
const closer = '<button class="close" aria-label="关闭弹窗">×</button>';
const safeFilename = title => String(title).replace(/[\\/:*?"<>|]/g,'-').slice(0,110) || 'Idea';

function editForm(n, pending) {
  if (mutating || importing) return;
  const fresh = !n;
  n ||= { title:'', summary:'', category:'未分类', type:'待定义', scenario:'待定义', tags:[] };
  const doc = documentFor(n);
  modal(`${closer}<h2>${fresh ? '捕捉一个新想法' : pending ? '审核候选 Idea' : '编辑 Idea'}</h2>
    <p>${pending || n.status === '自动整理 · 待核对' ? '核对原文、摘要与属性后保存。你的修改会保留，不会被再次导入覆盖。' : '从一个清晰的想法开始，让联系慢慢生长。'}</p>
    <form id="ideaForm"><label for="ftitle">想法名称</label><input id="ftitle" required maxlength="300" value="${esc(n.title)}">
    <label for="fsummary">核心想法</label><textarea id="fsummary" required maxlength="10000">${esc(n.summary)}</textarea>
    <div class="formgrid"><div><label for="fcat">主题领域</label><select id="fcat">${Object.keys(cats).map(c => `<option ${n.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div><label for="ftype">核心设计机制</label><input id="ftype" required maxlength="200" value="${esc(n.type)}"></div></div>
    <label for="fscenario">适用场景</label><input id="fscenario" required maxlength="500" value="${esc(n.scenario)}">
    <label for="ftags">关键词，以逗号分隔</label><input id="ftags" value="${esc(n.tags.join('，'))}">
    ${doc ? `<details class="extraction-evidence"><summary>原文对照 · ${esc(doc.name)}（完整）</summary><pre class="source-inline">${esc(doc.text)}</pre></details>` : pending ? `<label>来源对照 · ${esc(n.source)}</label><div class="source">${esc(n.quote || n.summary)}</div>` : ''}
    <div class="modal-actions"><button type="button" class="secondary" id="cancelForm">取消</button><button class="primary" type="submit">${pending ? '确认并加入图谱' : '保存 Idea'}</button></div></form>`);
  $('#cancelForm').onclick = () => $('#modal').close();
  $('#ideaForm').onsubmit = async event => {
    event.preventDefault();
    const button = $('#ideaForm button[type=submit]'); button.disabled = true;
    const value = {...n, title:$('#ftitle').value.trim(), summary:$('#fsummary').value.trim(), category:$('#fcat').value, type:$('#ftype').value.trim(), scenario:$('#fscenario').value.trim(), tags:[...new Set($('#ftags').value.split(/[,，、]/).map(s => s.trim().slice(0,200)).filter(Boolean))].slice(0,32), status:'已确认'};
    if (!value.title || !value.summary) { button.disabled = false; return; }
    const committed = await commitWorkspaceChange(draft=>{
      if (fresh) { value.id=crypto.randomUUID();Object.assign(value,positionFor(value,draft.nodes));value.source='手动创建';value.quote=value.summary;draft.nodes.push(value); }
      else if(pending) {draft.pending=draft.pending.filter(node=>node.id!==n.id);if(n.status!=='待复核')Object.assign(value,positionFor(value,draft.nodes));draft.nodes.push(value);}
      else draft.nodes=draft.nodes.map(node=>node.id===n.id?value:node);
    });
    if (!committed) { button.disabled = false; return; }
    $('#modal').close();
    if (!pending) { selected = value.id; showDetail(value); }
    render(); toast('已保存，完整原文与已有节点位置保持保留');
  };
}

function renderInbox() {
  $('#inboxPanel').innerHTML = `<div class="inbox-title"><div><h2>想法收件箱 <span style="color:#a4adbc">${state.pending.length}</span></h2><p>一份报告保留为一个完整想法。核对提取结果，原文随时可读。</p></div><div><button class="secondary" id="restoreRemoved">恢复已移除 (${state.trash.length})</button> <button class="secondary" id="inboxImport">导入文档</button></div></div>` +
    (state.pending.length ? state.pending.map(n => `<article class="pending"><div><span class="badge">${n.pdf ? '旧版 PDF 记录 · 未解析' : '待人工审核'}</span><h3>${esc(n.title)}</h3><p>${esc(n.summary.slice(0,180))}</p><p>${esc(n.source)}</p></div><div class="pending-actions">${documentFor(n) ? `<button class="secondary pending-source" data-id="${esc(n.id)}">阅读原文</button>` : ''}${!n.pdf ? `<button class="primary review" data-id="${esc(n.id)}">审核并入图</button>` : ''}<button class="secondary reject" data-id="${esc(n.id)}">移除</button></div></article>`).join('') : '<div class="empty"><strong>为下一次灵感，留一个位置</strong>导入 Markdown / 文本报告，或直接新建 Idea。<br>导入时可选择直接入图或先人工审核。</div>');
  $('#inboxImport').onclick = showImport;
  $('#restoreRemoved').onclick = async () => { if(!await commitWorkspaceChange(draft=>{draft.pending.push(...draft.trash);draft.trash=[];}))return;render();toast('已恢复全部移除记录'); };
  $$('.review').forEach(button => button.onclick = () => editForm(state.pending.find(n => n.id === button.dataset.id), true));
  $$('.pending-source').forEach(button => button.onclick = () => showDocument(documentFor(state.pending.find(n => n.id === button.dataset.id))));
  $$('.reject').forEach(button => button.onclick = async () => { if(!await commitWorkspaceChange(draft=>{const node=draft.pending.find(n=>n.id===button.dataset.id);if(!node)return;draft.trash.push(node);draft.pending=draft.pending.filter(n=>n.id!==button.dataset.id);} ))return;render();toast('已移除，原文保留，可在收件箱恢复'); });
}

function positionFor(idea, nodes = state.nodes) { return positionForIdea(idea,nodes); }

function showImport() {
  if (importing || mutating) return;
  modal(`${closer}<h2>让研究，进入思想网络。</h2><p>支持与你的 Deep Research 报告相同的长篇 Markdown。默认一份文档对应一个 Idea，原文完整保留。</p>
    <label for="importDestination">导入方式</label><select id="importDestination"><option value="network" ${view !== 'inbox' ? 'selected' : ''}>直接加入图谱 · 标记待核对</option><option value="inbox" ${view === 'inbox' ? 'selected' : ''}>先进入待审核</option></select>
    <div class="dropzone" id="dropzone" role="button" tabindex="0"><div class="upload-symbol">↥</div><strong>选择多份报告，或拖到这里</strong><span>Markdown / TXT ≤ 5 MB · JSON 完整备份 ≤ 25 MB<br>一次最多 50 份，总大小 ≤ 25 MB</span></div>
    <div class="source"><strong>完整保留，方便核对</strong><br>自动提取标题、摘要、领域、核心机制、场景与关键词；长文不再截断，章节不会拆成独立结点。相同内容重复导入会跳过，同名的新内容可以正常导入。<br>整理使用本地规则，无外部 AI 调用。文档仅存于此浏览器，不会上传到 GitHub 或公共网站。PDF 尚不支持内容解析，请先导出 Markdown / TXT。</div>`);
  const drop = $('#dropzone');
  drop.onclick = () => $('#fileInput').click();
  drop.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('#fileInput').click(); } };
  drop.ondragover = event => { event.preventDefault(); drop.classList.add('drag-over'); };
  drop.ondragleave = () => drop.classList.remove('drag-over');
  drop.ondrop = event => { event.preventDefault(); handleFiles(event.dataTransfer.files); };
}

async function handleFiles(fileList) {
  if (importing || mutating) return;
  const files = Array.from(fileList || []);
  $('#fileInput').value = '';
  if (!files.length) return;
  if (files.length > 50 || files.reduce((sum,file)=>sum+file.size,0) > 25*1024*1024) { modal(`${closer}<h2>这批文件较大</h2><p>一次最多 50 份，总大小不超过 25 MB。请分批选择；本次没有改变已有内容。</p>`); return; }
  const destination = $('#importDestination')?.value || 'network';
  importing = true;
  $('#importBtn').disabled = true;
  modal('<h2>正在整理研究文档…</h2><p id="importProgress" role="status">准备读取文件</p><progress id="importProgressBar" value="0" max="'+files.length+'"></progress><p>文档在本机处理。保存完成后会显示每份文件的结果。</p>');
  let staged;
  try {
    staged = await stageDocumentFiles(files,state,{destination,onProgress:async ({index,total,name})=>{
      $('#importProgress').textContent = `${index+1} / ${total} · ${name}`;
      $('#importProgressBar').value = index;
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }});
  } catch (error) {
    importing=false;$('#importBtn').disabled=false;
    modal(`${closer}<h2>本次未导入</h2><p>${esc(error.message || '整理被中断，请重新选择文件。')} 已有内容保持保留。</p>`);
    return;
  }
  const {state:draft,added,restored,documentsAdded,results} = staged;
  let saved = true;
  try {
    if (added || restored || documentsAdded) {
      draft.showExamples = false;
      await workspaceStore.save(draft);
      state = draft; storageOK = true;
      $('#storageLabel').textContent = '已保存到本机';
      $('.sidebar-bottom .statusdot').style.background = '#7da88c';
    }
  } catch (error) {
    saved = false;
    for (const result of results) if (result.kind === 'added') { result.kind = 'error'; result.message = '本机保存失败，本次未写入。请导出已有备份、释放空间后重试。'; }
  } finally { importing = false; $('#importBtn').disabled = false; }
  if (saved && (added || restored || documentsAdded)) {
    view = destination === 'inbox' && !restored ? 'inbox' : 'network';
    listMode = false; category=''; focus=false; selected=null; $('#search').value=''; $('#detail').hidden=true;
  }
  render();
  if (saved && added && destination === 'network') field.fitView();
  const duplicates = results.filter(r => r.kind === 'duplicate').length, errors = results.filter(r => r.kind === 'error').length;
  modal(`${closer}<h2>${saved ? '文档整理完成' : '本次未能保存'}</h2><p>${saved ? `新增 ${added} 份报告 · 恢复 ${restored} 个想法 · 跳过 ${duplicates} 个重复 · ${errors} 个未导入` : '已有数据保持不变，下面的文件可以重新选择导入。'}</p>
    <ul class="import-results">${results.map(result => `<li class="result-${result.kind}"><span class="result-status">${result.kind === 'added' ? '已保存' : result.kind === 'duplicate' ? '已跳过' : '未导入'}</span><strong>${esc(result.name)}</strong>${result.title ? `<b>${esc(result.title)}</b>` : ''}<p>${esc(result.message)}</p>${result.warnings?.length ? `<small>${result.warnings.map(esc).join('；')}</small>` : ''}</li>`).join('')}</ul>
    <div class="modal-actions"><button class="primary" id="finishImport">${view === 'inbox' ? '查看待审核' : '查看思想图谱'}</button></div>`, 'import-results-dialog');
  $('#finishImport').onclick = () => $('#modal').close();
}

function showDocument(doc, initialQuery = '') {
  if (!doc) { toast('未找到完整原文，请重新导入文档'); return; }
  modal(`${closer}<div class="reader-heading"><div class="eyebrow">SOURCE DOCUMENT · 本机原文</div><h2>${esc(doc.title)}</h2><p>${esc(doc.name)} · ${doc.chars.toLocaleString()} 字符 · 原文完整保留</p></div>
    <div class="reader-toolbar"><label for="documentSearch" class="reader-search-label">文内查找</label><input id="documentSearch" type="search" placeholder="查找原文内容…" autocomplete="off"><span id="documentMatchCount" aria-live="polite"></span><button class="secondary" id="prevMatch" aria-label="上一个匹配">↑</button><button class="secondary" id="nextMatch" aria-label="下一个匹配">↓</button><button class="secondary" id="toggleRaw" aria-pressed="false">原始 Markdown</button><button class="secondary" id="downloadSource">下载原文</button></div>
    <div class="reader-layout"><nav class="document-toc" aria-label="文档章节"><strong>目录 · ${doc.sections.length}</strong>${doc.sections.map(section => `<button data-line="${section.line}" style="padding-left:${12+Math.max(0,section.level-1)*9}px">${esc(section.title)}</button>`).join('') || '<p>此文档没有标题章节。</p>'}</nav><article id="readerContent" class="document-content" tabindex="0"></article></div>`, 'reader-dialog');
  $('#documentSearch').value = initialQuery;
  let raw = false, marks = [], activeMatch = -1;
  const html = renderDocument(doc.text), content = $('#readerContent');
  function moveMatch(direction) {
    if (!marks.length) return;
    marks[activeMatch]?.classList.remove('active-match');
    activeMatch = (activeMatch + direction + marks.length) % marks.length;
    marks[activeMatch].classList.add('active-match'); marks[activeMatch].scrollIntoView({block:'center'});
    $('#documentMatchCount').textContent = `${activeMatch+1} / ${marks.length}${marks.length >= 1500 ? '+' : ''}`;
  }
  function renderReading() {
    const query = $('#documentSearch').value.trim().toLocaleLowerCase();
    content.innerHTML = raw ? '<pre class="raw-document">'+esc(doc.text)+'</pre>' : html;
    marks=[]; activeMatch=-1;
    if (query) {
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT), texts=[];
      while (walker.nextNode()) texts.push(walker.currentNode);
      for (const text of texts) {
        if (marks.length >= 1500) break;
        const value = text.textContent, lower=value.toLocaleLowerCase();
        if (!lower.includes(query)) continue;
        const fragment=document.createDocumentFragment(); let cursor=0, found;
        while ((found=lower.indexOf(query,cursor)) >= 0 && marks.length < 1500) {
          fragment.append(document.createTextNode(value.slice(cursor,found)));
          const mark=document.createElement('mark'); mark.textContent=value.slice(found,found+query.length); fragment.append(mark); marks.push(mark); cursor=found+query.length;
        }
        fragment.append(document.createTextNode(value.slice(cursor))); text.replaceWith(fragment);
      }
    }
    $('#documentMatchCount').textContent = query ? `${marks.length} 个匹配` : '';
    $('#prevMatch').disabled = $('#nextMatch').disabled = !marks.length;
    if (marks.length) moveMatch(1);
  }
  $('#documentSearch').oninput = renderReading;
  $('#documentSearch').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); moveMatch(event.shiftKey ? -1 : 1); } };
  $('#prevMatch').onclick=()=>moveMatch(-1); $('#nextMatch').onclick=()=>moveMatch(1);
  $('#toggleRaw').onclick=()=>{ raw=!raw; $('#toggleRaw').setAttribute('aria-pressed',String(raw)); $('#toggleRaw').textContent=raw?'阅读视图':'原始 Markdown'; renderReading(); };
  $('#downloadSource').onclick=()=>download(doc.name,doc.text,'text/markdown;charset=utf-8');
  $$('.document-toc button').forEach(button=>button.onclick=()=>{if(raw){raw=false;$('#toggleRaw').setAttribute('aria-pressed','false');$('#toggleRaw').textContent='原始 Markdown';renderReading();}content.querySelector('#line-'+button.dataset.line)?.scrollIntoView({block:'start'});});
  renderReading();
}

function download(name,body,type='application/json'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function guide(){modal(`${closer}<h2>让研究，慢慢连成网络。</h2><ol class="guide-list"><li>悬停柔光点暂停并预览，点击查看摘要、关键属性与完整来源。</li><li>触屏轻点预览，再次轻点查看详情；键盘 Tab、Enter 和 Escape 也可操作。</li><li>长篇 Markdown / TXT 默认整份生成一个 Idea，保留全部原文与章节。导入后可直接入图并标记待核对，或先进入收件箱。</li><li>搜索会查找想法属性与完整原文。在详情中打开原文，可继续定位命中内容、浏览目录和下载原文件。</li><li>相同内容重复导入会跳过，同名的新内容会保留。人工修改不会被重导覆盖。</li><li>图中相似建议来自可解释的属性与术语匹配，每个想法选择前三个近邻后合并。常见术语会降权，未知属性不计分。</li><li>新增想法靠近已有匹配邻居安排，已有位置不移动。拖动与固定位置可保留空间记忆。</li><li>导出完整备份会包含所有文档原文、想法、待审核记录和布局。可在另一浏览器导入恢复。</li></ol><div class="source">文档仅保存在当前浏览器，不会上传 GitHub。没有云端同步或外部 AI；自动摘要、分类与连线需要核对。公式与 Mermaid 源码保留可读文本，不执行文档中的代码。PDF 尚未支持正文解析，请先转换为 Markdown / TXT。</div>`);}
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
    if (mutating || importing || workspaceStore.readOnly) return;
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
$('#workspace').onclick = () => {
  modal(`${closer}<h2>我的思想空间</h2><p>${state.documents.length} 份完整文档 · ${state.nodes.filter(n=>n.status!=='示例').length} 个个人想法</p><div class="source">文档与图谱使用 ${workspaceStore.kind} 保存在当前浏览器。其他访客不会看到你的文档；换设备或清除网站数据后，需要导入完整备份恢复。</div><div class="modal-actions"><button class="secondary" id="workspaceExamples">${state.showExamples?'隐藏':'显示'}示例 Ideas</button><button class="primary" id="workspaceExport">导出完整备份</button></div>`);
  $('#workspaceExamples').onclick = async () => { if(!await commitWorkspaceChange(draft=>draft.showExamples=!draft.showExamples))return;$('#modal').close();render();field.fitView(); };
  $('#workspaceExport').onclick = () => $('#export').click();
};
$('#showExamples').onchange = async event => { const show=event.target.checked;if(!await commitWorkspaceChange(draft=>draft.showExamples=show)){event.target.checked=state.showExamples;return;}selected=null;focus=false;$('#detail').hidden=true;render();field.fitView(); };
$('#export').onclick = () => download('idea-atlas-complete-backup.json', JSON.stringify({ ...state, format: 'idea-atlas-v2', exportedAt:new Date().toISOString() }, null, 2));
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
$('#modal').addEventListener('cancel', event => { if (importing) event.preventDefault(); });
$('#modal').onclick = event => { if (event.target === $('#modal') && !importing) $('#modal').close(); };
$('#mobileNav').onchange = event => {
  if (event.target.value === 'export') { $('#export').click(); event.target.value = view; return; }
  view = event.target.value;
  if (view === 'network') listMode = false;
  category = ''; focus = false; selected = null;
  $('#detail').hidden = true;
  render();
};
render();
if (workspaceStore.warning) {
  storageOK = false;
  $('#storageLabel').textContent='本机读取异常';
  $('.sidebar-bottom .statusdot').style.background='#d4aa71';
  $('#newBtn').disabled=$('#importBtn').disabled=$('#fileInput').disabled=$('#showExamples').disabled=true;
  field.setGlobalPause('recovery',true);
  modal(`${closer}<h2>本机文库需要恢复</h2><p>${esc(workspaceStore.warning)}</p><div class="source">原始存储没有被覆盖。当前显示临时只读视图，修改与导入暂停。请先保存恢复记录，再刷新重试。</div><div class="modal-actions">${workspaceStore.recoveryData !== undefined ? '<button class="secondary" id="recoveryExport">下载原始恢复记录</button>' : ''}<button class="primary" id="retryLoad">刷新重试</button></div>`);
  if ($('#recoveryExport')) $('#recoveryExport').onclick=()=>download('idea-atlas-recovery-record.json',typeof workspaceStore.recoveryData==='string'?workspaceStore.recoveryData:JSON.stringify(workspaceStore.recoveryData,null,2));
  $('#retryLoad').onclick=()=>location.reload();
}
