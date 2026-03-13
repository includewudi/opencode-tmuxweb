const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const router = express.Router();

const HOME = os.homedir();
function tildePath(absPath) {
  return absPath.startsWith(HOME) ? '~' + absPath.slice(HOME.length) : absPath;
}

// Upload directory: TmuxWeb/uploads/{YYYY-MM-DD}/
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Ensure upload dir exists
function getUploadDir() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = path.join(UPLOADS_ROOT, today);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Multer storage: date-organized, unique filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_') // sanitize, keep CJK
      .slice(0, 60);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${unique}_${base}${ext}`);
  },
});

// 100MB limit, allow common file types
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// POST /api/upload — single file upload
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { filename, originalname, size, mimetype } = req.file;
    const relativePath = path.relative(UPLOADS_ROOT, req.file.path);
    // URL path for serving back
    const url = `/uploads/${relativePath}`;
    // Absolute server path
    const serverPath = req.file.path;

    console.log(`[Upload] ${originalname} → ${serverPath} (${(size / 1024).toFixed(1)}KB)`);

    res.json({
      success: true,
      filename,
      originalname,
      size,
      mimetype,
      url,
      path: tildePath(serverPath),
    });
  } catch (err) {
    console.error('[POST /api/upload]', err);
    res.status(500).json({ error: 'upload_failed', message: err.message });
  }
});

// POST /api/upload/multi — multiple files
router.post('/multi', upload.array('files', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const results = req.files.map(file => {
      const relativePath = path.relative(UPLOADS_ROOT, file.path);
      return {
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        url: `/uploads/${relativePath}`,
        path: tildePath(file.path),
      };
    });

    console.log(`[Upload] ${results.length} files uploaded`);
    res.json({ success: true, files: results });
  } catch (err) {
    console.error('[POST /api/upload/multi]', err);
    res.status(500).json({ error: 'upload_failed', message: err.message });
  }
});

// GET /api/upload/list — list recent uploads
router.get('/list', (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_ROOT)) {
      return res.json({ files: [] });
    }

    const files = [];
    const days = fs.readdirSync(UPLOADS_ROOT)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse()
      .slice(0, 7); // last 7 days

    for (const day of days) {
      const dayDir = path.join(UPLOADS_ROOT, day);
      const entries = fs.readdirSync(dayDir);
      for (const entry of entries) {
        const filePath = path.join(dayDir, entry);
        const stat = fs.statSync(filePath);
        files.push({
          filename: entry,
          url: `/uploads/${day}/${entry}`,
          path: tildePath(filePath),
          size: stat.size,
          date: day,
          mtime: stat.mtime.toISOString(),
        });
      }
    }

    // Sort by mtime desc
    files.sort((a, b) => b.mtime.localeCompare(a.mtime));
    res.json({ files });
  } catch (err) {
    console.error('[GET /api/upload/list]', err);
    res.status(500).json({ error: 'list_failed', message: err.message });
  }
});

module.exports = router;
