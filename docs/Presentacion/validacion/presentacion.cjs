const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
 try{
  for(const [width,height] of [[1920,1080],[1366,768],[1280,720]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('#slide-nav button').count(),2);
   assert.equal(await page.locator('#footer,.masthead,#notes-btn').count(),0);
   for(let i=1;i<=8;i++){
    await page.keyboard.press(String(i));
    await page.waitForTimeout(380);
    const rect=await page.locator('.slide:not([hidden])').boundingBox();
    assert.ok(rect.width>=width-2 && rect.height>=height-2);
    await page.screenshot({path:path.join(__dirname,'capturas',width+'x'+height+'-'+String(i).padStart(2,'0')+'.png')});
   }
   await page.keyboard.press('4');
   await page.waitForFunction(()=>document.querySelectorAll('.flow-node.done').length===6);
   assert.equal(await page.locator('#status-title').innerText(),'Salida anonimizada');
   await page.keyboard.press('5');
   await page.keyboard.press('4');
   await page.waitForFunction(()=>document.querySelectorAll('.flow-node.done').length<6);
   await page.keyboard.press('6');
   await page.waitForFunction(()=>document.querySelector('#actor-name').textContent==='IESS');
   assert.deepEqual(errors,[]);
   await page.close();
   console.log(width+' × '+height+' verificado');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
