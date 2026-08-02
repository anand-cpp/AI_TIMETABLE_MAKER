import { useState } from 'react';
import { cn } from '../../utils/cn';

const Tabs = ({
  tabs,
  defaultTab,
  onChange,
  className,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key);

  const handleTabClick = (key) => {
    setActiveTab(key);
    onChange?.(key);
  };

  const activeContent = tabs.find((t) => t.key === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab headers */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={cn(
                'py-3 text-sm font-bold border-b-2 -mb-px transition-colors cursor-pointer',
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-cyan-400 font-black'
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
              )}
            >
              <span className="flex items-center gap-2">
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full',
                      activeTab === tab.key
                        ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="pt-4">{activeContent}</div>
    </div>
  );
};

export default Tabs;