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

router.get('/diff', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    const target = resolveSafe(filePath);
    const fileDir = path.dirname(target);
    let repoRoot, relPath;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: fileDir, encoding: 'utf-8', timeout: 5000 }).trim();
      relPath = path.relative(repoRoot, target);
    } catch {
      return res.json({ hasChanges: false, diff: '', fileStatus: 'untracked', stats: { additions: 0, deletions: 0 } });
    }
    let fileStatus = 'modified';
    try {
      const statusOut = execSync('git status --porcelain -- ' + relPath, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
      if (statusOut && statusOut[0] === '?') fileStatus = 'untracked';
      else if (statusOut) fileStatus = statusOut[0] !== ' ' ? 'staged' : 'modified';
    } catch { fileStatus = 'untracked'; }
    if (fileStatus === 'untracked') {
      return res.json({ hasChanges: false, diff: '', fileStatus: 'untracked', stats: { additions: 0, deletions: 0 } });
    }
    const staged = req.query.staged === '1';
    let diff;
    try {
      const flag = staged ? '--cached' : 'HEAD';
      diff = execSync('git diff ' + flag + ' -- ' + relPath, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 });
    } catch { diff = ''; }
    if (!diff || diff.trim() === '') {
      return res.json({ hasChanges: false, diff: '', fileStatus, stats: { additions: 0, deletions: 0 } });
    }
    let binary = false;
    try {
      execSync('git diff --stat -- ' + relPath, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 });
    } catch (e) {
      if (e.stdout && e.stdout.includes('Binary')) binary = true;
      if (e.stderr && e.stderr.includes('Binary')) binary = true;
    }
    if (binary) {
      return res.json({ hasChanges: true, diff: '', fileStatus: 'binary', stats: { additions: 0, deletions: 0 } });
    }
    if (Buffer.byteLength(diff, 'utf-8') > 102400) {
      diff = diff.substring(0, 102400) + '\n... (truncated)';
    }
    let additions = 0, deletions = 0;
    for (const line of diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }
    res.json({ hasChanges: true, diff, fileStatus, stats: { additions, deletions } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    const target = resolveSafe(filePath);
    const fileDir = path.dirname(target);
    let repoRoot, relPath;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: fileDir, encoding: 'utf-8', timeout: 5000 }).trim();
      relPath = path.relative(repoRoot, target);
    } catch {
      return res.json({ commits: [], filePath });
    }
    let count = parseInt(req.query.count) || 20;
    if (count < 1) count = 1;
    if (count > 100) count = 100;
    let out;
    try {
      out = execSync('git log --format="%H|%an|%aI|%s" -n ' + count + ' -- ' + relPath, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    } catch { out = ''; }
    if (!out) {
      return res.json({ commits: [], filePath: relPath });
    }
    const commits = out.split('\n').map(line => {
      const [sha, author, date, ...msgParts] = line.split('|');
      return { sha, author, date, message: msgParts.join('|') };
    });
    res.json({ commits, filePath: relPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conflicts', async (req, res) => {
  try {
    const dir = req.query.dir;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    let mergeStatus = 'clean';
    try {
      const gitDir = execSync('git rev-parse --git-dir', { cwd: target, encoding: 'utf-8', timeout: 5000 }).trim();
      const absGitDir = path.resolve(target, gitDir);
      if (fs.existsSync(path.join(absGitDir, 'MERGE_HEAD'))) mergeStatus = 'merging';
      else if (fs.existsSync(path.join(absGitDir, 'rebase-merge')) || fs.existsSync(path.join(absGitDir, 'rebase-apply'))) mergeStatus = 'rebasing';
      else if (fs.existsSync(path.join(absGitDir, 'CHERRY_PICK_HEAD'))) mergeStatus = 'cherry-picking';
    } catch { mergeStatus = 'clean'; }
    let conflictedFiles = [];
    try {
      const out = execSync('grep -rn "<<<<<<< " --include="*" -l .', { cwd: target, encoding: 'utf-8', timeout: 5000 }).trim();
      if (out) {
        const lines = out.split('\n');
        for (const file of lines) {
          if (file.includes('.git/') || file.includes('node_modules/')) continue;
          const absPath = path.resolve(target, file);
          try {
            const stat = fs.statSync(absPath);
            if (stat.size > MAX_FILE_SIZE) continue;
          } catch { continue; }
          conflictedFiles.push({ path: absPath, relativePath: file });
        }
      }
    } catch { conflictedFiles = []; }
    res.json({ hasConflicts: conflictedFiles.length > 0 || mergeStatus !== 'clean', conflictedFiles, mergeStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/original', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    const ref = req.query.ref || 'HEAD';
    if (!/^[A-Za-z0-9_/.\~-]+$/.test(ref)) {
      return res.status(400).json({ error: 'Invalid ref parameter' });
    }
    const target = resolveSafe(filePath);
    const fileDir = path.dirname(target);
    let repoRoot, relPath, sha;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: fileDir, encoding: 'utf-8', timeout: 5000 }).trim();
      relPath = path.relative(repoRoot, target);
      sha = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    let content;
    try {
      content = execSync('git show ' + ref + ':' + relPath, { cwd: repoRoot, encoding: 'buffer', timeout: 5000 });
    } catch {
      return res.status(404).json({ error: 'File not found at ref ' + ref });
    }
    if (!content || content.length === 0) {
      return res.status(404).json({ error: 'File not found at ref ' + ref });
    }
    if (content.length > MAX_FILE_SIZE) {
      return res.status(413).json({ error: 'File too large', size: content.length });
    }
    let isBinary = false;
    if (Buffer.isBuffer(content)) {
      isBinary = content.includes(0);
    }
    res.json({ content: isBinary ? '' : content.toString('utf-8'), ref, sha, size: content.length, binary: isBinary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/changes-summary', async (req, res) => {
  try {
    const dir = req.query.dir || process.env.HOME || '/tmp';
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.json({ summary: 'Not a git repository', files: [] });
    }
    const statOut = execSync('git diff --stat HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    if (!statOut) return res.json({ summary: 'No uncommitted changes', files: [] });
    const diffOut = execSync('git diff HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 }).trim();
    const truncated = diffOut.length > 50000;
    const diffContent = truncated ? diffOut.slice(0, 50000) + '\n... (truncated)' : diffOut;
    const apiKey = process.env.LLM_API_KEY || config.llm?.apiKey;
    if (!apiKey) {
      return res.json({ summary: 'LLM not configured. Set llm.apiKey in config.', diff: statOut, files: [] });
    }
    const apiUrl = process.env.LLM_API_URL || config.llm?.apiUrl || 'https://api.deerapi.com/v1/chat/completions';
    const model = process.env.LLM_MODEL || config.llm?.model || 'deepseek-v3.2';
    const llmRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a code review assistant. Analyze the git diff and provide a concise summary in Chinese. Format:\n## 📝 改动概要\n(1-2 sentences overall)\n\n## 📂 文件变更\n(for each changed file: bullet point with what changed and why)\n\n## 💡 建议\n(any suggestions, concerns, or potential issues)' },
          { role: 'user', content: `Analyze this git diff:\n\n${diffContent}` }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });
    const data = await llmRes.json();
    const summary = data.choices?.[0]?.message?.content || 'Failed to generate summary';
    res.json({ summary, diff: statOut });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/diff-report', async (req, res) => {
  try {
    const dir = req.query.dir || process.env.HOME || '/tmp';
    const target = resolveSafe(dir);
    const scriptPath = path.join(os.homedir(), '.config/opencode/skills/diff-report/diff_report.py');
    const fs = require('fs');
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ error: 'diff-report skill not found' });
    }
    const { execSync } = require('child_process');
    const out = execSync(`python3 "${scriptPath}" --raw --repo-root "${target}" --no-open -o /dev/stdout`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
