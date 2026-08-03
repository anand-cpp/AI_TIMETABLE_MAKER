import { GraduationCap, Pencil, Trash2, BookOpen } from 'lucide-react';
import Table from '../ui/Table';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { getPaletteForIndex } from '../../utils/palette';
import { useTheme } from '../../context/ThemeContext';

const ClassList = ({ classes, loading, onEdit, onDelete }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const columns = [
    {
      key: 'name',
      title: 'Class',
      render: (_, row, index) => {
        const paletteStyle = getPaletteForIndex(index, isDark);
        return (
          <div className="flex items-center gap-3">
            <div
              style={paletteStyle}
              className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border"
            >
              <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-serif font-normal text-base text-[var(--text-primary)]">
                {row.departmentId?.code || '—'} — Sem {row.semester}{' '}
                <span className="text-[var(--accent)] font-sans font-medium">Sec {row.section}</span>
              </p>
              <p className="text-xs font-sans text-[var(--text-secondary)]">
                {row.departmentId?.name || '—'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'strength',
      title: 'Strength',
      render: (val) => (
        <span className="text-xs font-sans text-[var(--text-primary)]">{val || 60} students</span>
      ),
    },
    {
      key: 'subjects',
      title: 'Subjects',
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.5} />
          <span className="text-xs font-sans">
            {val?.length || 0} subjects
          </span>
        </div>
      ),
    },
    {
      key: 'classRepName',
      title: 'Class Rep',
      render: (val, row) =>
        val ? (
          <div>
            <p className="text-xs font-sans font-medium text-[var(--text-primary)]">{val}</p>
            {row.classRepEmail && (
              <p className="text-xs font-sans text-[var(--text-muted)]">{row.classRepEmail}</p>
            )}
          </div>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        ),
    },
    {
      key: 'actions',
      title: '',
      cellClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Tooltip content="Edit class">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row)}
              leftIcon={<Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip content="Delete class">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(row)}
              className="text-[var(--error)] hover:bg-[var(--bg-hover)]"
              leftIcon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              Delete
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={classes}
      loading={loading}
      emptyMessage="No classes yet. Add departments first, then create classes."
      emptyIcon={GraduationCap}
    />
  );
};

export default ClassList;