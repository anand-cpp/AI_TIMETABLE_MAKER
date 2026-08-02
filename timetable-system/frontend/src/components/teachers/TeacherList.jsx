import { Users, Pencil, Trash2, Mail, Phone, Key } from 'lucide-react';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Tooltip from '../ui/Tooltip';
import { cn } from '../../utils/cn';

const TeacherList = ({ teachers, loading, onEdit, onDelete, onShowCredentials }) => {
  const columns = [
    {
      key: 'name',
      title: 'Teacher',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
            'bg-purple-100 text-purple-700'
          )}>
            {val?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{val}</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">@{row.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'departmentId',
      title: 'Department',
      render: (val) =>
        val ? (
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{val.name}</p>
            <p className="text-xs text-slate-400 dark:text-slate-400">{val.code}</p>
          </div>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
    {
      key: 'contact',
      title: 'Contact',
      render: (_, row) => (
        <div className="space-y-0.5">
          {row.email && (
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Mail className="w-3 h-3 text-blue-500" />
              <span>{row.email}</span>
            </div>
          )}
          {row.phone && (
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Phone className="w-3 h-3 text-emerald-500" />
              <span>{row.phone}</span>
            </div>
          )}
          {!row.email && !row.phone && (
            <span className="text-slate-400 text-sm">—</span>
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
          <span className="text-gray-300 text-sm">—</span>
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
              leftIcon={<Key className="w-3.5 h-3.5" />}
            />
          </Tooltip>
          <Tooltip content="Edit teacher">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onEdit(row)}
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
            />
          </Tooltip>
          <Tooltip content="Delete teacher">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onDelete(row)}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
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