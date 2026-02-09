export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  extension: string;
}

export async function fetchFiles(dirPath: string, root?: string): Promise<FileEntry[]> {
  let url = `/api/files?path=${encodeURIComponent(dirPath)}`;
  if (root) url += `&root=${encodeURIComponent(root)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
  return res.json();
}

export async function fetchFile(filePath: string, root?: string): Promise<FileContent> {
  let url = `/api/file?path=${encodeURIComponent(filePath)}`;
  if (root) url += `&root=${encodeURIComponent(root)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return res.json();
}

export async function saveFile(
  filePath: string,
  content: string,
  root?: string,
): Promise<{ ok: boolean; path: string; size: number }> {
  const body: Record<string, string> = { path: filePath, content };
  if (root) body.root = root;
  const res = await fetch('/api/file', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Save failed' }));
    throw new Error(err.error || `Save failed: ${res.status}`);
  }
  return res.json();
}
