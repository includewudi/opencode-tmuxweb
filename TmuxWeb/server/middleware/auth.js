const config = require('../config-loader');
const { verifySessionValue, COOKIE_NAME } = require('../routes/auth');

function validateToken(token) {
  return token === config.token;
}

function tokenMiddleware(req, res, next) {
  let token = null;
  
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    token = verifySessionValue(req.cookies[COOKIE_NAME]);
    if (token && validateToken(token)) {
      req.token = token;
      return next();
    }
  }
  
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.token = token;
  next();
}

module.exports = { tokenMiddleware, validateToken };
