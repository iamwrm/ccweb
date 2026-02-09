// ── Shared types ──

export interface TerminalTabInfo {
  id: string;
  label: string;
}

export type SplitPlacement = 'before' | 'after';

// ── Tile layout types ──

export type TileNode =
  | { type: 'terminal'; terminalId: string }
  | { type: 'editor'; filePath: string }
  | { type: 'split'; direction: 'horizontal' | 'vertical'; children: [TileNode, TileNode] };

// ── Identity helpers ──

/** Get a unique ID for a leaf node (terminalId or filePath). */
export function leafId(node: TileNode): string | null {
  if (node.type === 'terminal') return node.terminalId;
  if (node.type === 'editor') return node.filePath;
  return null;
}

// ── Tree queries ──

/** Check if a leaf with the given ID exists in the tree. */
export function existsInTile(layout: TileNode, id: string): boolean {
  if (layout.type === 'split') {
    return existsInTile(layout.children[0], id) || existsInTile(layout.children[1], id);
  }
  return leafId(layout) === id;
}

/** Find a leaf node by its ID. */
export function findInTile(layout: TileNode, id: string): TileNode | null {
  if (layout.type === 'split') {
    return findInTile(layout.children[0], id) || findInTile(layout.children[1], id);
  }
  return leafId(layout) === id ? layout : null;
}

/** Collect all terminal IDs in the tree. */
export function collectTerminalIds(layout: TileNode): Set<string> {
  if (layout.type === 'terminal') return new Set([layout.terminalId]);
  if (layout.type === 'editor') return new Set();
  const left = collectTerminalIds(layout.children[0]);
  const right = collectTerminalIds(layout.children[1]);
  for (const id of right) left.add(id);
  return left;
}

/** Collect all editor file paths in the tree. */
export function collectEditorPaths(layout: TileNode): Set<string> {
  if (layout.type === 'editor') return new Set([layout.filePath]);
  if (layout.type === 'terminal') return new Set();
  const left = collectEditorPaths(layout.children[0]);
  const right = collectEditorPaths(layout.children[1]);
  for (const p of right) left.add(p);
  return left;
}

/** Count total leaf nodes in the tree. */
export function countLeaves(layout: TileNode): number {
  if (layout.type === 'split') {
    return countLeaves(layout.children[0]) + countLeaves(layout.children[1]);
  }
  return 1;
}

// ── Tree mutations (immutable) ──

/** Replace a leaf identified by id with a new subtree. */
export function replaceInTile(layout: TileNode, id: string, replacement: TileNode): TileNode {
  if (layout.type === 'split') {
    return {
      ...layout,
      children: [
        replaceInTile(layout.children[0], id, replacement),
        replaceInTile(layout.children[1], id, replacement),
      ],
    };
  }
  return leafId(layout) === id ? replacement : layout;
}

/** Remove a leaf by id. Returns the pruned tree, or null if the tree becomes empty. */
export function removeFromTile(layout: TileNode, id: string): TileNode | null {
  if (layout.type !== 'split') {
    return leafId(layout) === id ? null : layout;
  }
  const left = removeFromTile(layout.children[0], id);
  const right = removeFromTile(layout.children[1], id);
  if (!left && !right) return null;
  if (!left) return right;
  if (!right) return left;
  return { ...layout, children: [left, right] };
}

/** Split a leaf by wrapping it in a split node with a new sibling. */
export function splitAtTile(
  layout: TileNode,
  targetId: string,
  newNode: TileNode,
  direction: 'horizontal' | 'vertical',
): TileNode {
  return splitAtTileWithPlacement(layout, targetId, newNode, direction, 'after');
}

/** Split a leaf with explicit placement for the new sibling. */
export function splitAtTileWithPlacement(
  layout: TileNode,
  targetId: string,
  newNode: TileNode,
  direction: 'horizontal' | 'vertical',
  placement: SplitPlacement,
): TileNode {
  const targetNode = findInTile(layout, targetId) || { type: 'terminal', terminalId: targetId } as TileNode;
  const children = placement === 'before'
    ? [newNode, targetNode]
    : [targetNode, newNode];
  const splitNode: TileNode = {
    type: 'split',
    direction,
    children: children as [TileNode, TileNode],
  };
  return replaceInTile(layout, targetId, splitNode);
}

/** Swap two leaves in the tree. */
export function swapTiles(layout: TileNode, idA: string, idB: string): TileNode {
  const nodeA = findInTile(layout, idA);
  const nodeB = findInTile(layout, idB);
  if (!nodeA || !nodeB) return layout;

  // Swap by replacing A with B then B with A (using temp placeholder)
  const placeholder: TileNode = { type: 'terminal', terminalId: '__swap_placeholder__' };
  let result = replaceInTile(layout, idA, placeholder);
  result = replaceInTile(result, idB, nodeA);
  result = replaceInTile(result, '__swap_placeholder__', nodeB);
  return result;
}

/** Get a list of all leaf IDs in the tree. */
export function getAllLeafIds(layout: TileNode): string[] {
  if (layout.type === 'split') {
    return [...getAllLeafIds(layout.children[0]), ...getAllLeafIds(layout.children[1])];
  }
  const id = leafId(layout);
  return id ? [id] : [];
}
