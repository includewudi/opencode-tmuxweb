const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const snippetsDefault = path.join(__dirname, '..', 'snippets.json');
const snippetsPrivate = path.join(__dirname, '..', 'snippets_private.json');

function loadSnippets() {
  try {
    const filePath = fs.existsSync(snippetsPrivate) ? snippetsPrivate : snippetsDefault;
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Snippets] Failed to load snippets:', err.message);
  }
  return [];
}

function saveSnippets(snippets) {
  try {
    fs.writeFileSync(snippetsPrivate, JSON.stringify(snippets, null, 2), 'utf8');
  } catch (err) {
    console.error('[Snippets] Failed to save snippets:', err.message);
  }
}

router.get('/', async (req, res) => {
  try {
    const snippets = loadSnippets();
    res.json({ snippets });
  } catch (err) {
    console.error('[GET /api/snippets]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, command } = req.body;

    if (!name || !command) {
      return res.status(400).json({ error: 'name and command are required' });
    }

    const snippets = loadSnippets();
    snippets.push({ name, command });
    saveSnippets(snippets);

    res.status(201).json({ success: true, index: snippets.length - 1 });
  } catch (err) {
    console.error('[POST /api/snippets]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    const { index } = req.query;

    if (index === undefined) {
      return res.status(400).json({ error: 'index query parameter is required' });
    }

    const idx = parseInt(index, 10);
    if (isNaN(idx)) {
      return res.status(400).json({ error: 'index must be a number' });
    }

    const snippets = loadSnippets();
    if (idx < 0 || idx >= snippets.length) {
      return res.status(404).json({ error: 'Snippet not found' });
    }

    snippets.splice(idx, 1);
    saveSnippets(snippets);

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/snippets]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = router;
