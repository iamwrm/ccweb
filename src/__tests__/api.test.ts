import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFiles, fetchFile, saveFile, renameFile } from '../lib/api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchFiles', () => {
  it('calls the correct URL with encoded path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ name: 'src', path: 'src', type: 'directory' }]),
    });

    const result = await fetchFiles('src/components');
    expect(mockFetch).toHaveBeenCalledWith('/api/files?path=src%2Fcomponents');
    expect(result).toEqual([{ name: 'src', path: 'src', type: 'directory' }]);
  });

  it('encodes special characters in path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await fetchFiles('path with spaces/dir');
    expect(mockFetch).toHaveBeenCalledWith('/api/files?path=path%20with%20spaces%2Fdir');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchFiles('nonexistent')).rejects.toThrow('Failed to fetch files: 404');
  });
});

describe('fetchFile', () => {
  it('calls the correct URL and returns parsed JSON', async () => {
    const fileData = { path: 'main.ts', content: 'hello', size: 5, extension: 'ts' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(fileData),
    });

    const result = await fetchFile('main.ts');
    expect(mockFetch).toHaveBeenCalledWith('/api/file?path=main.ts');
    expect(result).toEqual(fileData);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(fetchFile('../secret')).rejects.toThrow('Failed to fetch file: 403');
  });
});

describe('saveFile', () => {
  it('sends PUT with correct body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, path: 'main.ts', size: 10 }),
    });

    await saveFile('main.ts', 'new content');
    expect(mockFetch).toHaveBeenCalledWith('/api/file', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'main.ts', content: 'new content' }),
    });
  });

  it('includes root in body when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, path: 'main.ts', size: 10 }),
    });

    await saveFile('main.ts', 'content', '/custom/root');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.root).toBe('/custom/root');
  });

  it('throws on non-OK response with error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Access denied' }),
    });

    await expect(saveFile('secret.txt', 'x')).rejects.toThrow('Access denied');
  });
});

describe('renameFile', () => {
  it('sends PATCH with correct body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, path: 'src/new.ts' }),
    });

    await renameFile('src/old.ts', 'src/new.ts');
    expect(mockFetch).toHaveBeenCalledWith('/api/file/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'src/old.ts', newPath: 'src/new.ts' }),
    });
  });

  it('includes root in body when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, path: 'src/new.ts' }),
    });

    await renameFile('src/old.ts', 'src/new.ts', '/custom/root');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.root).toBe('/custom/root');
  });

  it('throws on non-OK response with error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'Target already exists' }),
    });

    await expect(renameFile('a.ts', 'b.ts')).rejects.toThrow('Target already exists');
  });
});
