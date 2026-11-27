// Ejecutar con Node.js y Playwright instalados. README.md describe el entorno.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function verify() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
  });
  const output = process.env.DECK_CAPTURAS || path.join(__dirname, 'capturas');
  const entry = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await fs.mkdir(output, { recursive: true });
  const errors = [];
  const network = [];
  try {
    for (const [width,height] of [[1920,1080],[1366,768],[1280,720]]) {
      const context = await browser.newContext({ viewport:{width,height},offline:true,reducedMotion:'reduce' });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => {
        if (/^https?:/.test(r.url()) || (r.url().startsWith('file:') && r.url()!==entry)) network.push(r.url());
      });
      await page.goto(entry);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.slide').count(),8);
      for (let i=1;i<=8;i++) {
        await page.keyboard.press(String(i));
        const bounds = await page.evaluate(() => {
          const section = document.querySelector('.slide:not([hidden])');
          const box = section.getBoundingClientRect();
          const elements = Array.from(section.querySelectorAll('h1,h2,h3,h4,p,button,select,img,.road,.epn'));
          return {
            overflow:document.documentElement.scrollHeight>innerHeight || document.documentElement.scrollWidth>innerWidth,
            outside:elements.filter(e=>{
              const b=e.getBoundingClientRect();
              return b.width && (b.bottom>box.bottom+1||b.right>box.right+1||b.left<box.left-1||b.top<box.top-1);
            }).map(e=>e.textContent || e.alt || e.tagName),
            broken:Array.from(document.images).filter(img=>!img.complete || !img.naturalWidth).length
          };
        });
        assert.deepEqual(bounds,{overflow:false,outside:[],broken:0},width+' × '+height+' / '+i+' '+JSON.stringify(bounds));
        await page.screenshot({path:path.join(output,width+'x'+height+'-'+String(i).padStart(2,'0')+'.png')});
      }
      await page.keyboard.press('n');
      assert.equal(await page.locator('dialog[open]').count(),1);
      await page.keyboard.press('ArrowRight');
      assert.match(await page.locator('#counter').innerText(),/08/);
      await page.keyboard.press('Escape');
      await page.keyboard.press('i');
      await page.locator('[data-page="3"]').click();
      assert.equal(await page.locator('.workflow').isVisible(),true);
      assert.equal(await page.locator('.workflow.general').count(),1);
      assert.equal(await page.locator('#view-general').getAttribute('aria-pressed'),'true');
      await page.locator('#view-decisions').click();
      assert.equal(await page.locator('.workflow.general').count(),0);
      await page.locator('#view-general').click();
      await page.locator('#inputs').click();
      assert.match(await page.locator('#panel-body').innerText(),/cohorte clínica ficticia/);
      await page.keyboard.press('Escape');
      for(let i=0;i<6;i++){
        await page.locator('.flow-node').nth(i).click();
        await page.getByRole('button',{name:'Vista técnica',exact:true}).click();
        assert.equal(await page.locator('.detail-list dd').count(),5);
        if(i===4){
          await page.locator('#decision-map').click();
          assert.match(await page.locator('#panel-body').innerText(),/k ≥ 5/);
          await page.locator('#back-phase').click();
        }
        await page.keyboard.press('Escape');
      }
      await page.locator('#step').click();
      await page.waitForFunction(()=>document.querySelector('.flow-node').classList.contains('done'));
      assert.equal(await page.locator('.flow-node.done').count(),1);
      assert.equal(await page.locator('#journey-input').getAttribute('data-state'),'done');
      await page.locator('#run').click();
      await page.waitForFunction(()=>document.querySelector('#status-title').textContent==='Salida anonimizada' && document.querySelector('#run').disabled);
      await page.locator('#scenario').selectOption('risk');
      await page.locator('#run').click();
      await page.getByRole('button',{name:'Ajustar datos'}).waitFor();
      if(width===1366)await page.screenshot({path:path.join(output,'detalle-riesgo.png')});
      await page.getByRole('button',{name:'Ajustar datos'}).click();
      await page.waitForFunction(()=>document.querySelector('#status-title').textContent==='Salida anonimizada' && document.querySelector('#run').disabled);
      assert.equal(await page.locator('#run').isDisabled(),true);
      await page.locator('#reset').click();
      await page.locator('#run').click();
      await page.getByRole('button',{name:'Bloquear salida',exact:true}).click();
      assert.equal(await page.locator('#status-title').innerText(),'Salida bloqueada');
      await page.keyboard.press('5');
      await page.locator('#compare').click();
      assert.match(await page.locator('#panel-body').innerText(),/ID-SINT/);
      if(width===1280)await page.screenshot({path:path.join(output,'detalle-comparacion.png')});
      await page.keyboard.press('Escape');await page.locator('#evidence').click();
      assert.match(await page.locator('#panel-body').innerText(),/44\/44/);
      await page.keyboard.press('Escape');await page.keyboard.press('6');
      for(const actor of await page.locator('.actor').all()){
        await actor.click();assert.equal(await page.locator('#actor-name').innerText(),await actor.innerText());
      }
      await page.keyboard.press('7');await page.locator('#budget-detail').click();
      assert.match(await page.locator('.budget-total').innerText(),/6\.000/);
      await page.getByRole('button',{name:'Operación anual',exact:true}).click();
      assert.match(await page.locator('.budget-total').innerText(),/2\.400/);
      if(width===1920)await page.screenshot({path:path.join(output,'detalle-operacion.png')});
      await page.keyboard.press('Escape');await page.keyboard.press('Home');
      assert.equal(await page.locator('#prev').isDisabled(),true);
      await page.keyboard.press('f');
      await page.waitForFunction(()=>!!document.fullscreenElement);
      await page.keyboard.press('f');
      await page.waitForFunction(()=>!document.fullscreenElement);
      await context.close();
      console.log(width+' × '+height+' · ocho diapositivas y controles verificados');
    }
    const p = await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'no-preference'});
    await p.goto(entry);await p.keyboard.press('4');await p.locator('#run').click();
    await p.waitForFunction(()=>Number(document.querySelector('.flow-node .fill').getAttribute('width'))>6);
    await p.locator('#run').click();
    const fill = () => p.locator('.flow-node .fill').first().getAttribute('width');
    const paused=await fill();
    await p.waitForTimeout(170);
    assert.equal(paused,await fill(),'La pausa debe congelar el llenado');
    await p.locator('#run').click();
    await p.waitForFunction(()=>document.querySelector('.flow-node').classList.contains('done'));
    await p.keyboard.press('5');await p.keyboard.press('4');
    assert.match(await p.locator('#run').innerText(),/Reanudar/);
    await p.locator('#reset').click();
    assert.equal(await p.locator('.flow-node.done').count(),0);
    await p.keyboard.press('6');
    await p.waitForFunction(()=>{
      const signal=document.querySelector('.actor-signal');
      return signal.getAttribute('visibility')==='visible' && signal.hasAttribute('cx');
    });
    await p.locator('#actor-play').click();
    const pausedSignal=await p.locator('.actor-signal').evaluate(el=>[el.getAttribute('cx'),el.getAttribute('cy')]);
    await p.waitForTimeout(170);
    assert.deepEqual(await p.locator('.actor-signal').evaluate(el=>[el.getAttribute('cx'),el.getAttribute('cy')]),pausedSignal);
    await p.locator('#actor-play').click();
    await p.waitForFunction(()=>document.querySelector('#actor-name').textContent==='Equipo TI');
    await p.getByRole('button',{name:'Asegurados',exact:true}).click();
    assert.equal(await p.locator('#actor-name').innerText(),'Asegurados');
    assert.match(await p.locator('#actor-play').innerText(),/Reproducir/);
    await p.locator('#actor-next').click();
    await p.waitForFunction(()=>document.querySelector('#actor-name').textContent==='IESS');
    await p.getByRole('button',{name:'Repetir recorrido'}).click();
    await p.waitForFunction(()=>document.querySelector('#actor-name').textContent==='Comité de Ética');
    await p.close();
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
    console.log('Movimiento, pausa, recorrido del ecosistema y funcionamiento offline verificados.');
  } finally {await browser.close();}
}
verify().catch(error=>{console.error(error);process.exitCode=1;});
