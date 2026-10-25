const { chromium } = require('playwright');
const { spawn } = require('child_process');
const FPS = 30;
const OUT = '/home/user/drayai1/video/silent.mp4';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file:///home/user/drayai1/video/stage.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const total = await page.evaluate(() => window.__TOTAL);
  const frames = Math.ceil(total * FPS);
  console.log('TOTAL', total.toFixed(2), 's  frames', frames);

  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg',
    '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', OUT],
    { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log('frame', i, '/', frames);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 6)));
  await browser.close();
})();
