import { Router, json as jsonMiddleware, type Request, type Response } from 'express';
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

/**
 * Resolve and validate an override root directory.
 * Returns the resolved root if valid, or null if the directory doesn't exist.
 */
async function resolveRoot(overrideRoot: string): Promise<string | null> {
  const resolved = path.resolve(overrideRoot);
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) return null;
    return resolved;
  } catch {
    return null;
  }
}

export function createFileRouter(projectRoot: string): Router {
  const router = Router();
  const defaultRoot = path.resolve(projectRoot);

  // GET /api/files/all?root=/custom/root — recursive flat listing
  router.get('/files/all', async (req: Request, res: Response) => {
    const rootOverride = req.query.root as string | undefined;

    let resolvedRoot = defaultRoot;
    if (rootOverride) {
      const validated = await resolveRoot(rootOverride);
      if (!validated) {
        res.status(400).json({ error: 'Invalid root directory' });
        return;
      }
      resolvedRoot = validated;
    }

    const files: string[] = [];
    const MAX_FILES = 10000;

    async function walk(dir: string) {
      if (files.length >= MAX_FILES) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(path.relative(resolvedRoot, fullPath));
        }
        if (files.length >= MAX_FILES) return;
      }
    }

    try {
      await walk(resolvedRoot);
      files.sort();
      res.json(files);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.status(500).json({ error: 'Internal error' });
      }
    }
  });

  // GET /api/files?path=src/components&root=/custom/root
  router.get('/files', async (req: Request, res: Response) => {
    const requestedPath = (req.query.path as string) || '.';
    const rootOverride = req.query.root as string | undefined;

    let resolvedRoot = defaultRoot;
    if (rootOverride) {
      const validated = await resolveRoot(rootOverride);
      if (!validated) {
        res.status(400).json({ error: 'Invalid root directory' });
        return;
      }
      resolvedRoot = validated;
    }

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

  // GET /api/file?path=src/main.ts&root=/custom/root
  router.get('/file', async (req: Request, res: Response) => {
    const requestedPath = req.query.path as string;
    if (!requestedPath) {
      res.status(400).json({ error: 'Missing path parameter' });
      return;
    }

    const rootOverride = req.query.root as string | undefined;

    let resolvedRoot = defaultRoot;
    if (rootOverride) {
      const validated = await resolveRoot(rootOverride);
      if (!validated) {
        res.status(400).json({ error: 'Invalid root directory' });
        return;
      }
      resolvedRoot = validated;
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

  // PUT /api/file — save file content
  router.put('/file', jsonMiddleware({ limit: '2mb' }), async (req: Request, res: Response) => {
    const requestedPath = req.body?.path as string;
    const content = req.body?.content;

    if (!requestedPath || typeof content !== 'string') {
      res.status(400).json({ error: 'Missing path or content' });
      return;
    }

    if (content.length > 1_048_576) {
      res.status(413).json({ error: 'Content too large (>1MB)' });
      return;
    }

    const rootOverride = req.body?.root as string | undefined;

    let resolvedRoot = defaultRoot;
    if (rootOverride) {
      const validated = await resolveRoot(rootOverride);
      if (!validated) {
        res.status(400).json({ error: 'Invalid root directory' });
        return;
      }
      resolvedRoot = validated;
    }

    const fullPath = safePath(resolvedRoot, requestedPath);
    if (!fullPath) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) {
        res.status(400).json({ error: 'Path is not a file' });
        return;
      }

      await fs.writeFile(fullPath, content, 'utf-8');
      res.json({ ok: true, path: requestedPath, size: Buffer.byteLength(content, 'utf-8') });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.status(500).json({ error: 'Internal error' });
      }
    }
  });

  // PATCH /api/file/rename — rename (or move) a file or directory
  router.patch('/file/rename', jsonMiddleware({ limit: '1mb' }), async (req: Request, res: Response) => {
    const requestedPath = req.body?.path as string | undefined;
    const requestedNewPath = req.body?.newPath as string | undefined;

    if (!requestedPath || !requestedNewPath) {
      res.status(400).json({ error: 'Missing path or newPath' });
      return;
    }

    const rootOverride = req.body?.root as string | undefined;

    let resolvedRoot = defaultRoot;
    if (rootOverride) {
      const validated = await resolveRoot(rootOverride);
      if (!validated) {
        res.status(400).json({ error: 'Invalid root directory' });
        return;
      }
      resolvedRoot = validated;
    }

    const fromPath = safePath(resolvedRoot, requestedPath);
    const toPath = safePath(resolvedRoot, requestedNewPath);
    if (!fromPath || !toPath) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      if (fromPath === toPath) {
        res.json({ ok: true, path: requestedNewPath });
        return;
      }

      await fs.stat(fromPath);

      try {
        await fs.stat(toPath);
        res.status(409).json({ error: 'Target already exists' });
        return;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code && code !== 'ENOENT') {
          throw err;
        }
      }

      await fs.rename(fromPath, toPath);
      res.json({ ok: true, path: requestedNewPath });
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
