import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAllFiles } from '../lib/api';
import { fuzzySearch, type FuzzyResult } from '../lib/fuzzyMatch';
import { getFileIcon } from '../lib/fileIcons';
import './QuickOpen.css';

interface QuickOpenProps {
  root?: string;
  onSelect: (filePath: string) => void;
  onClose: () => void;
}

export function QuickOpen({ root, onSelect, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [results, setResults] = useState<FuzzyResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllFiles(root)
      .then(setAllFiles)
      .catch(() => setAllFiles([]));
  }, [root]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setResults(fuzzySearch(query, allFiles));
    setSelectedIndex(0);
  }, [query, allFiles]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex].path);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, onSelect, onClose]);

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          className="quick-open-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search files by name..."
          spellCheck={false}
        />
        <div className="quick-open-results" ref={listRef}>
          {results.map((r, i) => {
            const filename = r.path.split('/').pop() || r.path;
            const dir = r.path.slice(0, r.path.length - filename.length);
            return (
              <div
                key={r.path}
                className={`quick-open-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => { onSelect(r.path); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="quick-open-icon">
                  {getFileIcon(filename, 'file')}
                </span>
                <span className="quick-open-filename">
                  <HighlightedText text={filename} matches={r.matches} filenameStart={dir.length} />
                </span>
                {dir && <span className="quick-open-dir">{dir}</span>}
              </div>
            );
          })}
          {results.length === 0 && query && (
            <div className="quick-open-empty">No files found</div>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightedText({ text, matches, filenameStart }: { text: string; matches: number[]; filenameStart: number }) {
  if (matches.length === 0) return <>{text}</>;

  // Adjust match indices to be relative to the filename portion
  const adjustedMatches = new Set(matches.filter(i => i >= filenameStart).map(i => i - filenameStart));
  if (adjustedMatches.size === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let current = '';
  let isMatch = false;

  for (let i = 0; i < text.length; i++) {
    const charIsMatch = adjustedMatches.has(i);
    if (charIsMatch !== isMatch) {
      if (current) {
        parts.push(isMatch ? <mark key={i}>{current}</mark> : current);
      }
      current = '';
      isMatch = charIsMatch;
    }
    current += text[i];
  }
  if (current) {
    parts.push(isMatch ? <mark key={text.length}>{current}</mark> : current);
  }

  return <>{parts}</>;
}
