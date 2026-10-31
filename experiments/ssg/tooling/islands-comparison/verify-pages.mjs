import{createServer}from'node:http';
import{readFile,stat,writeFile,mkdir}from'node:fs/promises';
import{resolve,extname,sep}from'node:path';
import{chromium}from'@playwright/test';
const root=resolve(process.env.HUB_COMPARE_PUBLIC_DIRECTORY??'.pilot/islands-comparison/vue-pages/.pilot/full/ox-native-islands/public');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+sep))throw Error('Invalid path');if((await stat(file)).isDirectory())file=resolve(file,'index.html');const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});const checks=[];
try{
 for(const test of [{path:'/ja/'},{path:'/',entry:true},{path:'/ja/',width:390},{path:'/ja/servers/'},{path:'/ja/docs/'},{path:'/ja/tools/share-link-generator/',tool:true},{path:'/en/tools/share-link-generator/',tool:true},{path:'/ja/contact/',faq:true},{path:'/ja/blog/',blog:true},{path:'/ja/about-us/team/'},{path:'/ns/'},{path:'/ja/share/?text=bench',clientOnly:true},{path:'/ja/mi-web/?path=/test',clientOnly:true}]){
  const context=await browser.newContext({viewport:{width:test.width??1440,height:900},locale:'ja-JP'});const page=await context.newPage(),errors=[],failures=[],externalWarnings=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(/hydration/i.test(message.text()))errors.push(message.text());else if(message.type()==='error'||message.type()==='warning')externalWarnings.push(message.text());});page.on('response',response=>{const url=new URL(response.url());if(url.origin===origin&&response.status()>=400)failures.push({url:url.pathname,status:response.status()});});
  try{
   const response=await page.goto(origin+test.path,{waitUntil:'domcontentloaded'});if(response.status()!==200)throw Error('Page HTTP '+response.status());if(test.entry)await page.waitForURL('**/ja/');
   await page.waitForFunction(()=>document.documentElement.dataset.vuePagesReady==='true',{},{timeout:30000});
   await page.waitForTimeout(1000);
   if(test.clientOnly)await page.waitForFunction(()=>!!document.querySelector('#vue-page-root input'));
   const body=await page.locator('#vue-page-root').innerText();if(body.length<50)throw Error('Empty Vue page: '+test.path);if(/UI omitted for this diagnostic/.test(body))throw Error('Placeholder still present');
   if(test.tool){await page.locator('#shareLinkGeneratorBody').fill('Vue page benchmark');await page.waitForFunction(()=>[...document.querySelectorAll('input[readonly]')].some(element=>(()=>{try{return new URL(element.value).searchParams.get('text')==='Vue page benchmark';}catch{return false;}})()));const preview=await page.locator('#vue-page-root').innerText();if(!preview.includes('Vue page benchmark'))throw Error('MFM preview missing');}
   if(test.faq){const faq=page.locator('details .markdown-body').first();if((await faq.textContent()).trim().length<100)throw Error('FAQ body missing');await page.locator('details summary').first().click();}
   if(test.blog&&await page.locator('#vue-page-root a[href*="/blog/202"]').count()===0)throw Error('Blog list missing');
   if(test.clientOnly){await page.waitForFunction(()=>!!document.querySelector('#vue-page-root input'));}
   const componentErrors=await page.evaluate(()=>((window).__vuePageErrors??[]).map(String));errors.push(...componentErrors);
   if(errors.length||failures.length)throw Error(JSON.stringify({errors,failures}));
   checks.push({path:test.path,width:test.width??1440,status:200,bodyTextLength:body.length,interaction:test.tool?'share-link input + MFM preview':test.faq?'FAQ content + open':test.blog?'article links':test.clientOnly?'client page mounted':'rendered',errors,localFailures:failures,externalWarnings});
   console.log('[vue-pages-browser] '+JSON.stringify(checks.at(-1)));
  }catch(error){console.error('Browser check failed:',test.path,error,JSON.stringify({errors,failures,state:await page.evaluate(()=>({ready:document.documentElement.dataset.vuePagesReady,body:document.body.innerText.slice(0,300)}))}));if(process.env.HUB_COMPARE_RECORD_FAILURES==='1'){checks.push({path:test.path,width:test.width??1440,status:'failed',error:String(error),errors,localFailures:failures,externalWarnings});}else{await mkdir('.pilot/islands-comparison/vue-pages/browser',{recursive:true});await page.screenshot({path:'.pilot/islands-comparison/vue-pages/browser/failure.png',fullPage:true});throw error;}}finally{await context.close();}
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
await writeFile(process.env.HUB_COMPARE_BROWSER_RESULT??'experiments/ssg/results/islands-comparison/2026-10-31/vue-pages/browser.json',JSON.stringify({checks,policy:'Representative original Vue pages in Chromium, including mobile, tool input/MFM, FAQ, blog, and .client pages. Not full VRT.'},null,2)+'\n');

if(checks.some(check=>check.status==='failed'))process.exitCode=1;
