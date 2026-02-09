import type { ReactElement } from 'react';

// ── Color palette (inspired by material icon theme) ──

const C = {
  ts: '#3178c6',
  js: '#f0db4f',
  py: '#3572a5',
  rust: '#dea584',
  go: '#00add8',
  json: '#cbcb41',
  html: '#e44d26',
  css: '#563d7c',
  md: '#519aba',
  yaml: '#cb171e',
  java: '#b07219',
  cpp: '#f34b7d',
  php: '#777bb3',
  sql: '#e38c00',
  xml: '#0060ac',
  git: '#f05032',
  docker: '#2496ed',
  npm: '#cb3837',
  folder: '#90a4ae',
  folderOpen: '#78909c',
  file: '#78909c',
  config: '#6d8086',
  shell: '#4eaa25',
  svg: '#ffb13b',
  vue: '#41b883',
  svelte: '#ff3e00',
  lock: '#6d8086',
  env: '#ecd53f',
  txt: '#78909c',
  image: '#a074c4',
  toml: '#9c4121',
};

// ── SVG icon builders ──

function textIcon(bg: string, text: string, fg = '#fff'): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="14" height="14" rx="2" fill={bg} />
      <text x="8" y="11.5" textAnchor="middle" fill={fg} fontSize="8" fontWeight="bold" fontFamily="Inter,system-ui,sans-serif">{text}</text>
    </svg>
  );
}

function fileDocIcon(color: string): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 1.5h5.5L13 5v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 14V3A1.5 1.5 0 0 1 4.5 1.5z" fill="none" stroke={color} strokeWidth="1" />
      <path d="M9.5 1.5V5H13" fill="none" stroke={color} strokeWidth="1" />
    </svg>
  );
}

function folderIcon(open: boolean): ReactElement {
  const color = open ? C.folderOpen : C.folder;
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.5l1.5 2H13A1.5 1.5 0 0 1 14.5 5v1H4l-2.5 7V3z" fill={color} opacity="0.9" />
        <path d="M1.5 13l2.5-7h11l-2.5 7h-11z" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.5l1.5 2H13A1.5 1.5 0 0 1 14.5 5v7.5a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12.5V3z" fill={color} />
    </svg>
  );
}

// ── Extension → icon mapping ──

const EXT_ICONS: Record<string, () => ReactElement> = {
  ts: () => textIcon(C.ts, 'TS'),
  tsx: () => textIcon(C.ts, 'TX'),
  js: () => textIcon(C.js, 'JS', '#333'),
  jsx: () => textIcon(C.js, 'JX', '#333'),
  mjs: () => textIcon(C.js, 'JS', '#333'),
  cjs: () => textIcon(C.js, 'JS', '#333'),
  json: () => textIcon(C.json, '{ }', '#333'),
  jsonc: () => textIcon(C.json, '{ }', '#333'),
  py: () => textIcon(C.py, 'PY'),
  pyw: () => textIcon(C.py, 'PY'),
  rs: () => textIcon(C.rust, 'RS'),
  go: () => textIcon(C.go, 'GO', '#fff'),
  html: () => textIcon(C.html, '<>'),
  htm: () => textIcon(C.html, '<>'),
  css: () => textIcon(C.css, '#', '#fff'),
  scss: () => textIcon(C.css, 'S#', '#fff'),
  less: () => textIcon(C.css, 'LS', '#fff'),
  md: () => textIcon(C.md, 'M', '#fff'),
  mdx: () => textIcon(C.md, 'MX'),
  markdown: () => textIcon(C.md, 'M', '#fff'),
  yaml: () => textIcon(C.yaml, 'YA'),
  yml: () => textIcon(C.yaml, 'YA'),
  java: () => textIcon(C.java, 'JA'),
  cpp: () => textIcon(C.cpp, '++'),
  cc: () => textIcon(C.cpp, 'C'),
  cxx: () => textIcon(C.cpp, 'C'),
  c: () => textIcon(C.cpp, 'C'),
  h: () => textIcon(C.cpp, 'H'),
  hpp: () => textIcon(C.cpp, 'H'),
  xml: () => textIcon(C.xml, '<>'),
  xsl: () => textIcon(C.xml, '<>'),
  sql: () => textIcon(C.sql, 'SQ'),
  php: () => textIcon(C.php, 'PH'),
  svg: () => textIcon(C.svg, 'SV', '#333'),
  vue: () => textIcon(C.vue, 'V'),
  svelte: () => textIcon(C.svelte, 'S'),
  astro: () => textIcon('#ff5d01', 'A'),
  toml: () => textIcon(C.toml, 'TL'),
  ini: () => textIcon(C.config, 'IN'),
  cfg: () => textIcon(C.config, 'CF'),
  conf: () => textIcon(C.config, 'CF'),
  sh: () => textIcon(C.shell, '$'),
  bash: () => textIcon(C.shell, '$'),
  zsh: () => textIcon(C.shell, '$'),
  fish: () => textIcon(C.shell, '$'),
  env: () => textIcon(C.env, 'EN', '#333'),
  txt: () => fileDocIcon(C.txt),
  log: () => fileDocIcon(C.txt),
  csv: () => fileDocIcon(C.txt),
  lock: () => fileDocIcon(C.lock),
  png: () => textIcon(C.image, 'PN'),
  jpg: () => textIcon(C.image, 'JP'),
  jpeg: () => textIcon(C.image, 'JP'),
  gif: () => textIcon(C.image, 'GI'),
  webp: () => textIcon(C.image, 'WP'),
  ico: () => textIcon(C.image, 'IC'),
};

// ── Special filename → icon mapping ──

const NAME_ICONS: Record<string, () => ReactElement> = {
  'package.json': () => textIcon(C.npm, 'NP'),
  'package-lock.json': () => textIcon(C.npm, 'NP'),
  'tsconfig.json': () => textIcon(C.ts, 'TS'),
  'tsconfig.node.json': () => textIcon(C.ts, 'TS'),
  '.gitignore': () => textIcon(C.git, 'GI'),
  '.gitattributes': () => textIcon(C.git, 'GA'),
  'Dockerfile': () => textIcon(C.docker, 'DK'),
  'docker-compose.yml': () => textIcon(C.docker, 'DC'),
  'docker-compose.yaml': () => textIcon(C.docker, 'DC'),
  '.dockerignore': () => textIcon(C.docker, 'DI'),
  '.env': () => textIcon(C.env, 'EN', '#333'),
  '.env.local': () => textIcon(C.env, 'EN', '#333'),
  '.env.development': () => textIcon(C.env, 'EN', '#333'),
  '.env.production': () => textIcon(C.env, 'EN', '#333'),
  '.eslintrc.json': () => textIcon('#4b32c3', 'ES'),
  '.eslintrc.js': () => textIcon('#4b32c3', 'ES'),
  '.prettierrc': () => textIcon('#56b3b4', 'PR'),
  '.prettierrc.json': () => textIcon('#56b3b4', 'PR'),
  'vite.config.ts': () => textIcon('#646cff', 'VI'),
  'vite.config.js': () => textIcon('#646cff', 'VI'),
  'vitest.config.ts': () => textIcon('#729b1b', 'VT'),
  'vitest.config.js': () => textIcon('#729b1b', 'VT'),
  'Makefile': () => textIcon(C.config, 'MK'),
  'LICENSE': () => fileDocIcon(C.config),
  'README.md': () => textIcon(C.md, 'RM'),
  'CLAUDE.md': () => textIcon('#cc785c', 'CL'),
  'Cargo.toml': () => textIcon(C.rust, 'CG'),
  'Cargo.lock': () => textIcon(C.rust, 'CG'),
  'go.mod': () => textIcon(C.go, 'GM'),
  'go.sum': () => textIcon(C.go, 'GS'),
};

// ── Public API ──

export function getFileIcon(
  filename: string,
  type: 'file' | 'directory',
  isExpanded?: boolean,
): ReactElement {
  if (type === 'directory') {
    return folderIcon(!!isExpanded);
  }

  // Check exact filename first
  const nameIcon = NAME_ICONS[filename];
  if (nameIcon) return nameIcon();

  // Then check extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const extIcon = EXT_ICONS[ext];
  if (extIcon) return extIcon();

  // Generic file fallback
  return fileDocIcon(C.file);
}
