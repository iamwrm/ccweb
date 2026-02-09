import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createFileRouter, safePath } from '../files.js';

let app: express.Express;
let testDir: string;

beforeAll(async () => {
  // Create a temp directory structure for testing
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ccweb-test-'));

  await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'src', 'components'), { recursive: true });
  await fs.mkdir(path.join(testDir, '.hidden'), { recursive: true });
  await fs.mkdir(path.join(testDir, 'node_modules'), { recursive: true });

  await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project');
  await fs.writeFile(path.join(testDir, 'src', 'main.ts'), 'console.log("hello");');
  await fs.writeFile(path.join(testDir, 'src', 'components', 'App.tsx'), 'export function App() {}');
  await fs.writeFile(path.join(testDir, '.hidden', 'secret.txt'), 'hidden content');
  await fs.writeFile(path.join(testDir, 'node_modules', 'pkg.js'), 'module.exports = {}');

  // Create a large file (>1MB)
  const largeContent = 'x'.repeat(1_100_000);
  await fs.writeFile(path.join(testDir, 'large.bin'), largeContent);

  app = express();
  app.use('/api', createFileRouter(testDir));
});

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe('safePath', () => {
  it('allows paths within project root', () => {
    expect(safePath('/project', 'src/main.ts')).toBe('/project/src/main.ts');
  });

  it('allows the root directory itself', () => {
    expect(safePath('/project', '.')).toBe('/project');
  });

  it('rejects path traversal with ../', () => {
    expect(safePath('/project', '../../../etc/passwd')).toBeNull();
  });

  it('rejects path traversal with absolute path', () => {
    expect(safePath('/project', '/etc/passwd')).toBeNull();
  });

  it('normalizes paths correctly', () => {
    expect(safePath('/project', 'src/../src/main.ts')).toBe('/project/src/main.ts');
  });
});

describe('GET /api/files', () => {
  it('returns directory listing for root', async () => {
    const res = await request(app).get('/api/files?path=.');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const names = res.body.map((e: { name: string }) => e.name);
    expect(names).toContain('src');
    expect(names).toContain('README.md');
  });

  it('sorts directories first then alphabetical', async () => {
    const res = await request(app).get('/api/files?path=.');
    expect(res.status).toBe(200);

    const types = res.body.map((e: { type: string }) => e.type);
    const firstFileIndex = types.indexOf('file');
    const lastDirIndex = types.lastIndexOf('directory');

    if (firstFileIndex !== -1 && lastDirIndex !== -1) {
      expect(lastDirIndex).toBeLessThan(firstFileIndex);
    }
  });

  it('filters dotfiles and node_modules', async () => {
    const res = await request(app).get('/api/files?path=.');
    const names = res.body.map((e: { name: string }) => e.name);
    expect(names).not.toContain('.hidden');
    expect(names).not.toContain('node_modules');
  });

  it('returns subdirectory listing', async () => {
    const res = await request(app).get('/api/files?path=src');
    expect(res.status).toBe(200);

    const names = res.body.map((e: { name: string }) => e.name);
    expect(names).toContain('components');
    expect(names).toContain('main.ts');
  });

  it('includes file size for files', async () => {
    const res = await request(app).get('/api/files?path=.');
    const readme = res.body.find((e: { name: string }) => e.name === 'README.md');
    expect(readme).toBeDefined();
    expect(readme.type).toBe('file');
    expect(typeof readme.size).toBe('number');
  });

  it('returns 404 for nonexistent directory', async () => {
    const res = await request(app).get('/api/files?path=nonexistent');
    expect(res.status).toBe(404);
  });

  it('rejects path traversal', async () => {
    const res = await request(app).get('/api/files?path=../../../etc');
    expect(res.status).toBe(403);
  });

  it('defaults to root when no path given', async () => {
    const res = await request(app).get('/api/files');
    expect(res.status).toBe(200);
    const names = res.body.map((e: { name: string }) => e.name);
    expect(names).toContain('src');
  });
});

describe('GET /api/file', () => {
  it('returns file content with extension', async () => {
    const res = await request(app).get('/api/file?path=src/main.ts');
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('console.log("hello");');
    expect(res.body.extension).toBe('ts');
    expect(res.body.path).toBe('src/main.ts');
    expect(typeof res.body.size).toBe('number');
  });

  it('returns 400 when path is missing', async () => {
    const res = await request(app).get('/api/file');
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent file', async () => {
    const res = await request(app).get('/api/file?path=nope.txt');
    expect(res.status).toBe(404);
  });

  it('rejects path traversal', async () => {
    const res = await request(app).get('/api/file?path=../../../etc/passwd');
    expect(res.status).toBe(403);
  });

  it('rejects URL-encoded path traversal', async () => {
    const res = await request(app).get('/api/file?path=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    expect(res.status).toBe(403);
  });

  it('returns 413 for files larger than 1MB', async () => {
    const res = await request(app).get('/api/file?path=large.bin');
    expect(res.status).toBe(413);
  });
});

describe('PUT /api/file', () => {
  it('saves file content and returns ok', async () => {
    const res = await request(app)
      .put('/api/file')
      .send({ path: 'README.md', content: '# Updated' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.path).toBe('README.md');
    expect(typeof res.body.size).toBe('number');
  });

  it('persists content to disk', async () => {
    await request(app)
      .put('/api/file')
      .send({ path: 'src/main.ts', content: 'console.log("updated");' });

    const content = await fs.readFile(path.join(testDir, 'src/main.ts'), 'utf-8');
    expect(content).toBe('console.log("updated");');
  });

  it('returns 400 when path is missing', async () => {
    const res = await request(app)
      .put('/api/file')
      .send({ content: 'hello' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(app)
      .put('/api/file')
      .send({ path: 'README.md' });
    expect(res.status).toBe(400);
  });

  it('rejects path traversal', async () => {
    const res = await request(app)
      .put('/api/file')
      .send({ path: '../../../etc/passwd', content: 'hacked' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent file', async () => {
    const res = await request(app)
      .put('/api/file')
      .send({ path: 'nonexistent.txt', content: 'hello' });
    expect(res.status).toBe(404);
  });

  it('returns 413 for content larger than 1MB', async () => {
    const res = await request(app)
      .put('/api/file')
      .send({ path: 'README.md', content: 'x'.repeat(1_100_000) });
    expect(res.status).toBe(413);
  });

  it('rejects writing to a directory', async () => {
    const res = await request(app)
      .put('/api/file')
      .send({ path: 'src', content: 'hello' });
    expect(res.status).toBe(400);
  });
});
