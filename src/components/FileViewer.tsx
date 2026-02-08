import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { type LanguageSupport } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import './FileViewer.css';

export interface OpenFile {
  path: string;
  content: string;
  extension: string;
}

interface FileViewerProps {
  file: OpenFile;
  onClose: () => void;
}

const ccwebTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    height: '100%',
    fontSize: 'var(--text-sm)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-tertiary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-hover)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-hover)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
}, { dark: true });

function getLanguage(ext: string): LanguageSupport | null {
  switch (ext) {
    case 'ts': case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'js': case 'jsx': case 'mjs': return javascript({ jsx: true });
    case 'py': return python();
    case 'json': return json();
    case 'html': case 'htm': return html();
    case 'css': case 'scss': return css();
    case 'md': case 'markdown': return markdown();
    case 'rs': return rust();
    default: return null;
  }
}

export function FileViewer({ file, onClose }: FileViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      ccwebTheme,
      oneDark,
    ];

    const lang = getLanguage(file.extension);
    if (lang) extensions.push(lang);

    const state = EditorState.create({
      doc: file.content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => view.destroy();
  }, [file.path, file.content, file.extension]);

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <span className="file-viewer-path">{file.path}</span>
        <button className="file-viewer-close" onClick={onClose} title="Close">
          &times;
        </button>
      </div>
      <div className="file-viewer-content" ref={containerRef} />
    </div>
  );
}
