import { BookOpen, FlaskConical, Layers, Pencil, Trash2 } from 'lucide-react';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { cn } from '../../utils/cn';

const typeConfig = {
  theory: {
    icon: BookOpen,
    color: 'bg-blue-100 text-blue-600',
    badge: 'primary',
    label: 'Theory',
  },
  lab: {
    icon: FlaskConical,
    color: 'bg-purple-100 text-purple-600',
    badge: 'info',
    label: 'Lab',
  },
  elective: {
    icon: Layers,
    color: 'bg-green-100 text-green-600',
    badge: 'success',
    label: 'Elective',
  },
};

const SubjectList = ({ subjects, loading, onEdit, onDelete }) => {
  const columns = [
    {
      key: 'name',
      title: 'Subject',
      render: (val, row) => {
        const config = typeConfig[row.type] || typeConfig.theory;
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', config.color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-white">{val}</p>
              <p className="text-xs text-slate-400 dark:text-slate-400 font-mono">{row.code}</p>
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
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {val.departmentId?.code || '—'} S{val.semester}{val.section}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'type',
      title: 'Type',
      render: (val) => {
        const config = typeConfig[val] || typeConfig.theory;
        return <Badge variant={config.badge}>{config.label}</Badge>;
      },
    },
    {
      key: 'weeklyHours',
      title: 'Weekly',
      render: (val, row) => {
        if (row.type === 'lab') {
          return (
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {row.labDetails?.duration || 2} periods
            </span>
          );
        }
        return (
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
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
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {teachers.slice(0, 2).join(', ')}
            {teachers.length > 2 && (
              <span className="text-slate-400"> +{teachers.length - 2}</span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
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
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
            >
              Edit
            </Button>
          </Tooltip>
          <Tooltip content="Delete subject">
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
      data={subjects}
      loading={loading}
      emptyMessage="No subjects yet. Add classes first, then create subjects."
      emptyIcon={BookOpen}
    />
  );
};

export default SubjectList;