import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import api from '../../services/api';
import {
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Server,
  Calendar,
} from 'lucide-react';

const StatusRow = ({ label, status, detail, icon: Icon }) => {
  const isOk = status === 'ok';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        isOk ? 'bg-green-50' : 'bg-red-50'
      )}>
        <Icon className={cn('w-4 h-4', isOk ? 'text-green-600' : 'text-red-500')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {detail && <p className="text-xs text-gray-400 truncate">{detail}</p>}
      </div>
      {isOk ? (
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
      )}
    </div>
  );
};

const SystemStatus = ({ stats }) => {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    api.get('/health')
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('error'));
  }, []);

  const hasAccepted = !!stats?.acceptedTimetable;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">System Status</h3>
      <div>
        <StatusRow
          label="API Server"
          status={apiStatus === 'ok' ? 'ok' : 'error'}
          detail={apiStatus === 'ok' ? 'Connected' : 'Cannot reach server'}
          icon={Server}
        />
        <StatusRow
          label="Database"
          status={apiStatus === 'ok' ? 'ok' : 'error'}
          detail="MongoDB Atlas"
          icon={Database}
        />
        <StatusRow
          label="Timetable"
          status={hasAccepted ? 'ok' : 'error'}
          detail={hasAccepted ? 'Published & Active' : 'Not published yet'}
          icon={Calendar}
        />
      </div>
    </div>
  );
};

export default SystemStatus;