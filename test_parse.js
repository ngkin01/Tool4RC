const md = `
# 🏢 CLIENT INSIGHTS
Some text here.
## I. TỔNG QUAN
Overview text.
## II. COMPETITORS
Competitors text.
# 🎯 HIRING INSIGHTS
Hiring text.
`;

function parseMarkdownToSections(markdown) {
  const lines = markdown.split('\n');
  const root = { level: 0, title: '', content: [], children: [] };
  const stack = [root];

  for (const line of lines) {
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
    } else {
      stack[stack.length - 1].content.push(line);
    }
  }
  return root.children;
}
console.log(JSON.stringify(parseMarkdownToSections(md), null, 2));
