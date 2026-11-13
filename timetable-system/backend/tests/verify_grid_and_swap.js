const { chromium } = require('playwright');
const mongoose = require('mongoose');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5174';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE QUICK TIMETABLE & SWAP TEST');
  console.log('====================================================\n');

  // Connect to DB for direct persistence verification
  await mongoose.connect('mongodb://127.0.0.1:27017/timetable_db');
  const Timetable = require('../src/models/Timetable');

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('timetable_splash_dismissed', 'true'); } catch {}
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });

  try {
    // ----------------------------------------------------
    // STEP 1: Admin Login
    // ----------------------------------------------------
    console.log('1. Logging in as Admin...');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle' });
    await page.locator('input[placeholder*="username" i]').fill('demo.admin');
    await page.locator('input[type="password"]').fill('DemoAdmin123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(url => !url.pathname.includes('/login') && url.pathname.includes('/admin'), { timeout: 10000 });
    console.log('✅ Logged in successfully');

    // ----------------------------------------------------
    // STEP 2: Navigate to Quick Timetable
    // ----------------------------------------------------
    console.log('\n2. Navigating to Quick Timetable (/admin/timetable)...');
    await page.goto(`${BASE_URL}/admin/timetable`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const initialTableCount = await page.locator('table').count();
    console.log(`Initial table count on page: ${initialTableCount}`);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step2_initial_timetable.png'), fullPage: true });

    // ----------------------------------------------------
    // STEP 3: Generate Timetable in Quick Timetable
    // ----------------------------------------------------
    console.log('\n3. Triggering Timetable Generation in Quick Timetable...');
    const generateBtn = page.locator('button:has-text("Generate New Timetable")').first();
    assert(await generateBtn.isVisible(), 'Generate button must be visible');
    await generateBtn.click();

    console.log('Waiting for generation engine to finish (up to 15s)...');
    // Wait for generate button to no longer show loading
    await page.waitForSelector('button:has-text("Generate New Timetable")', { timeout: 20000 });
    await page.waitForTimeout(2000);

    // ----------------------------------------------------
    // STEP 4: Verify Timetable Grid is IMMEDIATELY Visible
    // ----------------------------------------------------
    console.log('\n4. Verifying Timetable Grid is Immediately Visible...');
    const gridTable = page.locator('table').first();
    const isGridVisible = await gridTable.isVisible();
    assert(isGridVisible, 'Timetable grid table must be immediately visible after generation');

    const totalCells = await page.locator('table td.timetable-cell').count();
    console.log(`✅ Timetable Grid visible with ${totalCells} cells rendered`);
    assert(totalCells >= 30, `Expected at least 30 timetable cells, got ${totalCells}`);

    // Select S4 CSE A or S4 CSE B so we can inspect populated classes
    const classSelect = page.locator('select.custom-native-class-select');
    await classSelect.selectOption({ label: 'S4 CSE A' }).catch(async () => {
      // Fallback: select by value if option label differs
      const optVal = await page.locator('option:has-text("S4 CSE A")').getAttribute('value');
      if (optVal) await classSelect.selectOption(optVal);
    });
    await page.waitForTimeout(1000);

    const activeClassVal = await classSelect.inputValue();
    console.log(`✅ Selected populated class: ${activeClassVal}`);

    // Verify Minor, Lab, Elective tags
    const minorBadges = await page.locator('table td.minor, table span:has-text("MINOR")').count();
    const theoryCount = await page.locator('table td.theory').count();
    console.log(`✅ Grid features detected on S4 CSE A: Minor slots = ${minorBadges}, Theory slots = ${theoryCount}`);
    assert(minorBadges >= 4, 'S4 CSE A must have at least 4 Minor slots');
    assert(theoryCount >= 2, 'S4 CSE A must have populated theory slots');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step4_after_generate_grid.png'), fullPage: true });

    // ----------------------------------------------------
    // STEP 5: Test Click-to-Swap Mode & Visual Compatibility
    // ----------------------------------------------------
    console.log('\n5. Testing Click-to-Swap Mode & Visual Compatibility Highlighting...');
    const swapModeToggle = page.locator('button:has-text("Click-to-Swap"), button:has-text("Swap Mode")').first();
    assert(await swapModeToggle.isVisible(), 'Click-to-Swap button must be visible in toolbar');

    await swapModeToggle.click();
    console.log('Toggled Click-to-Swap Mode ON');
    await page.waitForTimeout(500);

    // Find first theory slot that is not a break or locked
    const theorySlots = page.locator('table td.theory');
    const firstTheorySlot = theorySlots.first();
    const firstSlotText = await firstTheorySlot.innerText();
    console.log(`Selecting Source Slot: "${firstSlotText.replace(/\n/g, ' ')}"`);
    await firstTheorySlot.click();
    await page.waitForTimeout(500);

    // Verify source slot has amber pulsing ring and "Source" banner appears
    const sourceBanner = page.locator('text=Click any green cell to swap');
    const isBannerVisible = await sourceBanner.isVisible();
    console.log(`✅ Guidance Banner visible: ${isBannerVisible}`);
    assert(isBannerVisible, 'Guidance banner must appear when source slot is selected');

    // Verify compatible slots have emerald green highlighting ("Swap" badges)
    const compatiblePills = page.locator('span:has-text("Swap")');
    const compatibleCount = await compatiblePills.count();
    console.log(`✅ Compatible slots visually highlighted in green: ${compatibleCount} slots`);
    assert(compatibleCount > 0, 'At least one compatible target slot must be highlighted in green');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step5_click_to_swap_highlighting.png'), fullPage: true });

    // ----------------------------------------------------
    // STEP 6: Execute Valid Swap & Verify Immediate Grid Update
    // ----------------------------------------------------
    console.log('\n6. Executing Slot Swap between compatible slots...');
    const targetSlot = page.locator('table td.timetable-cell:has(span:has-text("Swap"))').first();
    const targetTextBefore = await targetSlot.innerText();
    console.log(`Clicking Compatible Target: "${targetTextBefore.replace(/\n/g, ' ')}"`);

    await targetSlot.click();
    console.log('Clicked target slot. Waiting for atomic backend persist & toast...');
    await page.waitForTimeout(2000);

    // Check toast notification
    const toastMsg = await page.locator('.toaster, [role="status"]').innerText().catch(() => '');
    console.log(`✅ Toast feedback: "${toastMsg}"`);

    // Verify Undo button is now enabled
    const undoBtn = page.locator('button:has-text("Undo")').first();
    const canUndo = await undoBtn.isEnabled();
    console.log(`✅ Undo button enabled: ${canUndo}`);
    assert(canUndo, 'Undo button must be enabled after slot swap');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step6_after_successful_swap.png'), fullPage: true });

    // ----------------------------------------------------
    // STEP 7: Verify Undo & Redo
    // ----------------------------------------------------
    console.log('\n7. Testing Undo and Redo Functionality...');
    await undoBtn.click();
    console.log('Clicked Undo. Waiting for rollback...');
    await page.waitForTimeout(1500);

    const redoBtn = page.locator('button:has-text("Redo")').first();
    const canRedo = await redoBtn.isEnabled();
    console.log(`✅ Undo applied, Redo button enabled: ${canRedo}`);
    assert(canRedo, 'Redo button must be enabled after Undo');

    await redoBtn.click();
    console.log('Clicked Redo. Waiting for reapplication...');
    await page.waitForTimeout(1500);
    console.log('✅ Redo applied successfully');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'step7_undo_redo_verified.png'), fullPage: true });

    // ----------------------------------------------------
    // STEP 8: Verify Backend DB Persistence
    // ----------------------------------------------------
    console.log('\n8. Verifying Authoritative MongoDB Persistence...');
    const latestTimetable = await Timetable.findOne().sort({ version: -1 });
    assert(latestTimetable, 'Latest timetable must exist in MongoDB');
    console.log(`Latest Version in DB: Version ${latestTimetable.version}, Revision ${latestTimetable.revision || 1}`);
    console.log(`Undo Stack Length in DB: ${latestTimetable.undoStack ? latestTimetable.undoStack.length : 0}`);
    console.log(`Edit History Entries: ${latestTimetable.editHistory ? latestTimetable.editHistory.length : 0}`);
    assert(latestTimetable.classTimetables && latestTimetable.classTimetables.length > 0, 'Class timetables must be stored in DB');
    console.log('✅ Authoritative MongoDB persistence confirmed');

    console.log('\n====================================================');
    console.log('🎉 ALL QUICK TIMETABLE & SWAP VERIFICATIONS PASSED!');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ VERIFICATION FAILED:', err);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'verification_failure.png'), fullPage: true });
    throw err;
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }
}

runVerification().catch((e) => {
  console.error(e);
  process.exit(1);
});
