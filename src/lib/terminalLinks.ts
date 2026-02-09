import type { Terminal, ILinkProvider, ILink } from '@xterm/xterm';

// Match file paths: relative (src/foo.ts, ./lib/api.ts) and absolute (/home/user/foo.ts)
// Optionally with :line or :line:col suffix
const FILE_PATH_RE = /(?:^|[\s'"(=])((\.{0,2}\/)?[\w.@-]+(?:\/[\w.@-]+)*\.[a-zA-Z]{1,10}(?::\d+(?::\d+)?)?)/g;

const KNOWN_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'pyw', 'json', 'jsonc',
  'html', 'htm', 'css', 'scss', 'less',
  'md', 'markdown', 'mdx',
  'rs', 'yml', 'yaml',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
  'java', 'xml', 'svg', 'xsl',
  'sql', 'php', 'go',
  'toml', 'ini', 'cfg', 'conf',
  'sh', 'bash', 'zsh',
  'txt', 'log', 'csv',
  'vue', 'svelte', 'astro',
  'lock', 'env',
]);

export interface FilePathMatch {
  path: string;
  startCol: number;
  endCol: number;
}

export function parseFilePathMatches(lineText: string): FilePathMatch[] {
  const matches: FilePathMatch[] = [];

  FILE_PATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FILE_PATH_RE.exec(lineText)) !== null) {
    const fullMatch = m[1];
    const matchStart = m.index + (m[0].length - m[1].length);

    // Strip :line:col to get file path and extension
    const colonParts = fullMatch.split(':');
    const filePath = colonParts[0];

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    if (!KNOWN_EXTENSIONS.has(ext)) continue;

    matches.push({
      path: filePath,
      startCol: matchStart,
      endCol: matchStart + fullMatch.length,
    });
  }

  return matches;
}

export function createFileLinkProvider(
  terminal: Terminal,
  onOpenFile: (filePath: string) => void,
): ILinkProvider {
  return {
    provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
      const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
      if (!line) {
        callback(undefined);
        return;
      }

      const lineText = line.translateToString(true);
      const matches = parseFilePathMatches(lineText);

      if (matches.length === 0) {
        callback(undefined);
        return;
      }

      const links: ILink[] = matches.map(match => ({
        range: {
          start: { x: match.startCol + 1, y: bufferLineNumber },
          end: { x: match.endCol + 1, y: bufferLineNumber },
        },
        text: match.path,
        decorations: {
          pointerCursor: true,
          underline: true,
        },
        activate(_event: MouseEvent, text: string) {
          onOpenFile(text);
        },
      }));

      callback(links);
    },
  };
}
