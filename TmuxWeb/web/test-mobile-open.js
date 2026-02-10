const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.createContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:8215/?debug=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  // Simulate keyboard
  await page.evaluate(() => {
    if (window.visualViewport) {
      Object.defineProperty(window.visualViewport, 'height', {
        configurable: true,
        value: 844 - 260
      });
      window.visualViewport.dispatchEvent(new Event('resize'));
    }
  });
  
  await page.waitForTimeout(300);
  
  const result = await page.evaluate(() => {
    const spacer = document.querySelector('.keyboard-spacer');
    return {
      spacerExists: !!spacer,
      spacerHeight: spacer ? parseInt(window.getComputedStyle(spacer).height, 10) : 0,
      hasScrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1
    };
  });
  
  console.log('Spacer state (keyboard open):', JSON.stringify(result, null, 2));
  
  await page.screenshot({ path: '../../.sisyphus/evidence/keyboard-spacer-open.png' });
  
  await context.close();
  await browser.close();
  
  if (!result.spacerExists) { throw new Error('Spacer should exist'); }
  if (result.spacerHeight === 0) { throw new Error('Spacer height should be > 0'); }
  if (result.hasScrollbar) { throw new Error('Should not have scrollbars'); }
  
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
