import { parseIdeaDocument, normalizeDocumentText } from './import-engine.mjs?v=6';
import { validateBackup, mergeBackup } from './workspace-store.mjs?v=6';
import { relationScore } from './relations.mjs?v=6';
import { chooseOpenPosition } from './motion.mjs?v=6';

export const IMPORT_LIMITS = Object.freeze({ files:50, fileBytes:5*1024*1024, batchBytes:25*1024*1024 });
export function positionForIdea(idea, nodes) {
  const ownNodes = nodes.filter(node => node.status !== '示例');
  const candidates = ownNodes.map(node => ({node,...relationScore(idea,node,[...ownNodes,idea])}))
    .filter(result => result.value >= 30).sort((a,b)=>b.value-a.value).slice(0,2);
  const total = candidates.reduce((sum,item)=>sum+item.value,0);
  const origin = total ? {
    x:candidates.reduce((sum,item)=>sum+item.node.x*item.value,0)/total,
    y:candidates.reduce((sum,item)=>sum+item.node.y*item.value,0)/total
  } : {x:.48,y:.45};
  return chooseOpenPosition(idea.documentId ? ownNodes : nodes,origin,idea.documentId ? 105 : 62);
}

// File objects are passed by the input/drop UI. This function never uploads,
// persists or mutates the current workspace; the caller commits the returned
// draft only after the complete batch has been examined.
export async function stageDocumentFiles(fileList, current, options = {}) {
  const files = Array.from(fileList || []), destination = options.destination === 'inbox' ? 'pending' : 'nodes';
  if (files.length > IMPORT_LIMITS.files || files.reduce((sum,file)=>sum+file.size,0) > IMPORT_LIMITS.batchBytes)
    throw new Error('一次最多 50 份，总大小不超过 25 MB。请分批选择；本次没有改变已有内容。');
  let draft = structuredClone(current), added = 0, restored = 0, documentsAdded = 0;
  draft.documents ||= []; draft.trash ||= [];
  const results = [];
  for (const [index,file] of files.entries()) {
    await options.onProgress?.({index,total:files.length,name:file.name});
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['md','markdown','txt','json'].includes(ext)) throw new Error(ext === 'pdf' ? 'PDF 尚不支持内容解析，请先转换为 Markdown / TXT' : '不支持该文件类型');
      if (file.size > (ext === 'json' ? IMPORT_LIMITS.batchBytes : IMPORT_LIMITS.fileBytes)) throw new Error('超过单个文件大小限制，未导入');
      const text = await file.text();
      if (typeof text !== 'string' || text.includes('\uFFFD')) throw new Error('检测到无效文字编码，请另存为 UTF-8 后重试');
      if (ext === 'json') {
        const merged = mergeBackup(draft,validateBackup(JSON.parse(text)));
        draft = merged.state; restored += merged.ideas; documentsAdded += merged.documents;
        results.push({name:file.name,kind:merged.ideas || merged.documents ? 'added' : 'duplicate',message:`恢复 ${merged.ideas} 个想法、${merged.documents} 份原文；跳过 ${merged.duplicates} 项重复`});
        continue;
      }
      if (!text.trim()) throw new Error('文件为空，未导入');
      if (text.includes('\u0000')) throw new Error('该文件不像文本，请检查格式');
      const normalized = normalizeDocumentText(text);
      const existing = draft.documents.find(doc=>normalizeDocumentText(doc.text) === normalized);
      if (existing) { results.push({name:file.name,kind:'duplicate',message:`相同原文已存在：${existing.title}。如已移除，可到待审核恢复。`}); continue; }
      const parsed = parseIdeaDocument({name:file.name,text,size:file.size}), doc = {...parsed.document};
      if (draft.documents.some(item=>item.id === doc.id)) doc.id += '-'+crypto.randomUUID();
      const idea = {...parsed.idea,id:'idea-'+crypto.randomUUID(),documentId:doc.id,source:file.name,
        status:destination === 'pending' ? '待审核' : '自动整理 · 待核对',pinned:false,warnings:parsed.warnings};
      Object.assign(idea,positionForIdea(idea,draft.nodes));
      draft.documents.push(doc); draft[destination].push(idea); added++; documentsAdded++;
      results.push({name:file.name,title:idea.title,kind:'added',message:`${doc.chars.toLocaleString()} 字符 · ${doc.sections.length} 章节 · ${idea.category}`,warnings:parsed.warnings.map(w=>w.message)});
    } catch (error) {
      results.push({name:file.name,kind:'error',message:error instanceof SyntaxError ? 'JSON 格式不正确，未导入' : error.message || '读取失败，请重试'});
    }
  }
  if (added || restored || documentsAdded) draft.showExamples = false;
  return {state:draft,added,restored,documentsAdded,results};
}
