/** Safe, deliberately small Markdown reader. No raw HTML, image fetches or plugins.
 * Source stays untouched in storage; this module only produces a reading view.
 * Heading IDs use 1-based physical source lines. No document content is executed.
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
  } catch { return null; }
}

// Tokenize the original string before escaping so encoded HTML never becomes markup.
// Unrecognized and unsupported Markdown is displayed as literal, escaped text.
function inline(text, depth = 0) {
  if (depth > 4) return escapeHtml(text);
  let out = '', plain = '';
  const flush = () => { out += escapeHtml(plain); plain = ''; };
  for (let i = 0; i < text.length;) {
    const tail = text.slice(i);
    let m;
    if ((m = tail.match(/^(`+)([\s\S]*?)\1(?!`)/))) {
      flush(); out += `<code>${escapeHtml(m[2])}</code>`; i += m[0].length;
    } else if ((m = tail.match(/^(\${1,2})([^\n]*?)\1/))) {
      flush(); out += `<span class="document-math">${escapeHtml(m[0])}</span>`; i += m[0].length;
    } else if ((m = tail.match(/^!\[([^\]\n]*)\]\(([^)\n]*)\)/))) {
      // Keep complete image syntax visible, including its URL, without an <img>.
      flush(); out += `<span class="document-image-placeholder">${escapeHtml(m[0])}</span>`; i += m[0].length;
    } else if ((m = tail.match(/^\[([^\]\n]+)\]\(([^\s)]+)(?:\s+"[^"\n]*")?\)/))) {
      flush(); const href = safeLink(m[2]);
      out += href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inline(m[1], depth + 1)}</a>` : escapeHtml(m[0]);
      i += m[0].length;
    } else if ((m = tail.match(/^\*\*([^\n]+?)\*\*/))) {
      flush(); out += `<strong>${inline(m[1], depth + 1)}</strong>`; i += m[0].length;
    } else if ((m = tail.match(/^\*([^*\n]+)\*/))) {
      flush(); out += `<em>${inline(m[1], depth + 1)}</em>`; i += m[0].length;
    } else { plain += text[i++]; }
  }
  flush(); return out;
}

function cells(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const result = []; let cell = '', inCode = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '\\' && row[i + 1] === '|') { cell += '|'; i++; }
    else if (c === '`') { inCode = !inCode; cell += c; }
    else if (c === '|' && !inCode) { result.push(cell.trim()); cell = ''; }
    else cell += c;
  }
  result.push(cell.trim()); return result;
}
const heading = line => line.match(/^ {0,3}(#{1,6})[ \t]+(.*)$/);
const fence = line => line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
const listItem = line => line.match(/^ {0,3}([-+*]|\d+[.)])[ \t]+(.*)$/);
const quote = line => /^ {0,3}>/.test(line);
const mathStart = line => /^(\$\$|\\\[)\s*$/.test(line.trim());
function isTable(lines, i) {
  return i + 1 < lines.length && lines[i].includes('|') && lines[i + 1].includes('-') &&
    cells(lines[i + 1]).every(c => /^:?-{3,}:?$/.test(c)) && cells(lines[i]).length === cells(lines[i + 1]).length;
}
function blockStart(lines, i) {
  const line = lines[i];
  return heading(line) || fence(line) || listItem(line) || quote(line) || mathStart(line) || isTable(lines, i) || /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function renderLines(lines, baseLine = 1, depth = 0) {
  if (depth > 12) return `<pre>${escapeHtml(lines.join('\n'))}</pre>`;
  const out = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const f = fence(line), h = heading(line), li = listItem(line);
    if (f) {
      const marker = f[1][0], size = f[1].length, body = []; i++;
      // A missing closing fence keeps the complete remainder as text.
      const closing = new RegExp('^ {0,3}' + marker + '{' + size + ',}\\s*$');
      while (i < lines.length && !closing.test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++;
      out.push(`<pre class="document-code"><code>${escapeHtml(body.join('\n'))}</code></pre>`);
    } else if (mathStart(line)) {
      const end = line.trim() === '$$' ? '$$' : '\\]', body = [line]; i++;
      while (i < lines.length) { const next = lines[i++]; body.push(next); if (next.trim() === end) break; }
      out.push(`<pre class="document-math">${escapeHtml(body.join('\n'))}</pre>`);
    } else if (h) {
      const level = h[1].length, title = h[2].replace(/[ \t]+#+[ \t]*$/, '');
      out.push(`<h${level} id="line-${baseLine + i}">${inline(title)}</h${level}>`); i++;
    } else if (isTable(lines, i)) {
      const header = cells(line), align = cells(lines[i + 1]).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left');
      const row = (values, tag) => '<tr>' + values.map((v, index) => `<${tag} style="text-align:${align[index] || 'left'}">${inline(v)}</${tag}>`).join('') + '</tr>';
      let table = `<div class="document-table"><table><thead>${row(header, 'th')}</thead><tbody>`; i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|') && !blockStart(lines, i)) {
        table += row(cells(lines[i++]), 'td');
      }
      out.push(table + '</tbody></table></div>');
    } else if (quote(line)) {
      const start = i, body = [];
      while (i < lines.length && quote(lines[i])) body.push(lines[i++].replace(/^ {0,3}> ?/, ''));
      out.push(`<blockquote>${renderLines(body, baseLine + start, depth + 1)}</blockquote>`);
    } else if (li) {
      const ordered = /^\d/.test(li[1]), tag = ordered ? 'ol' : 'ul';
      const start = ordered ? ` start="${Number.parseInt(li[1], 10)}"` : '';
      const items = [];
      while (i < lines.length) {
        const item = listItem(lines[i]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(`<li>${inline(item[2])}</li>`); i++;
      }
      out.push(`<${tag}${start}>${items.join('')}</${tag}>`);
    } else if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>'); i++;
    } else {
      const body = [line]; i++;
      while (i < lines.length && lines[i].trim() && !blockStart(lines, i)) body.push(lines[i++]);
      out.push(`<p>${body.map(l => inline(l)).join('<br>\n')}</p>`);
    }
  }
  return out.join('\n');
}

export function renderDocument(text) {
  // Normalization is for display only. Store the original string separately.
  return renderLines(String(text ?? '').replace(/\r\n?/g, '\n').split('\n'));
}
