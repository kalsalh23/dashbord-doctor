const sharp = require('sharp');
const SRC = 'C:/Users/DELL/Downloads/5911427608958668399.jpg';
(async () => {
  const meta = await sharp(SRC).metadata();
  const lw = Math.round(meta.width * 0.105);
  const lx = Math.round(meta.width * 0.088);
  const ly = Math.round(meta.height * 0.036);
  const lh = Math.round(meta.height * 0.078);
  await sharp(SRC).extract({ left: lx, top: ly, width: lw, height: lh }).png().toFile('public/rose-logo.png');
  console.log('logo re-cropped');
})().catch(e => console.log('ERR', e.message));
