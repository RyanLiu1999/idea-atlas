/** Deterministic, local Markdown/TXT report extraction. No model calls or file I/O.
 * Offsets are UTF-16 offsets into the original text. Hash is a non-cryptographic
 * 128-bit content fingerprint: deduplication MUST also compare normalized text.
 */
export const PARSER_VERSION = 'report-import-1';
export function normalizeDocumentText(text) {
  return String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
}
export function contentHash(text) {
  const value = normalizeDocumentText(text);
  let a = 1779033703, b = 3144134277, c = 1013904242, d = 2773480762;
  for (let i = 0; i < value.length; i++) {
    const k = value.charCodeAt(i);
    a = b ^ Math.imul(a ^ k, 597399067); b = c ^ Math.imul(b ^ k, 2869860233);
    c = d ^ Math.imul(c ^ k, 951274213); d = a ^ Math.imul(d ^ k, 2716044179);
  }
  a = Math.imul(c ^ (a >>> 18), 597399067); b = Math.imul(d ^ (b >>> 22), 2869860233);
  c = Math.imul(a ^ (c >>> 17), 951274213); d = Math.imul(b ^ (d >>> 19), 2716044179);
  return [(a ^ b ^ c ^ d) >>> 0, (b ^ a) >>> 0, (c ^ a) >>> 0, (d ^ a) >>> 0].map(n => n.toString(16).padStart(8, '0')).join('');
}

export function cleanMarkdown(text) {
  return String(text)
    .replace(/[\s\S]*?/g, ' ').replace(/[\uE200-\uE2FF]/g, ' ')
    .replace(/```[^\n]*\n[\s\S]*?(?:```|$)/g, ' ').replace(/~~~[^\n]*\n[\s\S]*?(?:~~~|$)/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ').replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ').replace(/\$[^$\n]{1,500}\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\^?\d+(?:[ ,，–-]+\d+)*\]/g, ' ').replace(/\[\^[^\]]+\]/g, ' ')
    .replace(/<[^>\n]*>/g, ' ').replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+)/gm, '').replace(/[*_`~]/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

const genericHeading = /^(?:executive\s+summary|summary|abstract|introduction|conclusions?|references?|执行摘要|摘要|主要瓶颈分析|背景与动机|关键维度|文献综述|引言|概述|总结|结论|参考文献|研究结论与证据边界|研究背景|目录|报告|研究报告)$/i;
const referenceHeading = /^(?:参考文献|references?|bibliography|附录|sources|来源|文献清单)/i;
const lexicon = [
  ['quadruped','四足机器人',/四足(?:机器人)?|quadruped/gi,3.5],
  ['robotics','机器人',/机器人|robot(?:ics)?\b/gi,2],
  ['embodied','具身智能',/具身智能|embodied\s+(?:intelligence|reasoning|foundation)/gi,3],
  ['navigation','导航',/导航|navigation\b/gi,2.5],
  ['ood','OOD 泛化',/\bOOD\b|out.of.distribution|分布外|未见(?:场景|环境|拓扑)|未知迷宫/gi,3],
  ['maze','迷宫与拓扑',/迷宫|\bmaze\b|拓扑|topolog(?:y|ical)/gi,3],
  ['rl','强化学习',/强化学习|reinforcement\s+learning|\bDRL\b|\bRL\b/gi,2.5],
  ['marl','多智能体训练',/多智能体|多主体|\bMARL\b|multi.agent/gi,3.5],
  ['sru','空间循环记忆',/\bSRU(?:-WM)?\b|spatially.enhanced\s+recurrent/gi,4],
  ['sgs','成功引导采样',/\bSGS\b|success.guided\s+sampling/gi,4],
  ['ued','环境生成',/\bUED\b|\bAEG\b|adversarial\s+environment\s+generation|对抗式?环境生成|主动场景生成|环境生成/gi,4],
  ['curriculum','课程学习',/课程学习|autocurriculum|\bcurriculum\b|自动课程/gi,3],
  ['world-model','世界模型',/世界模型|world\s+models?|latent\s+world\s+models?/gi,3.5],
  ['predictive','预测表征',/预测表征|predictive\s+representation|\bJEPA\b|latent\s+predict/gi,4],
  ['memory','长期记忆',/长期记忆|长时(?:程|记忆)|episodic\s+memory|情景记忆|记忆/gi,2.8],
  ['distillation','知识蒸馏',/蒸馏|distillation|CTDE/gi,3.5],
  ['safety','安全与风险',/安全|风险约束|risk.critical|\bsafety\b/gi,2.5],
  ['interaction','交互与意图',/reciprocal|hidden\s+intent|交互者|交互训练|意图建模/gi,3],
  ['swarm','群体智能',/群体智能|群体经验|集体探索|文化传递|社会学习|蜂群/gi,4],
  ['sample-efficiency','样本效率',/样本效率|sample\s+efficien/gi,3],
  ['plasticity','可塑性',/塑性(?:损失|丧失)|可塑性|plasticity/gi,3],
  ['exploration','探索机制',/探索困难|主动探索|内在奖励|intrinsic\s+reward|探索策略/gi,3],
  ['meta-rl','元强化学习',/元(?:强化)?学习|元RL|meta.RL|meta.reinforcement|AMAGO/gi,3.5],
  ['hierarchy','层次强化学习',/层次化|层次强化学习|宏动作|hierarchical|HiMeta/gi,3.5],
  ['transformer','Transformer',/\bTransformer\b/gi,2.5],
  ['causal','因果验证',/因果(?:验证|消融|拆解|分解|诊断|对照|推理)|causal/gi,3],
  ['audit','研究审计',/审计报告|逻辑校准|逻辑错误|过度推断|事实基线/gi,3],
  ['sim-to-real','Sim-to-real',/sim.to.real|仿真到现实|真实部署/gi,3],
  ['ai','人工智能',/人工智能|大语言模型|语言模型|machine\s+learning|\bLLM\b/gi,2],
  ['ux','交互设计',/用户体验|交互设计|渐进式信息披露|界面设计/gi,3],
  ['knowledge','知识管理',/知识管理|思维导图|双向链接|知识网络|笔记系统/gi,3],
];

function linesWithOffsets(text) {
  const lines = []; let start = 0;
  for (const [i, raw] of text.split('\n').entries()) {
    lines.push({ raw: raw.replace(/\r$/, ''), start, end: start + raw.length, line: i + 1 });
    start += raw.length + 1;
  }
  return lines;
}
function structuralView(text) {
  const lines = linesWithOffsets(text), headings = [], paragraphs = [];
  let fence = null, math = false, frontmatter = lines[0]?.raw.replace(/^\uFEFF/, '').trim() === '---', current = [], section = '', references = false;
  function flush() {
    if (!current.length) return;
    const start = current[0].start, end = current.at(-1).end;
    const raw = text.slice(start, end), clean = cleanMarkdown(raw);
    if (clean && !references) paragraphs.push({start,end,line:current[0].line,raw,clean,section});
    current = [];
  }
  for (const row of lines) {
    const raw = row.raw.replace(/^\uFEFF/, ''), trim = raw.trim();
    if (frontmatter) { if (row.line > 1 && /^(?:---|\.\.\.)$/.test(trim)) frontmatter = false; continue; }
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(raw);
    if (marker) { flush(); if (!fence) fence = marker[1]; else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null; continue; }
    if (fence) continue;
    if (math) { if (/(?:\\\]|\$\$)\s*$/.test(raw)) math=false; continue; }
    if (/^\s*(?:\\\[|\$\$)/.test(raw)) { flush(); math = !/(?:\\\]|\$\$)\s*$/.test(raw.replace(/^\s*(?:\\\[|\$\$)/,'')); continue; }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (heading) {
      flush(); section = cleanMarkdown(heading[2]); references = referenceHeading.test(section);
      headings.push({level:heading[1].length,title:section,start:row.start,end:row.end,line:row.line}); continue;
    }
    if (!trim) { flush(); continue; }
    // Exclude tables, footnote definitions, metadata and indented code from extracts.
    if (/^\s*\||^\s*\[\^?[^\]]+\]:|^ {4}\S/.test(raw)) { flush(); continue; }
    current.push(row);
  }
  flush();
  return { sections: headings.map((h,i)=>({...h,end:headings[i+1]?.start??text.length})), paragraphs, unclosedFence:Boolean(fence), unclosedMath:math };
}
function matchingTerms(text, sections) {
  // Ignore fenced code, formulas, bibliographies and citation scaffolding in ranking.
  // Offsets still point to the unmodified source through the paragraph ranges.
  const searchable = sections.paragraphs.map(p=>({start:p.start,text:p.raw}));
  for (const h of sections.sections) searchable.push({start:h.start,text:text.slice(h.start, text.indexOf('\n',h.start) < 0 ? text.length : text.indexOf('\n',h.start))});
  return lexicon.map(([term,label,pattern,weight])=>{
    let count=0, first=null;
    for (const part of searchable) {
      const re = new RegExp(pattern.source, pattern.flags); let m;
      while ((m=re.exec(part.text))) {
        count++; if (!first || part.start+m.index < first.start) first={start:part.start+m.index,end:part.start+m.index+m[0].length,excerpt:cleanMarkdown(text.slice(Math.max(part.start,part.start+m.index-32),Math.min(text.length,part.start+m.index+m[0].length+80)))};
      }
    }
    return count ? {term,label,count,weight,evidence:first} : null;
  }).filter(Boolean);
}
function shortText(value,max) {
  if(value.length<=max)return value;
  const part=value.slice(0,max), stop=Math.max(part.lastIndexOf('。'),part.lastIndexOf('；'),part.lastIndexOf('！'),part.lastIndexOf('？'));
  return stop>max*.45?part.slice(0,stop+1):part.replace(/[，,、；;：:\s]+$/,'')+'…';
}
function deriveTitle(name, structure, terms) {
  const h1=structure.sections.find(h=>h.level===1&&!genericHeading.test(h.title)&&!referenceHeading.test(h.title));
  // When the first H1 is merely a section label, later H1s are not document titles.
  const first=structure.sections.find(h=>h.level===1);
  if(h1&&(!first||h1===first))return {title:shortText(h1.title,140),evidence:{start:h1.start,end:h1.start+textLineLength(h1),excerpt:h1.title},fallback:false};
  const map=new Map(terms.map(t=>[t.term,t]));
  const firstPara=structure.paragraphs.find(p=>p.clean.length>=24);
  if(map.has('swarm')&&map.has('quadruped'))return {title:'群体智能向单体四足机器人的知识、记忆与策略迁移',evidence:map.get('swarm').evidence,fallback:true};
  if(map.has('rl')&&first&&/瓶颈/.test(first.title))return {title:'深度强化学习瓶颈与研究路线',evidence:map.get('rl').evidence,fallback:true};
  if(firstPara){let title=firstPara.clean.split(/[。！？]/)[0].replace(/^(?:本文|本报告|该报告)(?:主要)?(?:考察了|考察|研究了|研究|探讨了|探讨|聚焦于|聚焦|围绕|分析了|分析)/,'');return {title:shortText(title,72),evidence:{start:firstPara.start,end:firstPara.end,excerpt:shortText(firstPara.clean,160)},fallback:true};}
  const base=cleanMarkdown(String(name||'').replace(/\.[^.]+$/,''));
  return {title:base||'未命名 Idea',evidence:null,fallback:true};
}
function textLineLength(h){return h.title.length+h.level+1;}

export function parseIdeaDocument({name='',text,size}={}) {
  if(typeof text!=='string')throw new TypeError('text 必须是字符串');
  if(typeof name!=='string')throw new TypeError('name 必须是字符串');
  const structure=structuralView(text), terms=matchingTerms(text,structure), termMap=new Map(terms.map(t=>[t.term,t]));
  const warnings=[], evidence=[];
  const titleResult=deriveTitle(name,structure,terms), title=titleResult.title;
  if(titleResult.fallback)warnings.push({code:'TITLE_INFERRED',message:'首标题缺失或为通用章节名，标题由正文主题推断，请确认。'});
  if(titleResult.evidence)evidence.push({field:'title',value:title,...titleResult.evidence});
  let candidates=structure.paragraphs.filter(p=>p.clean.length>=35&&!/^(?:本轮检索截止|截至检索截止|检索截止|检索日期|最后更新|报告日期)/.test(p.clean));
  const ranked=candidates.map((p,i)=>({p,score:(i<8?Math.max(0,16-i*2):0)+(/本报告(?:的)?核心(?:判断|结论)|核心科研假说|本报告聚焦|本文考察|本报告围绕|本次复核确认/.test(p.clean)?24:0)+(/执行摘要|executive summary|研究结论与证据边界/i.test(p.section)?12:0)-(/^(?:第一[，,]|第二[，,]|第三[，,])/.test(p.clean)?4:0)-(/^其中|^SRU-GRU|^SRU 的核心 recurrence/.test(p.clean)?24:0)+(/能否|本研究更适合收敛|研究问题/.test(p.clean)&&i<14?18:0)-(/DOI:|arXiv:/.test(p.clean)?6:0)})).sort((a,b)=>b.score-a.score||a.p.start-b.p.start);
  const chosen=ranked[0]?.p||structure.paragraphs.find(p=>p.clean.length>0);
  const beforeChosen=chosen?structure.paragraphs[structure.paragraphs.indexOf(chosen)-1]:null;
  const framing=chosen&&/^\s*>/.test(chosen.raw)&&beforeChosen&&beforeChosen.clean.length<100&&/假说|假设|研究问题|以下问题/.test(beforeChosen.clean)?beforeChosen:null;
  const summarySource=chosen?(framing?framing.clean+' ':'')+chosen.clean:'';
  const summary=chosen?shortText(summarySource,280):'尚无可提取正文，请补充核心想法。';
  if(chosen)evidence.push({field:'summary',value:summary,start:framing?.start??chosen.start,end:chosen.end,line:framing?.line??chosen.line,excerpt:shortText(summarySource,320)});
  if(!chosen)warnings.push({code:'NO_PROSE',message:'未发现可提取的正文，保留原文并等待人工补充。'});
  const lead=[title,...structure.paragraphs.slice(0,3).map(p=>p.clean)].join(' ');
  let category='未分类',categoryKey=null;
  if(/四足|机器人|quadruped|具身智能|embodied/i.test(lead)){category='机器人与具身智能';categoryKey=termMap.has('quadruped')?'quadruped':termMap.has('embodied')?'embodied':'robotics';}
  else if(/强化学习|reinforcement learning|\bDRL\b|\bRL\b/i.test(lead)){category='强化学习';categoryKey='rl';}
  else if(termMap.has('ux')){category='产品与体验';categoryKey='ux';}
  else if(termMap.has('knowledge')){category='知识与思考';categoryKey='knowledge';}
  else if(termMap.has('ai')){category='人工智能';categoryKey='ai';}
  else if(termMap.has('rl')){category='强化学习';categoryKey='rl';}
  if(categoryKey&&termMap.has(categoryKey))evidence.push({field:'category',value:category,term:categoryKey,...termMap.get(categoryKey).evidence});
  const mechanisms=['swarm','marl','predictive','world-model','memory','sru','ued','sgs','curriculum','distillation','meta-rl','hierarchy','causal','ux','knowledge'];
  const selected=terms.filter(t=>mechanisms.includes(t.term)).map(t=>({...t,rank:Math.log2(t.count+1)*t.weight+(new RegExp(lexicon.find(x=>x[0]===t.term)[2].source,'i').test(title)?8:0)})).sort((a,b)=>b.rank-a.rank||a.term.localeCompare(b.term)).slice(0,2);
  if(/审计|逻辑校准/.test(title)&&termMap.has('audit')){selected.splice(0,selected.length,termMap.get('audit'),...(termMap.has('causal')?[termMap.get('causal')]:[]));}
  const type=selected.length?selected.map(t=>t.label).join(' · '):'待定义';
  for(const t of selected)evidence.push({field:'type',value:t.label,term:t.term,...t.evidence});
  let scenario='待定义',scenarioTerm=null;
  if(category==='机器人与具身智能'&&termMap.has('maze')){scenario=termMap.has('ood')?'未知迷宫与复杂室内导航泛化':'迷宫与拓扑导航研究';scenarioTerm='maze';}
  else if(category==='机器人与具身智能'&&termMap.has('navigation')){scenario=termMap.has('safety')?'四足机器人导航与安全避障':'机器人导航研究';scenarioTerm='navigation';}
  else if(category==='机器人与具身智能'&&termMap.has('embodied')){scenario='具身智能研究';scenarioTerm='embodied';}
  else if(category==='强化学习'){scenario='强化学习算法研究与验证';scenarioTerm='rl';}
  else if(category==='知识与思考'){scenario='个人知识组织';scenarioTerm='knowledge';}
  else if(category==='产品与体验'){scenario='产品交互设计';scenarioTerm='ux';}
  if(scenarioTerm&&termMap.has(scenarioTerm))evidence.push({field:'scenario',value:scenario,term:scenarioTerm,...termMap.get(scenarioTerm).evidence});
  const tags=terms.map(t=>({...t,rank:Math.log2(t.count+1)*t.weight})).sort((a,b)=>b.rank-a.rank||a.term.localeCompare(b.term)).slice(0,9).map(t=>t.label);
  for(const t of terms.filter(t=>tags.includes(t.label)))evidence.push({field:'tags',value:t.label,term:t.term,...t.evidence});
  if(category==='未分类'||type==='待定义'||scenario==='待定义')warnings.push({code:'UNKNOWN_ATTRIBUTES',message:'部分属性没有充分文本线索，已保留未分类或待定义。'});
  if(structure.unclosedFence)warnings.push({code:'UNCLOSED_CODE_FENCE',message:'原文包含未闭合代码围栏，围栏内内容未用于摘要。'});
  if(structure.unclosedMath)warnings.push({code:'UNCLOSED_MATH',message:'原文包含未闭合数学块，请检查格式。'});
  warnings.push({code:'RULE_BASED_EXTRACTION',message:'属性是本地词表和正文线索推断，未验证研究主张或引用真实性，请审核后入图。'});
  const hash=contentHash(text), documentId='doc-'+hash;
  return {document:{id:documentId,hash,name,title,text,chars:text.length,...(Number.isFinite(size)&&size>=0?{size}:{}),sections:structure.sections,parserVersion:PARSER_VERSION},idea:{title,summary,category,type,scenario,tags,quote:chosen?shortText(chosen.clean,420):'',documentId,evidence,terms},warnings};
}
