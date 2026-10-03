const sharp = require('sharp');
(async () => {
  // strengthen the faint rose for the header (logo) — keep watermark faint
  await sharp('public/rose-logo.png')
    .modulate({ saturation: 2.4, brightness: 0.96 })
    .linear(1.35, -30)
    .png()
    .toFile('public/rose-logo.png');
  console.log('logo enhanced');
})().catch(e => console.log('ERR', e.message));
