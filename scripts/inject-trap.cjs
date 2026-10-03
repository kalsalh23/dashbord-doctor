const fs = require('fs');
const p = 'dist/index.html';
let s = fs.readFileSync(p, 'utf8');
const trap = `<script>window.__errs=[];window.onerror=function(m,s,l,c,e){var d=document.getElementById('errbox');if(!d){d=document.createElement('pre');d.id='errbox';d.style.cssText='position:fixed;top:0;left:0;z-index:99999;background:#000;color:#0f0;font:12px monospace;white-space:pre-wrap;max-height:50vh;overflow:auto;padding:8px';document.body.appendChild(d)}d.textContent+=(m)+' @'+(s||'?')+':'+l+'\\n'+((e&&e.stack)?e.stack:'')+'\\n---\\n'};window.addEventListener('unhandledrejection',function(e){window.onerror('unhandledrejection: '+(e.reason&&e.reason.message||e.reason),'',0,0,e.reason)})</script>`;
if (!s.includes('window.__errs')) {
  s = s.replace('<head>', '<head>' + trap);
  fs.writeFileSync(p, s);
  console.log('trap injected');
} else console.log('already');
