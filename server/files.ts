import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export function safePath(projectRoot: string, requestedPath: string): string | null {
  const resolved = path.resolve(projectRoot, requestedPath);
  const normalizedRoot = path.normalize(projectRoot);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    return null;
  }
  return resolved;
}

export function createFileRouter(projectRoot: string): Router {
  const router = Router();
  const resolvedRoot = path.resolve(projectRoot);

  // GET /api/files?path=src/components
  router.get('/files', async (req: Request, res: Response) => {
    const requestedPath = (req.query.path as string) || '.';
    const fullPath = safePath(resolvedRoot, requestedPath);

    if (!fullPath) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const relativePath = path.relative(resolvedRoot, path.join(fullPath, entry.name));
        const item: FileEntry = {
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? 'directory' : 'file',
        };

        if (entry.isFile()) {
          try {
            const stat = await fs.stat(path.join(fullPath, entry.name));
            item.size = stat.size;
          } catch {
            // Skip files we can't stat
          }
        }

        result.push(item);
      }

      // Directories first, then alphabetical
      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      res.json(result);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.status(500).json({ error: 'Internal error' });
      }
    }
  });

  // GET /api/file?path=src/main.ts
  router.get('/file', async (req: Request, res: Response) => {
    const requestedPath = req.query.path as string;
    if (!requestedPath) {
      res.status(400).json({ error: 'Missing path parameter' });
      return;
    }

    const fullPath = safePath(resolvedRoot, requestedPath);
    if (!fullPath) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      const stat = await fs.stat(fullPath);

      if (stat.size > 1_048_576) {
        res.status(413).json({ error: 'File too large (>1MB)' });
        return;
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const ext = path.extname(fullPath).slice(1);

      res.json({
        path: requestedPath,
        content,
        size: stat.size,
        extension: ext,
      });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.status(500).json({ error: 'Internal error' });
      }
    }
  });

  return router;
}
