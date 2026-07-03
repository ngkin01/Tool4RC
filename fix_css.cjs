const fs = require('fs');
let content = fs.readFileSync('src/index.css', 'utf8');

content = content.replace(
  /\.markdown-body pre \{[\s\S]*?\}/,
  `.markdown-body pre {
  overflow-x: auto;
  padding: 20px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid var(--border-color);
  margin-bottom: 1.5em;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}
.dark .markdown-body pre {
  background: rgba(0, 0, 0, 0.15);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}`
);

content = content.replace(
  /\.markdown-body table \{[\s\S]*?\}/,
  `.markdown-body table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: separate;
  border-spacing: 0;
  margin-bottom: 1.5em;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}`
);

fs.writeFileSync('src/index.css', content, 'utf8');
