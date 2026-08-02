import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import TeacherTimetableGrid from '../../components/timetable/TeacherTimetableGrid';
import timetableService from '../../services/timetableService';
import settingsService from '../../services/settingsService';
import { formatDate } from '../../utils/formatters';
import { Download, FileSpreadsheet, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const MyTimetable = () => {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [timetableInfo, setTimetableInfo] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noTimetable, setNoTimetable] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [timetableRes, settingsRes] = await Promise.allSettled([
          timetableService.getTeacherTimetable(user._id),
          settingsService.get(),
        ]);

        if (timetableRes.status === 'fulfilled') {
          setSlots(timetableRes.value.data.slots || []);
          setTimetableInfo({
            version: timetableRes.value.data.version,
            generatedAt: timetableRes.value.data.generatedAt,
          });
        } else {
          setNoTimetable(true);
        }

        if (settingsRes.status === 'fulfilled') {
          const timeline = settingsRes.value.data.settings?.periodTimeline || [];
          const teachingPeriods = timeline
            .filter((p) => !p.isBreak)
            .map((p) => p.periodNumber);
          if (teachingPeriods.length > 0) setPeriods(teachingPeriods);
        }
      } catch {
        setNoTimetable(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user._id]);

  const handleDownloadPdf = () => {
    timetableService.downloadTeacherPdf(user._id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (noTimetable) {
    return (
      <div>
        <PageHeader
          title="My Timetable"
          description="Your personal teaching schedule"
        />
        <div className="card p-12 text-center">
          <Calendar className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Timetable Published Yet
          </h3>
          <p className="text-gray-400 text-sm max-w-sm mx-auto">
            The admin has not published a timetable yet.
            Please check back later or contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Timetable"
        description={
          timetableInfo
            ? `Version ${timetableInfo.version} · Published ${formatDate(timetableInfo.generatedAt)}`
            : 'Your personal teaching schedule'
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download PDF
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
          const count = slots.filter((s) => s.day === day).length;
          return (
            <div key={day} className="card p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500">{day.slice(0, 3)}</p>
            </div>
          );
        })}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Weekly Schedule
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {slots.length} total period{slots.length !== 1 ? 's' : ''} per week
            </p>
          </div>
          <div className="flex gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-white border border-gray-300 inline-block" />
              Theory
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-100 inline-block" />
              Lab
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-100 inline-block" />
              Elective
            </span>
          </div>
        </div>
        <TeacherTimetableGrid slots={slots} periods={periods} />
      </div>
    </div>
  );
};

export default MyTimetable;