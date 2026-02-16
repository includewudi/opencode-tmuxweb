/**
 * Xunfei (讯飞) Speech-to-Text WebSocket Proxy
 * 
 * Bridges browser audio → Xunfei streaming ASR API.
 * Protocol: client sends {type: "start"/"audio"/"stop"}, server replies {type: "ready"/"partial"/"end"/"error"}.
 * 
 * Ported from TmuxWeb/server/services/speech.js
 */
const crypto = require('crypto');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('./config');

const XFYUN_HOST = config.xfyun?.host || 'iat.cn-huabei-1.xf-yun.com';
const XFYUN_PATH = config.xfyun?.path || '/v1';

const PROXY_URL = process.env.https_proxy || process.env.HTTPS_PROXY || null;
const proxyAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

const XFYUN_CONFIG = {
    appId: process.env.XFYUN_APP_ID || config.xfyun?.appId || '',
    apiKey: process.env.XFYUN_API_KEY || config.xfyun?.apiKey || '',
    apiSecret: process.env.XFYUN_API_SECRET || config.xfyun?.apiSecret || '',
};

// --- Auth URL Generation (HMAC-SHA256) ---
function generateAuthUrl() {
    const { apiKey, apiSecret } = XFYUN_CONFIG;
    const date = new Date().toUTCString();
    const signatureOrigin = `host: ${XFYUN_HOST}\ndate: ${date}\nGET ${XFYUN_PATH} HTTP/1.1`;

    const signature = crypto
        .createHmac('sha256', apiSecret)
        .update(signatureOrigin)
        .digest('base64');

    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return `wss://${XFYUN_HOST}${XFYUN_PATH}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(XFYUN_HOST)}`;
}

// --- Xunfei Frame Construction ---
function createFirstFrame(audioBase64, seq) {
    return JSON.stringify({
        header: { app_id: XFYUN_CONFIG.appId, res_id: 'hot_words', status: 0 },
        parameter: {
            iat: {
                domain: 'slm',
                language: 'zh_cn',
                accent: 'mandarin',
                eos: 6000,
                vinfo: 1,
                dwa: 'wpgs',
                result: { encoding: 'utf8', compress: 'raw', format: 'json' }
            }
        },
        payload: {
            audio: {
                encoding: 'raw', sample_rate: 16000, channels: 1,
                bit_depth: 16, seq, status: 0, audio: audioBase64
            }
        }
    });
}

function createMiddleFrame(audioBase64, seq) {
    return JSON.stringify({
        header: { app_id: XFYUN_CONFIG.appId, res_id: 'hot_words', status: 1 },
        payload: {
            audio: {
                encoding: 'raw', sample_rate: 16000, channels: 1,
                bit_depth: 16, seq, status: 1, audio: audioBase64
            }
        }
    });
}

function createLastFrame(seq) {
    return JSON.stringify({
        header: { app_id: XFYUN_CONFIG.appId, res_id: 'hot_words', status: 2 },
        payload: {
            audio: {
                encoding: 'raw', sample_rate: 16000, channels: 1,
                bit_depth: 16, seq, status: 2, audio: ''
            }
        }
    });
}

// --- Result Parsing ---
function parseResult(response) {
    try {
        const data = JSON.parse(response);

        // Defensive: check for header existence
        if (!data || !data.header) {
            console.error('[Speech] Unexpected response format:', JSON.stringify(data).substring(0, 200));
            return { error: 'Unexpected response format (no header)' };
        }

        if (data.header.code !== 0) {
            return { error: `code ${data.header.code}: ${data.header.message || 'unknown'}` };
        }

        // IAT v2: result is in payload.result.text (NOT base64 for standard iat)
        if (data.payload?.result?.text) {
            let textData;
            try {
                // Try base64 decode first (大模型 API format)
                textData = JSON.parse(
                    Buffer.from(data.payload.result.text, 'base64').toString('utf8')
                );
            } catch {
                // Might be plain text/JSON already
                try {
                    textData = typeof data.payload.result.text === 'string'
                        ? JSON.parse(data.payload.result.text)
                        : data.payload.result.text;
                } catch {
                    return { text: data.payload.result.text, status: data.header.status };
                }
            }

            let text = '';
            if (textData.ws) {
                for (const word of textData.ws) {
                    if (word.cw) {
                        for (const cw of word.cw) {
                            text += cw.w || '';
                        }
                    }
                }
            }
            return { text, sn: textData.sn, ls: textData.ls, pgs: textData.pgs, rg: textData.rg, status: data.header.status };
        }

        return { status: data.header.status };
    } catch (e) {
        console.error('[Speech] Parse exception:', e.message, 'raw:', response.toString().substring(0, 200));
        return { error: e.message };
    }
}

// --- Speech Connection Handler ---
function handleSpeechConnection(clientWs) {
    let xfyunWs = null;
    let seq = 0;
    let isFirstFrame = true;

    console.log('[Speech] Client connected');

    clientWs.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type === 'start') {
                const url = generateAuthUrl();
                console.log('[Speech] Connecting to Xunfei...');
                console.log('[Speech] URL:', url.substring(0, 100) + '...');
                console.log('[Speech] Proxy:', proxyAgent ? 'enabled' : 'disabled');

                xfyunWs = new WebSocket(url, { agent: proxyAgent });

                xfyunWs.on('open', () => {
                    console.log('[Speech] Xunfei connected');
                    clientWs.send(JSON.stringify({ type: 'ready' }));
                });

                xfyunWs.on('message', (msg) => {
                    const raw = msg.toString();
                    console.log('[Speech] Xunfei raw:', raw.substring(0, 300));
                    const result = parseResult(raw);

                    if (result.error) {
                        console.error('[Speech] Xunfei error:', result.error);
                        clientWs.send(JSON.stringify({ type: 'error', message: result.error }));
                        return;
                    }

                    if (result.text !== undefined) {
                        clientWs.send(JSON.stringify({
                            type: 'partial', text: result.text, sn: result.sn, ls: result.ls,
                            pgs: result.pgs, rg: result.rg
                        }));
                    }

                    if (result.status === 2) {
                        console.log('[Speech] Recognition complete');
                        clientWs.send(JSON.stringify({ type: 'end' }));
                    }
                });

                xfyunWs.on('error', (err) => {
                    console.error('[Speech] Xunfei error:', err.message);
                    clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
                });

                xfyunWs.on('close', () => {
                    console.log('[Speech] Xunfei disconnected');
                });

            } else if (data.type === 'audio') {
                if (!xfyunWs || xfyunWs.readyState !== WebSocket.OPEN) return;

                seq++;
                const frame = isFirstFrame
                    ? (isFirstFrame = false, createFirstFrame(data.audio, seq))
                    : createMiddleFrame(data.audio, seq);
                xfyunWs.send(frame);

            } else if (data.type === 'stop') {
                if (xfyunWs && xfyunWs.readyState === WebSocket.OPEN) {
                    seq++;
                    xfyunWs.send(createLastFrame(seq));
                }
            }
        } catch (e) {
            console.error('[Speech] Parse error:', e.message);
        }
    });

    clientWs.on('close', () => {
        console.log('[Speech] Client disconnected');
        if (xfyunWs) xfyunWs.close();
    });

    clientWs.on('error', (err) => {
        console.error('[Speech] Client error:', err.message);
        if (xfyunWs) xfyunWs.close();
    });
}

module.exports = { handleSpeechConnection };
