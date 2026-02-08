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

export async function fetchFiles(dirPath: string): Promise<FileEntry[]> {
  const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
  return res.json();
}

export async function fetchFile(filePath: string): Promise<FileContent> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return res.json();
}
