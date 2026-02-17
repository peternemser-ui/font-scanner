const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = 'C:/Users/peter/OneDrive/Desktop/favico.png';
const OUT_DIR = path.resolve(__dirname, '..', 'src', 'public', 'favicons');

// Standard favicon sizes
const sizes = [
  { size: 16,  name: 'favicon-16x16.png' },
  { size: 32,  name: 'favicon-32x32.png' },
  { size: 48,  name: 'favicon-48x48.png' },
  { size: 64,  name: 'favicon-64x64.png' },
  { size: 96,  name: 'favicon-96x96.png' },
  { size: 128, name: 'favicon-128x128.png' },
  { size: 180, name: 'apple-touch-icon.png' },       // Apple Touch Icon
  { size: 192, name: 'android-chrome-192x192.png' },  // Android / PWA
  { size: 512, name: 'android-chrome-512x512.png' },  // Android / PWA splash
];

async function generateFavicons() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Source file not found:', SOURCE);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { size, name } of sizes) {
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(OUT_DIR, name));
    console.log(`Created ${name} (${size}x${size})`);
  }

  // Also copy the 32x32 as the default favicon.png in public root
  await sharp(SOURCE)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(OUT_DIR, '..', 'favicon.png'));
  console.log('Created favicon.png (32x32) in public root');

  // Generate .ico file (contains 16, 32, 48)
  // sharp doesn't natively produce .ico, so we'll create a multi-size PNG set
  // and build the ICO manually
  await generateIco();

  console.log('\nAll favicons generated in:', OUT_DIR);
  console.log('\nAdd this to your HTML <head>:');
  console.log(`
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicons/favicon-48x48.png">
<link rel="icon" type="image/png" sizes="96x96" href="/favicons/favicon-96x96.png">
<link rel="icon" type="image/png" sizes="128x128" href="/favicons/favicon-128x128.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicons/android-chrome-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/favicons/android-chrome-512x512.png">
<link rel="icon" href="/favicon.ico" sizes="any">
  `.trim());
}

async function generateIco() {
  // ICO format: header + directory entries + image data
  const icoSizes = [16, 32, 48];
  const pngBuffers = [];

  for (const size of icoSizes) {
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push({ size, data: buf });
  }

  // ICO file structure
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;

  let dataOffset = headerSize + dirSize;
  const parts = [];

  // ICONDIR header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);           // Reserved
  header.writeUInt16LE(1, 2);           // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4);   // Number of images
  parts.push(header);

  // ICONDIRENTRY for each image
  const dirEntries = Buffer.alloc(dirSize);
  for (let i = 0; i < numImages; i++) {
    const { size, data } = pngBuffers[i];
    const offset = i * dirEntrySize;
    dirEntries.writeUInt8(size < 256 ? size : 0, offset);       // Width
    dirEntries.writeUInt8(size < 256 ? size : 0, offset + 1);   // Height
    dirEntries.writeUInt8(0, offset + 2);                         // Color palette
    dirEntries.writeUInt8(0, offset + 3);                         // Reserved
    dirEntries.writeUInt16LE(1, offset + 4);                      // Color planes
    dirEntries.writeUInt16LE(32, offset + 6);                     // Bits per pixel
    dirEntries.writeUInt32LE(data.length, offset + 8);            // Data size
    dirEntries.writeUInt32LE(dataOffset, offset + 12);            // Data offset
    dataOffset += data.length;
  }
  parts.push(dirEntries);

  // Image data (PNG format embedded)
  for (const { data } of pngBuffers) {
    parts.push(data);
  }

  const ico = Buffer.concat(parts);
  const icoPath = path.join(OUT_DIR, '..', 'favicon.ico');
  fs.writeFileSync(icoPath, ico);
  console.log('Created favicon.ico (16, 32, 48) in public root');
}

generateFavicons().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
