const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Collect failed resource loads
  const failedResources = [];
  page.on('response', response => {
    if (!response.ok() && !response.url().includes('ws')) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle', timeout: 30000 });

  // Check computed styles on a key element
  const outerDiv = page.locator('body > div').first();
  const outerStyles = await outerDiv.evaluate(el => {
    const s = getComputedStyle(el);
    return {
      display: s.display,
      minHeight: s.minHeight,
      backgroundColor: s.backgroundColor,
      fontFamily: s.fontFamily,
      color: s.color,
    };
  });

  // Check for Tailwind-specific styles
  const loginCard = page.locator('.rounded-3xl, [class*="rounded-3xl"]').first();
  let cardStyles = null;
  try {
    cardStyles = await loginCard.evaluate(el => {
      const s = getComputedStyle(el);
      return {
        borderRadius: s.borderRadius,
        background: s.background,
        boxShadow: s.boxShadow,
        borderWidth: s.borderWidth,
      };
    });
  } catch(e) {
    cardStyles = 'not found';
  }

  // Check the page title
  const title = await page.title();

  console.log('=== PAGE TITLE:', title);
  console.log('=== OUTER DIV COMPUTED STYLES:', JSON.stringify(outerStyles));
  console.log('=== CARD STYLES:', JSON.stringify(cardStyles));
  console.log('=== FAILED RESOURCES:', failedResources.slice(0, 10));
  console.log('=== CONSOLE LOGS (last 10):', consoleLogs.slice(-10));

  // Take screenshot
  await page.screenshot({ path: 'C:/Users/lenovo/Desktop/new hotel/frontend/dev-screenshot.png', fullPage: true });
  console.log('Screenshot saved');

  await browser.close();
})();
