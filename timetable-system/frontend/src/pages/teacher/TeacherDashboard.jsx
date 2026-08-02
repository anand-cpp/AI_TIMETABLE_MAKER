import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import teacherService from '../../services/teacherService';
import timetableService from '../../services/timetableService';
import suggestionService from '../../services/suggestionService';
import { formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  Calendar,
  MessageSquare,
  Clock,
  BookOpen,
  ChevronRight,
  User,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [slots, setSlots] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noTimetable, setNoTimetable] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [profileRes, suggestionsRes] = await Promise.all([
          teacherService.getMyProfile(),
          suggestionService.getMine(),
        ]);
        setProfile(profileRes.data.teacher);
        setSuggestions(suggestionsRes.data.suggestions || []);

        try {
          const timetableRes = await timetableService.getTeacherTimetable(user._id);
          setSlots(timetableRes.data.slots || []);
        } catch {
          setNoTimetable(true);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user._id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Get today's slots
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todaySlots = slots
    .filter((s) => s.day === today)
    .sort((a, b) => a.period - b.period);

  // Weekly period count
  const weeklyCount = slots.length;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.name || user?.name || 'Teacher'}!`}
        description={`${formatDate(new Date())} · ${profile?.departmentId?.name || 'No department'}`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{weeklyCount}</p>
            <p className="text-sm text-gray-500">Periods/Week</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{todaySlots.length}</p>
            <p className="text-sm text-gray-500">Classes Today</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{suggestions.length}</p>
            <p className="text-sm text-gray-500">My Suggestions</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's schedule */}
        <div className="lg:col-span-2">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between">
                <div>
                  <Card.Title>Today's Schedule</Card.Title>
                  <Card.Description>{today}</Card.Description>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/teacher/timetable')}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Full Timetable
                </Button>
              </div>
            </Card.Header>
            <Card.Content>
              {noTimetable ? (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    No timetable has been published yet
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    Check back after the admin publishes the timetable
                  </p>
                </div>
              ) : todaySlots.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    No classes today!
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Enjoy your free day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-xl border',
                        slot.subjectType === 'lab'
                          ? 'bg-blue-50 border-blue-200'
                          : slot.subjectType === 'elective'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200'
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        slot.subjectType === 'lab' ? 'bg-blue-100' :
                        slot.subjectType === 'elective' ? 'bg-green-100' :
                        'bg-gray-100'
                      )}>
                        <BookOpen className={cn(
                          'w-5 h-5',
                          slot.subjectType === 'lab' ? 'text-blue-600' :
                          slot.subjectType === 'elective' ? 'text-green-600' :
                          'text-gray-500'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900">
                            {slot.subjectName}
                          </p>
                          <Badge
                            variant={
                              slot.subjectType === 'lab' ? 'info' :
                              slot.subjectType === 'elective' ? 'success' :
                              'default'
                            }
                            size="sm"
                          >
                            {slot.subjectType}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Period {slot.period} · {slot.className}
                        </p>
                        {slot.roomName && (
                          <p className="text-xs text-gray-400">
                            📍 {slot.roomName}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gray-700">
                          P{slot.period}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Content>
          </Card>
        </div>

        {/* Right: Profile + Quick actions */}
        <div className="space-y-4">
          {/* Profile card */}
          <Card>
            <Card.Content>
              <div className="flex flex-col items-center text-center py-2">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                  <User className="w-8 h-8 text-purple-600" />
                </div>
                <p className="font-semibold text-gray-900 text-lg">
                  {profile?.name}
                </p>
                <p className="text-sm text-gray-500">@{profile?.username}</p>
                {profile?.departmentId?.name && (
                  <p className="text-xs text-gray-400 mt-1">
                    {profile.departmentId.name}
                  </p>
                )}
                {profile?.email && (
                  <p className="text-xs text-gray-400">{profile.email}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Badge variant="success" dot>Active</Badge>
                  {profile?.morningLabPreference && (
                    <Badge variant="info" size="sm">Morning Labs</Badge>
                  )}
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Quick actions */}
          <Card>
            <Card.Header>
              <Card.Title>Quick Actions</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-2">
                <Button
                  fullWidth
                  variant="outline"
                  onClick={() => navigate('/teacher/timetable')}
                  leftIcon={<Calendar className="w-4 h-4" />}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  View Full Timetable
                </Button>
                <Button
                  fullWidth
                  variant="outline"
                  onClick={() => navigate('/teacher/suggestions')}
                  leftIcon={<MessageSquare className="w-4 h-4" />}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Submit Suggestion
                </Button>
              </div>
            </Card.Content>
          </Card>

          {/* Unavailability summary */}
          {profile?.unavailability?.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Your Unavailability</Card.Title>
                <Card.Description>
                  {profile.unavailability.length} slot(s) marked
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-1">
                  {DAYS.map((day) => {
                    const daySlots = (profile.unavailability || [])
                      .filter((u) => u.day === day)
                      .map((u) => u.period)
                      .sort((a, b) => a - b);
                    if (daySlots.length === 0) return null;
                    return (
                      <div key={day} className="flex items-center gap-2 text-xs">
                        <span className="w-8 font-medium text-gray-600">
                          {day.slice(0, 3)}
                        </span>
                        <div className="flex gap-1 flex-wrap">
                          {daySlots.map((p) => (
                            <span
                              key={p}
                              className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium"
                            >
                              P{p}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card.Content>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;