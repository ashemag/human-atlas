import { SYSTEMS, type Part, type SystemId } from "./anatomy.ts";

/** Separate complete systems with a clear gap between their source bounds. */
export function createSystemSeparationLayout(parts: Part[]) {
  const groups = new Map<SystemId, { min: number; max: number }>();
  let minY = Infinity, maxY = -Infinity, depth = 0;
  for (const part of parts) {
    const group = groups.get(part.system) ?? { min: Infinity, max: -Infinity };
    group.min = Math.min(group.min, part.bounds[0][0]);
    group.max = Math.max(group.max, part.bounds[1][0]);
    groups.set(part.system, group);
    minY = Math.min(minY, part.bounds[0][1]);
    maxY = Math.max(maxY, part.bounds[1][1]);
    depth = Math.max(depth, Math.abs(part.bounds[0][2]), Math.abs(part.bounds[1][2]));
  }
  const gap = 0.025;
  const width = [...groups.values()].reduce((sum, group) => sum + group.max - group.min, 0) + Math.max(0, groups.size - 1) * gap;
  const offsets = new Map<SystemId, number>();
  let x = -width / 2;
  for (const { id } of SYSTEMS) {
    const group = groups.get(id);
    if (!group) continue;
    offsets.set(id, x - group.min);
    x += group.max - group.min + gap;
  }
  return { offsets, width, height: parts.length ? 2 * Math.max(Math.abs(minY - 0.85), Math.abs(maxY - 0.85)) : 0, depth: depth * 2 };
}
export interface LayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Pack only visible source meshes. Every projected bounding box gets its own cell. */
export function createExplosionLayout(parts: Part[], aspect = 1) {
  const cards = parts.map((p) => ({
    id: p.id,
    system: p.system,
    width: Math.max(0.035, p.bounds[1][0] - p.bounds[0][0]) + 0.04,
    height: Math.max(0.035, p.bounds[1][1] - p.bounds[0][1]) + 0.04,
  }));
  const area = cards.reduce((n, c) => n + c.width * c.height, 0),
    maxWidth = Math.max(0.3, ...cards.map((c) => c.width));
  const targetWidth = Math.max(
    maxWidth,
    Math.sqrt(area * Math.max(0.5, Math.min(1.5, aspect))) * 1.18,
  );
  cards.sort((a, b) => b.height - a.height || a.id.localeCompare(b.id));
  const cells = new Map<string, LayoutCell>();
  let x = 0,
    y = 0,
    row = 0,
    usedWidth = 0;
  for (const c of cards) {
    if (x > 0 && x + c.width > targetWidth) {
      x = 0;
      y += row;
      row = 0;
    }
    cells.set(c.id, { x: x + c.width / 2, y: -y - c.height / 2, width: c.width, height: c.height });
    x += c.width;
    usedWidth = Math.max(usedWidth, x);
    row = Math.max(row, c.height);
  }
  const height = y + row;
  cells.forEach((c) => {
    c.x -= usedWidth / 2;
    c.y += height / 2;
  });
  return { cells, width: usedWidth, height };
}
