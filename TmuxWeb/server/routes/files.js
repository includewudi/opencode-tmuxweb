const express = require('express');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const router = express.Router();

const MAX_FILE_SIZE = 1024 * 1024;

function expandDir(raw) {
  return raw.replace(/^~/, os.homedir());
}

function resolveSafe(raw) {
  return path.resolve(expandDir(raw));
}

function getGitStatus(dir) {
  try {
    const out = execSync('git status --porcelain -uall', { cwd: dir, encoding: 'utf-8', timeout: 3000 }).trim();
    if (!out) return {};
    let repoRoot = dir;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf-8' }).trim();
    } catch {}
    const relativeTo = dir;
    const map = {};
    for (const line of out.split('\n')) {
      if (!line) continue;
      const raw = line.slice(3).replace(/^"(.*)"$/, '$1');
      if (raw.includes(' -> ')) continue;
      const xy = line.slice(0, 2);
      const status = xy === '??' ? 'untracked'
        : xy[0] !== ' ' && xy[0] !== '?' ? 'staged'
        : xy[1] !== ' ' && xy[1] !== '?' ? 'modified'
        : 'modified';
      const absPath = path.resolve(repoRoot, raw);
      const rel = path.relative(relativeTo, absPath);
      map[rel] = status;
    }
    return map;
  } catch {
    return null;
  }
}

router.get('/tree', async (req, res) => {
  try {
    const dir = req.query.dir || process.env.HOME || '/tmp';
    const target = resolveSafe(dir);
    const stat = await fsp.stat(target);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }
    const showHidden = req.query.showHidden === '1';
    const entries = await fsp.readdir(target, { withFileTypes: true });
    const gitStatus = getGitStatus(target);
    const items = [];
    for (const entry of entries) {
      if (!showHidden && entry.name.startsWith('.')) continue;
      const fullPath = path.join(target, entry.name);
      let size = 0;
      let mtime = null;
      try {
        const s = await fsp.stat(fullPath);
        size = s.size;
        mtime = s.mtime.toISOString();
      } catch {}
      const relPath = path.relative(target, fullPath);
      let git;
      if (gitStatus) {
        if (gitStatus[relPath]) {
          git = gitStatus[relPath];
        } else if (entry.isDirectory()) {
          const prefix = relPath + '/';
          git = Object.keys(gitStatus).some(k => k.startsWith(prefix)) ? 'modified' : undefined;
        }
      }
      items.push({
        name: entry.name,
        type: entry.isDirectory() ? 'dir' : 'file',
        size: entry.isDirectory() ? 0 : size,
        mtime,
        git,
      });
    }
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json(items);
  } catch (err) {
    const code = err.code === 'ENOENT' ? 404 : err.code === 'EACCES' ? 403 : 500;
    res.status(code).json({ error: err.message });
  }
});

router.get('/content', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    const target = resolveSafe(filePath);
    const stat = await fsp.stat(target);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
    if (stat.size > MAX_FILE_SIZE) {
      return res.json({ error: 'binary_file', size: stat.size });
    }
    const buf = await fsp.readFile(target);
    if (buf.includes(0)) {
      return res.json({ error: 'binary_file', size: stat.size });
    }
    res.json({ content: buf.toString('utf-8'), encoding: 'utf-8' });
  } catch (err) {
    const code = err.code === 'ENOENT' ? 404 : err.code === 'EACCES' ? 403 : 500;
    res.status(code).json({ error: err.message });
  }
});

router.put('/content', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    if (content === undefined) return res.status(400).json({ error: 'content is required' });
    const target = resolveSafe(filePath);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(err.code === 'EACCES' ? 403 : 500).json({ error: err.message });
  }
});

router.post('/mkdir', async (req, res) => {
  try {
    const { dir, name } = req.body;
    if (!dir || !name) return res.status(400).json({ error: 'dir and name are required' });
    const target = resolveSafe(path.join(dir, name));
    await fsp.mkdir(target, { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.code === 'EACCES' ? 403 : 500).json({ error: err.message });
  }
});

router.delete('/delete', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    const target = resolveSafe(filePath);
    const stat = await fsp.stat(target);
    if (stat.isDirectory()) {
      await fsp.rm(target, { recursive: true, force: true });
    } else {
      await fsp.unlink(target);
    }
    res.json({ ok: true });
  } catch (err) {
    const code = err.code === 'ENOENT' ? 404 : err.code === 'EACCES' ? 403 : 500;
    res.status(code).json({ error: err.message });
  }
});

router.post('/rename', async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath are required' });
    const from = resolveSafe(oldPath);
    const to = resolveSafe(newPath);
    await fsp.mkdir(path.dirname(to), { recursive: true });
    await fsp.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    const code = err.code === 'ENOENT' ? 404 : err.code === 'EACCES' ? 403 : 500;
    res.status(code).json({ error: err.message });
  }
});

module.exports = router;
