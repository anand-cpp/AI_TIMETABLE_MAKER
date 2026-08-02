import { GraduationCap, Pencil, Trash2, BookOpen } from 'lucide-react';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';

const ClassList = ({ classes, loading, onEdit, onDelete }) => {
  const columns = [
    {
      key: 'name',
      title: 'Class',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">
              {row.departmentId?.code || '—'} — Sem {row.semester}{' '}
              <span className="text-blue-600 dark:text-cyan-400 font-bold">Sec {row.section}</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              {row.departmentId?.name || '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'strength',
      title: 'Strength',
      render: (val) => (
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{val || 60} students</span>
      ),
    },
    {
      key: 'subjects',
      title: 'Subjects',
      render: (val) => (
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{val}</p>
            {row.classRepEmail && (
              <p className="text-xs text-slate-400 dark:text-slate-400">{row.classRepEmail}</p>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
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
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip content="Delete class">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(row)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
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