import { cn } from '../../utils/cn';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

const Table = ({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  onRowClick,
  rowKey = '_id',
  className,
  striped = false,
  hoverable = true,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 glass-panel rounded-3xl">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} icon={emptyIcon} />;
  }

  return (
    <div className={cn('overflow-x-auto rounded-3xl glass-panel shadow-xl', className)}>
      <table className="min-w-full divide-y divide-[#CBD5E1] dark:divide-white/10">
        <thead className="bg-[#F1F5F9] dark:bg-white/5 border-b border-[#CBD5E1] dark:border-white/10">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={cn(
                  'px-6 py-4 text-left text-xs font-black text-[#6C63FF] dark:text-[#00D4FF] uppercase tracking-widest font-display',
                  col.headerClassName
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] dark:divide-white/5 text-[#0F172A] dark:text-white">
          {data.map((row, rowIdx) => (
            <tr
              key={row[rowKey] || rowIdx}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'transition-colors duration-150',
                striped && rowIdx % 2 === 1 && 'bg-slate-50 dark:bg-white/[0.02]',
                hoverable && 'hover:bg-slate-100/80 dark:hover:bg-white/5',
                onRowClick && 'cursor-pointer'
              )}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={col.key || colIdx}
                  className={cn('px-6 py-4 text-sm font-bold text-[#0F172A] dark:text-white', col.cellClassName)}
                >
                  {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;