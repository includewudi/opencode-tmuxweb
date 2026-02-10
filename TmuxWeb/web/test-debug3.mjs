import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  // Enable logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE EXCEPTION:', err);
  });
  
  await page.goto('http://localhost:8215/?debug=1');
  
  // Wait for app
  await page.waitForSelector('.app', { timeout: 5000 }).catch(() => console.log('App selector not found'));
  
  await page.waitForTimeout(2000);
  
  const html = await page.evaluate(() => {
    const root = document.getElementById('root');
    const app = document.querySelector('.app');
    const panes = document.querySelector('.panes');
    
    return {
      rootExists: !!root,
      appExists: !!app,
      panesExists: !!panes,
      bodyHTML: document.body.innerHTML.substring(0, 500)
    };
  });
  
  console.log('HTML Debug:', JSON.stringify(html, null, 2));
  
  await browser.close();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
