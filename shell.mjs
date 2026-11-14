/* Overlay chrome only. View changes and every data action remain owned by app.js. */
export function createImmersiveShell({ onViewChange, onBeforeOpen } = {}) {
  const $ = selector => document.querySelector(selector);
  const panels = { sidebar: $('#shellSidebar'), tools: $('#topDock') };
  const triggers = { sidebar: $('#shellMenu'), tools: $('#shellTools') };
  const auxiliaryTools = [$('#canvasShell .canvas-top'), $('#canvasShell .canvas-bottom')].filter(Boolean);
  const controller = new AbortController();
  const signal = controller.signal;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const opened = new Map(), leaveTimers = new Map();
  let immersive = true, edgeTimer = null, edgeName = null, lastOpened = null;
  const modalOpen = () => Boolean(document.querySelector('dialog[open]'));
  const editing = () => document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  const inside = (node, element) => element instanceof Node && node.contains(element);
  const regions = name => name === 'tools' ? [panels.tools, ...auxiliaryTools] : [panels.sidebar];
  const insideRegion = (name, element) => regions(name).some(node => inside(node, element));
  const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, { ...options, signal });

  function cancelLeave(name) { clearTimeout(leaveTimers.get(name)); leaveTimers.delete(name); }
  function cancelEdge() { clearTimeout(edgeTimer); edgeTimer = null; edgeName = null; }
  function applyState(name, open) {
    const panel = panels[name], permanent = name === 'tools' && !immersive;
    panel.inert = !open && !permanent;
    panel.setAttribute('aria-hidden', String(!open && !permanent));
    triggers[name].setAttribute('aria-expanded', String(open || permanent));
    document.body.classList.toggle(`shell-${name}-open`, open);
    if (name === 'tools') for (const element of auxiliaryTools) {
      element.inert = !open && immersive;
      element.setAttribute('aria-hidden', String(!open && immersive));
    }
  }
  function close(name, restoreFocus = false) {
    cancelLeave(name);
    const entry = opened.get(name);
    const hadFocus = insideRegion(name, document.activeElement);
    opened.delete(name);
    applyState(name, false);
    if (restoreFocus && entry) {
      const target = entry.returnTo?.isConnected ? entry.returnTo : triggers[name];
      (target.closest('[inert]') ? triggers[name] : target).focus({ preventScroll: true });
    } else if (hadFocus && (name !== 'tools' || immersive)) triggers[name].focus({ preventScroll: true });
  }
  function open(name, { pinned = false, focus = false, focusSearch = false } = {}) {
    if (modalOpen()) return;
    cancelEdge(); cancelLeave(name);
    onBeforeOpen?.(name);
    for (const other of Object.keys(panels)) if (other !== name) close(other);
    if (name === 'tools' && !immersive) {
      if (focusSearch) $('#search').focus({ preventScroll: true });
      return;
    }
    const previous = opened.get(name);
    const active = document.activeElement;
    opened.set(name, {
      pinned: pinned || Boolean(previous?.pinned),
      returnTo: previous?.returnTo || (active && active !== document.body && !inside(panels[name], active) ? active : triggers[name])
    });
    lastOpened = name;
    applyState(name, true);
    if (focusSearch) $('#search').focus({ preventScroll: true });
    else if (focus) panels[name].querySelector('button, input, select, [tabindex="0"]')?.focus({ preventScroll: true });
  }
  function keepOpen(name) {
    return opened.get(name)?.pinned || insideRegion(name, document.activeElement) || editing() || modalOpen();
  }
  function scheduleLeave(name) {
    if (!opened.has(name) || leaveTimers.has(name)) return;
    leaveTimers.set(name, setTimeout(() => {
      leaveTimers.delete(name);
      if (!keepOpen(name)) close(name);
    }, 750));
  }
  function closeAll({ restoreFocus = false } = {}) {
    cancelEdge();
    const restoreName = lastOpened;
    for (const name of Object.keys(panels)) close(name, restoreFocus && name === restoreName);
  }
  function syncView(view = 'network', listMode = false) {
    const next = view === 'network' && !listMode;
    const changed = immersive !== next;
    immersive = next;
    document.body.dataset.view = view;
    document.body.dataset.listMode = String(Boolean(listMode));
    document.body.classList.toggle('is-immersive', immersive);
    $('#shellReturn').hidden = immersive;
    $('#shellToolsClose').hidden = !immersive;
    if (changed) closeAll();
    for (const name of Object.keys(panels)) applyState(name, opened.has(name));
  }
  function near(rect, x, y, padding = 16) {
    return x >= rect.left - padding && x <= rect.right + padding && y >= rect.top - padding && y <= rect.bottom + padding;
  }
  for (const name of Object.keys(panels)) {
    listen(triggers[name], 'click', event => {
      if (opened.has(name)) close(name, true);
      else open(name, { pinned: true, focus: name === 'sidebar' && event.detail === 0, focusSearch: name === 'tools' });
    });
    for (const region of regions(name)) {
      listen(region, 'pointerenter', () => cancelLeave(name));
      listen(region, 'pointerleave', () => scheduleLeave(name));
      listen(region, 'focusin', () => cancelLeave(name));
      listen(region, 'focusout', () => scheduleLeave(name));
    }
  }
  listen($('#shellSidebarClose'), 'click', () => close('sidebar', true));
  listen($('#shellToolsClose'), 'click', () => close('tools', true));
  listen($('#shellImport'), 'click', () => { closeAll(); triggers.tools.focus({ preventScroll: true }); $('#importBtn').click(); });
  listen($('#shellNew'), 'click', () => { closeAll(); triggers.tools.focus({ preventScroll: true }); $('#newBtn').click(); });
  listen($('#shellReturn'), 'click', () => {
    closeAll();
    if (onViewChange) onViewChange('network'); else $('#graphBtn').click();
  });
  listen(panels.sidebar, 'click', event => { if (event.target.closest('[data-view]')) close('sidebar'); });
  listen(document, 'pointermove', event => {
    if (!finePointer.matches || event.pointerType === 'touch' || event.buttons || modalOpen()) { cancelEdge(); return; }
    for (const [name] of opened) {
      const overPanel = regions(name).some(region => near(region.getBoundingClientRect(), event.clientX, event.clientY));
      const overTrigger = near((name === 'tools' ? $('.shell-quick') : triggers[name]).getBoundingClientRect(), event.clientX, event.clientY, 8);
      if (overPanel || overTrigger) cancelLeave(name); else scheduleLeave(name);
    }
    const name = event.clientX <= 8 ? 'sidebar' : immersive && event.clientY <= 8 ? 'tools' : null;
    if (!name || opened.has(name) || editing()) { cancelEdge(); return; }
    if (edgeName === name) return;
    cancelEdge(); edgeName = name;
    edgeTimer = setTimeout(() => { edgeTimer = null; edgeName = null; open(name); }, 320);
  });
  listen(document, 'pointerdown', event => {
    cancelEdge();
    if (modalOpen()) return;
    // Keep expanded quick actions mounted until their click handler runs.
    if (inside($('.shell-quick'), event.target)) return;
    for (const [name] of opened) {
      if (!insideRegion(name, event.target) && !inside(triggers[name], event.target)) close(name);
    }
  });
  listen(document, 'pointerleave', cancelEdge);
  listen(document, 'keydown', event => {
    if (modalOpen()) return;
    if (event.key === 'Escape' && opened.size) {
      event.preventDefault(); event.stopImmediatePropagation(); closeAll({ restoreFocus: true }); return;
    }
    if ((event.key === '/' && !editing() && !event.metaKey && !event.ctrlKey && !event.altKey) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
      event.preventDefault(); open('tools', { pinned: true, focusSearch: true });
    }
  }, { capture: true });
  syncView(document.body.dataset.view || 'network', document.body.dataset.listMode === 'true');
  return {
    syncView,
    openSidebar: ({ focus = false } = {}) => open('sidebar', { pinned: true, focus }),
    openTools: ({ focusSearch = false } = {}) => open('tools', { pinned: true, focusSearch }),
    closeAll,
    destroy() {
      closeAll(); controller.abort();
      for (const panel of [...Object.values(panels), ...auxiliaryTools]) { panel.inert = false; panel.removeAttribute('aria-hidden'); }
      document.body.classList.remove('is-immersive');
    }
  };
}
