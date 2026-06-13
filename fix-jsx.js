const fs = require('fs');
const path = require('path');

function fixFile(fp) {
  let content = fs.readFileSync(fp, 'utf8');
  let original = content;

  content = content.replace(/\brom\s+'/g, "from '");
  content = content.replace(/from\s+'[^']+'import/g, m => m.replace(/import$/, '\nimport'));
  content = content.replace(/\}\s*(const|let|var|function|export|if|try|return|useEffect|useState|useRef)/g, '}\n$1');
  content = content.replace(/\)\s*(const|let|var|function|export|if|try|return|useEffect|useState|useRef)/g, ')\n$1');
  content = content.replace(/;\s*(const|let|var|function|export|if|try|return|useEffect|useState|useRef)/g, ';\n$1');

  if (content !== original) {
    fs.writeFileSync(fp, content, 'utf8');
    console.log('Fixed:', path.relative('D:/daydream-studio/frontend/src', fp));
  }
}

function scan(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      scan(fp);
    } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
      fixFile(fp);
    }
  });
}

scan('D:/daydream-studio/frontend/src');
console.log('Done');
