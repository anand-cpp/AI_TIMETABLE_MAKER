import { Users, Pencil, Trash2, Mail, Phone, Key } from 'lucide-react';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { getPaletteForIndex } from '../../utils/palette';
import { useTheme } from '../../context/ThemeContext';

const TeacherList = ({ teachers, loading, onEdit, onDelete, onShowCredentials }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const columns = [
    {
      key: 'name',
      title: 'Teacher',
      render: (val, row, index) => {
        const paletteStyle = getPaletteForIndex(index, isDark);
        return (
          <div className="flex items-center gap-3">
            <div
              style={paletteStyle}
              className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 font-sans font-bold text-xs border uppercase"
            >
              {val?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-serif font-normal text-base text-[var(--text-primary)]">{val}</p>
              <p className="text-xs font-sans text-[var(--text-secondary)]">@{row.username}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'departmentId',
      title: 'Department',
      render: (val) =>
        val ? (
          <div>
            <p className="text-xs font-sans font-medium text-[var(--text-primary)]">{val.name}</p>
            <p className="text-xs font-sans text-[var(--text-secondary)]">{val.code}</p>
          </div>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        ),
    },
    {
      key: 'contact',
      title: 'Contact',
      render: (_, row) => (
        <div className="space-y-0.5">
          {row.email && (
            <div className="flex items-center gap-1.5 text-xs font-sans text-[var(--text-secondary)]">
              <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.5} />
              <span>{row.email}</span>
            </div>
          )}
          {row.phone && (
            <div className="flex items-center gap-1.5 text-xs font-sans text-[var(--text-secondary)]">
              <Phone className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.5} />
              <span>{row.phone}</span>
            </div>
          )}
          {!row.email && !row.phone && (
            <span className="text-[var(--text-muted)] text-xs">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'unavailability',
      title: 'Unavailable Slots',
      render: (val) => (
        <Badge variant={val?.length > 0 ? 'warning' : 'default'}>
          {val?.length || 0} slots
        </Badge>
      ),
    },
    {
      key: 'morningLabPreference',
      title: 'Morning Lab',
      render: (val) =>
        val ? (
          <Badge variant="info" dot>Preferred</Badge>
        ) : (
          <span className="text-[var(--text-muted)] text-xs">—</span>
        ),
    },
    {
      key: 'isActive',
      title: 'Status',
      render: (val) =>
        val ? (
          <Badge variant="success" dot>Active</Badge>
        ) : (
          <Badge variant="danger" dot>Inactive</Badge>
        ),
    },
    {
      key: 'actions',
      title: '',
      cellClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip content="View credentials">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onShowCredentials?.(row)}
              leftIcon={<Key className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
          </Tooltip>
          <Tooltip content="Edit teacher">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onEdit(row)}
              leftIcon={<Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />}
            />
          </Tooltip>
          <Tooltip content="Delete teacher">
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
      emptyMessage="No teachers yet. Add teachers to assign them to subjects."
      emptyIcon={Users}
    />
  );
};

export default TeacherList;