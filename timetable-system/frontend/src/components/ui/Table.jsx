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
      <div className="flex items-center justify-center py-16 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState message={emptyMessage} icon={emptyIcon} />;
  }

  return (
    <div className={cn('overflow-x-auto rounded-md bg-[var(--bg-surface)] border border-[var(--border)]', className)}>
      <table className="min-w-full divide-y divide-[var(--border)]">
        <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)]">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={cn(
                  'px-4 py-3 text-left text-[11px] font-sans font-semibold text-[var(--text-muted)] uppercase tracking-widest',
                  col.headerClassName
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)] font-sans text-sm">
          {data.map((row, rowIdx) => (
            <tr
              key={row[rowKey] || rowIdx}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'transition-colors duration-150',
                striped && rowIdx % 2 === 1 && 'bg-[var(--bg-surface-alt)]',
                hoverable && 'hover:bg-[var(--bg-hover)]',
                onRowClick && 'cursor-pointer'
              )}
            >
              {columns.map((col, colIdx) => (
                <td
                  key={col.key || colIdx}
                  className={cn('px-4 py-3 text-sm font-sans font-normal text-[var(--text-primary)]', col.cellClassName)}
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