import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import xml from 'highlight.js/lib/languages/xml'; // handles HTML
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import bash from 'highlight.js/lib/languages/bash';

// Load one-dark style
import 'highlight.js/styles/atom-one-dark.css';

// Register highlight.js languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('bash', bash);

interface CodeBlockProps {
  code: string;
  language: string;
  showLineNumbers?: boolean;    // default true
  maxHeight?: string;           // default '300px'
  showCopyButton?: boolean;     // default true
  showLanguageBadge?: boolean;  // default true
}

export default function CodeBlock({
  code,
  language,
  showLineNumbers = true,
  maxHeight = '300px',
  showCopyButton = true,
  showLanguageBadge = true,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const cleanLang = (language || 'text').trim().toLowerCase();
  const hljsLang = cleanLang === 'html' ? 'html' : cleanLang;

  let highlightedHtml = '';
  try {
    if (hljs.getLanguage(hljsLang)) {
      highlightedHtml = hljs.highlight(code, { language: hljsLang }).value;
    } else {
      highlightedHtml = hljs.highlight(code, { language: 'plaintext' }).value;
    }
  } catch (e) {
    highlightedHtml = code;
  }

  const lines = code.split('\n');
  const lineCount = lines.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <div className="relative border border-slate-800 bg-slate-950 rounded-xl overflow-hidden shadow-xl text-left w-full">
      {/* Header bar */}
      {(showLanguageBadge || showCopyButton) && (
        <div className="flex justify-between items-center px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 text-xs font-bold text-slate-400">
          <span>{showLanguageBadge ? cleanLang.toUpperCase() : ''}</span>
          {showCopyButton && (
            <button 
              onClick={handleCopy} 
              className="flex items-center gap-1 hover:text-white transition-colors bg-slate-950/60 hover:bg-slate-900/80 px-2 py-1 rounded border border-slate-800"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      )}

      {/* Code body */}
      <div 
        className="flex font-mono text-[14px] md:text-sm leading-6 p-4 overflow-auto"
        style={{ maxHeight }}
      >
        {showLineNumbers && (
          <div className="select-none text-right pr-3.5 text-slate-655 border-r border-slate-850 mr-3.5 flex flex-col">
            {Array.from({ length: lineCount }).map((_, i) => (
              <span key={i} className="h-6 block">{i + 1}</span>
            ))}
          </div>
        )}
        <pre className="overflow-x-auto w-full whitespace-pre">
          <code 
            dangerouslySetInnerHTML={{ __html: highlightedHtml }} 
            className={`hljs lang-${cleanLang} block h-full`}
          />
        </pre>
      </div>
    </div>
  );
}
