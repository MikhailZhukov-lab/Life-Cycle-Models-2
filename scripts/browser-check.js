/* Необов'язкова перевірка інтерфейсу: npm install --no-save playwright */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const root = path.join(__dirname, '..');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1.5 });
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = async (name, fn) => { await fn(); checks.push({ name, status: 'OK' }); };
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.waitForFunction(() => !!window.slarApp?.gallery.length);
  await check('Пряме відкриття index.html та шість графіків', async () => assert.equal(await page.locator('#gallery canvas').count(), 6));
  for (const n of ['5', '10', '20']) for (const d of ['1', '0.1']) for (const method of ['gauss', 'jacobi', 'seidel']) {
    await check(`Перемикачі та крок: n=${n}, d=${d}, ${method}`, async () => {
      await page.selectOption('#size', n); await page.selectOption('#margin', d); await page.selectOption('#method', method);
      await page.click('#step');
      const state = await page.evaluate(() => ({ n: slarApp.system.A.length, k: slarApp.state.frame, ok: slarApp.runs[slarApp.state.method].converged }));
      assert.deepEqual(state, { n: Number(n), k: 1, ok: true });
    });
  }
  await page.selectOption('#size', '5'); await page.selectOption('#margin', '1'); await page.selectOption('#method', 'gauss');
  await page.screenshot({ path: path.join(root,'results','gui.png'), fullPage: false });
  for (const n of [5,10,20]) for (const type of ['convergence','solution']) {
    await page.locator(`#${type}-${n}`).screenshot({ path: path.join(root,'results',`${type}_${n}.png`) });
  }
  await check('Відтворення та пауза', async () => {
    await page.click('#play'); await page.waitForFunction(() => slarApp.state.frame >= 2); await page.click('#play');
    assert.equal(await page.evaluate(() => slarApp.state.playing), false);
  });
  await page.locator('.animation').screenshot({ path: path.join(root,'results','gauss_animation.png') });
  await page.selectOption('#method','seidel');await page.click('#step');
  await page.locator('.animation').screenshot({path:path.join(root,'results','iteration_animation.png')});
  await page.locator('.input-panel summary').click();
  await check('Ручна матриця та відсутній exact', async () => {
    await page.fill('#input','4 1 | 1\n2 3 | 2'); await page.click('#apply');
    assert.equal(await page.evaluate(()=>slarApp.system.A.length),2);
    assert.equal(await page.evaluate(()=>slarApp.system.exact),undefined);
    assert.ok(!(await page.locator('#status').innerText()).includes('NaN'));
  });
  await check('Пошкоджений ввід зберігає попередню систему',async()=>{
    await page.fill('#input','4 bad | 1\n2 3 | 2');await page.click('#apply');
    assert.ok((await page.locator('#status').getAttribute('class')).includes('error'));
    assert.equal(await page.evaluate(()=>slarApp.system.A.length),2);
  });
  await check('Файл JSON і нульовий pivot',async()=>{
    await page.setInputFiles('#file',path.join(root,'results','example_system.json'));
    await page.waitForFunction(()=>slarApp.system.A[0][0]===0);
    assert.ok(await page.evaluate(()=>slarApp.runs.gauss.converged));
    assert.ok((await page.locator('#status').innerText()).includes('Нульовий діагональний'));
  });
  await check('Вироджена матриця: повідомлення і відсутня анімація Гаусса',async()=>{
    await page.fill('#input','1 2 | 3\n2 4 | 6');await page.click('#apply');await page.selectOption('#method','gauss');
    assert.ok((await page.locator('#status').innerText()).includes('головний елемент'));
    assert.equal(await page.locator('#play').isDisabled(),true);
  });
  await check('Експорт CSV',async()=>{
    await page.click('#reset');const downloadPromise=page.waitForEvent('download');await page.click('#export');
    const download=await downloadPromise;assert.equal(download.suggestedFilename(),'results.csv');
  });
  await check('Експорт JSON',async()=>{
    const downloadPromise=page.waitForEvent('download');await page.click('#save-system');const download=await downloadPromise;
    assert.equal(download.suggestedFilename(),'system.json');
  });
  await check('Автомасштаб поточного кадру',async()=>{
    await page.selectOption('#method','jacobi');await page.click('#step');
    assert.ok(await page.evaluate(()=>{
      const b=slarApp.charts.iteration.bounds;return slarApp.runs.jacobi.frames[1].every(v=>v>=b.ymin&&v<=b.ymax);
    }));
  });
  await check('Мобільна ширина 390 px',async()=>{
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  });
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(root,'results','mobile.png'),fullPage:false});
  assert.deepEqual(errors,[]);
  const result={browser:await browser.version(),checks,errors};
  fs.writeFileSync(path.join(root,'results','browser_checks.json'),JSON.stringify(result,null,2));
  console.log(`${checks.length} browser checks passed; 0 JavaScript errors.`);
  await browser.close();
})().catch(err=>{console.error(err);process.exit(1);});
