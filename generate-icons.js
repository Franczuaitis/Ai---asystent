const fs = require('fs');

// Generate simple SVG icons and convert to base64 PNG-like data
const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="40" fill="#6c63ff"/>
  <text x="96" y="130" font-size="100" text-anchor="middle">🤖</text>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#6c63ff"/>
  <text x="256" y="340" font-size="280" text-anchor="middle">🤖</text>
</svg>`;

fs.writeFileSync('public/icon-192.svg', svg192);
fs.writeFileSync('public/icon-512.svg', svg512);
console.log('Icons generated');
