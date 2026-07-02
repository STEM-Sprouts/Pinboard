import { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import cpp from 'highlight.js/lib/languages/cpp';
import 'highlight.js/styles/github.css';

hljs.registerLanguage('cpp', cpp);

export default function CodePreview({ code }: { code: string }) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      delete codeRef.current.dataset.highlighted;
      hljs.highlightElement(codeRef.current);
    }
  }, [code]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center text-sm font-semibold text-gray-700">
        Arduino C Preview
      </div>
      <div className="p-4 flex-1 overflow-y-auto bg-surface text-sm">
        <pre className="m-0">
          <code ref={codeRef} data-testid="code-preview" className="language-cpp bg-transparent !p-0">
            {code || '// Generated C code will appear here'}
          </code>
        </pre>
      </div>
    </div>
  );
}
