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
    const out = execSync('git status --porcelain -uall --ignored', { cwd: dir, encoding: 'utf-8', timeout: 3000 }).trim();
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
      const status = xy === '!!' ? 'ignored'
        : xy === '??' ? 'untracked'
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

router.get('/preview', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    const target = resolveSafe(filePath);
    const stat = await fsp.stat(target);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
    if (stat.size > 10 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large' });
    }
    res.setHeader('Content-Length', stat.size);
    const stream = fs.createReadStream(target);
    stream.on('error', (streamErr) => {
      res.status(streamErr.code === 'EACCES' ? 403 : 500).end();
    });
    stream.pipe(res);
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
    const from = req.query.from || '';
    const to = req.query.to || 'HEAD';
    const scriptPath = path.join(os.homedir(), '.config/opencode/skills/diff-report/diff_report.py');
    const fs = require('fs');
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ error: 'diff-report skill not found' });
    }
    const { execSync } = require('child_process');
    let cmd = `python3 "${scriptPath}" --raw --repo-root "${target}" --no-open -o /dev/stdout`;
    if (from) cmd += ` --from "${from}" --to "${to}"`;
    const out = execSync(cmd, {
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

router.get('/git/is-repo', async (req, res) => {
  try {
    const dir = req.query.dir;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: target, encoding: 'utf-8', timeout: 3000 });
      res.json({ isRepo: true });
    } catch {
      res.json({ isRepo: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/git/status', async (req, res) => {
  try {
    const dir = req.query.dir;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    let branch = '';
    let ahead = 0, behind = 0;
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {}
    try {
      const abOut = execSync('git rev-list --left-right --count HEAD...@{upstream}', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
      const parts = abOut.split(/\s+/);
      ahead = parseInt(parts[0]) || 0;
      behind = parseInt(parts[1]) || 0;
    } catch {}
    const statusOut = execSync('git status --porcelain -uall', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    const staged = [], modified = [], untracked = [];
    if (statusOut) {
      const relativeTo = target;
      for (const line of statusOut.split('\n')) {
        if (!line) continue;
        const raw = line.slice(3).replace(/^"(.*)"$/, '$1');
        if (raw.includes(' -> ')) continue;
        const xy = line.slice(0, 2);
        const absPath = path.resolve(repoRoot, raw);
        const rel = path.relative(relativeTo, absPath);
        if (xy === '??') untracked.push(rel);
        else if (xy[0] !== ' ' && xy[0] !== '?') staged.push(rel);
        else if (xy[1] !== ' ' && xy[1] !== '?') modified.push(rel);
      }
    }
    res.json({ branch, ahead, behind, staged, modified, untracked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/git/log', async (req, res) => {
  try {
    const dir = req.query.dir;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    const from = req.query.from;
    const count = parseInt(req.query.count) || 20;
    let range = `-n ${count}`;
    if (from) range = `${from}..HEAD`;
    let out;
    try {
      out = execSync(`git log --format="%H|%an|%aI|%s" ${range}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    } catch { out = ''; }
    if (!out) return res.json({ commits: [] });
    const commits = out.split('\n').map(line => {
      const [sha, author, date, ...msgParts] = line.split('|');
      return { sha, author, date, message: msgParts.join('|') };
    });
    res.json({ commits });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/git/diff-range', async (req, res) => {
  try {
    const dir = req.query.dir;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const from = req.query.from;
    const to = req.query.to || 'HEAD';
    if (!from) return res.status(400).json({ error: 'from is required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    let diff;
    try {
      diff = execSync(`git diff ${from}..${to}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 }).trim();
    } catch { diff = ''; }
    let statsRaw = '';
    try {
      statsRaw = execSync(`git diff --stat ${from}..${to}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    } catch { statsRaw = ''; }
    // Parse --stat into structured format
    const files = [];
    let totalAdditions = 0, totalDeletions = 0;
    for (const line of statsRaw.split('\n')) {
      const m = line.match(/\s*([^\s]+)\s+\|\s*(\d+)\s*[+-]*\s*(\d*)/);
      if (m) {
        const f = m[1].replace(/^"(.*)"$/, '$1');
        const a = parseInt(m[2]) || 0;
        const d = parseInt(m[3]) || 0;
        files.push({ path: f, additions: a, deletions: d });
        totalAdditions += a;
        totalDeletions += d;
      }
    }
    res.json({ from, to, diff, stats: { additions: totalAdditions, deletions: totalDeletions, files } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/git/diff-range-report', async (req, res) => {
  try {
    const dir = req.query.dir;
    const from = req.query.from;
    const to = req.query.to || 'HEAD';
    if (!dir || !from) return res.status(400).send('Missing dir or from');
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).send('Not a git repository');
    }
    let diff = '';
    try { diff = execSync(`git diff ${from}..${to}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 }).trim(); } catch { diff = ''; }
    let statsRaw = '';
    try { statsRaw = execSync(`git diff --stat ${from}..${to}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim(); } catch { statsRaw = ''; }

    const files = [];
    let totalAdditions = 0, totalDeletions = 0;
    for (const line of statsRaw.split('\n')) {
      const m = line.match(/\s*([^\s]+)\s+\|\s*(\d+)\s*[+-]*\s*(\d*)/);
      if (m) {
        const f = m[1].replace(/^"(.*)"$/, '$1');
        const a = parseInt(m[2]) || 0, d = parseInt(m[3]) || 0;
        files.push({ path: f, additions: a, deletions: d });
        totalAdditions += a; totalDeletions += d;
      }
    }

    const hunks = [];
    let currentHunk = null;
    for (const line of diff.split('\n')) {
      if (line.startsWith('@@')) {
        currentHunk = { header: line, lines: [] };
        hunks.push(currentHunk);
      } else if (currentHunk) {
        let type = 'ctx';
        if (line.startsWith('+') && !line.startsWith('+++')) type = 'add';
        else if (line.startsWith('-') && !line.startsWith('---')) type = 'del';
        currentHunk.lines.push({ type, text: line.replace(/</g, '&lt;').replace(/>/g, '&gt;') });
      }
    }

    const fileRows = files.map(f =>
      `<tr><td class="dr-fpath">${f.path}</td><td class="dr-num dr-add">+${f.additions}</td><td class="dr-num dr-del">-${f.deletions}</td></tr>`
    ).join('\n');

    const hunkHtml = hunks.map(h => {
      const linesHtml = h.lines.map(l =>
        `<div class="dr-line dr-line--${l.type}">${l.text}</div>`
      ).join('');
      return `<div class="dr-hunk"><div class="dr-hunk-header">${h.header}</div>${linesHtml}</div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diff ${from.slice(0,7)} .. ${to}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;background:#0d1117;color:#c9d1d9;font-size:13px;line-height:1.5}
.dr-header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
.dr-header h1{font-size:15px;font-weight:600;color:#e6edf3}
.dr-stats{display:flex;gap:16px;margin-left:auto;font-size:12px}
.dr-stats .dr-add{color:#3fb950}.dr-stats .dr-del{color:#f85149}
.dr-summary{background:#161b22;padding:12px 20px;border-bottom:1px solid #30363d}
table{width:100%;border-collapse:collapse}
th{text-align:left;color:#8b949e;font-size:11px;text-transform:uppercase;padding:6px 12px;border-bottom:1px solid #21262d}
td{padding:5px 12px;border-bottom:1px solid #21262d}
.dr-fpath{color:#58a6ff;word-break:break-all;max-width:60vw}
.dr-num{font-size:12px;text-align:right;width:60px}
.dr-content{padding:16px 20px}
.dr-hunk{margin-bottom:16px;border:1px solid #30363d;border-radius:6px;overflow:hidden}
.dr-hunk-header{background:#161b22;padding:4px 12px;color:#8b949e;font-size:11px;border-bottom:1px solid #30363d}
.dr-line{padding:0 12px;white-space:pre;min-height:20px}
.dr-line--add{background:rgba(46,160,67,.15);color:#3fb950}
.dr-line--del{background:rgba(248,81,73,.15);color:#f85149}
.dr-line--ctx{color:#8b949e}
.empty{padding:40px;text-align:center;color:#8b949e}
</style>
</head>
<body>
<div class="dr-header">
  <h1>📋 ${from.slice(0,7)} .. ${to}</h1>
  <div class="dr-stats">
    <span class="dr-add">+${totalAdditions}</span>
    <span class="dr-del">-${totalDeletions}</span>
    <span>${files.length} files</span>
  </div>
</div>
<div class="dr-summary">
  <table><thead><tr><th>File</th><th>Additions</th><th>Deletions</th></tr></thead><tbody>${fileRows || '<tr><td colspan="3" class="empty">No changes</td></tr>'}</tbody></table>
</div>
<div class="dr-content">${hunkHtml || '<div class="empty">No diff content</div>'}</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

router.post('/git/commit', async (req, res) => {
  try {
    const { dir, message, excludeFiles } = req.body;
    if (!dir || !message) return res.status(400).json({ error: 'dir and message are required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    execSync('git add -A', { cwd: repoRoot, encoding: 'utf-8', timeout: 10000 });
    if (excludeFiles && excludeFiles.length > 0) {
      for (const f of excludeFiles) {
        try {
          execSync(`git reset HEAD -- "${f}"`, { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 });
        } catch {}
      }
    }
    let out;
    try {
      out = execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 10000 }).trim();
    } catch (e) {
      return res.status(400).json({ error: e.stderr?.trim() || e.message || 'Commit failed' });
    }
    res.json({ ok: true, output: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/git/pull', async (req, res) => {
  try {
    const { dir } = req.body;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    let branch;
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Cannot determine current branch' });
    }
    let out;
    try {
      out = execSync(`git pull origin ${branch}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }).trim();
    } catch (e) {
      return res.status(400).json({ error: e.stderr?.trim() || e.message || 'Pull failed' });
    }
    res.json({ ok: true, output: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/git/push', async (req, res) => {
  try {
    const { dir } = req.body;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    let branch;
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Cannot determine current branch' });
    }
    let out;
    try {
      out = execSync(`git push origin ${branch}`, { cwd: repoRoot, encoding: 'utf-8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }).trim();
    } catch (e) {
      return res.status(400).json({ error: e.stderr?.trim() || e.message || 'Push failed' });
    }
    res.json({ ok: true, output: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/git/diff-for-commit', async (req, res) => {
  try {
    const dir = req.query.dir;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }
    const repoName = path.basename(repoRoot);
    let branch = '';
    try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 3000 }).trim(); } catch {}
    const statOut = execSync('git diff --stat HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    let diffContent = '';
    try { diffContent = execSync('git diff HEAD', { cwd: repoRoot, encoding: 'utf-8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 }).trim(); } catch {}
    const MAX_DIFF = 8000;
    if (diffContent.length > MAX_DIFF) {
      diffContent = diffContent.slice(0, MAX_DIFF) + '\n... (diff truncated)';
    }
    res.json({ repoName, branch, stat: statOut, diff: diffContent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/git/ai-commit-msg', async (req, res) => {
  try {
    const { dir } = req.body;
    if (!dir) return res.status(400).json({ error: 'dir is required' });
    const target = resolveSafe(dir);
    let repoRoot;
    try {
      repoRoot = execSync('git rev-parse --show-toplevel', { cwd: target, encoding: 'utf-8', timeout: 3000 }).trim();
    } catch {
      return res.status(400).json({ error: 'Not a git repository' });
    }

    const ocHost = process.env.OPENCODE_SERVER_HOST || '127.0.0.1';
    const ocPort = process.env.OPENCODE_SERVER_PORT || 13460;
    const ocBase = `http://${ocHost}:${ocPort}`;

    const sessionRes = await fetch(`${ocBase}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `git-commit:${path.basename(repoRoot)}` })
    });
    if (!sessionRes.ok) return res.status(502).json({ error: `OpenCode server unavailable: ${sessionRes.status}` });
    const { id: sessionId } = await sessionRes.json();

    const prompt = `请为以下 Git 仓库的未提交变更生成一个简洁的中文 commit message。

仓库路径: ${repoRoot}

请先执行以下命令获取变更信息：
1. git -C "${repoRoot}" rev-parse --abbrev-ref HEAD   (当前分支)
2. git -C "${repoRoot}" diff --stat HEAD                (变更统计)
3. git -C "${repoRoot}" diff HEAD                       (详细diff，如果太长只看关键文件)

然后根据变更内容生成 commit message：
- 只输出一行（中文，50字以内）
- 使用 conventional commits 风格前缀（feat/fix/docs/refactor/chore/style/test 等）
- 不要解释、不要代码块、不要多余内容
- 直接输出 message 文本`;

    const msgRes = await fetch(`${ocBase}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text: prompt }],
        noReply: false
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text().catch(() => '');
      return res.status(502).json({ error: `OpenCode message failed: ${msgRes.status}`, detail: errText.slice(0, 200) });
    }
    const msgData = await msgRes.json();

    let aiText = '';
    if (msgData.message?.content) aiText = msgData.message.content;
    else if (Array.isArray(msgData.parts)) {
      for (const p of msgData.parts) {
        if (p.type === 'text' && p.text) { aiText += p.text; }
      }
    }

    aiText = aiText.trim()
      .replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '')
      .replace(/^[#\*\-\s]+/, '');

    const codeMatch = aiText.match(/```(?:\w+)?\n?([\s\S]*?)```/);
    const command = codeMatch ? codeMatch[1].trim() : aiText;

    res.json({ command, raw: aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
