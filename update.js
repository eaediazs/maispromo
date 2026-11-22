const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
let count = 0;

function generateSVG() {
  count++;
  const gradId = `goldGrad-${count}`;
  return `<div class="brand-pill">
    <svg viewBox="0 0 100 100" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFF275"/>
          <stop offset="100%" stop-color="#F7C500"/>
        </linearGradient>
      </defs>
      <circle cx="53" cy="53" r="44" fill="#C49B00"/>
      <circle cx="48" cy="48" r="44" fill="url(#${gradId})"/>
      <path d="M40 26 h16 v16 h16 v16 h-16 v16 h-16 v-16 h-16 v-16 h16 z" fill="rgba(196,155,0,0.4)" transform="translate(3,4)"/>
      <rect x="40" y="24" width="16" height="48" rx="1.5" fill="#1A1A1A"/>
      <rect x="24" y="40" width="48" height="16" rx="1.5" fill="#1A1A1A"/>
      <rect x="40" y="24" width="8" height="48" rx="1.5" fill="#3D3D3D"/>
      <rect x="24" y="40" width="48" height="8" rx="1.5" fill="#3D3D3D"/>
    </svg>
    <span class="brand-pill-text">PROMO</span>
  </div>`.replace(/\n\s+/g, ''); // minify to not mess up indentation too much
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;

  // 1. Replace CSS cache buster
  content = content.replace(/(\/css\/[^"']+\.css\?v=)1\.[23]/g, '$11.4');
  
  // 2. Replace old logo
  const logoRegex = /<div class="mark">\+<\/div>\+PRO<span>MO<\/span>/g;
  content = content.replace(logoRegex, () => generateSVG());

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${filePath}`);
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('.temp_skills')) {
        traverse(fullPath);
      }
    } else if (fullPath.endsWith('.html')) {
      processFile(fullPath);
    }
  }
}

traverse(projectRoot);
console.log('Done.');
