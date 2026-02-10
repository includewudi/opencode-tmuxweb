import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  page.on('console', msg => {
    if (msg.type() === 'log' && msg.text().includes('auth')) {
      console.log('LOG:', msg.text());
    }
  });
  
  await page.goto('http://localhost:8215/?debug=1');
  
  // Wait for login modal
  await page.waitForSelector('.login-modal', { timeout: 5000 });
  
  // Try to login - assuming there's a test token or we can use any token for testing
  const tokenInput = await page.locator('input[name="token"], input[placeholder*="token"], input#token').first();
  if ((await tokenInput.count()) > 0) {
    await tokenInput.fill('test-token-123');
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Submit")').first().click();
    
    // Wait for navigation
    await page.waitForNavigation().catch(() => console.log('No navigation'));
    await page.waitForTimeout(2000);
  }
  
  // Check if app loaded
  const wrapper = await page.locator('.terminal-wrapper').count();
  console.log(`Terminal wrapper found: ${wrapper > 0}`);
  
  const debug = await page.evaluate(() => {
    const wrapper = document.querySelector('.terminal-wrapper');
    const spacer = document.querySelector('.keyboard-spacer');
    const accessoryBar = document.querySelector('.accessory-bar');
    
    return {
      wrapperExists: !!wrapper,
      spacerExists: !!spacer,
      accessoryBarExists: !!accessoryBar,
      locationHref: window.location.href
    };
  });
  
  console.log('APP State:', JSON.stringify(debug, null, 2));
  
  await browser.close();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
