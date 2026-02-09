import { describe, it, expect } from 'vitest';
import {
  splitAtTile,
  splitAtTileWithPlacement,
  removeFromTile,
  swapTiles,
  findInTile,
  collectTerminalIds,
  collectEditorPaths,
  countLeaves,
  getAllLeafIds,
  existsInTile,
  type TileNode,
} from '../lib/tileLayout';

describe('tileLayout', () => {
  const singleTerminal: TileNode = { type: 'terminal', terminalId: 't1' };

  describe('splitAtTile', () => {
    it('splits a terminal vertically (top/bottom) when direction is vertical', () => {
      // This is what the ━ button should produce: direction='vertical' → stacked panels
      const result = splitAtTile(singleTerminal, 't1', { type: 'terminal', terminalId: 't2' }, 'vertical');
      expect(result).toEqual({
        type: 'split',
        direction: 'vertical',
        children: [
          { type: 'terminal', terminalId: 't1' },
          { type: 'terminal', terminalId: 't2' },
        ],
      });
    });

    it('splits a terminal horizontally (left/right) when direction is horizontal', () => {
      // This is what the ┃ button should produce: direction='horizontal' → side-by-side panels
      const result = splitAtTile(singleTerminal, 't1', { type: 'terminal', terminalId: 't2' }, 'horizontal');
      expect(result).toEqual({
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'terminal', terminalId: 't1' },
          { type: 'terminal', terminalId: 't2' },
        ],
      });
    });

    it('splits a nested terminal in an existing split', () => {
      const layout: TileNode = {
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'terminal', terminalId: 't1' },
          { type: 'terminal', terminalId: 't2' },
        ],
      };
      const result = splitAtTile(layout, 't2', { type: 'terminal', terminalId: 't3' }, 'vertical');
      expect(result.type).toBe('split');
      if (result.type !== 'split') return;
      expect(result.direction).toBe('horizontal');
      // t2 should now be replaced with a vertical split containing t2 and t3
      const rightChild = result.children[1];
      expect(rightChild).toEqual({
        type: 'split',
        direction: 'vertical',
        children: [
          { type: 'terminal', terminalId: 't2' },
          { type: 'terminal', terminalId: 't3' },
        ],
      });
    });

    it('can split to add an editor pane next to a terminal', () => {
      const result = splitAtTile(singleTerminal, 't1', { type: 'editor', filePath: '/foo.ts' }, 'horizontal');
      expect(result).toEqual({
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'terminal', terminalId: 't1' },
          { type: 'editor', filePath: '/foo.ts' },
        ],
      });
    });

    it('can place the new pane before the target when requested', () => {
      const result = splitAtTileWithPlacement(
        singleTerminal,
        't1',
        { type: 'terminal', terminalId: 't0' },
        'horizontal',
        'before',
      );
      expect(result).toEqual({
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'terminal', terminalId: 't0' },
          { type: 'terminal', terminalId: 't1' },
        ],
      });
    });
  });

  describe('removeFromTile', () => {
    it('returns null when removing the only node', () => {
      expect(removeFromTile(singleTerminal, 't1')).toBeNull();
    });

    it('returns sibling when removing one child of a split', () => {
      const layout: TileNode = {
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'terminal', terminalId: 't1' },
          { type: 'terminal', terminalId: 't2' },
        ],
      };
      expect(removeFromTile(layout, 't1')).toEqual({ type: 'terminal', terminalId: 't2' });
    });

    it('preserves unrelated nodes', () => {
      expect(removeFromTile(singleTerminal, 'nonexistent')).toEqual(singleTerminal);
    });
  });

  describe('swapTiles', () => {
    it('swaps two terminals in a split', () => {
      const layout: TileNode = {
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'terminal', terminalId: 't1' },
          { type: 'terminal', terminalId: 't2' },
        ],
      };
      const result = swapTiles(layout, 't1', 't2');
      expect(result.type).toBe('split');
      if (result.type !== 'split') return;
      expect(result.children[0]).toEqual({ type: 'terminal', terminalId: 't2' });
      expect(result.children[1]).toEqual({ type: 'terminal', terminalId: 't1' });
    });
  });

  describe('tree queries', () => {
    const complexLayout: TileNode = {
      type: 'split',
      direction: 'horizontal',
      children: [
        {
          type: 'split',
          direction: 'vertical',
          children: [
            { type: 'terminal', terminalId: 't1' },
            { type: 'editor', filePath: '/a.ts' },
          ],
        },
        { type: 'terminal', terminalId: 't2' },
      ],
    };

    it('findInTile finds leaves', () => {
      expect(findInTile(complexLayout, 't1')).toEqual({ type: 'terminal', terminalId: 't1' });
      expect(findInTile(complexLayout, '/a.ts')).toEqual({ type: 'editor', filePath: '/a.ts' });
      expect(findInTile(complexLayout, 'nonexistent')).toBeNull();
    });

    it('existsInTile checks existence', () => {
      expect(existsInTile(complexLayout, 't1')).toBe(true);
      expect(existsInTile(complexLayout, 't2')).toBe(true);
      expect(existsInTile(complexLayout, '/a.ts')).toBe(true);
      expect(existsInTile(complexLayout, 'nope')).toBe(false);
    });

    it('collectTerminalIds returns all terminal IDs', () => {
      expect(collectTerminalIds(complexLayout)).toEqual(new Set(['t1', 't2']));
    });

    it('collectEditorPaths returns all editor paths', () => {
      expect(collectEditorPaths(complexLayout)).toEqual(new Set(['/a.ts']));
    });

    it('countLeaves counts all leaves', () => {
      expect(countLeaves(complexLayout)).toBe(3);
      expect(countLeaves(singleTerminal)).toBe(1);
    });

    it('getAllLeafIds returns IDs in order', () => {
      expect(getAllLeafIds(complexLayout)).toEqual(['t1', '/a.ts', 't2']);
    });
  });
});
