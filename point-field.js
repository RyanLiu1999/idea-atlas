import { hashId, createMotion, advanceMotion, moveAnchor, commitPosition, zoomCamera, curveBetween, placePointLabels } from './motion.mjs?v=4';

const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class PointField {
  constructor(options) {
    this.options = options;
    this.graph = document.querySelector('#graph');
    this.world = document.querySelector('#world');
    this.svg = document.querySelector('#edges');
    this.preview = document.querySelector('#nodePreview');
    this.motionButton = document.querySelector('#motionToggle');
    this.points = new Map();
    this.visible = new Map();
    this.edges = [];
    this.camera = { scale: 1, x: 0, y: 0 };
    this.dimensions = { width: 1, height: 1, worldWidth: 820, worldHeight: 520 };
    this.pauseReasons = new Set();
    this.selectedId = null;
    this.hoveredId = null;
    this.focusedId = null;
    this.previewId = null;
    this.touchPreviewId = null;
    this.gesture = null;
    this.keyboardMode = false;
    this.active = false;
    this.initialized = false;
    this.frameId = null;
    this.previousTime = null;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.coarse = matchMedia('(hover: none)');
    try { this.userPaused = localStorage.getItem('idea-atlas-motion') === 'paused'; } catch { this.userPaused = false; }
    this.bindEvents();
    this.updateMotionControl();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.graph);
    this.intersectionObserver = new IntersectionObserver(entries => {
      this.setGlobalPause('offscreen', !entries[0].isIntersecting);
    });
    this.intersectionObserver.observe(this.graph);
  }

  anchorFor(node) {
    return {
      x: 64 + node.x * (this.dimensions.worldWidth - 128),
      y: 64 + node.y * (this.dimensions.worldHeight - 136),
    };
  }

  measure() {
    const rect = this.graph.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    this.dimensions = {
      width: rect.width, height: rect.height,
      worldWidth: Math.max(820, rect.width), worldHeight: Math.max(520, rect.height),
    };
    return true;
  }

  sync(nodes, links, selectedId) {
    this.active = true;
    this.pauseReasons.delete('view');
    if (!this.measure()) return;
    const ids = new Set(nodes.map(node => node.id));
    if (this.previewId && !ids.has(this.previewId)) this.clearPreview();
    if (this.hoveredId && !ids.has(this.hoveredId)) this.hoveredId = null;
    if (this.focusedId && !ids.has(this.focusedId)) this.focusedId = null;
    for (const [id, point] of this.visible) {
      if (!ids.has(id)) {
        point.element.remove();
        this.visible.delete(id);
      }
    }
    const degree = new Map(nodes.map(node => [node.id, 0]));
    for (const link of links) {
      degree.set(link.a.id, degree.get(link.a.id) + 1);
      degree.set(link.b.id, degree.get(link.b.id) + 1);
    }
    for (const node of nodes) {
      let point = this.points.get(node.id);
      if (!point) {
        point = { node, motion: createMotion(node.id, this.anchorFor(node)) };
        this.points.set(node.id, point);
      } else {
        point.node = node;
        moveAnchor(point.motion, this.anchorFor(node));
      }
      if (!this.visible.has(node.id)) {
        point.element = this.makePoint(node);
        this.world.append(point.element);
        this.visible.set(node.id, point);
      }
      const color = this.options.colors[node.category] || this.options.colors['未分类'];
      point.element.style.setProperty('--point-color', color.color);
      point.element.style.setProperty('--core-size', (20 + Math.min(8, degree.get(node.id) * 1.5)) + 'px');
      point.element.style.setProperty('--halo-size', (48 + Math.min(24, degree.get(node.id) * 4)) + 'px');
      point.element.setAttribute('aria-label', `查看 ${node.title}`);
      point.element.querySelector('.point-label').textContent = node.title;
      point.labelWidth = Math.min(150, Math.max(40, point.element.querySelector('.point-label').scrollWidth));
      point.element.classList.toggle('is-pinned', Boolean(node.pinned));
    }
    this.edges = links.map(link => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'connection');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.dataset.source = link.a.id;
      path.dataset.target = link.b.id;
      path.style.setProperty('--edge-opacity', (.14 + link.value / 330).toFixed(2));
      return { ...link, path, bend: (hashId(link.a.id + link.b.id) % 25) - 12 };
    });
    this.svg.replaceChildren(...this.edges.map(edge => edge.path));
    this.setSelected(selectedId);
    this.updateMotionControl();
    if (!this.initialized) {
      this.initialized = true;
      this.fitView();
    } else this.updateCamera();
    this.paint();
    this.wake();
  }

  makePoint(node) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'idea-point';
    button.dataset.pointId = node.id;
    button.innerHTML = '<span class="point-halo" aria-hidden="true"></span><span class="point-orbit" aria-hidden="true"></span><span class="point-core" aria-hidden="true"></span><span class="point-label" aria-hidden="true"></span>';
    button.addEventListener('focus', () => {
      if (!this.keyboardMode) return;
      this.focusedId = node.id;
      this.clearHover();
      if (this.selectedId !== node.id) this.showPreview(node.id);
      this.updateEmphasis();
      this.paint();
    });
    button.addEventListener('blur', event => {
      if (this.preview.contains(event.relatedTarget)) return;
      this.focusedId = null;
      if (!this.hoveredId && !this.touchPreviewId) this.clearPreview();
      this.updateEmphasis();
      this.wake();
    });
    // Native buttons generate detail=0 click events for Enter/Space and AT.
    button.addEventListener('click', event => {
      if (event.detail === 0) this.open(node.id, true);
    });
    return button;
  }

  frozen(point) {
    const id = point.node.id;
    return point.node.pinned || id === this.selectedId || id === this.hoveredId || id === this.focusedId || id === this.touchPreviewId || id === this.gesture?.id;
  }

  isGloballyPaused() {
    return !this.active || this.userPaused || this.reduced.matches || this.pauseReasons.size > 0;
  }

  canAnimate() {
    return !this.isGloballyPaused() && [...this.visible.values()].some(point => !this.frozen(point));
  }

  wake() {
    if (this.frameId !== null || !this.canAnimate()) return;
    this.previousTime = null;
    this.frameId = requestAnimationFrame(time => this.frame(time));
  }

  frame(time) {
    this.frameId = null;
    if (!this.canAnimate()) { this.previousTime = null; return; }
    const elapsed = this.previousTime === null ? 0 : Math.min(.05, Math.max(0, (time - this.previousTime) / 1000));
    this.previousTime = time;
    for (const point of this.visible.values()) advanceMotion(point.motion, elapsed, this.frozen(point));
    this.paint();
    this.frameId = requestAnimationFrame(next => this.frame(next));
  }

  paint() {
    const halfHit = 22 / this.camera.scale;
    for (const point of this.visible.values()) {
      const { x, y } = point.motion.position;
      point.element.style.transform = `translate3d(${(x - halfHit).toFixed(3)}px, ${(y - halfHit).toFixed(3)}px, 0)`;
      point.element.dataset.motion = this.isGloballyPaused() || this.frozen(point) ? 'paused' : 'floating';
    }
    for (const edge of this.edges) {
      const a = this.visible.get(edge.a.id), b = this.visible.get(edge.b.id);
      if (a && b) edge.path.setAttribute('d', curveBetween(a.motion.position, b.motion.position, edge.bend));
    }
    if (this.previewId) this.positionPreview();
  }

  setGlobalPause(reason, paused) {
    if (paused) this.pauseReasons.add(reason); else this.pauseReasons.delete(reason);
    if (this.isGloballyPaused()) {
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      this.frameId = null;
      this.previousTime = null;
      this.paint();
    } else this.wake();
  }

  hide() {
    this.active = false;
    this.clearPreview();
    this.clearHover();
    this.focusedId = null;
    this.cancelGesture();
    this.setGlobalPause('view', true);
  }

  setSelected(id) {
    this.selectedId = id || null;
    if (id && this.previewId === id) this.clearPreview();
    this.updateEmphasis();
    this.paint();
    this.wake();
  }

  updateEmphasis() {
    const id = this.hoveredId || this.focusedId || this.touchPreviewId || this.selectedId;
    const nearby = new Set([id]);
    for (const edge of this.edges) {
      const active = edge.a.id === id || edge.b.id === id;
      edge.path.classList.toggle('is-related', Boolean(id && active));
      edge.path.classList.toggle('is-dim', Boolean(id && !active));
      if (active) { nearby.add(edge.a.id); nearby.add(edge.b.id); }
    }
    for (const [pointId, point] of this.visible) {
      point.element.classList.toggle('is-selected', pointId === this.selectedId);
      point.element.classList.toggle('is-hovered', pointId === this.hoveredId || pointId === this.focusedId || pointId === this.touchPreviewId);
      point.element.classList.toggle('is-neighbor', Boolean(id && pointId !== id && nearby.has(pointId)));
      point.element.classList.toggle('is-dim', Boolean(id && !nearby.has(pointId)));
      point.element.setAttribute('aria-expanded', String(pointId === this.selectedId));
    }
  }

  enterHover(id) {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
    if (this.hoveredId !== id) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
      this.clearPreview();
      this.hoveredId = id;
      this.updateEmphasis();
      this.paint();
    }
    if (this.selectedId !== id && this.previewId !== id && !this.previewTimer) {
      this.previewTimer = setTimeout(() => {
        this.previewTimer = null;
        if (this.hoveredId === id && !this.gesture) this.showPreview(id);
      }, 180);
    }
    this.wake();
  }

  leaveHover() {
    clearTimeout(this.previewTimer);
    this.previewTimer = null;
    if (this.leaveTimer) return;
    this.leaveTimer = setTimeout(() => {
      this.leaveTimer = null;
      if (this.previewHovered || this.preview.matches(':focus-within')) return;
      this.clearHover();
      if (!this.focusedId && !this.touchPreviewId) this.clearPreview();
      this.updateEmphasis();
      this.paint();
      this.wake();
    }, 160);
  }

  clearHover() {
    clearTimeout(this.previewTimer);
    clearTimeout(this.leaveTimer);
    this.previewTimer = null;
    this.leaveTimer = null;
    this.hoveredId = null;
  }

  showPreview(id) {
    const point = this.visible.get(id);
    if (!point || !this.active || this.selectedId === id) return;
    this.clearPreview();
    this.previewId = id;
    const node = point.node;
    const color = this.options.colors[node.category] || this.options.colors['未分类'];
    const connections = this.edges.filter(edge => edge.a.id === id || edge.b.id === id).length;
    this.preview.style.setProperty('--preview-color', color.color);
    this.preview.innerHTML = `<div class="preview-eyebrow"><i></i>${safe(node.category)}<span>${connections} 条相似关联</span></div><h3>${safe(node.title)}</h3><p id="previewSummary">${safe(node.summary)}</p><div class="preview-footer"><span>${safe(node.type)}</span><button type="button" id="previewOpen">查看详情 <span aria-hidden="true">↗</span></button></div>`;
    this.preview.hidden = false;
    this.preview.classList.remove('is-compact');
    point.element.setAttribute('aria-describedby', 'previewSummary');
    this.preview.querySelector('button').onclick = () => this.open(id, this.keyboardMode);
    if (this.dimensions.width < 600) {
      const y = point.motion.position.y * this.camera.scale + this.camera.y;
      const room = Math.max(y - 28 - 58, this.dimensions.height - 58 - y - 28);
      if (room < this.preview.offsetHeight) this.preview.classList.add('is-compact');
    }
    this.previewSize = { width: this.preview.offsetWidth, height: this.preview.offsetHeight };
    this.positionPreview();
    this.paint();
  }

  clearPreview() {
    if (this.previewId) this.visible.get(this.previewId)?.element.removeAttribute('aria-describedby');
    this.previewId = null;
    this.previewHovered = false;
    this.preview.hidden = true;
    this.touchPreviewId = null;
  }

  positionPreview() {
    const point = this.visible.get(this.previewId);
    if (!point || !this.previewSize) return;
    const p = point.motion.position;
    const x = p.x * this.camera.scale + this.camera.x;
    const y = p.y * this.camera.scale + this.camera.y;
    const { width, height } = this.previewSize;
    let left = x + 31;
    if (left + width > this.dimensions.width - 18) left = x - width - 31;
    left = Math.max(14, Math.min(left, this.dimensions.width - width - 14));
    let top = y - height / 2;
    top = Math.max(64, Math.min(top, this.dimensions.height - height - 65));
    // On narrow screens place the preview above/below the point, leaving the
    // point's hit target free so a second tap is always possible.
    if (this.dimensions.width < 600) {
      const above = y - 28 - 58;
      const below = this.dimensions.height - 58 - y - 28;
      top = above >= height || above > below ? y - height - 28 : y + 28;
      top = Math.max(58, Math.min(top, this.dimensions.height - height - 58));
    }
    this.preview.style.left = `${left.toFixed(2)}px`;
    this.preview.style.top = `${top.toFixed(2)}px`;
  }

  open(id, keyboard = false) {
    if (!this.visible.has(id)) return;
    this.clearPreview();
    this.clearHover();
    this.returnFocusId = keyboard ? id : null;
    this.selectedId = id;
    this.updateEmphasis();
    this.options.onOpen(id, keyboard);
    this.paint();
    this.wake();
  }

  closeSelection(restoreFocus = false) {
    const id = this.returnFocusId || this.selectedId;
    this.returnFocusId = null;
    this.selectedId = null;
    this.clearPreview();
    if (restoreFocus && id) {
      this.keyboardMode = true;
      this.visible.get(id)?.element.focus({ preventScroll: true });
    }
    this.updateEmphasis();
    this.wake();
  }

  toWorld(event) {
    const rect = this.graph.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.camera.x) / this.camera.scale,
      y: (event.clientY - rect.top - this.camera.y) / this.camera.scale,
    };
  }

  nearest(event) {
    const label = event.target?.closest?.('.point-label');
    const labelId = label?.closest('.idea-point')?.dataset.pointId;
    if (labelId && this.visible.has(labelId)) return labelId;
    const p = this.toWorld(event);
    const radius = 24 / this.camera.scale;
    let closest = null, distance = radius;
    for (const [id, point] of this.visible) {
      const d = Math.hypot(p.x - point.motion.position.x, p.y - point.motion.position.y);
      if (d < distance) { distance = d; closest = id; }
    }
    return closest;
  }

  bindEvents() {
    this.graph.addEventListener('pointermove', event => {
      if (this.gesture?.pointerId === event.pointerId) { this.moveGesture(event); return; }
      if (event.pointerType === 'touch') return;
      this.keyboardMode = false;
      const id = this.nearest(event);
      if (id) this.enterHover(id); else this.leaveHover();
    });
    this.graph.addEventListener('pointerleave', () => { if (!this.gesture) this.leaveHover(); });
    this.graph.addEventListener('pointerdown', event => this.startGesture(event));
    this.graph.addEventListener('pointerup', event => this.endGesture(event));
    this.graph.addEventListener('pointercancel', event => { if (event.pointerId === this.gesture?.pointerId) this.cancelGesture(); });
    this.graph.addEventListener('lostpointercapture', event => { if (event.pointerId === this.gesture?.pointerId) this.cancelGesture(); });
    this.graph.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) < 1) return;
      event.preventDefault();
      const rect = this.graph.getBoundingClientRect();
      this.zoomBy(Math.exp(-event.deltaY * .0015), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }, { passive: false });
    this.preview.addEventListener('pointerenter', () => {
      this.previewHovered = true;
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
      if (this.previewId) this.hoveredId = this.previewId;
    });
    this.preview.addEventListener('pointerleave', () => { this.previewHovered = false; this.leaveHover(); });
    this.preview.addEventListener('focusout', event => {
      if (!this.preview.contains(event.relatedTarget)) {
        this.focusedId = null;
        this.leaveHover();
      }
    });
    this.motionButton.addEventListener('click', () => {
      if (this.reduced.matches) { this.options.onNotice('已遵循系统“减少动态效果”偏好，仍可预览和查看详情'); return; }
      this.userPaused = !this.userPaused;
      try { localStorage.setItem('idea-atlas-motion', this.userPaused ? 'paused' : 'floating'); } catch { /* optional preference */ }
      this.updateMotionControl();
      this.setGlobalPause('user', this.userPaused);
    });
    document.addEventListener('visibilitychange', () => this.setGlobalPause('background', document.hidden));
    document.addEventListener('keydown', event => { if (['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) this.keyboardMode = true; });
    this.reduced.addEventListener('change', () => { this.updateMotionControl(); this.setGlobalPause('reduced', this.reduced.matches); });
    this.coarse.addEventListener('change', () => this.updateMotionControl());
    this.setGlobalPause('background', document.hidden);
    this.setGlobalPause('user', this.userPaused);
    this.setGlobalPause('reduced', this.reduced.matches);
  }

  updateMotionControl() {
    const stopped = this.reduced.matches || this.userPaused;
    this.motionButton.setAttribute('aria-pressed', String(stopped));
    this.motionButton.innerHTML = this.reduced.matches ? '<span aria-hidden="true">◉</span> 已减少动态' : stopped ? '<span aria-hidden="true">▷</span> 恢复浮动' : '<span aria-hidden="true">Ⅱ</span> 暂停浮动';
    this.graph.classList.toggle('motion-stopped', stopped);
    document.querySelector('#motionStatus').textContent = stopped ? '静止探索' : '缓慢浮动';
    document.querySelector('#fieldInstruction').textContent = this.coarse.matches ? '轻点光点预览 · 再次轻点查看详情' : '悬停光点，停住一个想法 · 点击深入';
    document.querySelector('#graphInstructions').textContent = this.coarse.matches ? '轻点预览，再次轻点查看详情。拖动空白平移，可切换列表浏览。' : '悬停光点或用 Tab 聚焦可暂停并预览。点击或按 Enter 查看详情。按 Escape 返回。';
  }

  startGesture(event) {
    if (event.button !== 0 || this.gesture || event.isPrimary === false) return;
    this.keyboardMode = false;
    const id = this.nearest(event);
    this.gesture = {
      pointerId: event.pointerId, pointerType: event.pointerType, id,
      clientX: event.clientX, clientY: event.clientY, moved: false,
      camera: { ...this.camera },
      position: id ? { ...this.visible.get(id).motion.position } : null,
      originalMotion: id ? structuredClone(this.visible.get(id).motion) : null,
    };
    clearTimeout(this.previewTimer);
    this.graph.setPointerCapture(event.pointerId);
    if (!id) {
      this.clearHover();
      this.clearPreview();
      this.updateEmphasis();
      this.setGlobalPause('pan', true);
    }
    this.paint();
  }

  moveGesture(event) {
    const gesture = this.gesture;
    const dx = event.clientX - gesture.clientX, dy = event.clientY - gesture.clientY;
    if (Math.hypot(dx, dy) > 6) gesture.moved = true;
    if (!gesture.moved) return;
    this.graph.classList.add('is-dragging');
    this.clearPreview();
    if (!gesture.id) {
      this.camera.x = gesture.camera.x + dx;
      this.camera.y = gesture.camera.y + dy;
      this.updateCamera();
    } else {
      const point = this.visible.get(gesture.id);
      if (!point) return;
      if (point.node.pinned) {
        if (!gesture.warned) this.options.onNotice('此光点已固定，可在详情中取消固定');
        gesture.warned = true;
        return;
      }
      point.motion.position = {
        x: Math.max(64, Math.min(this.dimensions.worldWidth - 64, gesture.position.x + dx / this.camera.scale)),
        y: Math.max(64, Math.min(this.dimensions.worldHeight - 72, gesture.position.y + dy / this.camera.scale)),
      };
    }
    this.paint();
  }

  endGesture(event) {
    if (!this.gesture || event.pointerId !== this.gesture.pointerId) return;
    const gesture = this.gesture;
    this.gesture = null;
    this.graph.classList.remove('is-dragging');
    if (this.graph.hasPointerCapture(event.pointerId)) this.graph.releasePointerCapture(event.pointerId);
    this.setGlobalPause('pan', false);
    if (gesture.moved && gesture.id) {
      const point = this.visible.get(gesture.id);
      if (point && !point.node.pinned) {
        commitPosition(point.motion, point.motion.position);
        this.options.onMove(gesture.id, {
          x: (point.motion.anchor.x - 64) / (this.dimensions.worldWidth - 128),
          y: (point.motion.anchor.y - 64) / (this.dimensions.worldHeight - 136),
        });
      }
    } else if (!gesture.moved && gesture.id) {
      if (gesture.pointerType === 'touch' && this.touchPreviewId !== gesture.id) {
        this.clearHover();
        this.showPreview(gesture.id);
        this.touchPreviewId = gesture.id;
        this.updateEmphasis();
      } else this.open(gesture.id);
    } else if (!gesture.moved) {
      this.clearHover();
      this.clearPreview();
      this.focusedId = null;
      if (this.selectedId) this.options.onClear();
      this.setSelected(null);
    }
    if (gesture.moved || gesture.pointerType !== 'touch') {
      const id = gesture.pointerType === 'touch' ? null : this.nearest(event);
      if (id) this.enterHover(id); else { this.clearHover(); this.updateEmphasis(); }
    }
    this.paint();
    this.layoutLabels();
    this.wake();
  }

  cancelGesture() {
    if (!this.gesture) return;
    const gesture = this.gesture;
    this.gesture = null;
    this.clearHover();
    this.clearPreview();
    if (gesture.id && this.visible.has(gesture.id)) this.visible.get(gesture.id).motion = gesture.originalMotion;
    if (!gesture.id) this.camera = gesture.camera;
    if (this.graph.hasPointerCapture(gesture.pointerId)) this.graph.releasePointerCapture(gesture.pointerId);
    this.graph.classList.remove('is-dragging');
    this.setGlobalPause('pan', false);
    this.updateCamera();
    this.updateEmphasis();
    this.paint();
    this.wake();
  }

  zoomBy(factor, anchor = null) {
    this.clearHover();
    this.clearPreview();
    const scale = Math.max(.35, Math.min(2.2, this.camera.scale * factor));
    this.camera = zoomCamera(this.camera, scale, anchor || { x: this.dimensions.width / 2, y: this.dimensions.height / 2 });
    this.updateCamera();
    this.updateEmphasis();
    this.paint();
    this.wake();
  }

  updateCamera() {
    const { scale, x, y } = this.camera;
    const transform = `translate(${x}px, ${y}px) scale(${scale})`;
    this.world.style.transform = transform;
    this.svg.style.transform = transform;
    this.graph.style.setProperty('--hit-size', `${44 / scale}px`);
    this.graph.style.setProperty('--inverse-scale', String(1 / scale));
    document.querySelector('#zoomLabel').textContent = Math.round(scale * 100) + '%';
    this.layoutLabels();
  }

  layoutLabels() {
    const { scale, x, y } = this.camera;
    const entries = [...this.visible].map(([id, point]) => ({
      id, x: point.motion.position.x * scale + x, y: point.motion.position.y * scale + y,
      width: point.labelWidth || 100, height: 17,
    }));
    const positions = placePointLabels(entries, this.dimensions);
    for (const [id, position] of positions) {
      const label = this.visible.get(id).element.querySelector('.point-label');
      label.style.transform = `translate(${position.x / scale}px, ${position.y / scale}px) scale(${1 / scale})`;
    }
  }

  fitView() {
    this.clearHover();
    this.clearPreview();
    const d = this.dimensions;
    const scale = Math.min(1, d.width / d.worldWidth, d.height / d.worldHeight);
    this.camera = { scale, x: (d.width - d.worldWidth * scale) / 2, y: (d.height - d.worldHeight * scale) / 2 };
    this.updateCamera();
    this.updateEmphasis();
    this.paint();
    this.wake();
  }

  commitCurrentPosition(id) {
    const point = this.visible.get(id);
    if (!point) return;
    commitPosition(point.motion, point.motion.position);
    this.options.onMove(id, {
      x: (point.motion.anchor.x - 64) / (this.dimensions.worldWidth - 128),
      y: (point.motion.anchor.y - 64) / (this.dimensions.worldHeight - 136),
    });
  }

  resize() {
    if (!this.active || !this.measure()) return;
    for (const point of this.points.values()) moveAnchor(point.motion, this.anchorFor(point.node));
    this.clearHover();
    this.clearPreview();
    this.fitView();
    this.wake();
  }

  setModal(open) {
    if (open) { this.clearHover(); this.clearPreview(); this.updateEmphasis(); }
    this.setGlobalPause('modal', open);
  }
}
