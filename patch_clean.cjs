const fs = require('fs');
let content = fs.readFileSync('src/pages/FreeCAI.tsx', 'utf8');

content = content.replace(
  /const cleanMarkdownFences = \(text: string\): string => \{/,
  `const cleanMarkdownFences = (text: string, clientOverview?: string): string => {
    if (!text) return "";
    text = text.replace(/\\\\?<br\\\\?\\s*\\\\?\\/?>/gi, " ");
    
    // Fix old entries having literal \${companyReport} or ##
    if (clientOverview && text.includes("\\\${companyReport}")) {
      text = text.replace("\\\${companyReport}", clientOverview);
    }
    if (clientOverview && text.includes("\${companyReport}")) {
      text = text.replace("\${companyReport}", clientOverview);
    }
    // Convert ## INSIGHTS CLIENT to # INSIGHTS CLIENT for old entries to match sizes
    text = text.replace("## 🏢 INSIGHTS CLIENT", "# 🏢 INSIGHTS CLIENT");
    `
);

content = content.replace(
  /<ReactMarkdown remarkPlugins={\[remarkGfm\]} rehypePlugins={\[rehypeRaw\]}>{cleanMarkdownFences\(selectedJob.report.markdownReport\)}<\/ReactMarkdown>/g,
  `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{cleanMarkdownFences(selectedJob.report.markdownReport, selectedClient?.summary?.overview)}</ReactMarkdown>`
);

content = content.replace(
  /<ReactMarkdown remarkPlugins={\[remarkGfm\]} rehypePlugins={\[rehypeRaw\]}>{cleanMarkdownFences\(draftResult.jobData.markdownReport \|\| ""\)}<\/ReactMarkdown>/g,
  `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{cleanMarkdownFences(draftResult.jobData.markdownReport || "", selectedClient?.summary?.overview)}</ReactMarkdown>`
);

fs.writeFileSync('src/pages/FreeCAI.tsx', content, 'utf8');
