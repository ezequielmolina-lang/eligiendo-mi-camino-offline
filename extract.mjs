// Extracts the three inline blocks from the reference demo into source files.
import fs from 'fs';

const html = fs.readFileSync('_reference_demo.html', 'utf8');

function between(s, startMarker, endMarker) {
  const a = s.indexOf(startMarker);
  if (a < 0) return null;
  const b = s.indexOf(endMarker, a + startMarker.length);
  if (b < 0) return null;
  return s.slice(a + startMarker.length, b);
}

// 1) Tailwind config object (text after `tailwind.config=` up to the closing </script>)
const cfgStart = html.indexOf('tailwind.config=');
const cfgEnd = html.indexOf('</script>', cfgStart);
let tailwindConfig = html.slice(cfgStart + 'tailwind.config='.length, cfgEnd).trim();
tailwindConfig = tailwindConfig.replace(/;\s*$/, '');

// 2) <style> block
const css = (between(html, '<style>', '</style>') || '').trim();

// 3) <script type="text/babel"> block
const babel = (between(html, '<script type="text/babel">', '</script>') || '').trim();

fs.mkdirSync('src', { recursive: true });
fs.writeFileSync('src/tailwind.config.snippet.txt', tailwindConfig);
fs.writeFileSync('src/custom.css', css);
fs.writeFileSync('src/app_raw.jsx', babel);

// Report
const head = html.slice(0, html.indexOf('</head>'));
console.log('=== HEAD external refs ===');
console.log((head.match(/<(script|link)[^>]*>/g) || []).join('\n'));
console.log('\n=== sizes ===');
console.log('tailwind config chars:', tailwindConfig.length);
console.log('custom css chars     :', css.length);
console.log('babel/app chars      :', babel.length, '(~', Math.round(babel.length/1024), 'KB)');
console.log('\n=== app_raw.jsx first 500 chars ===');
console.log(babel.slice(0, 500));
console.log('\n=== app_raw.jsx last 200 chars ===');
console.log(babel.slice(-200));
console.log('\n=== tailwind config ===');
console.log(tailwindConfig);
