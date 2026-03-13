const express = require('express');

const router = express.Router();

const taskStatus = new Map();

router.post('/callback', (req, res) => {
  const { paneId, taskId, status, message } = req.body;

  if (!paneId || !taskId || !status) {
    return res.status(400).json({ error: 'Missing required fields: paneId, taskId, status' });
  }

  taskStatus.set(paneId, {
    taskId,
    status,
    message: message || '',
    updatedAt: new Date().toISOString()
  });

  res.json({ success: true });
});

router.get('/state', (req, res) => {
  const state = {};
  for (const [paneId, data] of taskStatus) {
    state[paneId] = data;
  }
  res.json(state);
});

module.exports = router;
