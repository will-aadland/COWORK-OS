/**
 * lib/fs-ops.mjs
 * Shared filesystem operations scoped to a root directory.
 * Used by the global /api/files/* endpoints and the project/meeting-scoped endpoints.
 *
 * Every function takes an absolute root path + a relative path; callers clamp
 * via resolveInsideRoot so traversal outside the root is rejected.
 */

import fs from 'node:fs';
import path from 'node:path';

const SKIP_NAMES = new Set(['.claude', '.git', 'node_modules', 'desktop.ini', '.DS_Store']);
const SKIP_EXTS = new Set(['.skill']);

export function resolveInsideRoot(root, relPath) {
  const abs = path.resolve(path.join(root, relPath || ''));
  const rootAbs = path.resolve(root);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw Object.assign(new Error('Invalid path'), { status: 403 });
  }
  return abs;
}

export function buildTree(rootDir, relBase = '', displayName) {
  const name = relBase === '' ? (displayName || path.basename(rootDir)) : path.basename(rootDir);
  const node = { name, type: 'directory', path: relBase, children: [] };
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return node;
  }
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const entryRel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const entryAbs = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      node.children.push(buildTree(entryAbs, entryRel));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase().replace('.', '');
      if (SKIP_EXTS.has('.' + ext)) continue;
      let size = 0, modified = '';
      try {
        const stat = fs.statSync(entryAbs);
        size = stat.size;
        modified = stat.mtime.toISOString();
      } catch {}
      node.children.push({ name: entry.name, type: 'file', path: entryRel, ext, size, modified });
    }
  }
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return node;
}

export function readFileContent(root, relPath) {
  const abs = resolveInsideRoot(root, relPath);
  const content = fs.readFileSync(abs, 'utf8');
  const ext = path.extname(abs).toLowerCase().replace('.', '');
  return { content, ext, path: relPath };
}

export function writeFileContent(root, relPath, content) {
  const abs = resolveInsideRoot(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content ?? '', 'utf8');
}

export function mkdirAt(root, relPath) {
  const abs = resolveInsideRoot(root, relPath);
  fs.mkdirSync(abs, { recursive: true });
}

export function deleteAt(root, relPath) {
  const abs = resolveInsideRoot(root, relPath);
  fs.rmSync(abs, { recursive: true, force: true });
}

export function moveAt(root, fromRel, toRel) {
  const absFrom = resolveInsideRoot(root, fromRel);
  const absTo = resolveInsideRoot(root, toRel);
  fs.mkdirSync(path.dirname(absTo), { recursive: true });
  try {
    fs.renameSync(absFrom, absTo);
  } catch {
    // Fallback for cross-device / OneDrive-locked files
    const srcStat = fs.statSync(absFrom);
    if (srcStat.isDirectory()) {
      fs.cpSync(absFrom, absTo, { recursive: true });
      fs.rmSync(absFrom, { recursive: true, force: true });
    } else {
      fs.copyFileSync(absFrom, absTo);
      fs.unlinkSync(absFrom);
    }
  }
}

export function renameAt(root, relPath, newName) {
  const absOld = resolveInsideRoot(root, relPath);
  const absNew = resolveInsideRoot(root, path.join(path.dirname(relPath), newName));
  try {
    fs.renameSync(absOld, absNew);
  } catch {
    const srcStat = fs.statSync(absOld);
    if (srcStat.isDirectory()) {
      fs.cpSync(absOld, absNew, { recursive: true });
      fs.rmSync(absOld, { recursive: true, force: true });
    } else {
      fs.copyFileSync(absOld, absNew);
      fs.unlinkSync(absOld);
    }
  }
}

const MIME_MAP = {
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  log: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

export function mimeForExt(ext) {
  return MIME_MAP[(ext || '').toLowerCase()] || 'application/octet-stream';
}

export function streamRawFile(res, root, relPath) {
  const abs = resolveInsideRoot(root, relPath);
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  const ext = path.extname(abs).toLowerCase().replace('.', '');
  res.writeHead(200, { 'Content-Type': mimeForExt(ext), 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(abs).pipe(res);
}
