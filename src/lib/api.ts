function checkAuth(res: Response) {
  if (res.status === 401) {
    window.location.reload();
    throw new Error('Session expired');
  }
}

export async function authenticate(token: string): Promise<void> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('Invalid token');
}

export async function checkAuthStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/files?path=.');
    return res.ok;
  } catch {
    return false;
  }
}

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
  checkAuth(res);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
  return res.json();
}

export async function fetchFile(filePath: string, root?: string): Promise<FileContent> {
  let url = `/api/file?path=${encodeURIComponent(filePath)}`;
  if (root) url += `&root=${encodeURIComponent(root)}`;
  const res = await fetch(url);
  checkAuth(res);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return res.json();
}

export async function fetchAllFiles(root?: string): Promise<string[]> {
  let url = '/api/files/all';
  if (root) url += `?root=${encodeURIComponent(root)}`;
  const res = await fetch(url);
  checkAuth(res);
  if (!res.ok) throw new Error(`Failed to fetch all files: ${res.status}`);
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

export async function renameFile(
  filePath: string,
  newPath: string,
  root?: string,
): Promise<{ ok: boolean; path: string }> {
  const body: Record<string, string> = { path: filePath, newPath };
  if (root) body.root = root;
  const res = await fetch('/api/file/rename', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Rename failed' }));
    throw new Error(err.error || `Rename failed: ${res.status}`);
  }
  return res.json();
}
