const { chromium } = require('playwright');
(async () => {
  const times = process.argv.slice(2).map(Number);
  const T = times.length ? times : [2.5, 9, 15, 20, 27, 33, 39, 44, 50, 56, 61.5, 67.5];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text()); });
  await page.goto('file:///home/user/drayai1/video/stage.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const total = await page.evaluate(() => window.__TOTAL);
  console.log('TOTAL', total.toFixed(2));
  let k = 0;
  for (const t of T) {
    await page.evaluate(tt => window.render(tt), t);
    await page.waitForTimeout(120);
    await page.screenshot({ path: `/home/user/drayai1/shots/p${String(k).padStart(2,'0')}_${t}.png` });
    k++;
  }
  console.log('ERRORS', JSON.stringify(errs.slice(0, 10)));
  await browser.close();
})();
