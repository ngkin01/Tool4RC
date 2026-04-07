const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Replace specific font-family strings
  content = content.replace(/fontFamily:\s*"'DM Sans','Noto Sans',sans-serif"/g, 'fontFamily: "\'DM Sans\', \'Noto Sans\', system-ui, sans-serif"');
  content = content.replace(/fontFamily:\s*"'DM Sans',sans-serif"/g, 'fontFamily: "\'DM Sans\', \'Noto Sans\', system-ui, sans-serif"');
  content = content.replace(/fontFamily:\s*"'IBM Plex Mono','Courier New',monospace"\s*\?\s*"'IBM Plex Mono','Courier New',monospace"\s*:\s*"'DM Sans',sans-serif"/g, 'fontFamily: mono ? "\'IBM Plex Mono\', \'Courier New\', monospace" : "\'DM Sans\', \'Noto Sans\', system-ui, sans-serif"');
  content = content.replace(/fontFamily:\s*mono\?"'IBM Plex Mono','Courier New',monospace":"'DM Sans',sans-serif"/g, 'fontFamily: mono ? "\'IBM Plex Mono\', \'Courier New\', monospace" : "\'DM Sans\', \'Noto Sans\', system-ui, sans-serif"');
  content = content.replace(/fontFamily:\s*"'DM Sans','Noto Sans',sans-serif",/g, 'fontFamily: "\'DM Sans\', \'Noto Sans\', system-ui, sans-serif",');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir('./src');
