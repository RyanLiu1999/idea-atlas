// No network calls: complete source documents and the graph share one local,
// atomic IndexedDB record. The v1 localStorage workspace is migrated on load.
export function createWorkspaceStore(environment = globalThis) {
  let database;
  let kind = 'IndexedDB';
  let sequence = Promise.resolve();
  let warning = '', readOnly = false, recoveryData;
  const normalize = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('本机记录格式不正确');
    const validated = validateBackup({ ...value, format: 'idea-atlas-v2' });
    return { ...validated, showExamples: typeof value.showExamples === 'boolean' ? value.showExamples : !validated.documents.length };
  };
  const legacyRecord = (required = false) => {
    let raw;
    try {
      if (!environment.localStorage) {
        if (required) throw new Error('本机存储不可用');
        return { exists: false };
      }
      raw = environment.localStorage.getItem('idea-atlas-v1');
      if (raw == null) return { exists: false };
      return { exists: true, raw, value: normalize(JSON.parse(raw)) };
    } catch (error) { return { exists: raw != null, raw, error }; }
  };
  const protect = (message, original) => {
    readOnly = true;
    warning = message + ' 原有记录未覆盖；当前为只读临时视图，请先下载可用恢复数据，刷新后重试。';
    recoveryData = original;
  };
  const open = () => database ||= new Promise((resolve, reject) => {
    if (!environment.indexedDB) return reject(new Error('此浏览器不支持 IndexedDB'));
    const request = environment.indexedDB.open('idea-atlas-local', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onerror = () => reject(request.error || new Error('无法打开本机数据库'));
    request.onblocked = () => reject(new Error('本机数据库被其他窗口占用，请关闭旧窗口后重试'));
    request.onsuccess = () => resolve(request.result);
  });
  async function read() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('workspace', 'readonly');
      const request = transaction.objectStore('workspace').get('current');
      let result;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error || new Error('读取失败'));
    });
  }
  async function write(value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('workspace', 'readwrite');
      transaction.objectStore('workspace').put(value, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('保存失败'));
      transaction.onabort = () => reject(transaction.error || new Error('本机存储空间不足'));
    });
  }
  return {
    get kind() { return kind; },
    get warning() { return warning; },
    get readOnly() { return readOnly; },
    get recoveryData() { return recoveryData; },
    async load(initial) {
      // A missing API may use localStorage. A failed existing API must never
      // silently switch storage and later overwrite an authoritative workspace.
      if (!environment.indexedDB) {
        kind = 'localStorage';
        const legacy = legacyRecord(true);
        if (legacy.error) protect('无法读取或校验旧版本机数据。', legacy.raw);
        return legacy.value || normalize(initial);
      }
      let saved;
      try {
        saved = await read();
      } catch (error) {
        const legacy = legacyRecord();
        protect('无法读取本机数据库。', legacy.raw);
        return legacy.value || normalize(initial);
      }
      if (saved !== undefined) {
        try { return normalize(saved); }
        catch (error) {
          const legacy = legacyRecord();
          protect('本机数据库记录格式异常。', saved);
          return legacy.value || normalize(initial);
        }
      }
      // Only an actual missing record may be initialized or migrated.
      const legacy = legacyRecord();
      if (legacy.error) {
        protect('无法读取或校验旧版本机数据，已暂停迁移。', legacy.raw);
        return normalize(initial);
      }
      const first = legacy.value || normalize(initial);
      try {
        await write(first);
        return first;
      } catch (error) {
        protect('无法完成本机数据库初始化或迁移。', legacy.raw);
        return first;
      }
    },
    save(value) {
      if (readOnly) return Promise.reject(new Error(warning));
      // Snapshot immediately, serialize commits, and allow a later retry after
      // an earlier failed write. Completion means the storage transaction ended.
      const snapshot = structuredClone(value);
      sequence = sequence.catch(() => {}).then(() => {
        if (readOnly) throw new Error(warning);
        if (kind === 'localStorage') {
          if (!environment.localStorage) throw new Error('本机存储不可用');
          environment.localStorage.setItem('idea-atlas-v1', JSON.stringify(snapshot));
          return;
        }
        return write(snapshot);
      });
      return sequence;
    }
  };
}

const string = (value, max, optional = false) => {
  if (optional && value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('备份中存在不合法的文本字段');
  return value;
};

// Validate first, merge second: malformed backups never partially change state.
export function validateBackup(input) {
  if (!input || !['idea-atlas-v1', 'idea-atlas-v2'].includes(input.format)) throw new Error('这不是 Idea Atlas 的备份');
  if (!Array.isArray(input.nodes) || !Array.isArray(input.pending)) throw new Error('备份缺少图谱或收件箱');
  const groups = ['nodes', 'pending', 'trash'];
  if (groups.reduce((sum, key) => sum + (input[key]?.length || 0), 0) > 10000) throw new Error('一次最多恢复 10,000 个想法');
  const ids = new Set();
  const result = { nodes: [], pending: [], trash: [], documents: [] };
  for (const key of groups) {
    if (input[key] != null && !Array.isArray(input[key])) throw new Error('备份集合格式不正确');
    for (const item of input[key] || []) {
      if (!item || typeof item !== 'object') throw new Error('备份中存在无效想法');
      const id = string(item.id, 200);
      if (!id || ids.has(id)) throw new Error('备份中存在重复的想法 ID');
      ids.add(id);
      if (item.pdf && key === 'nodes') throw new Error('未解析的 PDF 不能作为图谱节点');
      const pdf = Boolean(item.pdf);
      if (!pdf && (!Array.isArray(item.tags) || item.tags.length > 64 || item.tags.some(tag => typeof tag !== 'string' || tag.length > 200))) throw new Error('关键词格式不正确');
      if (!pdf && key === 'nodes' && (!Number.isFinite(item.x) || !Number.isFinite(item.y) || item.x < 0 || item.x > 1 || item.y < 0 || item.y > 1)) throw new Error('想法位置不正确');
      const node = {
        id, title: string(item.title, 500), summary: string(item.summary, 20000),
        category: pdf ? '未分类' : string(item.category, 200), type: pdf ? '待定义' : string(item.type, 200),
        scenario: pdf ? '待定义' : string(item.scenario, 500), tags: pdf ? [] : [...item.tags],
        source: string(item.source, 1000, true), quote: string(item.quote, 20000, true),
        status: string(item.status, 100, true) || '待审核', pinned: Boolean(item.pinned),
        x: Number.isFinite(item.x) ? Math.max(0, Math.min(1, item.x)) : .5,
        y: Number.isFinite(item.y) ? Math.max(0, Math.min(1, item.y)) : .5
      };
      if (pdf) node.pdf = true;
      if (item.documentId) node.documentId = string(item.documentId, 200);
      if (Array.isArray(item.evidence)) node.evidence = item.evidence.filter(e => e && typeof e.field === 'string' && typeof e.excerpt === 'string').map(e => ({ field: e.field.slice(0, 100), value: String(e.value || '').slice(0, 500), term: String(e.term || '').slice(0, 200), excerpt: e.excerpt.slice(0, 2000), start: Number(e.start) || 0, end: Number(e.end) || 0 }));
      if (Array.isArray(item.terms)) node.terms = item.terms.filter(t => t && typeof t.term === 'string' && typeof t.label === 'string').slice(0, 100).map(t => ({ term: t.term.slice(0, 200), label: t.label.slice(0, 200), count: Math.max(0, Number(t.count) || 0), weight: Math.max(0, Math.min(10, Number(t.weight) || 1)) }));
      if (Array.isArray(item.warnings)) node.warnings = item.warnings.filter(w => w && typeof w.message === 'string').map(w => ({ code: String(w.code || ''), message: w.message.slice(0, 1000) }));
      result[key].push(node);
    }
  }
  if (input.documents != null && !Array.isArray(input.documents)) throw new Error('原文文库格式不正确');
  const documentIds = new Set();
  for (const item of input.documents || []) {
    if (!item || typeof item !== 'object') throw new Error('原文文档格式不正确');
    const doc = {
      id: string(item.id, 200), hash: string(item.hash, 200), name: string(item.name, 500),
      title: string(item.title, 500), text: string(item.text, 5 * 1024 * 1024),
      parserVersion: string(item.parserVersion, 100, true),
      sections: (Array.isArray(item.sections) ? item.sections : []).filter(s => s && typeof s.title === 'string').map(s => ({ level: Math.max(1, Math.min(6, Number(s.level) || 1)), title: s.title.slice(0, 500), start: Math.max(0, Number(s.start) || 0), end: Math.max(0, Number(s.end) || 0), line: Math.max(1, Number(s.line) || 1) }))
    };
    if (!doc.id || documentIds.has(doc.id)) throw new Error('原文 ID 重复');
    documentIds.add(doc.id);
    doc.chars = doc.text.length;
    doc.size = Number(item.size) || new TextEncoder().encode(doc.text).length;
    result.documents.push(doc);
  }
  for (const key of groups) for (const node of result[key]) if (node.documentId && !documentIds.has(node.documentId)) throw new Error('备份缺少关联原文，请使用完整备份');
  return result;
}

export function mergeBackup(current, backup) {
  const next = structuredClone(current);
  next.documents ||= [];
  next.trash ||= [];
  const remap = new Map();
  let documents = 0, ideas = 0, duplicates = 0;
  for (const doc of backup.documents) {
    const found = next.documents.find(d => d.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim() === doc.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim());
    if (found) { remap.set(doc.id, found.id); continue; }
    if (next.documents.some(d => d.id === doc.id)) throw new Error('原文 ID 冲突，未合并备份');
    next.documents.push(doc); remap.set(doc.id, doc.id); documents++;
  }
  const existing = [...next.nodes, ...next.pending, ...next.trash];
  const ids = new Set(existing.map(n => n.id));
  for (const key of ['nodes', 'pending', 'trash']) for (const original of backup[key]) {
    const node = { ...original };
    if (node.documentId) node.documentId = remap.get(node.documentId);
    if (ids.has(node.id)) { duplicates++; continue; }
    next[key].push(node); ids.add(node.id); ideas++;
  }
  return { state: next, documents, ideas, duplicates };
}
