const fs = require('fs');
const p = 'src/lib/staffPush.js';
let s = fs.readFileSync(p, 'utf8');

// force a fresh subscription each activation (old-key subscriptions become invalid after rotation)
s = s.replace(
  `    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? (await reg.pushManager.subscribe({`,
  `    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()
    const sub = await reg.pushManager.subscribe({`
);

fs.writeFileSync(p, s);
console.log('fresh-subscribe:', s.includes('await existing.unsubscribe()'));
