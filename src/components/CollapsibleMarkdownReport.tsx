import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ChevronRight, ChevronDown, ListCollapse, ListTree } from 'lucide-react';

interface MarkdownSection {
  level: number;
  title: string;
  rawTitle: string;
  content: string[];
  children: MarkdownSection[];
}

function parseMarkdownToSections(markdown: string): MarkdownSection {
  const lines = markdown.split('\n');
  const root: MarkdownSection = { level: 0, title: '', rawTitle: '', content: [], children: [] };
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
        const section: MarkdownSection = { level, title, rawTitle: line, content: [], children: [] };
        
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

interface MarkdownNodeRendererProps {
  node: MarkdownSection;
  expandAction: { action: 'expand' | 'collapse'; timestamp: number } | null;
  isRoot?: boolean;
}

const MarkdownNodeRenderer: React.FC<MarkdownNodeRendererProps> = ({ node, expandAction, isRoot }) => {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (expandAction) {
      setIsOpen(expandAction.action === 'expand');
    }
  }, [expandAction]);

  const hasChildren = node.children.length > 0 || node.content.some(line => line.trim().length > 0);
  const isMainSection = node.level === 1;

  return (
    <div className={`mb-2 ${isRoot ? '' : 'ml-0'}`}>
      {node.level > 0 && (
        <div 
          className={`flex items-center cursor-pointer transition-colors select-none py-1.5 -ml-1.5 pl-1.5 pr-2 rounded-md hover:bg-slate-100 ${
            isMainSection ? 'mt-6 mb-2 border-b border-slate-200 pb-2 bg-slate-50/50' : 'mt-2'
          }`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex-shrink-0 w-6 flex justify-center items-center">
            {isOpen ? <ChevronDown className={`text-slate-500 ${isMainSection ? 'w-5 h-5' : 'w-4 h-4'}`} /> : <ChevronRight className={`text-slate-500 ${isMainSection ? 'w-5 h-5' : 'w-4 h-4'}`} />}
          </div>
          <div className="flex-grow">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeRaw]} 
              className={`markdown-body ${isMainSection ? '!text-xl !mb-0' : '!text-base !mb-0'}`}
              components={{
                h1: ({node, ...props}) => <h1 style={{margin:0, border: 'none', padding: 0}} {...props} />,
                h2: ({node, ...props}) => <h2 style={{margin:0, border: 'none', padding: 0}} {...props} />,
                h3: ({node, ...props}) => <h3 style={{margin:0, border: 'none', padding: 0}} {...props} />,
                h4: ({node, ...props}) => <h4 style={{margin:0, border: 'none', padding: 0}} {...props} />,
                h5: ({node, ...props}) => <h5 style={{margin:0, border: 'none', padding: 0}} {...props} />,
                h6: ({node, ...props}) => <h6 style={{margin:0, border: 'none', padding: 0}} {...props} />,
              }}
            >
              {node.rawTitle}
            </ReactMarkdown>
          </div>
        </div>
      )}
      {isOpen && (
        <div className={node.level > 0 ? "ml-6" : ""}>
          {node.content.join('\n').trim() && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} className="markdown-body">
              {node.content.join('\n')}
            </ReactMarkdown>
          )}
          {node.children.map((child, i) => (
            <MarkdownNodeRenderer key={i} node={child} expandAction={expandAction} />
          ))}
        </div>
      )}
    </div>
  );
};

export const CollapsibleMarkdownReport: React.FC<{ markdown: string }> = ({ markdown }) => {
  const [expandAction, setExpandAction] = useState<{ action: 'expand' | 'collapse'; timestamp: number } | null>(null);
  const rootNode = parseMarkdownToSections(markdown);

  return (
    <div className="flex flex-col relative">
      <div className="sticky top-0 z-10 flex justify-end gap-2 mb-4 bg-white/90 backdrop-blur-sm py-2 border-b">
        <button onClick={() => setExpandAction({ action: 'expand', timestamp: Date.now() })} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors h-8">
          <ListTree className="w-4 h-4 mr-1.5" /> Mở rộng tất cả
        </button>
        <button onClick={() => setExpandAction({ action: 'collapse', timestamp: Date.now() })} className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors h-8">
          <ListCollapse className="w-4 h-4 mr-1.5" /> Thu gọn tất cả
        </button>
      </div>
      <div>
        {rootNode.content.join('\n').trim() && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} className="markdown-body">
            {rootNode.content.join('\n')}
          </ReactMarkdown>
        )}
        {rootNode.children.map((child, i) => (
          <MarkdownNodeRenderer key={i} node={child} expandAction={expandAction} isRoot={true} />
        ))}
      </div>
    </div>
  );
};
