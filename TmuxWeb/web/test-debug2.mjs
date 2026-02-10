import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  await page.goto('http://localhost:8215/?debug=1', { waitUntil: 'domcontentloaded' });
  
  // Wait for app to render
  for (let i = 0; i < 10; i++) {
    const wrapper = await page.locator('.terminal-wrapper').count();
    if (wrapper > 0) {
      console.log(`Found terminal-wrapper after ${i * 200}ms`);
      break;
    }
    await page.waitForTimeout(200);
  }
  
  await page.waitForTimeout(500);
  
  const debug = await page.evaluate(() => {
    const accessoryBar = document.querySelector('.accessory-bar');
    const wrapper = document.querySelector('.terminal-wrapper');
    const spacer = document.querySelector('.keyboard-spacer');
    const container = document.querySelector('.terminal-container');
    
    return {
      bodyChildren: document.body.children.length,
      accessoryBarExists: !!accessoryBar,
      wrapperExists: !!wrapper,
      spacerExists: !!spacer,
      containerExists: !!container,
      wrapperDisplay: wrapper ? window.getComputedStyle(wrapper).display : 'N/A',
      accessoryBarDisplay: accessoryBar ? window.getComputedStyle(accessoryBar).display : 'N/A'
    };
  });
  
  console.log('DEBUG:', JSON.stringify(debug, null, 2));
  
  await browser.close();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
