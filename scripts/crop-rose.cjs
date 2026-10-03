const sharp = require('sharp');
const fs = require('fs');
const SRC = 'C:/Users/DELL/Downloads/5911427608958668399.jpg';

(async () => {
  const meta = await sharp(SRC).metadata();
  console.log('source:', meta.width, 'x', meta.height);
  // header rose logo (white circle inside the navy band) — generous crop
  const lw = Math.round(meta.width * 0.12);   // ~88px
  const lx = Math.round(meta.width * 0.075);
  const ly = Math.round(meta.height * 0.028);
  const lh = Math.round(meta.height * 0.085);
  await sharp(SRC).extract({ left: lx, top: ly, width: lw, height: lh }).png().toFile('public/rose-logo.png');
  // watermark rose (center)
  const ww = Math.round(meta.width * 0.62);
  const wx = Math.round(meta.width * 0.19);
  const wy = Math.round(meta.height * 0.36);
  const wh = Math.round(meta.height * 0.40);
  await sharp(SRC).extract({ left: wx, top: wy, width: ww, height: wh }).png().toFile('public/rose-watermark.png');
  console.log('crops written');
})().catch(e => console.log('ERR', e.message));
