const ARTWORK = __ARTWORK__;
const ICONS = __ICONS__;
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS['circle-alert']}</svg>`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const artwork = () => `<img class="brand-image" src="${ARTWORK}" alt="ClipCascade">`;
const sampleEntries = [
  {id:'meeting',time:'21:17',text:'Meeting moved to 15:30.\nRoom 4, second floor.',preview:'Meeting moved to 15:30.',type:'Text',direction:'Sent from this device',status:'Delivered',tone:'good',glyph:'check-check',detail:'All targeted recipients acknowledged clipboard application.',count:'2 / 2 application ACKs'},
  {id:'notes',time:'21:12',text:'https://example.com/project-notes',preview:'https://example.com/project-notes',type:'Text',direction:'Received from another device',status:'Applied',tone:'good',glyph:'check',detail:'Successfully written to this device clipboard.',count:'Applied locally'},
  {id:'path',time:'21:08',text:'C:\\Projects\\ClipCascade\\notes',preview:'C:\\Projects\\ClipCascade\\notes',type:'Text',direction:'Sent from this device',status:'Sent',tone:'pending',glyph:'clock-3',detail:'Handed to transport. Clipboard application has not been confirmed.',count:'Awaiting application ACKs'},
  {id:'image',time:'20:56',text:'Image 982 x 492',preview:'Image 982 x 492',type:'Image',direction:'Received from another device',status:'Applied',tone:'good',glyph:'check',detail:'Image successfully written to this device clipboard.',count:'Applied locally'},
  {id:'busy',time:'20:44',text:'Remember to bring the USB cable.',preview:'Remember to bring the USB cable.',type:'Text',direction:'Received from another device',status:'Error',tone:'error',glyph:'circle-alert',detail:'Clipboard busy. This item was not applied and was not acknowledged.',count:'Not applied'}
];
const designs = {A:{name:'Control Room',theme:'',subtitle:'History and diagnostics, side by side.'},B:{name:'Clear Desk',theme:'light',subtitle:'A quieter, text-first workspace.'},C:{name:'Quick Switch',theme:'quick',subtitle:'Compact, search-first clipboard access.'}};
const info = designs[document.body.dataset.direction] || designs.A;
const notify = message => { document.querySelector('.board-feedback').textContent = `Preview only: ${message}. No host clipboard, service or server changes.`; };
const status = entry => `<span class="status ${entry.tone}">${icon(entry.glyph)}${entry.status}</span>`;
const actionButton = (name,label,attrs='',primary=false) => `<button class="button ${primary?'primary':''}" ${attrs}>${icon(name)}${label}</button>`;
const iconButton = (name,label,attrs='') => `<button class="icon-btn" title="${label}" aria-label="${label}" ${attrs}>${icon(name)}</button>`;
const navigation = (view,phone=false) => ['History','Health','Settings'].map(label => `<button data-view="${label.toLowerCase()}" class="${view===label.toLowerCase()?'active':''}" ${view===label.toLowerCase()?'aria-current="page"':''} title="${label}" aria-label="${label}">${icon({History:'history',Health:'activity',Settings:'settings-2'}[label])}${phone?`<span>${label}</span>`:''}</button>`).join('');
const toggle = (label,checked=true) => `<label class="switch"><input type="checkbox" aria-label="${label}" ${checked?'checked':''}><span></span></label>`;
const health = phone => `<div class="view-content"><div class="health-banner">${icon('shield-check')}<div><h3>Ready to sync</h3><p>Service running. Capture is available.</p></div></div>
  <div class="status-row">${icon('radio')}<div><strong>Clipboard capture</strong><p>${phone?'Shizuku is authorized and listening.':'Windows clipboard watcher is listening.'}</p></div><span class="status good">Listening</span></div>
  <div class="status-row">${icon('network')}<div><strong>Server connection</strong><p>Private server<br>clipboard.example</p></div><span class="status good">Connected</span></div>
  <div class="status-row">${icon('lock-keyhole')}<div><strong>Encryption</strong><p>Shared sync key configured.</p></div><span class="status good">Enabled</span></div>
  <h3>Last delivery</h3><div class="detail-line"><span>Meeting moved to 15:30.</span><span>21:17</span></div><p class="delivery-note">2 of 2 targeted recipients acknowledged application.</p>
  <div class="health-actions">${actionButton('refresh-cw','Reconnect','data-action="reconnect"')}${actionButton('pause','Pause monitoring','data-action="pause"')}</div></div>`;
const settings = phone => `<div class="view-content"><h3>Sync</h3><div class="setting-row"><div><strong>Text</strong><p>Clipboard text</p></div>${toggle('Sync text')}</div><div class="setting-row"><div><strong>Images</strong><p>Clipboard image transfers</p></div>${toggle('Sync images')}</div><div class="setting-row"><div><strong>Files</strong><p>Explicit downloads</p></div>${toggle('Sync files')}</div>
  <h3>Service</h3><div class="setting-row"><div><strong>Start automatically</strong><p>${phone?'Resume monitoring after device restart.':'Start in the tray when Windows starts.'}</p></div>${toggle('Start automatically')}</div>
  ${phone?'<label class="field">Clipboard backend<select aria-label="Clipboard backend"><option>Shizuku</option><option>Accessibility</option><option>System clipboard</option></select></label>':''}
  <details><summary>Advanced settings</summary><label class="field">Maximum payload<input value="256 MiB" readonly></label><label class="field">Server address<input value="https://clipboard.example" readonly></label><p class="delivery-note">API key configured. Sync encryption enabled.</p></details>
  <div class="actions">${actionButton('save','Save settings','data-action="save"',true)}${actionButton('user-round','Account','data-view="login"')}</div></div>`;
const login = () => `<div class="auth-content">${artwork()}<h2>Connect your devices</h2><p>Sign in to your private ClipCascade server.</p><form class="auth-form"><label class="field">Server address<input type="url" value="https://clipboard.example" required></label><label class="field">Username<input autocomplete="off" value="sample-user" required></label><label class="field">Password<input type="password" autocomplete="off" placeholder="Account password" required></label>${actionButton('log-in','Sign in','type="submit"',true)}</form><button class="auth-secondary" data-action="api-login">Use an API key instead</button></div>`;

class PreviewApp {
  constructor(element) {
    this.el=element;this.phone=element.dataset.platform==='android';this.view=element.dataset.view||'history';this.entries=sampleEntries.map(item=>({...item}));this.selected='meeting';this.filter='All';this.query='';this.monitoring=true;
    this.el.addEventListener('click',event=>this.click(event));
    this.el.addEventListener('input',event=>{if(event.target.matches('[data-search]')){this.query=event.target.value;this.renderList();}});
    this.el.addEventListener('submit',event=>{event.preventDefault();this.view='history';this.render();notify('sign-in simulated');});
    this.render();
  }
  selectedEntry(){return this.entries.find(item=>item.id===this.selected);}
  currentEntries(){return this.entries.filter(item=>(this.filter==='All'||(this.filter==='Text'&&item.type==='Text')||(this.filter==='Needs attention'&&['Error','Sent'].includes(item.status)))&&(item.text+' '+item.status+' '+item.direction).toLowerCase().includes(this.query.toLowerCase()));}
  heading(){return this.view==='history'?'Clipboard history':this.view==='health'?'Connection health':this.view==='settings'?'Settings':'Account';}
  search(){return `<div class="tools"><label class="search">${icon('search')}<input data-search aria-label="Search clipboard history" placeholder="Search clipboard history" value="${escapeHtml(this.query)}"></label>${iconButton('trash-2','Clear history','data-action="clear"')}</div><div class="segmented" role="tablist" aria-label="History filter">${['All','Text','Needs attention'].map(name=>`<button role="tab" data-filter="${name}" aria-selected="${this.filter===name}">${name}</button>`).join('')}</div>`;}
  content(){return this.view==='history'?this.history():this.view==='health'?health(this.phone):this.view==='settings'?settings(this.phone):login();}
  render(){
    const content=this.content();
    if(this.phone){this.el.innerHTML=`<div class="statusbar"><span>21:17</span><span>${icon('signal')}${icon('wifi')}${icon('battery-full')}</span></div><div class="mobile-header"><span class="mobile-brand">${artwork()}ClipCascade</span>${iconButton('settings-2','Settings','data-view="settings"')}</div><div class="mobile-body">${this.view!=='login'?`<div class="mobile-title"><h2>${this.view==='history'?'History':this.heading()}</h2>${this.view==='history'?'<span class="status good">'+icon('check')+'Connected</span>':''}</div>`:''}${content}</div>${this.view==='history'?this.actions(true):''}<nav class="bottom-nav" aria-label="App navigation">${navigation(this.view,true)}</nav>`;}
    else {
      const light=info.theme==='light';
      const topNav=light?`<nav class="top-nav" aria-label="App navigation"><span class="wordmark">${artwork()}ClipCascade</span>${['History','Health','Settings'].map(label=>`<button data-view="${label.toLowerCase()}" class="${this.view===label.toLowerCase()?'active':''}">${icon({History:'history',Health:'activity',Settings:'settings-2'}[label])}${label}</button>`).join('')}<span class="status good">${icon('check')}Connected</span></nav>`:'';
      const rail=light?'':`<nav class="rail" aria-label="App navigation">${artwork()}${navigation(this.view)}<button class="rail-bottom" data-view="login" title="Account" aria-label="Account">${icon('user-round')}</button></nav>`;
      this.el.innerHTML=`<div class="titlebar"><span>${artwork()}ClipCascade</span><div class="window-actions" aria-hidden="true"><span>${icon('minus')}</span><span>${icon('square')}</span><span>${icon('x')}</span></div></div>${topNav}<div class="app-layout">${rail}<div class="workspace"><header class="app-header"><div><h2>${this.heading()}</h2>${this.view==='history'?'<p class="subhead">Today, 26 October</p>':''}</div><div class="header-actions">${!light?`<span class="status good">${icon('check')}Connected</span>`:''}${iconButton('refresh-cw','Refresh view','data-action="refresh"')}</div></header>${this.view==='history'?`<div class="connection-line"><span>${icon('radio')}Capture listening</span><span>${icon('lock-keyhole')}End-to-end encrypted</span></div>`:''}${content}<footer class="app-footer"><span>${icon('shield-check')}Private server</span><span>Monitoring ${this.monitoring?'active':'paused'}</span></footer></div></div>`;
    }
  }
  history(){
    if(this.phone)return `<div class="mobile-healthline"><span>${icon('radio')}Capture listening</span><span>${icon('lock-keyhole')}Encrypted</span></div>${this.search()}<div class="mobile-list" data-list>${this.rows()}</div>`;
    return `${this.search()}<div class="history-layout"><div class="history-list" data-list>${this.rows()}</div>${info.theme==='light'?'':this.inspector()}</div>`;
  }
  rows(){
    const entries=this.currentEntries();
    if(!entries.length)return '<div class="empty">No matching entries.</div>';
    if(this.phone)return `<div class="day-label">Today</div>${entries.map(item=>`<button class="mobile-entry ${this.selected===item.id?'selected':''}" data-entry="${item.id}" aria-pressed="${this.selected===item.id}"><p>${escapeHtml(item.preview)}</p><div class="entry-bottom"><span>${icon(item.direction.startsWith('Sent')?'arrow-up-right':'arrow-down-left')}${item.time} <span>${item.type}</span></span>${status(item)}</div></button>`).join('')}`;
    return `<div class="table-head"><span>Time</span><span>Clipboard</span><span>Status</span></div>${entries.map(item=>`<button class="entry-row ${this.selected===item.id?'selected':''}" data-entry="${item.id}" aria-pressed="${this.selected===item.id}"><span class="entry-time">${item.time}</span><span class="entry-main"><strong>${escapeHtml(item.preview)}</strong><small>${icon(item.direction.startsWith('Sent')?'arrow-up-right':'arrow-down-left')}${item.direction.startsWith('Sent')?'Sent':'Received'}<span>${item.type}</span></small></span>${status(item)}</button>${info.theme==='light'&&this.selected===item.id?`<div class="expanded-entry"><p>${escapeHtml(item.text)}</p><div class="delivery-note">${escapeHtml(item.detail)}</div>${this.actions()}</div>`:''}`).join('')}`;
  }
  inspector(){const entry=this.selectedEntry();if(!entry)return '<aside class="inspector"><p class="delivery-note">Select an entry.</p></aside>';return `<aside class="inspector"><div class="inspector-title"><span>Selected ${entry.type.toLowerCase()}</span>${icon(entry.type==='Text'?'text-cursor-input':'image')}</div><div class="selected-content">${escapeHtml(entry.text)}</div><div class="selected-detail"><div class="detail-line"><span>Time</span><span>${entry.time}</span></div><div class="detail-line"><span>Status</span>${status(entry)}</div><div class="detail-line"><span>Transport</span><span>Private server</span></div><p class="delivery-note">${escapeHtml(entry.detail)}</p><p class="delivery-note">${escapeHtml(entry.count)}</p></div>${this.actions()}</aside>`;}
  actions(mobile=false){const available=this.selectedEntry()?.type==='Text';return `<div class="${mobile?'mobile-actions':'actions'}">${actionButton('copy','Copy',`data-action="copy" ${available?'':'disabled'} title="Copy text locally"`,true)}${actionButton('send','Resend',`data-action="resend" ${available?'':'disabled'} title="Resend text"`)}</div>`;}
  renderList(){const list=this.el.querySelector('[data-list]');if(list)list.innerHTML=this.rows();}
  click(event){
    const target=event.target.closest('button');if(!target||target.disabled)return;
    if(target.dataset.view){this.view=target.dataset.view;this.render();return;}
    if(target.dataset.filter){this.filter=target.dataset.filter;this.render();return;}
    if(target.dataset.entry){this.selected=target.dataset.entry;this.render();return;}
    const action=target.dataset.action;
    if(action==='copy')notify('local text copy selected');
    if(action==='resend'){const entry=this.selectedEntry();entry.status='Sent';entry.tone='pending';entry.glyph='clock-3';entry.detail='Handed to transport. Clipboard application has not been confirmed.';entry.count='Awaiting application ACKs';this.render();notify('resend simulated; delivery stays unconfirmed');}
    if(action==='refresh')notify('view refreshed');
    if(action==='clear')this.confirmClear();
    if(action==='cancel-clear')this.el.querySelector('.modal-backdrop')?.remove();
    if(action==='confirm-clear'){this.entries=[];this.selected=null;this.render();notify('sample history cleared');}
    if(action==='save')notify('settings saved in preview only');
    if(action==='pause'){this.monitoring=!this.monitoring;target.innerHTML=icon(this.monitoring?'pause':'play')+(this.monitoring?'Pause monitoring':'Resume monitoring');notify(this.monitoring?'monitoring resumed in preview':'monitoring paused in preview');}
    if(action==='reconnect')notify('reconnection simulated');
    if(action==='api-login'){this.el.querySelector('.auth-content').innerHTML=`${artwork()}<h2>Connect with an API key</h2><form><label class="field">Server address<input type="url" value="https://clipboard.example" required></label><label class="field">Sync API key<input type="password" placeholder="cck_..." required></label><label class="field">Sync encryption key<input type="password" placeholder="ccsk_..." required></label>${actionButton('log-in','Connect','type="submit"',true)}</form><button class="auth-secondary" data-view="login">Use account sign-in</button>`;}
  }
  confirmClear(){this.el.insertAdjacentHTML('beforeend',`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="Clear history"><h3>Clear clipboard history?</h3><p>Remove the entries stored on this device. Other devices are unchanged.</p><div class="actions">${actionButton('x','Cancel','data-action="cancel-clear"')}${actionButton('trash-2','Clear history','data-action="confirm-clear"')}</div></section></div>`);this.el.querySelector('[data-action="cancel-clear"]').focus();}
}
document.querySelectorAll('[data-platform]').forEach(element=>new PreviewApp(element));
