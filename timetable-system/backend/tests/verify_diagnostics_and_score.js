const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const fs = require('fs');

const BASE_URL = 'http://localhost:5174';
const SCREENSHOTS_DIR = path.join(__dirname, 'diagnostics_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runVerification() {
  console.log('🚀 Starting Verification: Enhanced Diagnostics & Realistic Quality Scoring');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('timetable_splash_dismissed', 'true'); } catch {}
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    // 1. Admin Login
    console.log('Logging in as demo.admin...');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.locator('input[placeholder*="username" i]').fill('demo.admin');
    await page.locator('input[type="password"]').fill('DemoAdmin123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(url => !url.pathname.includes('/login') && url.pathname.includes('/admin'), { timeout: 10000 });
    console.log('✅ Logged in successfully');

    // 2. Open Timetable Builder
    await page.goto(`${BASE_URL}/admin/timetable`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // If version is not loaded automatically, click the first version in sidebar
    const firstVersionInSidebar = page.locator('div:has-text("Version")').first();
    if (!await page.locator('table').count()) {
      console.log('Selecting first version in sidebar...');
      await firstVersionInSidebar.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    // 3. Inspect Diagnostics Bar Badges & Sub-Summaries
    console.log('Checking Diagnostics Bar Badges & Descriptions...');
    const hardBadge = page.locator('button:has-text("Hard Conflicts")').first();
    const softBadge = page.locator('button:has-text("Soft Warnings")').first();
    const optBadge = page.locator('button:has-text("Optimization")').first();

    assert(await hardBadge.isVisible(), 'Hard Conflicts badge must be visible');
    assert(await softBadge.isVisible(), 'Soft Warnings badge must be visible');
    assert(await optBadge.isVisible(), 'Optimization badge must be visible');

    const hardText = await hardBadge.innerText();
    const softText = await softBadge.innerText();
    const optText = await optBadge.innerText();

    console.log(`✅ Hard Badge:\n   ${hardText.replace(/\n/g, ' | ')}`);
    console.log(`✅ Soft Badge:\n   ${softText.replace(/\n/g, ' | ')}`);
    console.log(`✅ Opt Badge:\n   ${optText.replace(/\n/g, ' | ')}`);

    assert(hardText.includes('FAILED') || hardText.includes('PASSED'), 'Hard badge must display status');
    assert(hardText.toLowerCase().includes('collision') || hardText.toLowerCase().includes('zero') || hardText.toLowerCase().includes('room') || hardText.toLowerCase().includes('booking') || hardText.toLowerCase().includes('assignment') || hardText.toLowerCase().includes('conflict'),
      'Hard badge must describe the specific issue');

    // Check Quality Score Pill in Diagnostics Bar
    const scorePill = page.locator('div:has-text("Score:")').last();
    assert(await scorePill.isVisible(), 'Score pill must be visible in diagnostics bar');
    const scoreText = await scorePill.innerText();
    console.log(`✅ Diagnostics Bar Score: "${scoreText.replace(/\n/g, ' ')}"`);
    assert(!scoreText.includes('100 / 100'), 'Timetable with 7 hard conflicts must NOT be scored 100/100');

    // 4. Click Hard Conflicts Badge to Open Inline Drawer
    console.log('Opening Inline Drawer for Hard Conflicts...');
    await hardBadge.click();
    await page.waitForTimeout(600);

    const drawer = page.locator('div:has-text("About Hard Conflicts")').first();
    assert(await drawer.isVisible(), 'About Hard Conflicts educational callout must appear when badge is clicked');
    console.log('✅ "About Hard Conflicts" callout is visible');

    // Verify Issue Cards
    const hardCards = page.locator('div:has-text("Double-Booking"), div:has-text("Laboratory Allocation"), div:has-text("Faculty Rest-Gap"), div:has-text("Double Booking")');
    const hardCardCount = await hardCards.count();
    console.log(`✅ Hard conflict issue cards rendered: ${hardCardCount}`);
    assert(hardCardCount > 0, 'Hard conflict issue cards must be rendered in the drawer');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_inline_hard_conflicts_drawer.png'), fullPage: true });

    // 5. Switch to Soft Warnings
    console.log('Switching to Soft Warnings...');
    await softBadge.click();
    await page.waitForTimeout(600);

    const softCallout = page.locator('div:has-text("About Soft Warnings")').first();
    assert(await softCallout.isVisible(), 'About Soft Warnings callout must be visible');
    const softCards = page.locator('div:has-text("High Consecutive Teaching Load")');
    const softCardCount = await softCards.count();
    console.log(`✅ Soft warning issue cards rendered: ${softCardCount}`);
    assert(softCardCount > 0, 'Soft warning issue cards must be rendered in the drawer');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_inline_soft_warnings_drawer.png'), fullPage: true });

    // 6. Switch to Optimization Opportunities
    console.log('Switching to Optimization...');
    await optBadge.click();
    await page.waitForTimeout(600);

    const optCallout = page.locator('div:has-text("About Optimization")').first();
    assert(await optCallout.isVisible(), 'About Optimization callout must be visible');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_inline_optimization_drawer.png'), fullPage: true });

    // 7. Verify Version History Cards: Realistic Score & Real Conflicts
    console.log('Checking Version History Sidebar cards...');
    const versionCards = page.locator('div:has-text("/100")');
    const firstVersionScore = await versionCards.first().innerText();
    console.log(`✅ Version Card Score preview:\n   ${firstVersionScore.substring(0, 150).replace(/\n/g, ' ')}`);

    const conflictPills = page.locator('span:has-text("CONFLICTS"), p:has-text("hard conflict")');
    const conflictPillCount = await conflictPills.count();
    console.log(`✅ Version history conflict warnings count: ${conflictPillCount}`);
    assert(conflictPillCount > 0, 'Versions with hard conflicts must display conflict warnings instead of 100% placed');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_version_history_realistic_scores.png'), fullPage: true });

    // 8. Test "Locate in Grid"
    console.log('Testing "Locate in Grid" from inline drawer...');
    await hardBadge.click();
    await page.waitForTimeout(600);
    const locateBtn = page.locator('button:has-text("Locate in Grid")').first();
    assert(await locateBtn.isVisible(), 'Locate in Grid button must be visible');
    await locateBtn.click();
    await page.waitForTimeout(800);

    const focusBanner = page.locator('div:has-text("Diagnostic Focus:")').first();
    assert(await focusBanner.isVisible(), 'Diagnostic Focus banner must be visible after locating cell');
    console.log('✅ Diagnostic Focus banner visible');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_locate_in_grid_focused.png'), fullPage: true });

    console.log('\n========================================================================');
    console.log('🎉 ALL DIAGNOSTICS & SCORING VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================');

  } catch (err) {
    console.error('❌ Verification failed:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runVerification().catch(e => {
  console.error(e);
  process.exit(1);
});
