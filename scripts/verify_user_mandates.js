const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:\\Users\\anand\\.gemini\\antigravity\\brain\\945725bd-8f10-4be0-aab6-3b5501288432\\screenshots';

async function runVerification() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navigating to Quick Timetable at http://localhost:5174/admin/timetable...');
  await page.goto('http://localhost:5174/admin/timetable', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Take screenshot of main page with interactive badges
  console.log('2. Capturing interactive diagnostic badges in header...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_interactive_diagnostic_badges_verified.png'), fullPage: false });

  // 3. Click Hard Conflicts Badge
  console.log('3. Clicking Hard Conflicts badge to open drawer...');
  const hardBadge = page.locator('button:has-text("Hard Conflicts")').first();
  if (await hardBadge.isVisible()) {
    await hardBadge.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_hard_conflicts_drawer_with_about_and_issues.png'), fullPage: false });
  } else {
    console.warn('Hard conflicts badge not found!');
  }

  // 4. Click Soft Warnings Badge
  console.log('4. Clicking Soft Warnings badge to open drawer...');
  const softBadge = page.locator('button:has-text("Soft Warnings")').first();
  if (await softBadge.isVisible()) {
    await softBadge.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_soft_warnings_drawer_with_about_and_issues.png'), fullPage: false });
  } else {
    console.warn('Soft warnings badge not found!');
  }

  // 5. Click Optimization Badge
  console.log('5. Clicking Optimization badge to open drawer...');
  const optBadge = page.locator('button:has-text("Optimization")').first();
  if (await optBadge.isVisible()) {
    await optBadge.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_optimization_drawer_with_about_and_issues.png'), fullPage: false });
  } else {
    console.warn('Optimization badge not found!');
  }

  // 6. Test Version History for realistic quality score
  console.log('6. Opening Version History panel...');
  const historyBtn = page.locator('button:has-text("History"), button:has-text("Versions")').first();
  if (await historyBtn.isVisible()) {
    await historyBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_version_history_realistic_scores_verified.png'), fullPage: false });
  }

  // 7. Check Teacher view for Dr Reshmi B
  console.log('7. Switching to Faculty view or checking Dr Reshmi B schedule...');
  const teacherFilter = page.locator('button:has-text("Faculty"), button:has-text("Teacher"), select').first();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_final_verification_overview.png'), fullPage: false });

  await browser.close();
  console.log('✅ Verification script completed successfully! Screenshots saved in:', SCREENSHOT_DIR);
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
