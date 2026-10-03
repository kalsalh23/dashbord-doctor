const sharp = require('sharp');
const SRC = 'C:/Users/DELL/Downloads/5911082250638397307.jpg';
(async () => {
  const meta = await sharp(SRC).metadata();
  console.log('source:', meta.width, 'x', meta.height);
  // top center gold/navy logo circle
  const lw = Math.round(meta.width * 0.16);
  const lx = Math.round(meta.width * 0.42);
  const ly = Math.round(meta.height * 0.012);
  const lh = Math.round(meta.height * 0.095);
  await sharp(SRC).extract({ left: lx, top: ly, width: lw, height: lh }).png().toFile('public/nizar-logo.png');
  // center faint spine watermark
  const ww = Math.round(meta.width * 0.45);
  const wx = Math.round(meta.width * 0.275);
  const wy = Math.round(meta.height * 0.40);
  const wh = Math.round(meta.height * 0.30);
  await sharp(SRC).extract({ left: wx, top: wy, width: ww, height: wh }).png().toFile('public/nizar-watermark.png');
  // QR bottom-left
  const qw = Math.round(meta.width * 0.14);
  const qx = Math.round(meta.width * 0.055);
  const qy = Math.round(meta.height * 0.755);
  const qh = Math.round(meta.height * 0.115);
  await sharp(SRC).extract({ left: qx, top: qy, width: qw, height: qh }).png().toFile('public/nizar-qr.png');
  console.log('nizar assets cropped');
})().catch(e => console.log('ERR', e.message));
