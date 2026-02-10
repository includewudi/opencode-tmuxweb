import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  await page.goto('http://localhost:8215/?debug=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  const debug = await page.evaluate(() => {
    const accessoryBar = document.querySelector('.accessory-bar');
    const wrapper = document.querySelector('.terminal-wrapper');
    const spacer = document.querySelector('.keyboard-spacer');
    
    return {
      userAgent: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      accessoryBarExists: !!accessoryBar,
      wrapperExists: !!wrapper,
      spacerExists: !!spacer,
      wrapperHTML: wrapper ? wrapper.outerHTML.substring(0, 200) : 'NO WRAPPER'
    };
  });
  
  console.log('DEBUG:', JSON.stringify(debug, null, 2));
  
  await browser.close();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
