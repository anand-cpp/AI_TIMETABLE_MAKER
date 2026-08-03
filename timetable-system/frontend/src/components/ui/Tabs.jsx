import { useState } from 'react';
import { cn } from '../../utils/cn';

const Tabs = ({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onChange,
  className,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab || tabs[0]?.key);
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleTabClick = (key) => {
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(key);
    }
    onChange?.(key);
  };

  const activeContent = tabs.find((t) => t.key === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab headers */}
      <div className="border-b border-[var(--border)] font-sans">
        <nav className="flex gap-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={cn(
                'py-3 text-xs font-sans font-semibold border-b-2 -mb-px transition-colors cursor-pointer shrink-0',
                activeTab === tab.key
                  ? 'border-[var(--accent)] text-[var(--accent)] font-bold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)]'
              )}
            >
              <span className="flex items-center gap-2">
                {tab.icon && <tab.icon className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />}
                {tab.label}
                {tab.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="pt-4 transition-all duration-300">{activeContent}</div>
    </div>
  );
};

export default Tabs;