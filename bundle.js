const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const scripts = [
  'config.js',
  'world.js',
  'renderer.js',
  'perception.js',
  'policies.js',
  'scenarios.js',
  'evaluation.js',
  'app.js'
];

let inlineScripts = '';
for (const s of scripts) {
  const content = fs.readFileSync(s, 'utf8');
  inlineScripts += `\n<!-- ================= ${s} ================= -->\n<script>\n${content}\n</script>\n`;
  html = html.replace(`<script src="${s}"></script>`, '');
}

html = html.replace('<!-- LOAD SCRIPTS LOCALLY IN EXACT ORDER -->', '<!-- EMBEDDED INLINE SCRIPTS (STANDALONE OFFLINE) -->\n' + inlineScripts);

fs.writeFileSync('dockcheck-demo.html', html, 'utf8');
console.log('dockcheck-demo.html generated successfully! File size:', fs.statSync('dockcheck-demo.html').size, 'bytes');
