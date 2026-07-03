const fs = require('fs');
let content = fs.readFileSync('src/pages/FreeCAI.tsx', 'utf8');

content = content.replace(
  /const cleanMarkdownFences = \(text: string\): string => \{/g,
  `const cleanMarkdownFences = (text: string): string => {
    if (!text) return "";
    text = text.replace(/\\\\?<br\\\\?\\s*\\\\?\\/?>/gi, " ");`
);

fs.writeFileSync('src/pages/FreeCAI.tsx', content, 'utf8');
