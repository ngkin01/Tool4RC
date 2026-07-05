function parseMarkdownToSections(markdown) {
  const lines = markdown.split('\n');
  const root = { level: 0, title: '', rawTitle: '', content: [], children: [] };
  const stack = [root];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    
    if (!inCodeBlock) {
      const match = line.match(/^(#{1,6})\s+(.*)/);
      if (match) {
        const level = match[1].length;
        const title = match[2];
        const section = { level, title, rawTitle: line, content: [], children: [] };
        
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        stack[stack.length - 1].children.push(section);
        stack.push(section);
        continue;
      }
    }
    stack[stack.length - 1].content.push(line);
  }
  return root;
}
const md = `
# 🏢 CLIENT INSIGHTS
Some text here.
\`\`\`
# This is a comment in code
\`\`\`
## I. TỔNG QUAN
Overview text.
`;
console.log(JSON.stringify(parseMarkdownToSections(md), null, 2));
