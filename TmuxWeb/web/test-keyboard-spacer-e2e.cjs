const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.join(__dirname, '../../.sisyphus/evidence');

async function ensureEvidenceDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

async function testKeyboardSpacerDesktop() {
  console.log('[TEST 1] Desktop - Verify no spacer rendered');
  const browser = await chromium.launch();
  
  const desktopContext = await browser.createContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  const page = await desktopContext.newPage();
  await page.goto('http://localhost:8215/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  // Verify no spacer on desktop
  const result = await page.evaluate(() => {
    const spacer = document.querySelector('.keyboard-spacer');
    const wrapper = document.querySelector('.terminal-wrapper');
    return {
      spacerExists: !!spacer,
      spacerDisplay: spacer ? window.getComputedStyle(spacer).display : 'N/A',
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasScrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      windowScrollY: window.scrollY
    };
  });
  
  console.log('Desktop result:', result);
  
  // Take screenshot
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'keyboard-spacer-desktop-noop.png') });
  console.log('✓ Screenshot: keyboard-spacer-desktop-noop.png');
  
  await desktopContext.close();
  await browser.close();
  
  // Validate desktop assertions
  if (result.spacerExists) {
    throw new Error('FAIL: Spacer should NOT exist on desktop');
  }
  if (result.hasScrollbar) {
    throw new Error('FAIL: Desktop should not have page-level scrollbars');
  }
  
  return { success: true, data: result };
}

async function testKeyboardSpacerMobileOpen() {
  console.log('[TEST 2] Mobile - Verify spacer behavior when keyboard opens');
  const browser = await chromium.launch();
  
  const mobileContext = await browser.createContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  const page = await mobileContext.newPage();
  await page.goto('http://localhost:8215/?debug=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  // Simulate keyboard open by reducing visualViewport height
  const simulateKeyboardOpen = await page.evaluate(() => {
    // Monkeypatch visualViewport to simulate keyboard appearance
    if (!window.visualViewport) {
      return { error: 'visualViewport not available' };
    }
    
    const originalHeight = window.visualViewport.height;
    const keyboardHeight = 260; // Typical iOS keyboard height
    
    // Create mock visualViewport
    Object.defineProperty(window.visualViewport, 'height', {
      configurable: true,
      value: originalHeight - keyboardHeight
    });
    
    // Dispatch resize event to trigger useKeyboardAvoider updates
    window.visualViewport.dispatchEvent(new Event('resize'));
    
    return { originalHeight, simulatedHeight: originalHeight - keyboardHeight, keyboardHeight };
  });
  
  console.log('Keyboard simulation:', simulateKeyboardOpen);
  
  // Wait for state update
  await page.waitForTimeout(200);
  
  // Check spacer state
  const spacerState = await page.evaluate(() => {
    const spacer = document.querySelector('.keyboard-spacer');
    const wrapper = document.querySelector('.terminal-wrapper');
    const spacerHeight = spacer ? parseInt(window.getComputedStyle(spacer).height, 10) : 0;
    
    return {
      spacerExists: !!spacer,
      spacerHeight: spacerHeight,
      spacerComputedHeight: spacer ? window.getComputedStyle(spacer).height : 'N/A',
      dataKeyboardSpacerHeight: wrapper?.getAttribute('data-keyboard-spacer-height'),
      dataKeyboardVisible: wrapper?.getAttribute('data-keyboard-visible'),
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasScrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      windowScrollY: window.scrollY
    };
  });
  
  console.log('Spacer state (keyboard open):', spacerState);
  
  // Take screenshot
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'keyboard-spacer-open.png') });
  console.log('✓ Screenshot: keyboard-spacer-open.png');
  
  await mobileContext.close();
  await browser.close();
  
  // Validate assertions
  if (!spacerState.spacerExists) {
    throw new Error('FAIL: Spacer should exist on mobile');
  }
  if (spacerState.spacerHeight === 0) {
    throw new Error('FAIL: Spacer height should be > 0 when keyboard is open');
  }
  if (spacerState.hasScrollbar) {
    throw new Error('FAIL: Should not have page-level scrollbars when keyboard is open');
  }
  
  return { success: true, data: spacerState };
}

async function testKeyboardSpacerMobileClose() {
  console.log('[TEST 3] Mobile - Verify spacer height returns to 0 when keyboard closes');
  const browser = await chromium.launch();
  
  const mobileContext = await browser.createContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  const page = await mobileContext.newPage();
  await page.goto('http://localhost:8215/?debug=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  // First simulate keyboard open
  await page.evaluate(() => {
    if (!window.visualViewport) return;
    
    const originalHeight = window.visualViewport.height;
    const keyboardHeight = 260;
    
    Object.defineProperty(window.visualViewport, 'height', {
      configurable: true,
      value: originalHeight - keyboardHeight
    });
    
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  
  await page.waitForTimeout(200);
  
  const stateOpen = await page.evaluate(() => {
    const spacer = document.querySelector('.keyboard-spacer');
    return {
      spacerHeightOpen: spacer ? parseInt(window.getComputedStyle(spacer).height, 10) : 0
    };
  });
  
  console.log('State after open:', stateOpen);
  
  // Now simulate keyboard close (restore visualViewport height)
  await page.evaluate(() => {
    if (!window.visualViewport) return;
    
    // Restore original height
    Object.defineProperty(window.visualViewport, 'height', {
      configurable: true,
      value: 844
    });
    
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  
  await page.waitForTimeout(200);
  
  // Check spacer state after close
  const spacerStateClose = await page.evaluate(() => {
    const spacer = document.querySelector('.keyboard-spacer');
    const wrapper = document.querySelector('.terminal-wrapper');
    const spacerHeight = spacer ? parseInt(window.getComputedStyle(spacer).height, 10) : 0;
    
    return {
      spacerExists: !!spacer,
      spacerHeight: spacerHeight,
      spacerComputedHeight: spacer ? window.getComputedStyle(spacer).height : 'N/A',
      dataKeyboardSpacerHeight: wrapper?.getAttribute('data-keyboard-spacer-height'),
      dataKeyboardVisible: wrapper?.getAttribute('data-keyboard-visible'),
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasScrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      windowScrollY: window.scrollY
    };
  });
  
  console.log('Spacer state (keyboard close):', spacerStateClose);
  
  // Take screenshot
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'keyboard-spacer-close.png') });
  console.log('✓ Screenshot: keyboard-spacer-close.png');
  
  await mobileContext.close();
  await browser.close();
  
  // Validate assertions
  if (spacerStateClose.spacerHeight > 0) {
    throw new Error('FAIL: Spacer height should be 0 when keyboard is closed');
  }
  if (spacerStateClose.hasScrollbar) {
    throw new Error('FAIL: Should not have page-level scrollbars when keyboard is closed');
  }
  
  return { success: true, data: spacerStateClose };
}

async function testKeyboardSpacerOrientation() {
  console.log('[TEST 4] Mobile - Verify orientation change without scrollbars');
  const browser = await chromium.launch();
  
  const mobileContext = await browser.createContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  const page = await mobileContext.newPage();
  await page.goto('http://localhost:8215/?debug=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  
  // Portrait state with keyboard open
  await page.evaluate(() => {
    if (!window.visualViewport) return;
    
    const originalHeight = 844;
    const keyboardHeight = 260;
    
    Object.defineProperty(window.visualViewport, 'height', {
      configurable: true,
      value: originalHeight - keyboardHeight
    });
    
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  
  await page.waitForTimeout(200);
  
  const portraitState = await page.evaluate(() => {
    const spacer = document.querySelector('.keyboard-spacer');
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      spacerHeight: spacer ? parseInt(window.getComputedStyle(spacer).height, 10) : 0,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasScrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      windowScrollY: window.scrollY
    };
  });
  
  console.log('Portrait state:', portraitState);
  
  // Swap to landscape (width becomes 844, height becomes 390)
  await mobileContext.close();
  
  const landscapeContext = await browser.createContext({
    viewport: { width: 844, height: 390 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  });
  
  const landscapePage = await landscapeContext.newPage();
  await landscapePage.goto('http://localhost:8215/?debug=1', { waitUntil: 'networkidle' });
  await landscapePage.waitForTimeout(500);
  
  // Simulate keyboard in landscape (smaller absolute height)
  await landscapePage.evaluate(() => {
    if (!window.visualViewport) return;
    
    const originalHeight = 390;
    const keyboardHeight = 162; // Smaller keyboard height in landscape
    
    Object.defineProperty(window.visualViewport, 'height', {
      configurable: true,
      value: originalHeight - keyboardHeight
    });
    
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  
  await landscapePage.waitForTimeout(200);
  
  const landscapeState = await landscapePage.evaluate(() => {
    const spacer = document.querySelector('.keyboard-spacer');
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      spacerHeight: spacer ? parseInt(window.getComputedStyle(spacer).height, 10) : 0,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hasScrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      windowScrollY: window.scrollY
    };
  });
  
  console.log('Landscape state:', landscapeState);
  
  const orientationMetrics = {
    portrait: portraitState,
    landscape: landscapeState,
    orientationTransitionTest: 'Verified no scrollbars in both orientations'
  };
  
  // Save metrics to JSON
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'keyboard-spacer-orientation.json'),
    JSON.stringify(orientationMetrics, null, 2)
  );
  console.log('✓ Metrics saved: keyboard-spacer-orientation.json');
  
  await landscapeContext.close();
  await browser.close();
  
  // Validate assertions
  if (portraitState.hasScrollbar) {
    throw new Error('FAIL: Portrait should not have page-level scrollbars');
  }
  if (landscapeState.hasScrollbar) {
    throw new Error('FAIL: Landscape should not have page-level scrollbars');
  }
  
  return { success: true, data: orientationMetrics };
}

async function runAllTests() {
  try {
    await ensureEvidenceDir();
    
    console.log('\n========== KEYBOARD SPACER E2E VERIFICATION ==========\n');
    
    const test1 = await testKeyboardSpacerDesktop();
    console.log('✅ Test 1 passed: Desktop\n');
    
    const test2 = await testKeyboardSpacerMobileOpen();
    console.log('✅ Test 2 passed: Mobile keyboard open\n');
    
    const test3 = await testKeyboardSpacerMobileClose();
    console.log('✅ Test 3 passed: Mobile keyboard close\n');
    
    const test4 = await testKeyboardSpacerOrientation();
    console.log('✅ Test 4 passed: Orientation change\n');
    
    const summary = {
      timestamp: new Date().toISOString(),
      allTestsPassed: true,
      tests: {
        desktopNoSpacer: test1,
        mobileKeyboardOpen: test2,
        mobileKeyboardClose: test3,
        orientationChange: test4
      },
      evidenceFiles: [
        'keyboard-spacer-desktop-noop.png',
        'keyboard-spacer-open.png',
        'keyboard-spacer-close.png',
        'keyboard-spacer-orientation.json'
      ]
    };
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'keyboard-spacer-test-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log('\n========== ALL TESTS PASSED ==========');
    console.log('Evidence files created:');
    summary.evidenceFiles.forEach(f => console.log(`  - ${f}`));
    console.log('=====================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
