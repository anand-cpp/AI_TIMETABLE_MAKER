import { Users, Pencil, Trash2, Mail, Phone, Key, FileText, Calendar, BookOpen, Clock } from 'lucide-react';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { getPaletteForIndex } from '../../utils/palette';
import { useTheme } from '../../context/ThemeContext';

const TeacherList = ({
  teachers,
  loading,
  onEdit,
  onDelete,
  onShowCredentials,
  onViewProfile,
  onViewPersonalTimetable,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const columns = [
    {
      key: 'name',
      title: 'Faculty Name',
      render: (val, row, index) => {
        const paletteStyle = getPaletteForIndex(index, isDark);
        return (
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onViewPersonalTimetable?.(row)}
          >
            <div
              style={paletteStyle}
              className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 font-sans font-bold text-xs border uppercase group-hover:ring-1 group-hover:ring-[var(--accent)] transition-all"
            >
              {val?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-serif font-normal text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                {val}
              </p>
              <p className="text-[11px] font-sans text-[var(--text-secondary)]">@{row.username}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'department',
      title: 'Department',
      render: (_, row) => {
        const deptName = row.departmentId?.name || row.department || 'CSE';
        const deptCode = row.departmentId?.code || row.departmentCode || 'CSE';
        return (
          <div>
            <p className="text-xs font-sans font-medium text-[var(--text-primary)] truncate max-w-[150px]">{deptName}</p>
            <p className="text-[10px] font-mono text-[var(--text-secondary)]">{deptCode}</p>
          </div>
        );
      },
    },
    {
      key: 'assignedSubjects',
      title: 'Assigned Subjects',
      render: (_, row) => {
        const subjects = row.assignedSubjects || [];
        if (subjects.length === 0) {
          return <span className="text-[var(--text-muted)] text-xs">No subjects</span>;
        }
        return (
          <div className="space-y-0.5 max-w-[220px]">
            {subjects.slice(0, 2).map((s, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs truncate">
                <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                  {s.code || s.subjectCode}
                </Badge>
                <span className="text-[var(--text-primary)] truncate text-[11px]">
                  {s.name || s.subjectName} ({s.weeklyHours}h)
                </span>
              </div>
            ))}
            {subjects.length > 2 && (
              <span className="text-[10px] text-[var(--text-muted)] italic">
                +{subjects.length - 2} more...
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'workload',
      title: 'Workload Status',
      render: (_, row) => {
        const scheduled = row.totalScheduledHours ?? row.scheduledHours ?? 0;
        const assigned = row.totalAssignedHours ?? row.assignedHours ?? 0;
        const status = row.status || (scheduled === assigned ? 'Balanced' : scheduled < assigned ? 'Underload' : 'Overload');

        return (
          <div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="font-bold text-[var(--text-primary)]">{scheduled}h</span>
              <span className="text-[var(--text-muted)]">/ {assigned}h</span>
            </div>
            <div className="mt-0.5">
              <Badge
                variant={status === 'Balanced' ? 'success' : status === 'Underload' ? 'warning' : 'danger'}
                className="text-[10px] py-0 px-1.5"
              >
                {status}
              </Badge>
            </div>
          </div>
        );
      },
    },
    {
      key: 'contact',
      title: 'Contact',
      render: (_, row) => (
        <div className="space-y-0.5 text-xs">
          {row.email && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate max-w-[150px]">
              <Mail className="w-3 h-3 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
              <span className="truncate">{row.email}</span>
            </div>
          )}
          {row.phone && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <Phone className="w-3 h-3 text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
              <span>{row.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      title: '',
      cellClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip content="Personal Timetable">
            <Button
              variant="outline"
              size="xs"
              onClick={() => onViewPersonalTimetable?.(row)}
              className="text-[var(--accent)] border-[var(--border)] hover:bg-[var(--accent-soft)]/20"
              leftIcon={<Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              Timetable
            </Button>
          </Tooltip>
          <Tooltip content="View Profile & Allocations">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onViewProfile?.(row)}
              leftIcon={<FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
          </Tooltip>
          <Tooltip content="Credentials">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onShowCredentials?.(row)}
              leftIcon={<Key className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
          </Tooltip>
          <Tooltip content="Edit Faculty">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onEdit(row)}
              leftIcon={<Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
          </Tooltip>
          <Tooltip content="Delete Faculty">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onDelete(row)}
              className="text-[var(--error)] hover:bg-[var(--bg-hover)]"
              leftIcon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={teachers}
      loading={loading}
      emptyMessage="No faculty members found. Add teachers to assign them to subjects."
      emptyIcon={Users}
    />
  );
};

export default TeacherList;
