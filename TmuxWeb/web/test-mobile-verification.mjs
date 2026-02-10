import { chromium } from 'playwright';
import fs from 'fs';

async function testMobileAccessoryBar() {
  const browser = await chromium.launch();
  
  // Test 1: Mobile viewport with iOS user agent
  const mobileContext = await browser.createContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
  });
  
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:8215/', { waitUntil: 'networkidle' });
  
  // Get accessibility tree to check for accessory bar
  const mobileSnapshot = await mobilePage.evaluate(() => {
    const accessoryBar = document.querySelector('.accessory-bar');
    const buttons = accessoryBar ? Array.from(accessoryBar.querySelectorAll('button')).map(b => b.textContent.trim()) : [];
    return {
      accessoryBarVisible: !!accessoryBar,
      buttons: buttons,
      computedDisplay: accessoryBar ? window.getComputedStyle(accessoryBar).display : 'N/A'
    };
  });
  
  // Take screenshot
  await mobilePage.screenshot({ path: '../../.sisyphus/evidence/task-8-mobile-with-ua.png' });
  
  // Test 2: Desktop viewport (should NOT show accessory bar)
  const desktopContext = await browser.createContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://localhost:8215/', { waitUntil: 'networkidle' });
  
  const desktopSnapshot = await desktopPage.evaluate(() => {
    const accessoryBar = document.querySelector('.accessory-bar');
    return {
      accessoryBarVisible: !!accessoryBar,
      computedDisplay: accessoryBar ? window.getComputedStyle(accessoryBar).display : 'N/A'
    };
  });
  
  await desktopPage.screenshot({ path: '../../.sisyphus/evidence/task-8-desktop.png' });
  
  // Performance metrics (mobile)
  const perfMetrics = await mobilePage.evaluate(() => {
    const perf = window.performance;
    const navigation = perf.getEntriesByType('navigation')[0] || {};
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
      timeToFirstByte: navigation.responseStart - navigation.fetchStart,
      connected: navigation.connectEnd - navigation.connectStart
    };
  });
  
  await mobileContext.close();
  await desktopContext.close();
  await browser.close();
  
  return {
    mobile: mobileSnapshot,
    desktop: desktopSnapshot,
    performance: perfMetrics
  };
}

testMobileAccessoryBar().then(result => {
  console.log('Mobile Test Results:');
  console.log(JSON.stringify(result.mobile, null, 2));
  console.log('\nDesktop Test Results:');
  console.log(JSON.stringify(result.desktop, null, 2));
  console.log('\nPerformance Metrics:');
  console.log(JSON.stringify(result.performance, null, 2));
  
  // Write to file
  fs.writeFileSync('../../.sisyphus/evidence/task-8-performance.json', JSON.stringify(result, null, 2));
  console.log('\nResults saved to task-8-performance.json');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
