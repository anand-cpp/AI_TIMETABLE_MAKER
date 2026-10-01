import { useMemo } from 'react';
import { cn } from '../../utils/cn';

const CustomClassSelector = ({
  options = [], // [{ value: 'id', label: 'CSE S1 A', group: 'CSE' }]
  value = '',
  onChange,
  placeholder = 'Select class...',
  className = '',
}) => {
  // Group options by department / group prefix
  const groupedOptions = useMemo(() => {
    const groups = {};
    for (const opt of options) {
      let groupName = opt.group;
      if (!groupName) {
        const parts = String(opt.label || '').split(' ');
        groupName = parts[0] || 'General';
      }
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(opt);
    }
    return groups;
  }, [options]);

  return (
    <div className={cn('relative inline-block text-left min-w-[220px]', className)}>
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        className="custom-native-class-select w-full bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-sm px-3 py-2 pr-9 text-xs font-sans font-semibold appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent)] transition-colors duration-150 shadow-sm"
      >
        {placeholder && (
          <option value="" disabled className="bg-[var(--bg-surface)] text-[var(--text-muted)] italic">
            {placeholder}
          </option>
        )}

        {Object.entries(groupedOptions).map(([dept, items]) => (
          <optgroup
            key={dept}
            label={`${dept.toUpperCase()} DEPARTMENT`}
            className="bg-[var(--bg-surface-alt)] text-[var(--text-label)] font-bold text-[11px]"
          >
            {items.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium py-1"
              >
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Custom Chevron Arrow */}
      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[var(--text-secondary)]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

export default CustomClassSelector;
