// Executed through the installed Helium Coordinator wrapper, on its owned tab.
export default async function verify(page) {
const root='file:///C:/Users/darka/Documents/Projects/Android/ClipCascade/design-demos/2026-10-26-ui-refresh/';
const output='C:/Users/darka/Documents/Projects/Android/ClipCascade/design-demos/2026-10-26-ui-refresh/screenshots/';
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const report=[];
const checkpoint=async step=>page.evaluate(value=>{document.title='ClipCascade QA: '+value},step);
for(const direction of ['a','b','c']){
  await page.setViewportSize({width:1600,height:1100});
  await page.goto(root+`dir-${direction}.html`);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});
  const win=page.locator('[data-platform="windows"]');
  const phone=page.locator('.pair [data-platform="android"]');
  if(await win.locator('.entry-row').count()!==5)throw Error(direction+': missing history');
  if(await phone.locator('.mobile-entry').count()!==5)throw Error(direction+': missing mobile history');
  await page.screenshot({path:output+`dir-${direction}-desktop.png`});
  await page.screenshot({path:output+`dir-${direction}-full.png`,fullPage:true});
  await checkpoint(direction+' search and filters');
  await win.locator('[data-search]').fill('project');
  if(await win.locator('.entry-row').count()!==2)throw Error(direction+': search failed');
  await win.locator('[data-search]').fill('');
  await win.locator('[data-filter="Needs attention"]').click();
  if(await win.locator('.entry-row').count()!==2)throw Error(direction+': filter failed');
  await win.locator('[data-filter="All"]').click();
  await win.locator('[data-entry="busy"]').click();
  await checkpoint(direction+' selected entry actions');
  if(!(await win.innerText()).includes('not applied'))throw Error(direction+': selected failure detail missing');
  await win.locator('[data-action="copy"]').click();
  if(!(await page.locator('.board-feedback').innerText()).includes('local text copy'))throw Error(direction+': copy interaction failed');
  await win.locator('[data-action="resend"]').click();
  const row=await win.locator('[data-entry="busy"]').innerText();
  if(!row.includes('Sent')||row.includes('Delivered'))throw Error(direction+': resend misrepresented as delivery');
  await win.locator('[data-view="health"]').first().click();
  if(await win.locator('.status-row').count()!==3)throw Error(direction+': health view failed');
  await win.locator('[data-view="settings"]').first().click();
  await checkpoint(direction+' settings switch');
  const check=win.getByRole('checkbox',{name:'Start automatically'});
  await win.locator('.switch').filter({has:page.getByRole('checkbox',{name:'Start automatically',exact:true})}).click();
  if(await check.isChecked())throw Error(direction+': settings toggle failed');
  await win.locator('[data-view="history"]').first().click();
  await checkpoint(direction+' clear confirmation');
  await win.locator('[data-action="clear"]').click();
  if(!await win.getByRole('dialog').isVisible())throw Error(direction+': clear confirmation missing');
  await win.locator('[data-action="cancel-clear"]').click();
  if(await win.locator('.entry-row').count()!==5)throw Error(direction+': cancelled clear deleted history');
  await phone.locator('[data-entry="image"]').click();
  await checkpoint(direction+' mobile navigation');
  if(!await phone.locator('[data-action="copy"]').isDisabled())throw Error(direction+': image replay incorrectly enabled');
  await phone.locator('[data-view="health"]').first().click();
  if(!await phone.getByText('Shizuku is authorized and listening.').isVisible())throw Error(direction+': Android capture state missing');
  await phone.locator('[data-view="settings"]').first().click();
  await phone.locator('[data-view="login"]').click();
  await phone.locator('[data-action="api-login"]').click();
  if(!await phone.getByText('Sync encryption key',{exact:true}).isVisible())throw Error(direction+': encryption setup omitted');
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    await checkpoint(direction+' viewport '+viewport.width);
    await page.setViewportSize(viewport);
    await page.reload();
    await page.evaluate(()=>document.fonts.ready);
    const measured=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,images:[...document.images].every(img=>img.complete&&img.naturalWidth>0),smallButtons:[...document.querySelectorAll('.phone button')].filter(button=>{const r=button.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43||r.height<43)}).map(button=>button.textContent.trim())}));
    if(measured.documentWidth>viewport.width)throw Error(direction+': viewport overflow '+JSON.stringify(measured));
    if(!measured.images)throw Error(direction+': missing artwork');
    if(measured.smallButtons.length)throw Error(direction+': undersized mobile controls '+JSON.stringify(measured.smallButtons));
    await page.screenshot({path:output+`dir-${direction}-${viewport.width}.png`});
    if(viewport.width===390)await phone.screenshot({path:output+`dir-${direction}-android.png`});
  }
  report.push({direction,historySelection:true,search:true,statusFilter:true,copyPreview:true,resendUnconfirmed:true,health:true,settings:true,clearCancel:true,textOnlyReplay:true,signInEncryption:true,viewports:[1600,1280,390]});
}
await page.setViewportSize({width:1600,height:1100});
await page.goto(root+'thumbs.html');
await page.screenshot({path:output+'six-candidates.png',fullPage:true});
await page.goto(root+'index.html');
await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()));});
await page.screenshot({path:output+'overview.png'});
if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
return {ok:true,pageErrors:errors,directions:report,productionAccessed:false};
}
