/**
 * CLI History Express Plugin
 *
 * Creates an Express Router that serves CLI history API endpoints.
 *
 * Usage:
 *   const { createRouter } = require('cli-history-sdk/express');
 *   app.use('/api/cli-history', createRouter({ dbPath: '...' }));
 *
 * Endpoints:
 *   GET /providers        — list providers with status
 *   GET /sessions         — list sessions (?provider, ?search, ?limit, ?offset, ?directory)
 *   GET /sessions/:id     — session detail with messages
 *   GET /sessions/:id/tools — tool calls for a session
 *   GET /search           — cross-session search (?provider, ?q, ?limit)
 */
const express = require('express');

// Built-in provider registry
const BUILTIN_PROVIDERS = {
  opencode: require('./providers/opencode'),
};

// Lazy-loaded provider cache
const _providerInstances = {};

/**
 * Create an Express router for CLI history API.
 * @param {object} [opts]
 * @param {string[]} [opts.providers] - Provider names to enable. Defaults to ['opencode']
 * @param {object} [opts.providerOpts] - Options passed to provider factories (e.g. { dbPath })
 * @returns {express.Router}
 */
function createRouter(opts = {}) {
  const router = express.Router();
  const providerNames = opts.providers || ['opencode'];
  const providerOpts = opts.providerOpts || {};

  function getProvider(name) {
    if (_providerInstances[name]) return _providerInstances[name];
    const factory = BUILTIN_PROVIDERS[name];
    if (!factory) {
      console.error(`[cli-history] Unknown provider: "${name}"`);
      _providerInstances[name] = null;
      return null;
    }
    try {
      const provider = factory.createOpenCodeProvider
        ? factory.createOpenCodeProvider(providerOpts)
        : factory(providerOpts);
      _providerInstances[name] = provider;
      return provider;
    } catch (err) {
      console.error(`[cli-history] Provider "${name}" failed to initialize:`, err.message);
      _providerInstances[name] = null;
      return null;
    }
  }

  // GET /providers — list all configured providers
  router.get('/providers', (req, res) => {
    const providers = providerNames.map(name => {
      const p = getProvider(name);
      return {
        id: name,
        name: p?.name || name,
        enabled: p?.enabled || false,
      };
    });
    res.json({ providers });
  });

  function resolveProvider(req, res) {
    const name = req.query.provider || 'opencode';
    const p = getProvider(name);
    if (!p) {
      res.status(404).json({ error: 'unknown_provider', message: `Provider "${name}" not found` });
      return null;
    }
    if (!p.enabled) {
      res.status(503).json({ error: 'provider_disabled', message: `Provider "${p.name}" is not available` });
      return null;
    }
    return p;
  }

  // GET /sessions — list sessions with optional search
  router.get('/sessions', (req, res) => {
    try {
      const p = resolveProvider(req, res);
      if (!p) return;

      const result = p.listSessions({
        limit: req.query.limit,
        offset: req.query.offset,
        search: req.query.search,
        directory: req.query.directory,
      });
      res.json(result);
    } catch (err) {
      console.error('[cli-history GET /sessions]', err);
      res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  // GET /sessions/:id — session detail with messages
  router.get('/sessions/:id', (req, res) => {
    try {
      const p = resolveProvider(req, res);
      if (!p) return;

      const session = p.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'not_found', message: 'Session not found' });
      }
      res.json(session);
    } catch (err) {
      console.error('[cli-history GET /sessions/:id]', err);
      res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  // GET /sessions/:id/tools — tool calls for a session
  router.get('/sessions/:id/tools', (req, res) => {
    try {
      const p = resolveProvider(req, res);
      if (!p) return;

      const result = p.getToolCalls(req.params.id, {
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json(result);
    } catch (err) {
      console.error('[cli-history GET /sessions/:id/tools]', err);
      res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  // GET /search — cross-session search
  router.get('/search', (req, res) => {
    try {
      const p = resolveProvider(req, res);
      if (!p) return;

      const q = req.query.q || '';
      if (!q.trim()) {
        return res.status(400).json({ error: 'missing_query', message: 'Query parameter "q" is required' });
      }

      const results = p.search(q, { limit: req.query.limit });
      res.json({ results });
    } catch (err) {
      console.error('[cli-history GET /search]', err);
      res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  return router;
}

module.exports = { createRouter };
