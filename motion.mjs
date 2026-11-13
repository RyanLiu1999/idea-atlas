// Visual motion is separate from the user's saved layout. Time only advances
// while this particular point is free to move, so pause/resume never jumps.
export function hashId(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createMotion(id, anchor) {
  const seed = hashId(id);
  return {
    anchor: { ...anchor },
    position: { ...anchor },
    time: 0,
    phaseX: (seed % 628) / 100,
    phaseY: ((seed >>> 8) % 628) / 100,
    amplitudeX: 3.2 + (seed % 20) / 10,
    amplitudeY: 2.7 + ((seed >>> 5) % 18) / 10,
    periodX: 19 + (seed % 17),
    periodY: 23 + ((seed >>> 9) % 19),
  };
}

export function motionOffset(motion) {
  return {
    x: motion.amplitudeX * (Math.sin(motion.phaseX + motion.time * Math.PI * 2 / motion.periodX) - Math.sin(motion.phaseX)),
    y: motion.amplitudeY * (Math.sin(motion.phaseY + motion.time * Math.PI * 2 / motion.periodY) - Math.sin(motion.phaseY)),
  };
}

export function advanceMotion(motion, elapsed, paused = false) {
  if (paused) return motion.position;
  motion.time += Math.max(0, elapsed);
  const offset = motionOffset(motion);
  motion.position.x = motion.anchor.x + offset.x;
  motion.position.y = motion.anchor.y + offset.y;
  return motion.position;
}

export function moveAnchor(motion, anchor) {
  const offset = { x: motion.position.x - motion.anchor.x, y: motion.position.y - motion.anchor.y };
  motion.anchor = { ...anchor };
  motion.position = { x: anchor.x + offset.x, y: anchor.y + offset.y };
}

export function commitPosition(motion, position) {
  motion.anchor = { ...position };
  motion.position = { ...position };
  motion.time = 0;
}

export function zoomCamera(camera, nextScale, screenAnchor) {
  const world = {
    x: (screenAnchor.x - camera.x) / camera.scale,
    y: (screenAnchor.y - camera.y) / camera.scale,
  };
  return { scale: nextScale, x: screenAnchor.x - nextScale * world.x, y: screenAnchor.y - nextScale * world.y };
}

export function curveBetween(a, b, bend = 0) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return '';
  const cx = (a.x + b.x) / 2 - dy / length * bend;
  const cy = (a.y + b.y) / 2 + dx / length * bend;
  return `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} Q ${cx.toFixed(3)} ${cy.toFixed(3)} ${b.x.toFixed(3)} ${b.y.toFixed(3)}`;
}

// Only new ideas receive a vacant anchor. Never rearrange existing ideas to
// create room: their saved positions are part of the user's spatial memory.
export function chooseOpenPosition(nodes, origin = { x: .44, y: .44 }) {
  let best = origin, clearance = -1;
  for (let index = 0; index < 160; index++) {
    const radius = .033 * Math.sqrt(index);
    const angle = index * 2.399963229728653;
    const candidate = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius };
    if (candidate.x < .07 || candidate.x > .93 || candidate.y < .07 || candidate.y > .91) continue;
    const distance = nodes.length ? Math.min(...nodes.map(node => Math.hypot((candidate.x - node.x) * 692, (candidate.y - node.y) * 384))) : Infinity;
    if (distance >= 62) return candidate;
    if (distance > clearance) { best = candidate; clearance = distance; }
  }
  return best;
}

export function placePointLabels(points, bounds) {
  const placed = [];
  const result = new Map();
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  for (const point of points) {
    const w = point.width, h = point.height;
    const choices = [[15, -h / 2], [-w - 15, -h / 2], [-w / 2, -h - 14], [-w / 2, 14], [15, -h - 13], [15, 12], [-w - 15, -h - 13], [-w - 15, 12], [-w / 2, -h - 30], [-w / 2, 30], [15, -h - 36], [-w - 15, -h - 36], [15, 34], [-w - 15, 34], [-w / 2, -h - 52], [-w / 2, 52]];
    let best = null;
    for (let index = 0; index < choices.length; index++) {
      const [dx, dy] = choices[index];
      const rect = { x: point.x + dx, y: point.y + dy, width: w, height: h };
      const expanded = { x: rect.x - 5, y: rect.y - 5, width: w + 10, height: h + 10 };
      const collision = placed.reduce((sum, item) => sum + overlap(expanded, item), 0) + points.filter(item => item.id !== point.id).reduce((sum, item) => sum + overlap(expanded, { x: item.x - 8, y: item.y - 8, width: 16, height: 16 }), 0);
      const visibleArea = overlap(rect, { x: 10, y: 62, width: bounds.width - 20, height: bounds.height - 125 });
      const score = collision * 1000 + (w * h - visibleArea) * 2000 + index;
      if (!best || score < best.score) best = { dx, dy, score, rect };
    }
    placed.push(best.rect);
    result.set(point.id, { x: best.dx, y: best.dy });
  }
  return result;
}
