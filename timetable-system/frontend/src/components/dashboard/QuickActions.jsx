import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import {
  Plus,
  Users,
  BookOpen,
  Calendar,
  Settings,
  ArrowRight,
} from 'lucide-react';

const actions = [
  {
    label: 'Add Department',
    description: 'Create a new department',
    icon: Plus,
    to: '/admin/departments',
    color: 'blue',
  },
  {
    label: 'Add Teacher',
    description: 'Register a new teacher',
    icon: Users,
    to: '/admin/teachers',
    color: 'green',
  },
  {
    label: 'Add Subject',
    description: 'Create theory, lab or elective',
    icon: BookOpen,
    to: '/admin/subjects',
    color: 'purple',
  },
  {
    label: 'Generate Timetable',
    description: 'Run the AI engine',
    icon: Calendar,
    to: '/admin/timetable',
    color: 'orange',
  },
  {
    label: 'College Settings',
    description: 'Configure periods & timings',
    icon: Settings,
    to: '/admin/settings',
    color: 'gray',
  },
];

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
  green: 'bg-green-50 text-green-600 group-hover:bg-green-100',
  purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
  orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
  gray: 'bg-gray-50 text-gray-600 group-hover:bg-gray-100',
};

const QuickActions = () => {
  const navigate = useNavigate();

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.to}
            onClick={() => navigate(action.to)}
            className="group w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-colors', colorMap[action.color])}>
              <action.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{action.label}</p>
              <p className="text-xs text-gray-500">{action.description}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;