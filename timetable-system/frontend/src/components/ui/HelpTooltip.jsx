import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

const HelpTooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex items-center ml-1 group cursor-pointer"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((s) => !s)}
    >
      {children || <HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" strokeWidth={1.5} />}
      
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-[var(--bg-surface-alt)] border border-[var(--border)] text-[var(--text-primary)] text-[11px] font-sans font-normal rounded-sm shadow-md z-50 pointer-events-none text-center leading-normal">
          {text}
        </span>
      )}
    </span>
  );
};

export default HelpTooltip;
