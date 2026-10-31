// Functional smoke check after timing; no screenshots, baseline changes or VRT.
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { chromium } from '@playwright/test';
const compilerMode=process.argv.includes('--compilers');
const cssMode=process.argv.includes('--css')||compilerMode;
const names=compilerMode?['vue','vize']:cssMode?['vue-island','vue-island-css']:['vue-client','vue-island'];
const result={cssComparison:cssMode,node:process.version,cpu:cpus()[0].model,platform:platform()+'-'+arch(),checks:[],policy:'After SSG timing: actual Chromium load and counter click, no JS/hydration errors. Minimal Vue button only, not site VRT.'};
const browser=await chromium.launch({headless:true});
try {
 for(const name of names) {
  const root=resolve(compilerMode?'.pilot/islands-comparison/compiler-artifacts/vue-island-css/'+name+'/public':'.pilot/islands-comparison/'+name+'/.pilot/full/ox-native-islands/public');
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
  const server=createServer(async(req,res)=>{try{let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+sep))throw Error('Invalid path');if((await stat(file)).isDirectory())file=resolve(file,'index.html');const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  try {
   const page=await browser.newPage();const errors=[],stylesheets=[];page.on('response',response=>{if(new URL(response.url()).pathname.endsWith('.css'))stylesheets.push({url:response.url(),status:response.status()});});page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(/hydration/i.test(message.text()))errors.push(message.text());});
   const response=await page.goto('http://127.0.0.1:'+server.address().port+'/ja/');if(response.status()!==200)throw Error('HTTP failed');
   const button=page.locator('#diagnostic-vue-button');await button.waitFor();const before=(await button.textContent()).trim();if(before!=='Vue: 0')throw Error('Initial counter: '+before);
   await button.click();await page.waitForFunction(()=>document.querySelector('#diagnostic-vue-button')?.textContent.trim()==='Vue: 1');
   let computedStyle;
   if(name==='vue-island-css'||compilerMode){
    computedStyle=await button.evaluate(element=>{const style=getComputedStyle(element);return{color:style.color,backgroundColor:style.backgroundColor,borderRadius:style.borderRadius,className:element.className};});
    if(computedStyle.color!=='rgb(12, 34, 56)'||computedStyle.backgroundColor!=='rgb(220, 230, 240)'||computedStyle.borderRadius!=='7px')throw Error('CSS module/Sass not applied: '+JSON.stringify(computedStyle));
    if(!stylesheets.length||stylesheets.some(s=>s.status!==200))throw Error('Stylesheet request failed: '+JSON.stringify(stylesheets));
   }
   if(errors.length)throw Error(errors.join('\n'));
   result.checks.push({case:name,httpStatus:200,before,after:(await button.textContent()).trim(),errors,...(cssMode?{stylesheets,computedStyle}: {})});await page.close();
  }finally{await new Promise(ok=>server.close(ok));}
 }
}finally{await browser.close();}
await writeFile('experiments/ssg/results/islands-comparison/2026-10-31/'+(compilerMode?'vue-pages-vize':cssMode?'vue-css':'vue-only')+(compilerMode?'/browser-minimal.json':'/browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
