const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const HOTWORDS_PATH = path.join(__dirname, '..', 'hotwords.json');

function loadHotwords() {
  try {
    return JSON.parse(fs.readFileSync(HOTWORDS_PATH, 'utf8'));
  } catch {
    return { hotwords: [], replacements: {} };
  }
}

function saveHotwords(data) {
  fs.writeFileSync(HOTWORDS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

router.get('/', (req, res) => {
  res.json(loadHotwords());
});

router.put('/', (req, res) => {
  try {
    const { hotwords, replacements } = req.body;
    if (!Array.isArray(hotwords) || typeof replacements !== 'object') {
      return res.status(400).json({ error: 'invalid format' });
    }
    const data = { hotwords, replacements };
    saveHotwords(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('[hotwords PUT]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/word', (req, res) => {
  try {
    const { word } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'word required' });
    }
    const data = loadHotwords();
    if (!data.hotwords.includes(word.trim())) {
      data.hotwords.push(word.trim());
      saveHotwords(data);
    }
    res.json({ ok: true, hotwords: data.hotwords });
  } catch (err) {
    console.error('[hotwords POST /word]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/word', (req, res) => {
  try {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: 'word required' });
    const data = loadHotwords();
    data.hotwords = data.hotwords.filter(w => w !== word);
    saveHotwords(data);
    res.json({ ok: true, hotwords: data.hotwords });
  } catch (err) {
    console.error('[hotwords DELETE /word]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/replacement', (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    const data = loadHotwords();
    data.replacements[from] = to;
    saveHotwords(data);
    res.json({ ok: true, replacements: data.replacements });
  } catch (err) {
    console.error('[hotwords POST /replacement]', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/replacement', (req, res) => {
  try {
    const { from } = req.body;
    if (!from) return res.status(400).json({ error: 'from required' });
    const data = loadHotwords();
    delete data.replacements[from];
    saveHotwords(data);
    res.json({ ok: true, replacements: data.replacements });
  } catch (err) {
    console.error('[hotwords DELETE /replacement]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
