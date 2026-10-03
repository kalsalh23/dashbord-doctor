const sharp = require('sharp');
(async () => {
  const meta = await sharp('C:/Users/DELL/Downloads/5911082250638397307.jpg').metadata();
  const lw = Math.round(meta.width * 0.15);
  const lx = Math.round(meta.width * 0.425);
  const ly = Math.round(meta.height * 0.014);
  const lh = Math.round(meta.height * 0.082);
  await sharp(SRC).extract({ left: lx, top: ly, width: lw, height: lh }).png().toFile('public/nizar-logo.png');
  console.log('logo re-cropped');
})().catch(e => console.log('ERR', e.message));
