const express = require('express');
const config = require('../config-loader');
const { ROLE_DEFS, getAllRoleDefs } = require('./roles');

const router = express.Router();

async function generateAiCommand(prompt, role) {
  const allDefs = getAllRoleDefs();
  const roleDef = allDefs[role] || ROLE_DEFS.cli;
  const systemPrompt = roleDef.prompt + '\n\n' + roleDef.suffix;

  const roleConfig = config.llm?.roles?.[role] || {};
  const defaultApiKey = process.env.LLM_API_KEY || config.llm?.apiKey;
  const defaultApiUrl = process.env.LLM_API_URL || config.llm?.apiUrl || 'https://api.deerapi.com/v1/chat/completions';
  const defaultModel = process.env.LLM_MODEL || config.llm?.model || 'deepseek-v3.2';

  const apiKey = roleConfig.apiKey || defaultApiKey;
  const apiUrl = roleConfig.apiUrl || defaultApiUrl;
  const model = roleConfig.model || defaultModel;

  if (!apiKey) {
    return {
      command: prompt.trim(),
      explanation: '⚠️ 未配置 LLM API。在 config_private.json 中设置 llm.apiKey 后可启用 AI 生成。'
    };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  });

  const data = await response.json();
  if (data.error) {
    return { command: '', explanation: 'API 错误: ' + (data.error.message || JSON.stringify(data.error)) };
  }

  const content = data.choices?.[0]?.message?.content?.trim() || '';
  const codeMatch = content.match(/```(?:\w+)?\n?([\s\S]*?)```/);
  const command = codeMatch ? codeMatch[1].trim() : content;
  return { command, explanation: `[${role}] ${model}` };
}

router.post('/command', async (req, res) => {
  try {
    const { prompt, role = 'cli' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const result = await generateAiCommand(prompt, role);
    res.json(result);
  } catch (err) {
    console.error('[POST /api/ai/command]', err);
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = router;
