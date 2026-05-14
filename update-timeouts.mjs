import fs from 'fs';

let content;

// page.tsx
content = fs.readFileSync('src/app/page.tsx', 'utf-8');
content = content.replace(/timeoutMs = 90000\)/g, 'timeoutMs = 300000)');
content = content.replace(/undefined, 25000\)/g, 'undefined, 300000)');
content = content.replace(/body: form }, 140000\)/g, 'body: form }, 300000)');
content = content.replace(/userId \}\),\n      \}, 70000\)/g, 'userId }),\n      }, 300000)');
content = content.replace(/controller.abort\(\), 180000\)/g, 'controller.abort(), 300000)');
content = content.replace(/sessionId \}\),\n      \}, 25000\)/g, 'sessionId }),\n      }, 300000)');
content = content.replace(/userId \}\),\n      \}, 50000\)/g, 'userId }),\n      }, 300000)');
fs.writeFileSync('src/app/page.tsx', content);

// transcribe-analyze
content = fs.readFileSync('src/app/api/transcribe-analyze/route.ts', 'utf-8');
content = content.replace(/1000, 75000\)\.catch/g, '1000, 300000).catch');
content = content.replace(/1000, 45000\)\.catch/g, '1000, 300000).catch');
content = content.replace(/maxDuration = 300/g, 'maxDuration = 300'); // already 300s
fs.writeFileSync('src/app/api/transcribe-analyze/route.ts', content);

// generate-speech
content = fs.readFileSync('src/app/api/generate-speech/route.ts', 'utf-8');
content = content.replace(/1000, 45000\)\.catch/g, '1000, 300000).catch');
fs.writeFileSync('src/app/api/generate-speech/route.ts', content);

// generate-insights
content = fs.readFileSync('src/app/api/generate-insights/route.ts', 'utf-8');
content = content.replace(/1000, 45000\)\.catch/g, '1000, 300000).catch');
fs.writeFileSync('src/app/api/generate-insights/route.ts', content);

// generate-speech-audio
content = fs.readFileSync('src/app/api/generate-speech-audio/route.ts', 'utf-8');
content = content.replace(/1000, 60000\);/g, '1000, 300000);');
content = content.replace(/1000, 120000\);/g, '1000, 300000);');
fs.writeFileSync('src/app/api/generate-speech-audio/route.ts', content);

