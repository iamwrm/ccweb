import { useEffect, useRef, useState, useCallback, type DragEvent as ReactDragEvent } from 'react';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { vim, Vim } from '@replit/codemirror-vim';
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
import { PaneHeader } from './PaneHeader';
import './FileViewer.css';

export interface OpenFile {
  path: string;
  content: string;
  extension: string;
}

interface EditorPaneProps {
  paneId: string;
  file: OpenFile;
  filePath: string;
  tabs: Array<{ id: string; path: string; pinned: boolean }>;
  activeTabId: string;
  isActive: boolean;
  canClose: boolean;
  cwd?: string;
  vimMode: boolean;
  onToggleVim: () => void;
  onSave: (content: string) => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onClose: () => void;
  onFocus: () => void;
  onSplitH?: () => void;
  onSplitV?: () => void;
  onDrop?: (fromId: string, position: 'center' | 'left' | 'right' | 'top' | 'bottom') => void;
  onOpenFile: (filePath: string) => void;
}

const EDITOR_TAB_DND_MIME = 'application/x-ccweb-editor-tab';

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

// Register vim :w and :wq commands once
let vimCommandsRegistered = false;
function registerVimCommands() {
  if (vimCommandsRegistered) return;
  vimCommandsRegistered = true;
  Vim.defineEx('write', 'w', (cm: { cm6: EditorView }) => {
    const event = new CustomEvent('ccweb-vim-save', { bubbles: true });
    cm.cm6.dom.dispatchEvent(event);
  });
  Vim.defineEx('wq', 'wq', (cm: { cm6: EditorView }) => {
    const event = new CustomEvent('ccweb-vim-save-close', { bubbles: true });
    cm.cm6.dom.dispatchEvent(event);
  });
}

export function EditorPane({
  paneId,
  file,
  filePath,
  tabs,
  activeTabId,
  isActive,
  canClose,
  cwd,
  vimMode,
  onToggleVim,
  onSave,
  onSelectTab,
  onCloseTab,
  onClose,
  onFocus,
  onSplitH,
  onSplitV,
  onDrop,
}: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const vimCompartmentRef = useRef(new Compartment());
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { theme } = useTheme();

  // Keep callbacks in refs for vim commands
  const handleSaveRef = useRef<() => void>(() => {});
  const onCloseRef = useRef(onClose);
  const onCloseTabRef = useRef(onCloseTab);
  const activeTabIdRef = useRef(activeTabId);
  const onFocusRef = useRef(onFocus);
  onCloseRef.current = onClose;
  onCloseTabRef.current = onCloseTab;
  activeTabIdRef.current = activeTabId;
  onFocusRef.current = onFocus;

  const handleSave = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;

    const content = view.state.doc.toString();
    setSaveStatus('saving');

    try {
      await saveFile(filePath, content, cwd);
      setIsDirty(false);
      setSaveStatus('saved');
      onSave(content);
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(prev => prev === 'error' ? 'idle' : prev), 3000);
    }
  }, [filePath, cwd, onSave]);

  handleSaveRef.current = handleSave;

  useEffect(() => {
    setIsDirty(false);
    setSaveStatus('idle');
  }, [filePath]);

  // Listen for vim :w and :wq custom events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onVimSave = () => handleSaveRef.current();
    const onVimSaveClose = () => {
      handleSaveRef.current();
      onCloseRef.current();
    };

    container.addEventListener('ccweb-vim-save', onVimSave);
    container.addEventListener('ccweb-vim-save-close', onVimSaveClose);
    return () => {
      container.removeEventListener('ccweb-vim-save', onVimSave);
      container.removeEventListener('ccweb-vim-save-close', onVimSaveClose);
    };
  }, [filePath]);

  useEffect(() => {
    if (!containerRef.current) return;

    registerVimCommands();
    const vimCompartment = vimCompartmentRef.current;

    const extensions = [
      vimCompartment.of(vimMode ? vim() : []),
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
        run: () => { handleSaveRef.current(); return true; },
      }, {
        key: 'Mod-w',
        run: () => { onCloseTabRef.current(activeTabIdRef.current); return true; },
      }])),
      EditorView.domEventHandlers({
        // Keep active-pane state in sync with actual editor focus.
        focus: () => {
          onFocusRef.current();
          return false;
        },
      }),
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
  }, [filePath, file.content, file.extension, theme]);

  // Hot-toggle vim mode without recreating editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const vimCompartment = vimCompartmentRef.current;
    view.dispatch({
      effects: vimCompartment.reconfigure(vimMode ? vim() : []),
    });
  }, [vimMode]);

  useEffect(() => {
    if (!isActive) return;
    viewRef.current?.focus();
  }, [isActive]);

  return (
    <>
      <PaneHeader
        title={filePath}
        paneId={paneId}
        paneType="editor"
        isDirty={isDirty}
        saveStatus={saveStatus}
        isActive={isActive}
        canClose={canClose}
        vimMode={vimMode}
        onToggleVim={onToggleVim}
        onSplitH={onSplitH}
        onSplitV={onSplitV}
        onClose={onClose}
        onFocus={onFocus}
        onDrop={onDrop}
      />
      <div className="editor-tabs" onMouseDown={onFocus}>
        {tabs.map(tab => {
          const isTabActive = tab.id === activeTabId;
          const tabName = tab.path.split('/').pop() || tab.path;
          return (
            <button
              key={tab.id}
              type="button"
              className={`editor-tab ${isTabActive ? 'active' : ''} ${tab.pinned ? '' : 'preview'}`}
              draggable
              onClick={(e) => {
                e.stopPropagation();
                onSelectTab(tab.id);
              }}
              onDragStart={(e: ReactDragEvent<HTMLButtonElement>) => {
                e.dataTransfer.setData(EDITOR_TAB_DND_MIME, JSON.stringify({ paneId, tabId: tab.id }));
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <span className="editor-tab-name" title={tab.path}>{tabName}</span>
              <span
                className="editor-tab-close"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }
                }}
                aria-label={`Close ${tabName}`}
              >
                x
              </span>
            </button>
          );
        })}
      </div>
      <div className="file-viewer-content" ref={containerRef} onMouseDown={onFocus} />
    </>
  );
}
