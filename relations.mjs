/* Explainable attribute/term matching. Scores are suggestions, not probabilities. */
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
const aliases = new Map();
for (const [key, forms] of Object.entries({
  marl: ['MARL', 'multi agent reinforcement learning', '多智能体强化学习', '多代理强化学习'],
  causal: ['causal', 'causal inference', 'causality', '因果', '因果推断', '因果学习'],
  distillation: ['distillation', 'knowledge distillation', 'policy distillation', '蒸馏', '知识蒸馏', '策略蒸馏'],
  population: ['population', 'population based training', '种群', '种群训练', '群体训练'],
  worldmodel: ['world model', 'world models', 'worldmodel', '世界模型'],
  memory: ['memory', '记忆', '记忆机制'],
  ued: ['UED', 'unsupervised environment design', '无监督环境设计'], sgs: ['SGS']
})) for (const form of [key, ...forms]) aliases.set(normalize(form), key);
const canonical = value => aliases.get(normalize(value)) || normalize(value);
const placeholders = new Set(['', '未分类', '待定义', '待补充', '未知', '无', '其他', 'unknown', 'undefined', 'null', 'na'].map(normalize));
const generic = new Set(['AI', '人工智能', '机器人', 'robot', 'robots', 'robotics', '机器人领域', '研究', 'research', '研究报告', '报告', '论文', 'paper', '设计', 'design', '方法', 'method', '模型', 'model', '学习', 'learning', '算法', 'algorithm', '系统', 'system', '技术', 'technology', '智能', '智能体', 'agent'].map(canonical));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function features(node) {
  const terms = new Map();
  function add(raw, label, weight) {
    const key = canonical(raw);
    if (!key || placeholders.has(key) || !Number.isFinite(weight) || weight <= 0) return;
    const old = terms.get(key);
    if (!old || old.weight < weight) terms.set(key, { key, label: String(label || raw), weight });
  }
  for (const tag of Array.isArray(node?.tags) ? node.tags : []) if (typeof tag === 'string') add(tag, tag, 1);
  for (const item of Array.isArray(node?.terms) ? node.terms : []) {
    if (typeof item === 'string') { add(item, item, 1.15); continue; }
    if (!item || typeof item !== 'object') continue;
    const count = Number.isFinite(item.count) ? Math.max(1, item.count) : 1;
    const importance = Number.isFinite(item.weight) ? clamp(item.weight, 0, 2) : 1;
    // Repetition is bounded so a repeated phrase cannot dominate a report.
    add(item.term || item.label, item.label || item.term, 1.15 * importance * (1 + Math.min(.3, Math.log2(count) * .06)));
  }
  return terms;
}

function corpusFor(nodes) {
  const unique = [], seenIds = new Set(), seenObjects = new Set();
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || seenObjects.has(node)) continue;
    if (node.id != null && seenIds.has(String(node.id))) continue;
    if (node.id != null) seenIds.add(String(node.id));
    seenObjects.add(node); unique.push(node);
  }
  const frequency = new Map(), cached = new Map();
  for (const node of unique) {
    const terms = features(node); cached.set(node, terms);
    for (const key of terms.keys()) frequency.set(key, (frequency.get(key) || 0) + 1);
  }
  return { frequency, size: unique.length, cached, factor(key) {
    const df = frequency.get(key) || 0;
    const idf = 1 + Math.log((unique.length + 1) / (df + 1));
    const prevalence = unique.length >= 3 ? 1 - .65 * df / unique.length : 1;
    return idf * prevalence * (generic.has(key) ? .12 : 1);
  }};
}

function scoreWithCorpus(a, b, corpus) {
  const ta = corpus.cached.get(a) || features(a), tb = corpus.cached.get(b) || features(b);
  let sumA = 0, sumB = 0, overlap = 0, specificEvidence = 0;
  const shared = [];
  for (const [key, term] of ta) sumA += term.weight * corpus.factor(key);
  for (const [key, term] of tb) sumB += term.weight * corpus.factor(key);
  for (const [key, term] of ta) {
    if (!tb.has(key)) continue;
    const weight = Math.min(term.weight, tb.get(key).weight) * corpus.factor(key);
    overlap += weight;
    if (!generic.has(key)) { specificEvidence += weight; shared.push({ key, label: term.label, weight }); }
  }
  const dice = sumA + sumB > 0 ? 2 * overlap / (sumA + sumB) : 0;
  let value = 84 * dice * Math.min(1, specificEvidence / .95);
  const reasons = [];
  shared.sort((x, y) => y.weight - x.weight || x.key.localeCompare(y.key));
  if (shared.length) reasons.push('共同术语/标签：' + shared.slice(0, 6).map(term => term.label).join('、'));
  const matches = field => {
    const x = normalize(a?.[field]), y = normalize(b?.[field]);
    return x && x === y && !placeholders.has(x) && !generic.has(canonical(x));
  };
  const ca = normalize(a?.category), cb = normalize(b?.category);
  if (ca && ca === cb && !placeholders.has(ca)) { value += 6; reasons.push('主题领域相同（低权重）'); }
  if (matches('type')) { value += 12; reasons.push('设计机制字段相同'); }
  if (matches('scenario')) { value += 8; reasons.push('适用场景字段相同'); }
  if (shared.some(term => corpus.size >= 3 && (corpus.frequency.get(term.key) || 0) / corpus.size >= .5)) reasons.push('文库中的常见术语已降低权重');
  if (!reasons.length) reasons.push('暂无共同的具体术语或有效属性');
  reasons.push('属性与术语匹配，仅为相似建议');
  return { value: clamp(Math.round(value), 0, 100), reasons, sharedTerms: shared.map(term => term.key) };
}

export function relationScore(a, b, allNodes = []) {
  return scoreWithCorpus(a, b, corpusFor([...(Array.isArray(allNodes) ? allNodes : []), a, b]));
}

export function buildSimilarityLinks(nodes, threshold = 30, maxNeighbors = 3) {
  const list = (Array.isArray(nodes) ? nodes : []).filter(node => node && typeof node === 'object');
  const minimum = Number.isFinite(threshold) ? clamp(threshold, 0, 100) : 30;
  const limit = Number.isFinite(maxNeighbors) ? clamp(Math.floor(maxNeighbors), 0, 3) : 3;
  if (!limit || list.length < 2) return [];
  const corpus = corpusFor(list), candidates = [], neighbors = list.map(() => []);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const result = scoreWithCorpus(list[i], list[j], corpus);
    if (result.value <= 0 || result.value < minimum) continue;
    const index = candidates.length;
    candidates.push({ a: list[i], b: list[j], ...result });
    neighbors[i].push({ index, other: j, value: result.value });
    neighbors[j].push({ index, other: i, value: result.value });
  }
  const chosen = new Set();
  const key = index => String(list[index].id ?? list[index].title ?? index);
  for (const group of neighbors) {
    group.sort((a, b) => b.value - a.value || key(a.other).localeCompare(key(b.other)) || a.other - b.other);
    for (const edge of group.slice(0, limit)) chosen.add(edge.index);
  }
  // Union, not degree cap: popular nodes can receive more than three choices.
  return [...chosen].sort((a, b) => a - b).map(index => candidates[index]);
}
