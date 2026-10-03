const sharp = require('sharp');
(async () => {
  // rose bloom only (clean white background) from the watermark crop
  const meta = await sharp('public/rose-watermark.png').metadata();
  console.log('watermark size:', meta.width, 'x', meta.height);
  const w = Math.round(meta.width * 0.38);
  const h = Math.round(meta.height * 0.38);
  const left = Math.round(meta.width * 0.31);
  const top = Math.round(meta.height * 0.13);
  await sharp('public/rose-watermark.png')
    .extract({ left, top, width: w, height: h })
    .png()
    .toFile('public/rose-logo.png');
  console.log('logo from watermark cropped');
})().catch(e => console.log('ERR', e.message));
