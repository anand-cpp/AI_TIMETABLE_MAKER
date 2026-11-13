import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import timetableService from '../../services/timetableService';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  MapPin,
  CheckCircle2,
  Coffee,
  Download
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const TeacherPersonalTimetableModal = ({ isOpen, onClose, teacherId, teacherName }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  useEffect(() => {
    if (isOpen && teacherId) {
      setLoading(true);
      timetableService.getTeacherTimetable(teacherId)
        .then((res) => {
          setData(res.data);
        })
        .catch((err) => {
          console.error('Failed to load teacher timetable:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setData(null);
    }
  }, [isOpen, teacherId]);

  if (!isOpen) return null;

  const summary = data?.summary || {};
  const scheduleGrid = data?.scheduleGrid || data?.timetable || {};
  const slots = data?.slots || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Individual Personal Timetable — ${teacherName || summary.teacherName || 'Faculty'}`}
      size="lg"
    >
      <div className="space-y-5 font-sans text-[var(--text-primary)]">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-xs text-[var(--text-secondary)]">Loading personal academic schedule...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            No schedule data found for this faculty member.
          </div>
        ) : (
          <>
            {/* Top Summary Banner */}
            <div className="p-4 rounded-md bg-[var(--bg-surface-alt)] border border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">Department</span>
                <p className="font-semibold text-[var(--text-primary)] mt-0.5 truncate">{summary.department || 'CSE'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">Teaching Workload</span>
                <p className="font-semibold text-emerald-500 mt-0.5">
                  {summary.totalScheduledHours} hrs scheduled <span className="text-[var(--text-muted)] font-normal">/ {summary.totalAssignedHours} assigned</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">Free Periods</span>
                <p className="font-semibold text-[var(--accent)] mt-0.5">
                  {summary.totalFreePeriods} periods <span className="text-[var(--text-muted)] font-normal">(Breaks/Prep)</span>
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)] block">Classes Taught</span>
                <p className="font-semibold text-[var(--text-primary)] mt-0.5 truncate">
                  {summary.classesTaught?.join(', ') || 'None'}
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Weekly Academic Schedule (Monday – Friday)
              </span>
              <div className="flex items-center gap-1 border border-[var(--border)] rounded-xs p-0.5 bg-[var(--bg-surface-alt)] text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 rounded-xs font-medium transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Weekly Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 rounded-xs font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Detailed List
                </button>
              </div>
            </div>

            {/* View Mode: Weekly Grid */}
            {viewMode === 'grid' && (
              <div className="border border-[var(--border)] rounded-md overflow-x-auto bg-[var(--bg-surface)]">
                <table className="w-full text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-[var(--text-secondary)] text-[11px]">
                      <th className="py-2 px-3 text-left font-semibold w-24">Day</th>
                      {PERIODS.map((p) => (
                        <th key={p} className="py-2 px-2 text-center font-semibold">
                          Period {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {DAYS.map((day) => (
                      <tr key={day} className="hover:bg-[var(--bg-surface-alt)]/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface-alt)]/50 border-r border-[var(--border)]">
                          {day}
                        </td>
                        {PERIODS.map((period) => {
                          const slot = scheduleGrid[day]?.[period];
                          const isFree = !slot || slot.isFree || slot.subjectCode === 'FREE';

                          if (isFree) {
                            return (
                              <td key={period} className="py-2 px-2 text-center border-r border-[var(--border)] bg-[var(--bg-surface-alt)]/10">
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-[var(--text-muted)]/60">
                                  FREE
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={period} className="p-2 text-left border-r border-[var(--border)] bg-[var(--accent-soft)]/15">
                              <p className="font-semibold text-[var(--text-primary)] truncate text-[11px]">
                                {slot.subjectCode}
                              </p>
                              <p className="text-[10px] text-[var(--accent)] font-medium truncate">
                                {slot.className}
                              </p>
                              {slot.roomName && slot.roomName !== '—' && (
                                <p className="text-[9px] text-[var(--text-muted)] truncate flex items-center gap-0.5 mt-0.5">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  {slot.roomName}
                                </p>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* View Mode: Detailed Table as specified in Part 10 */}
            {viewMode === 'table' && (
              <div className="border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg-surface)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-[var(--text-secondary)] text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-semibold">Day</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Period</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Class / Section</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Subject</th>
                      <th className="py-2.5 px-3 text-left font-semibold">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {DAYS.flatMap((day) =>
                      PERIODS.map((period) => {
                        const slot = scheduleGrid[day]?.[period];
                        const isFree = !slot || slot.isFree || slot.subjectCode === 'FREE';

                        return (
                          <tr key={`${day}_${period}`} className={isFree ? 'bg-[var(--bg-surface-alt)]/10 text-[var(--text-muted)]' : 'hover:bg-[var(--bg-surface-alt)]/30'}>
                            <td className="py-2 px-3 font-medium">{day}</td>
                            <td className="py-2 px-3 font-mono font-semibold">P{period}</td>
                            <td className="py-2 px-3">
                              {isFree ? (
                                <span className="font-mono text-xs text-[var(--text-muted)]">FREE</span>
                              ) : (
                                <span className="font-semibold text-[var(--accent)]">{slot.className}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {isFree ? (
                                <span className="text-[var(--text-muted)]">—</span>
                              ) : (
                                <div>
                                  <span className="font-medium text-[var(--text-primary)]">{slot.subjectName}</span>
                                  <span className="font-mono text-[10px] text-[var(--text-secondary)] ml-1.5">({slot.subjectCode})</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {isFree || !slot.roomName || slot.roomName === '—' ? (
                                <span className="text-[var(--text-muted)]">—</span>
                              ) : (
                                <Badge variant="outline">{slot.roomName}</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default TeacherPersonalTimetableModal;
