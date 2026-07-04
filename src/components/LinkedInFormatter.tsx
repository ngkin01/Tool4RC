import React, { useState, useRef, useEffect } from 'react';
import { formatText, FormatterStyle, unformatText } from '../lib/unicodeFormatter';
import {
  Undo, Redo, Eraser,
  Copy,
  ThumbsUp, MessageSquare, Repeat, Send,
  List, ListOrdered, CheckSquare, ArrowUp, ArrowDown
} from 'lucide-react';

interface Props {
  initialText?: string;
  onCopy?: () => void;
}

export function LinkedInFormatter({ initialText = '', onCopy }: Props) {
  const [text, setText] = useState(initialText);
  const [history, setHistory] = useState<string[]>([initialText]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    let cleanText = initialText.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    setText(cleanText);
    setHistory([cleanText]);
    setHistoryIndex(0);
  }, [initialText]);

  const handleTextChange = (newText: string, addToHistory = true) => {
    setText(newText);
    if (addToHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newText);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setText(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setText(history[historyIndex + 1]);
    }
  };

  const handleFormatSelection = (style: string) => {
    if (!style) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const isFullText = start === end;
    const targetText = isFullText ? text : text.substring(start, end);

    if (!targetText) return;

    let newFormattedText = targetText;

    if (['bullet', 'number', 'checklist', 'ascending', 'descending'].includes(style)) {
      const lines = targetText.split('\n');
      newFormattedText = lines.map((line, i) => {
        if (!line.trim()) return line;
        if (style === 'bullet') return `• ${line}`;
        if (style === 'number') return `${i + 1}. ${line}`;
        if (style === 'checklist') return `☐ ${line}`;
        if (style === 'ascending') return `${String.fromCharCode(65 + (i % 26))}. ${line}`;
        if (style === 'descending') return `${lines.length - i}. ${line}`;
        return line;
      }).join('\n');
    } else {
      newFormattedText = formatText(targetText, style as FormatterStyle);
    }

    const newText = isFullText 
      ? newFormattedText 
      : text.substring(0, start) + newFormattedText + text.substring(end);
      
    handleTextChange(newText);

    setTimeout(() => {
      textarea.focus();
      if (isFullText) {
        textarea.setSelectionRange(newFormattedText.length, newFormattedText.length);
      } else {
        textarea.setSelectionRange(start, start + newFormattedText.length);
      }
    }, 0);
  };

  const handleClearFormat = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      handleTextChange(unformatText(text));
    } else {
      const selectedText = text.substring(start, end);
      const cleanText = unformatText(selectedText);
      const newText = text.substring(0, start) + cleanText + text.substring(end);
      handleTextChange(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + cleanText.length);
      }, 0);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  const showToast = (msg: string) => alert(`${msg} (Not supported in this demo)`);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 500 }}>
        
        {/* LEFT PANEL: Editor */}
        <div style={{ flex: '1 1 50%', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minWidth: 350 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', padding: '12px', gap: 12, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              onChange={(e) => {
                handleFormatSelection(e.target.value);
                e.target.value = ""; // reset after selection
              }}
              defaultValue=""
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', outline: 'none', fontSize: 14, color: '#374151', background: '#f9fafb', cursor: 'pointer', fontWeight: 500, minWidth: 160 }}
            >
              <option value="" disabled>Apply formatting...</option>
              <optgroup label="Text Styles">
                <option value="normal">Normal</option>
                <option value="bold">{formatText('Bold', 'bold')}</option>
                <option value="boldSans">{formatText('Bold Sans', 'boldSans')}</option>
                <option value="italic">{formatText('Italic', 'italic')}</option>
                <option value="italicSans">{formatText('Italic Sans', 'italicSans')}</option>
                <option value="boldItalic">{formatText('Bold Italic', 'boldItalic')}</option>
                <option value="boldItalicSans">{formatText('Bold Italic Sans', 'boldItalicSans')}</option>
                <option value="sans">{formatText('Sans', 'sans')}</option>
                <option value="underline">{formatText('Underline', 'underline')}</option>
                <option value="strikethrough">{formatText('Strikethrough', 'strikethrough')}</option>
                <option value="boldUnderline">{formatText('Bold Underline', 'boldUnderline')}</option>
                <option value="boldStrikethrough">{formatText('Bold Strikethrough', 'boldStrikethrough')}</option>
                <option value="script">{formatText('Script', 'script')}</option>
                <option value="doublestruck">{formatText('Doublestruck', 'doublestruck')}</option>
                <option value="fullwidth">{formatText('Fullwidth', 'fullwidth')}</option>
                <option value="uppercase">UPPERCASE</option>
                <option value="lowercase">lowercase</option>
              </optgroup>
            </select>
            
            <Divider />
            {/* Group 2: Lists */}
            <div style={{ display: 'flex', gap: 4 }}>
              <ToolbarBtn icon={<List size={16}/>} onClick={() => handleFormatSelection('bullet')} title="Bullet Points" />
              <ToolbarBtn icon={<ListOrdered size={16}/>} onClick={() => handleFormatSelection('number')} title="Numbered List" />
              <ToolbarBtn icon={<CheckSquare size={16}/>} onClick={() => handleFormatSelection('checklist')} title="Checklist" />
              <ToolbarBtn icon={<ArrowUp size={16}/>} onClick={() => handleFormatSelection('ascending')} title="Ascending List" />
              <ToolbarBtn icon={<ArrowDown size={16}/>} onClick={() => handleFormatSelection('descending')} title="Descending List" />
            </div>

            <Divider />
            {/* Group 3: History & Clear */}
            <div style={{ display: 'flex', gap: 4 }}>
              <ToolbarBtn icon={<Undo size={16}/>} onClick={handleUndo} disabled={historyIndex === 0} title="Undo" />
              <ToolbarBtn icon={<Redo size={16}/>} onClick={handleRedo} disabled={historyIndex === history.length - 1} title="Redo" />
              <ToolbarBtn icon={<Eraser size={16}/>} onClick={handleClearFormat} title="Clear Formatting" />
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            style={{ flex: 1, padding: 20, border: 'none', outline: 'none', resize: 'none', fontSize: 15, lineHeight: 1.6, color: '#1f2937', fontFamily: 'inherit' }}
            placeholder="Write your post here... Select text and use the toolbar to format."
          />

          {/* Bottom Actions */}
          <div style={{ padding: '16px 20px', display: 'flex', gap: 12, borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
            <button onClick={copyToClipboard} className="lf-btn-copy" style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: copied ? '#dcfce7' : '#e0f2fe', color: copied ? '#166534' : '#0284c7', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              <Copy size={16} /> {copied ? 'Copied!' : 'Copy text'}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Preview */}
        <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', background: '#f3f2ef', minWidth: 350 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ fontWeight: 500, color: '#1f2937', fontSize: 15 }}>Post Preview</span>
          </div>

          {/* Preview Area */}
          <div style={{ flex: 1, padding: 24, display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
            <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: '16px 16px 8px', height: 'fit-content', transition: 'width 0.3s ease' }}>
              
              {/* LinkedIn Header */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 18, flexShrink: 0 }}>
                  NN
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#000000E6' }}>Nhan Nguyen (Tommy)</div>
                  <div style={{ fontSize: 12, color: '#00000099', marginTop: 2 }}>Recruitment Consultant at freeC Asia</div>
                  <div style={{ fontSize: 12, color: '#00000099', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>12h • 🌎</div>
                </div>
              </div>
              
              {/* Content */}
              <div style={{ fontSize: 14, color: '#000000E6', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 16 }}>
                {text || <span style={{ color: '#00000099' }}>Your post will appear here...</span>}
              </div>
              
              {/* Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#00000099', borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ background: '#0a66c2', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ThumbsUp size={10} fill="#fff" />
                  </div>
                  <div style={{ background: '#df704d', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -6, border: '1px solid #fff' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  </div>
                  <span style={{ marginLeft: 4 }}>57</span>
                </div>
                <div>24 comments • 6 reposts</div>
              </div>
              
              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <PreviewAction icon={<ThumbsUp size={18} />} label="Like" />
                <PreviewAction icon={<MessageSquare size={18} />} label="Comment" />
                <PreviewAction icon={<Repeat size={18} />} label="Repost" />
                <PreviewAction icon={<Send size={18} />} label="Send" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ToolbarBtn = ({ icon, onClick, disabled = false, title }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="lf-btn-toolbar"
    style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
      color: disabled ? '#9ca3af' : '#4b5563'
    }}
  >
    {icon}
  </button>
);

const Divider = () => <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />;

const PreviewAction = ({ icon, label }: any) => (
  <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#00000099', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '10px 8px', borderRadius: 4, flex: 1, justifyContent: 'center' }}
    onMouseEnter={(e) => e.currentTarget.style.background = '#0000000a'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
  >
    {icon} <span className="hidden sm:inline">{label}</span>
  </button>
);
