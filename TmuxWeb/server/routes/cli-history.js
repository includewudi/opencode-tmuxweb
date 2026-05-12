const { createRouter } = require('cli-history-sdk/express');
const { execSync } = require('child_process');
const { translatePaneText } = require('../services/translator');

const baseRouter = createRouter();

// POST /capture-pane — capture terminal content via tmux
baseRouter.post('/capture-pane', (req, res) => {
  try {
    const { paneId } = req.body;
    if (!paneId) return res.status(400).json({ error: 'paneId required' });

    let text = '';
    try {
      text = execSync(`tmux capture-pane -p -t "${paneId}" -S -2000`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
    } catch (e) {
      if (!e.message || !e.message.includes('can\'t find pane')) throw e;
      // Internal PTY paneId (%NNN) not recognized — resolve via display-message
      try {
        const resolved = execSync(
          `tmux display-message -t "${paneId}" -p "#{session_name}:#{window_index}"`,
          { encoding: 'utf-8', timeout: 3000 }
        ).trim();
        if (!resolved) throw e;
        text = execSync(`tmux capture-pane -p -t "${resolved}" -S -2000`, {
          encoding: 'utf-8',
          timeout: 3000,
        }).trim();
      } catch (e2) { throw e2; }
    }

    if (!text) return res.json({ status: 'empty', text: '' });
    res.json({ status: 'ok', text });
  } catch (err) {
    console.error('[cli-history POST /capture-pane]', err.message);
    res.status(500).json({ error: 'capture_failed', message: err.message });
  }
});

// POST /translate-text — translate text via LLM
baseRouter.post('/translate-text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });

    const translated = await translatePaneText(text);
    if (!translated) {
      return res.json({ status: 'error', error: '翻译失败' });
    }
    res.json({ status: 'ok', translated });
  } catch (err) {
    console.error('[cli-history POST /translate-text]', err.message);
    res.status(500).json({ error: 'translate_failed', message: err.message });
  }
});

module.exports = baseRouter;
