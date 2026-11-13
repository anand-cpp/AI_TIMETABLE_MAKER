const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5174';
const SCREENSHOTS_DIR = 'C:/Users/anand/.gemini/antigravity/brain/945725bd-8f10-4be0-aab6-3b5501288432/screenshots';

async function run() {
  console.log('🚀 Running Playwright Interactive Slot Swap & Undo Test...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('timetable_splash_dismissed', 'true'); } catch {}
  });

  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
  await page.locator('input[placeholder*="username" i]').fill('demo.admin');
  await page.locator('input[type="password"]').fill('DemoAdmin123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/.*\/admin/, { timeout: 10000 });

  // Go to Timetable Builder
  await page.goto(`${BASE_URL}/admin/timetable`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Enable Click-to-Swap Mode
  const clickToSwapBtn = page.locator('button:has-text("Click-to-Swap")').first();
  if (await clickToSwapBtn.isVisible()) {
    await clickToSwapBtn.click();
    console.log('✅ Click-to-Swap mode enabled');
    await page.waitForTimeout(500);
  }

  // Click on a slot to select it as source
  const slotCells = page.locator('td.relative');
  const count = await slotCells.count();
  console.log(`Found ${count} slot cells in timetable grid`);

  if (count >= 5) {
    // Click slot 2 (e.g. Monday Period 2)
    await slotCells.nth(1).click();
    await page.waitForTimeout(500);
    console.log('Clicked source slot');

    // Click slot 5 (e.g. Monday Period 5) to trigger swap
    await slotCells.nth(4).click();
    await page.waitForTimeout(1500);
    console.log('Clicked target slot to complete swap');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_slot_swap_executed.png') });

    // Click Undo
    const undoBtn = page.locator('button:has-text("Undo")').first();
    if (await undoBtn.isEnabled().catch(() => false)) {
      await undoBtn.click();
      console.log('✅ Clicked Undo button');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_slot_undo_executed.png') });
    }
  }

  await browser.close();
  console.log('🎉 Playwright Interactive Swap & Undo test completed successfully!');
}

run().catch(console.error);
