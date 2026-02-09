import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { type LanguageSupport, HighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { yaml } from '@codemirror/lang-yaml';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { php } from '@codemirror/lang-php';
import { go } from '@codemirror/lang-go';
import { saveFile } from '../lib/api';
import { useTheme } from '../lib/theme';
import './FileViewer.css';

export interface OpenFile {
  path: string;
  content: string;
  extension: string;
}

interface FileViewerProps {
  file: OpenFile;
  onClose: () => void;
  onSave?: (newContent: string) => void;
  root?: string;
}

const ccwebThemeRules = {
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
};

const ccwebDarkTheme = EditorView.theme(ccwebThemeRules, { dark: true });
const ccwebLightTheme = EditorView.theme(ccwebThemeRules, { dark: false });

const ccwebLightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#d32f2f' },
  { tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: '#1a1a1a' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: '#6a1b9a' },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: '#795548' },
  { tag: [tags.definition(tags.name), tags.separator], color: '#1a1a1a' },
  { tag: [tags.typeName, tags.className, tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: '#e65100' },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp, tags.link, tags.special(tags.string)], color: '#0277bd' },
  { tag: [tags.meta, tags.comment], color: '#8e8e8e', fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#0277bd', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#d32f2f' },
  { tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: '#795548' },
  { tag: [tags.processingInstruction, tags.string, tags.inserted], color: '#2e7d32' },
  { tag: tags.invalid, color: '#cd2b31' },
]);

function getLanguage(ext: string): LanguageSupport | null {
  switch (ext) {
    case 'ts': case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'js': case 'jsx': case 'mjs': case 'cjs': return javascript({ jsx: true });
    case 'py': case 'pyw': return python();
    case 'json': case 'jsonc': return json();
    case 'html': case 'htm': return html();
    case 'css': case 'scss': case 'less': return css();
    case 'md': case 'markdown': case 'mdx': return markdown();
    case 'rs': return rust();
    case 'yml': case 'yaml': return yaml();
    case 'c': case 'cpp': case 'cc': case 'cxx': case 'h': case 'hpp': return cpp();
    case 'java': return java();
    case 'xml': case 'svg': case 'xsl': case 'xsd': return xml();
    case 'sql': return sql();
    case 'php': return php();
    case 'go': return go();
    default: return null;
  }
}

export function FileViewer({ file, onClose, onSave, root }: FileViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { theme } = useTheme();

  const handleSave = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;

    const content = view.state.doc.toString();
    setSaveStatus('saving');

    try {
      await saveFile(file.path, content, root);
      setIsDirty(false);
      setSaveStatus('saved');
      onSave?.(content);
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(prev => prev === 'error' ? 'idle' : prev), 3000);
    }
  }, [file.path, root, onSave]);

  useEffect(() => {
    setIsDirty(false);
    setSaveStatus('idle');
  }, [file.path]);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      foldGutter(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...closeBracketsKeymap,
        indentWithTab,
      ]),
      Prec.highest(keymap.of([{
        key: 'Mod-s',
        run: () => { handleSave(); return true; },
      }])),
      EditorView.updateListener.of(update => {
        if (update.docChanged) setIsDirty(true);
      }),
      theme === 'dark' ? ccwebDarkTheme : ccwebLightTheme,
      ...(theme === 'dark' ? [oneDark] : [syntaxHighlighting(ccwebLightHighlight)]),
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

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [file.path, file.content, file.extension, theme, handleSave]);

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <span className="file-viewer-path">
          {file.path}
          {isDirty && <span className="file-viewer-dirty"> (modified)</span>}
        </span>
        <div className="file-viewer-header-right">
          {saveStatus === 'saving' && <span className="file-viewer-status">Saving...</span>}
          {saveStatus === 'saved' && <span className="file-viewer-status saved">Saved</span>}
          {saveStatus === 'error' && <span className="file-viewer-status error">Save failed</span>}
          <button className="file-viewer-close" onClick={onClose} title="Close">
            &times;
          </button>
        </div>
      </div>
      <div className="file-viewer-content" ref={containerRef} />
    </div>
  );
}
