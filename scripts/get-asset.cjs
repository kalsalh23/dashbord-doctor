const s = require('fs').readFileSync('page.html', 'utf8');
const m = s.match(/src="([^"]+\.js)"/);
console.log('script src:', m && m[1]);
require('fs').writeFileSync('asset-url.txt', 'http://localhost:4173' + (m ? m[1] : ''));
