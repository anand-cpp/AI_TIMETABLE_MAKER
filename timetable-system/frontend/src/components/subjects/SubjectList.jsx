import { BookOpen, FlaskConical, Layers, Pencil, Trash2 } from 'lucide-react';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { getPaletteForIndex } from '../../utils/palette';
import { useTheme } from '../../context/ThemeContext';

const typeIconMap = {
  theory: BookOpen,
  lab: FlaskConical,
  elective: Layers,
};

const SubjectList = ({ subjects, loading, onEdit, onDelete }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const columns = [
    {
      key: 'name',
      title: 'Subject',
      render: (val, row, index) => {
        const Icon = typeIconMap[row.type] || BookOpen;
        const paletteStyle = getPaletteForIndex(index, isDark);
        return (
          <div className="flex items-center gap-3">
            <div
              style={paletteStyle}
              className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border"
            >
              <Icon className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-serif font-normal text-base text-[var(--text-primary)]">{val}</p>
              <p className="text-xs font-mono text-[var(--text-secondary)]">{row.code}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'classId',
      title: 'Class',
      render: (val) =>
        val ? (
          <span className="text-xs font-sans font-medium text-[var(--text-primary)]">
            {val.departmentId?.code || '—'} S{val.semester}{val.section}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        ),
    },
    {
      key: 'type',
      title: 'Type',
      render: (val) => {
        return (
          <span className="px-2 py-0.5 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] text-[10px] font-sans font-semibold uppercase tracking-wider">
            {val}
          </span>
        );
      },
    },
    {
      key: 'weeklyHours',
      title: 'Weekly',
      render: (val, row) => {
        if (row.type === 'lab') {
          return (
            <span className="text-xs font-sans text-[var(--text-primary)]">
              {row.labDetails?.duration || 2} periods
            </span>
          );
        }
        return (
          <span className="text-xs font-sans text-[var(--text-primary)]">
            {val || 0} hrs/week
          </span>
        );
      },
    },
    {
      key: 'teachers',
      title: 'Teacher(s)',
      render: (val, row) => {
        const teachers = [];
        if (val?.length) {
          teachers.push(...val.map((t) => t.name || t));
        }
        if (row.type === 'lab' && row.labDetails?.isBatchSplit) {
          const b1 = row.labDetails.batch1Teacher?.name;
          const b2 = row.labDetails.batch2Teacher?.name;
          if (b1) teachers.push(`${b1} (B1)`);
          if (b2) teachers.push(`${b2} (B2)`);
        }
        return teachers.length > 0 ? (
          <div className="text-xs font-sans text-[var(--text-primary)]">
            {teachers.slice(0, 2).join(', ')}
            {teachers.length > 2 && (
              <span className="text-[var(--text-muted)]"> +{teachers.length - 2}</span>
            )}
          </div>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        );
      },
    },
    {
      key: 'actions',
      title: '',
      cellClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Tooltip content="Edit subject">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row)}
              leftIcon={<Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip content="Delete subject">
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
      data={subjects}
      loading={loading}
      emptyMessage="No subjects yet. Add classes first, then create subjects."
      emptyIcon={BookOpen}
    />
  );
};

export default SubjectList;