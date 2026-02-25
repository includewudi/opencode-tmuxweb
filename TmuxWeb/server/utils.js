/**
 * Parse paneKey into components
 * Format: "sessionName:windowIndex:paneIndex"
 * Session names may contain colons, so we split from the right.
 */
function parsePaneKey(paneKey) {
    const parts = paneKey.split(':');
    if (parts.length < 3) return null;
    return {
        sessionName: parts.slice(0, -2).join(':'),
        windowIndex: parseInt(parts[parts.length - 2], 10),
        paneIndex: parts[parts.length - 1]
    };
}

module.exports = { parsePaneKey };
