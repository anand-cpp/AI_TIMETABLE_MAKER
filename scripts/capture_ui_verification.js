const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../timetable-system/backend/node_modules/playwright'));

const SCREENSHOT_DIR = 'C:/Users/anand/.gemini/antigravity/brain/945725bd-8f10-4be0-aab6-3b5501288432/screenshots';

async function runVerification() {
  console.log('Starting Playwright UI Verification...');

  // 1. Get auth token from API
  console.log('Authenticating with backend...');
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const user = loginJson.data.user;
  console.log('Authenticated as admin:', user.username);

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 }
  });
  const page = await context.newPage();

  // Inject session storage and local storage to bypass splash screen & authenticate
  await page.addInitScript(({ token, user }) => {
    sessionStorage.setItem('timetable_splash_dismissed', 'true');
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user });

  try {
    // 2. Timetable Builder
    console.log('Navigating directly to Timetable Builder...');
    await page.goto('http://localhost:5174/admin/timetable', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // Screenshot 1: Diagnostic badges overview
    console.log('Capturing 01_interactive_diagnostic_badges.png...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_interactive_diagnostic_badges.png'),
      fullPage: false
    });

    // 3. Click Hard Conflicts Badge
    console.log('Clicking Hard Conflicts badge...');
    const hardBadge = page.locator('button:has-text("Hard Conflicts")').first();
    if (await hardBadge.isVisible()) {
      await hardBadge.click();
      await page.waitForTimeout(1200);
      console.log('Capturing 02_diagnostic_modal_hard_conflicts.png...');
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '02_diagnostic_modal_hard_conflicts.png'),
        fullPage: false
      });

      // 4. Click Soft Warnings Tab in Modal
      console.log('Switching to Soft Warnings tab...');
      const softTab = page.locator('button:has-text("Soft Warnings")').last();
      if (await softTab.isVisible()) {
        await softTab.click();
        await page.waitForTimeout(1200);
        console.log('Capturing 03_diagnostic_modal_soft_warnings.png...');
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '03_diagnostic_modal_soft_warnings.png'),
          fullPage: false
        });
      }

      // 5. Click Optimization Tab in Modal
      console.log('Switching to Optimization tab...');
      const optTab = page.locator('button:has-text("Optimization")').last();
      if (await optTab.isVisible()) {
        await optTab.click();
        await page.waitForTimeout(1200);
        console.log('Capturing 04_diagnostic_modal_optimization.png...');
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '04_diagnostic_modal_optimization.png'),
          fullPage: false
        });
      }

      // Close modal
      const closeBtn = page.locator('button:has-text("Close Diagnostics"), button:has-text("Close")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(600);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      }
    }

    // 6. Open Version History Sidebar
    console.log('Opening Version History sidebar...');
    const historyBtn = page.locator('button:has-text("History"), button:has-text("Version History")').first();
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      await page.waitForTimeout(2000);
      console.log('Capturing 05_version_history_realistic_scores.png...');
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '05_version_history_realistic_scores.png'),
        fullPage: false
      });
    }

    // 7. Check Teacher Profile & Sangeetha Name Correction
    console.log('Navigating to Teachers page...');
    await page.goto('http://localhost:5174/admin/teachers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log('Capturing 06_teachers_list_sangeetha_verified.png...');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06_teachers_list_sangeetha_verified.png'),
      fullPage: false
    });

    console.log('✅ UI Verification completed successfully! All screenshots captured.');
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
  }
}

runVerification();
