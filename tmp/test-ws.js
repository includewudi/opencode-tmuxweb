const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--ignore-certificate-errors', '--no-sandbox'],
    defaultViewport: {
      width: 375,
      height: 812,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    }
  });

  const page = await browser.newPage();
  
  // Override user agent for mobile
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const logEntry = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(logEntry);
    console.log('CONSOLE:', logEntry);
  });

  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log('PAGE ERROR:', err.message);
  });

  // Intercept WebSocket connections
  const wsConnections = [];
  const wsMessages = [];
  
  // Enable CDP for WebSocket monitoring
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.enable');
  
  cdp.on('Network.webSocketCreated', (params) => {
    console.log('WS CREATED:', params.url);
    wsConnections.push({
      url: params.url,
      id: params.requestId,
      time: new Date().toISOString()
    });
  });

  cdp.on('Network.webSocketFrameReceived', (params) => {
    console.log('WS RECV:', params.response.payloadData?.substring(0, 200));
    wsMessages.push({ type: 'received', data: params.response.payloadData, requestId: params.requestId });
  });

  cdp.on('Network.webSocketFrameSent', (params) => {
    console.log('WS SENT:', params.response.payloadData?.substring(0, 200));
    wsMessages.push({ type: 'sent', data: params.response.payloadData, requestId: params.requestId });
  });

  cdp.on('Network.webSocketClosed', (params) => {
    console.log('WS CLOSED:', params);
    const conn = wsConnections.find(c => c.id === params.requestId);
    if (conn) {
      conn.closed = true;
      conn.closeTime = new Date().toISOString();
    }
  });

  cdp.on('Network.webSocketFrameError', (params) => {
    console.log('WS ERROR:', params);
  });

  // Monitor responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/ws/')) {
      console.log('WS RESPONSE:', url, 'Status:', response.status());
    }
  });

  // Navigate to the page
  console.log('Navigating to https://172.29.15.223:5215/m?debug=1');
  await page.goto('https://172.29.15.223:5215/m?debug=1', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });

  console.log('Page loaded:', page.url());
  await page.screenshot({ path: 'tmp/01-initial.png' });

  // Wait a bit for any auth redirects
  await new Promise(r => setTimeout(r, 2000));

  // Check if we need to login (look for token input)
  const tokenInput = await page.$('input[type="text"], input[type="password"], input[placeholder*="token" i]');
  
  if (tokenInput) {
    console.log('Login page detected, entering token...');
    await page.type('input', 'tmuxweb-dev-token');
    
    // Try to find and click login button
    const loginBtn = await page.$('button, input[type="submit"], [type="button"]');
    if (loginBtn) {
      await loginBtn.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    await page.screenshot({ path: 'tmp/02-after-login.png' });
  }

  console.log('Current URL after login check:', page.url());

  // Wait for page to be ready
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'tmp/03-main-page.png' });

  // Look for drawer button (hamburger menu, menu button, etc.)
  console.log('Looking for drawer/pane selector...');
  
  // Try various selectors for drawer/menu buttons
  const drawerSelectors = [
    'button[aria-label*="menu" i]',
    'button[aria-label*="drawer" i]', 
    '[class*="menu"]',
    '[class*="drawer"]',
    '[class*="hamburger"]',
    'button.menu',
    'svg[class*="menu"]',
    'button:has(svg)',
    '[data-testid*="menu"]'
  ];

  let drawerOpened = false;
  for (const selector of drawerSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        console.log('Found drawer button:', selector);
        await btn.click();
        await new Promise(r => setTimeout(r, 1000));
        drawerOpened = true;
        await page.screenshot({ path: 'tmp/04-drawer-opened.png' });
        break;
      }
    } catch (e) {}
  }

  if (!drawerOpened) {
    // Try clicking on any visible button that might open the drawer
    const buttons = await page.$$('button');
    console.log('Found buttons:', buttons.length);
    
    // Take a screenshot to see what's available
    await page.screenshot({ path: 'tmp/04-no-drawer-found.png' });
  }

  // Look for pane items to click
  console.log('Looking for pane items...');
  const paneSelectors = [
    '[class*="pane"]',
    '[class*="session"]',
    'li[role="button"]',
    '[data-pane-id]',
    '.pane-item'
  ];

  for (const selector of paneSelectors) {
    try {
      const panes = await page.$$(selector);
      if (panes.length > 0) {
        console.log('Found panes with selector:', selector, 'count:', panes.length);
        await panes[0].click();
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: 'tmp/05-pane-selected.png' });
        break;
      }
    } catch (e) {}
  }

  // Wait to capture WS activity
  console.log('\n--- Waiting 5 seconds for WebSocket activity ---');
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: 'tmp/06-final.png' });

  // Get page content for debugging
  const html = await page.content();
  require('fs').writeFileSync('tmp/page-content.html', html);

  // Summary
  console.log('\n========== SUMMARY ==========');
  console.log('WebSocket Connections:', JSON.stringify(wsConnections, null, 2));
  console.log('\nConsole Logs:', consoleLogs);
  console.log('\nPage Errors:', pageErrors);
  console.log('\nWS Messages count:', wsMessages.length);
  console.log('\nScreenshots saved to tmp/');

  // Keep browser open for a bit longer
  console.log('\nKeeping browser open for 10 more seconds...');
  await new Promise(r => setTimeout(r, 10000));

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
