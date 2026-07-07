// Turns the extracted app_raw.jsx into an esbuild-ready module:
//  - adds React + react-dom/client imports (replacing the CDN globals)
//  - replaces ReactDOM.createRoot(...) with the imported createRoot
// Idempotent-ish: always regenerates src/app.base.jsx from app_raw.jsx.
import fs from 'fs';

let s = fs.readFileSync('src/app_raw.jsx', 'utf8');

const header = `import React from 'react';
import { createRoot } from 'react-dom/client';
// NOTE: hooks are destructured below from React (const{useState,...}=React) — kept as-is from the original.
`;

s = header + s;

s = s.replace(
  "ReactDOM.createRoot(document.getElementById('root')).render(<App/>);",
  "createRoot(document.getElementById('root')).render(<App/>);"
);

fs.writeFileSync('src/app.base.jsx', s);
console.log('Wrote src/app.base.jsx —', s.length, 'chars');
console.log('Has react import:', s.includes("import React from 'react'"));
console.log('Has createRoot mount:', s.includes('createRoot(document.getElementById'));
console.log('Still references ReactDOM?', s.includes('ReactDOM.'));
