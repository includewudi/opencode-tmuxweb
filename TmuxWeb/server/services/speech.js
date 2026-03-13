const crypto = require('crypto');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const config = require('../config-loader');

const XFYUN_HOST = 'iat.xf-yun.com';
const XFYUN_PATH = '/v1';

const HOTWORDS_PATH = path.join(__dirname, '..', 'hotwords.json');

function loadHotwords() {
  try {
    const raw = fs.readFileSync(HOTWORDS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { hotwords: [], replacements: {} };
  }
}

function buildDhw() {
  const { hotwords } = loadHotwords();
  if (!hotwords.length) return null;
  const dhw = 'utf-8;' + hotwords.join('|');
  if (dhw.length > 1024) {
    return dhw.slice(0, 1024);
  }
  return dhw;
}

function applyReplacements(text) {
  const { replacements } = loadHotwords();
  if (!replacements || !Object.keys(replacements).length) return text;
  let result = text;
  for (const [from, to] of Object.entries(replacements)) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }
  return result;
}

function generateAuthUrl() {
  const { apiKey, apiSecret } = config.xfyun;
  
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${XFYUN_HOST}\ndate: ${date}\nGET ${XFYUN_PATH} HTTP/1.1`;
  
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');
  
  const url = `wss://${XFYUN_HOST}${XFYUN_PATH}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(XFYUN_HOST)}`;
  
  return url;
}

function createFirstFrame(audioBase64, seq) {
  const iatParams = {
    domain: 'slm',
    language: 'zh_cn',
    accent: 'mandarin',
    eos: 6000,
    vinfo: 1,
    dwa: 'wpgs',
    result: {
      encoding: 'utf8',
      compress: 'raw',
      format: 'json'
    }
  };
  const dhw = buildDhw();
  if (dhw) iatParams.dhw = dhw;

  return JSON.stringify({
    header: {
      app_id: config.xfyun.appId,
      status: 0
    },
    parameter: { iat: iatParams },
    payload: {
      audio: {
        encoding: 'raw',
        sample_rate: 16000,
        channels: 1,
        bit_depth: 16,
        seq: seq,
        status: 0,
        audio: audioBase64
      }
    }
  });
}

function createMiddleFrame(audioBase64, seq) {
  return JSON.stringify({
    header: {
      app_id: config.xfyun.appId,
      status: 1
    },
    payload: {
      audio: {
        encoding: 'raw',
        sample_rate: 16000,
        seq: seq,
        status: 1,
        audio: audioBase64
      }
    }
  });
}

function createLastFrame(seq) {
  return JSON.stringify({
    header: {
      app_id: config.xfyun.appId,
      status: 2
    },
    payload: {
      audio: {
        encoding: 'raw',
        sample_rate: 16000,
        seq: seq,
        status: 2,
        audio: ''
      }
    }
  });
}

function parseResult(response) {
  try {
    const data = JSON.parse(response);
    if (data.header.code !== 0) {
      return { error: data.header.message };
    }
    
    if (data.payload && data.payload.result && data.payload.result.text) {
      const textData = JSON.parse(Buffer.from(data.payload.result.text, 'base64').toString('utf8'));
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
      return { 
        text: applyReplacements(text), 
        sn: textData.sn, 
        ls: textData.ls,
        pgs: textData.pgs,
        rg: textData.rg,
        status: data.header.status 
      };
    }
    
    return { status: data.header.status };
  } catch (e) {
    return { error: e.message };
  }
}

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
        console.log('[Speech] Connecting to XFYun...');
        
        xfyunWs = new WebSocket(url);
        
        xfyunWs.on('open', () => {
          console.log('[Speech] XFYun connected');
          clientWs.send(JSON.stringify({ type: 'ready' }));
        });
        
        xfyunWs.on('message', (msg) => {
          const result = parseResult(msg.toString());
          
          if (result.error) {
            console.error('[Speech] XFYun error:', result.error);
            clientWs.send(JSON.stringify({ type: 'error', message: result.error }));
            return;
          }
          
          if (result.text) {
            clientWs.send(JSON.stringify({ 
              type: 'partial', 
              text: result.text,
              sn: result.sn,
              ls: result.ls,
              pgs: result.pgs,
              rg: result.rg
            }));
          }
          
          if (result.status === 2) {
            console.log('[Speech] Recognition complete');
            clientWs.send(JSON.stringify({ type: 'end' }));
          }
        });
        
        xfyunWs.on('error', (err) => {
          console.error('[Speech] XFYun WebSocket error:', err.message);
          clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
        });
        
        xfyunWs.on('close', () => {
          console.log('[Speech] XFYun disconnected');
        });
        
      } else if (data.type === 'audio') {
        if (!xfyunWs || xfyunWs.readyState !== WebSocket.OPEN) {
          return;
        }
        
        seq++;
        let frame;
        if (isFirstFrame) {
          frame = createFirstFrame(data.audio, seq);
          isFirstFrame = false;
        } else {
          frame = createMiddleFrame(data.audio, seq);
        }
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
    if (xfyunWs) {
      xfyunWs.close();
    }
  });
  
  clientWs.on('error', (err) => {
    console.error('[Speech] Client error:', err.message);
    if (xfyunWs) {
      xfyunWs.close();
    }
  });
}

module.exports = { handleSpeechConnection };
