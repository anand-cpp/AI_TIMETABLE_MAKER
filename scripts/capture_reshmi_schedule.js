const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../timetable-system/backend/node_modules/playwright'));

const SCREENSHOT_DIR = 'C:/Users/anand/.gemini/antigravity/brain/945725bd-8f10-4be0-aab6-3b5501288432/screenshots';

async function captureReshmiSchedule() {
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data.token;
  const user = loginJson.data.user;

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  await page.addInitScript(({ token, user }) => {
    sessionStorage.setItem('timetable_splash_dismissed', 'true');
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token, user });

  console.log('Navigating to Timetable Builder...');
  await page.goto('http://localhost:5174/admin/timetable', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Look for Faculty tab / view toggle
  console.log('Checking for Faculty View toggle or Teacher dropdown...');
  const facultyTab = page.locator('button:has-text("Faculty"), button:has-text("Teacher View")').first();
  if (await facultyTab.isVisible()) {
    console.log('Clicking Faculty view tab...');
    await facultyTab.click();
    await page.waitForTimeout(1500);

    // Look for Teacher select
    const teacherSelect = page.locator('select').first();
    if (await teacherSelect.isVisible()) {
      // Find Reshmi option
      const options = await teacherSelect.locator('option').allInnerTexts();
      const reshmiOption = options.find(o => o.includes('Reshmi'));
      if (reshmiOption) {
        console.log('Selecting Dr Reshmi B from dropdown:', reshmiOption);
        await teacherSelect.selectOption({ label: reshmiOption });
        await page.waitForTimeout(1500);
      }
    }
  }

  console.log('Capturing 07_faculty_reshmi_b_schedule.png...');
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '07_faculty_reshmi_b_schedule.png'),
    fullPage: false
  });

  await browser.close();
  console.log('Done capturing faculty schedule!');
}

captureReshmiSchedule().catch(console.error);
