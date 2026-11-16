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
  AlertTriangle,
  Info,
  BarChart3,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const TeacherPersonalTimetableModal = ({
  isOpen,
  onClose,
  teacherId: initialTeacherId,
  teacherName: initialTeacherName,
  teacherList = [],
}) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState(initialTeacherId);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table' | 'analysis'

  useEffect(() => {
    if (isOpen && !selectedTeacherId) {
      if (initialTeacherId) {
        setSelectedTeacherId(initialTeacherId);
      } else if (teacherList && teacherList.length > 0) {
        setSelectedTeacherId(teacherList[0]._id);
      }
    }
  }, [isOpen, initialTeacherId, teacherList]);

  useEffect(() => {
    if (isOpen && selectedTeacherId) {
      setLoading(true);
      timetableService.getTeacherTimetable(selectedTeacherId)
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
  }, [isOpen, selectedTeacherId]);

  if (!isOpen) return null;

  const teacher = data?.teacher || {};
  const summary = data?.summary || {};
  const facultyAnalysis = data?.facultyAnalysis || {};
  const scheduleGrid = data?.scheduleGrid || data?.timetable || {};
  const dailyAnalysis = facultyAnalysis.dailyAnalysis || {};
  const breakDiagnosticFindings = facultyAnalysis.breakDiagnosticFindings || [];

  const currentTeacherName =
    teacher.name ||
    initialTeacherName ||
    summary.teacherName ||
    teacherList.find((t) => t._id === selectedTeacherId)?.name ||
    'Faculty Member';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between gap-4 w-full pr-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-base">Faculty Personal Timetable & Break Analysis</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-medium">
              {currentTeacherName}
            </span>
          </div>
          {teacherList && teacherList.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] font-sans">Switch Faculty:</span>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="text-xs py-1 px-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--accent)]"
              >
                {teacherList.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.departmentId?.name || t.department || 'CSE'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      }
      size="xl"
    >
      <div className="space-y-5 font-sans text-[var(--text-primary)]">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-xs text-[var(--text-secondary)]">Analyzing authoritative academic schedule...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            No schedule data found for this faculty member.
          </div>
        ) : (
          <>
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">Department</span>
                <p className="font-semibold text-[var(--text-primary)] mt-1 truncate">{summary.department || 'CSE'}</p>
                <span className="text-[10px] text-[var(--text-muted)]">Computer Science</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">Weekly Load</span>
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {summary.totalScheduledHours || facultyAnalysis.totalWeeklyTeachingPeriods || 0} periods
                </p>
                <span className="text-[10px] text-[var(--text-muted)]">Max {summary.weeklyCapacity || 20} hrs/week</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">Free Periods</span>
                <p className="font-bold text-sm text-[var(--accent)] mt-0.5">
                  {summary.totalFreePeriods || facultyAnalysis.totalWeeklyFreePeriods || 0} periods
                </p>
                <span className="text-[10px] text-[var(--text-muted)]">Breaks & Prep Time</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">Longest Run</span>
                <p className="font-bold text-sm text-[var(--text-primary)] mt-0.5">
                  {facultyAnalysis.longestWeeklyConsecutiveSequence || summary.maxConsecutiveTeaching || 0} consecutive
                </p>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {(facultyAnalysis.longestWeeklyConsecutiveSequence || 0) <= 2 ? 'Compliant' : 'Fatigue Alert'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">Idle Gap Time</span>
                <p className="font-bold text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                  {facultyAnalysis.totalWeeklyIdleTime || 0} hrs idle
                </p>
                <span className="text-[10px] text-[var(--text-muted)]">Between classes</span>
              </div>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Authoritative Personal Schedule & Diagnostic Analysis</span>
              </span>
              <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg p-0.5 bg-[var(--bg-surface-alt)] text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                    viewMode === 'grid'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Weekly Grid (with Lunch)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('analysis')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    viewMode === 'analysis'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <BarChart3 className="w-3 h-3 text-[var(--accent)]" />
                  <span>Break Analysis & Metrics</span>
                  {breakDiagnosticFindings.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 font-bold">
                      {breakDiagnosticFindings.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                    viewMode === 'table'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Detailed Slot Manifest
                </button>
              </div>
            </div>

            {/* ── VIEW 1: WEEKLY GRID WITH DEDICATED LUNCH BREAK COLUMN ── */}
            {viewMode === 'grid' && (
              <div className="space-y-3">
                <div className="border border-[var(--border)] rounded-xl overflow-x-auto bg-[var(--bg-surface)] shadow-xs">
                  <table className="w-full text-xs border-collapse min-w-[760px]">
                    <thead>
                      <tr className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-[var(--text-secondary)] text-[11px]">
                        <th className="py-2.5 px-3 text-left font-bold w-24">Day</th>
                        <th className="py-2.5 px-2 text-center font-bold">P1<span className="block text-[9px] font-normal text-[var(--text-muted)]">09:00 - 10:00</span></th>
                        <th className="py-2.5 px-2 text-center font-bold">P2<span className="block text-[9px] font-normal text-[var(--text-muted)]">10:00 - 11:00</span></th>
                        <th className="py-2.5 px-2 text-center font-bold">P3<span className="block text-[9px] font-normal text-[var(--text-muted)]">11:20 - 12:20</span></th>
                        <th className="py-2.5 px-2 text-center font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 w-28 border-x border-[var(--border)]">
                          <span className="flex items-center justify-center gap-1">
                            <Coffee className="w-3 h-3" />
                            <span>LUNCH</span>
                          </span>
                          <span className="block text-[9px] font-normal opacity-80">12:20 - 13:10</span>
                        </th>
                        <th className="py-2.5 px-2 text-center font-bold">P4<span className="block text-[9px] font-normal text-[var(--text-muted)]">13:10 - 14:10</span></th>
                        <th className="py-2.5 px-2 text-center font-bold">P5<span className="block text-[9px] font-normal text-[var(--text-muted)]">14:10 - 15:10</span></th>
                        <th className="py-2.5 px-2 text-center font-bold">P6<span className="block text-[9px] font-normal text-[var(--text-muted)]">15:10 - 16:10</span></th>
                        <th className="py-2.5 px-2 text-center font-bold bg-[var(--bg-surface-alt)] border-l border-[var(--border)] w-20">
                          Daily Load
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {DAYS.map((day) => {
                        const dayData = dailyAnalysis[day] || {};
                        const dailyTaught = dayData.dailyTeachingPeriods || 0;

                        return (
                          <tr key={day} className="hover:bg-[var(--bg-surface-alt)]/25 transition-colors">
                            <td className="py-3 px-3 font-bold text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-alt)]/50 border-r border-[var(--border)]">
                              <div>{day}</div>
                              <div className="text-[10px] font-normal text-[var(--text-muted)] mt-0.5">
                                {dailyTaught === 0 ? 'Off day' : `${dailyTaught} taught`}
                              </div>
                            </td>

                            {/* Pre-Lunch Periods (P1 - P3) */}
                            {[1, 2, 3].map((period) => {
                              const slot = scheduleGrid[day]?.[period];
                              const isFree = !slot || slot.isFree || slot.subjectCode === 'FREE';

                              if (isFree) {
                                return (
                                  <td key={period} className="py-2.5 px-2 text-center border-r border-[var(--border)] bg-[var(--bg-surface-alt)]/10">
                                    <span className="text-[10px] font-mono text-[var(--text-muted)]/60">FREE</span>
                                  </td>
                                );
                              }

                              return (
                                <td key={period} className="p-2 border-r border-[var(--border)] bg-blue-500/10">
                                  <div className="font-bold text-[11px] text-[var(--text-primary)] truncate">
                                    {slot.subjectCode}
                                  </div>
                                  <div className="text-[10px] text-[var(--accent)] font-semibold truncate mt-0.5">
                                    {slot.className}
                                  </div>
                                  <div className="text-[9px] text-[var(--text-muted)] truncate flex items-center gap-1 mt-0.5">
                                    {slot.roomName && slot.roomName !== '—' && (
                                      <span>📍 {slot.roomName}</span>
                                    )}
                                    {slot.isLabBlock && (
                                      <span className="px-1 rounded bg-emerald-500/20 text-emerald-600 font-bold">LAB</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Dedicated Lunch Break Cell */}
                            <td className="py-2.5 px-2 text-center border-r border-[var(--border)] bg-amber-500/5 text-amber-800 dark:text-amber-300">
                              <span className="text-[10px] font-medium flex items-center justify-center gap-1">
                                <Coffee className="w-2.5 h-2.5 text-amber-500" />
                                <span>Interval</span>
                              </span>
                              {dayData.teachesAcrossLunch && (
                                <span className="inline-block mt-0.5 text-[8px] font-bold px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                  P3+P4 Flanked
                                </span>
                              )}
                            </td>

                            {/* Post-Lunch Periods (P4 - P6) */}
                            {[4, 5, 6].map((period) => {
                              const slot = scheduleGrid[day]?.[period];
                              const isFree = !slot || slot.isFree || slot.subjectCode === 'FREE';

                              if (isFree) {
                                return (
                                  <td key={period} className="py-2.5 px-2 text-center border-r border-[var(--border)] bg-[var(--bg-surface-alt)]/10">
                                    <span className="text-[10px] font-mono text-[var(--text-muted)]/60">FREE</span>
                                  </td>
                                );
                              }

                              return (
                                <td key={period} className="p-2 border-r border-[var(--border)] bg-blue-500/10">
                                  <div className="font-bold text-[11px] text-[var(--text-primary)] truncate">
                                    {slot.subjectCode}
                                  </div>
                                  <div className="text-[10px] text-[var(--accent)] font-semibold truncate mt-0.5">
                                    {slot.className}
                                  </div>
                                  <div className="text-[9px] text-[var(--text-muted)] truncate flex items-center gap-1 mt-0.5">
                                    {slot.roomName && slot.roomName !== '—' && (
                                      <span>📍 {slot.roomName}</span>
                                    )}
                                    {slot.isLabBlock && (
                                      <span className="px-1 rounded bg-emerald-500/20 text-emerald-600 font-bold">LAB</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Daily Workload Column */}
                            <td className="py-2.5 px-2 text-center border-l border-[var(--border)] bg-[var(--bg-surface-alt)]/40 font-mono font-bold text-xs">
                              <span className={dailyTaught >= 4 ? 'text-amber-600' : dailyTaught === 0 ? 'text-emerald-600' : 'text-[var(--text-primary)]'}>
                                {dailyTaught}/6
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-blue-500/20 border border-blue-500/40 inline-block"></span>
                      <span>Assigned Academic Session</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/40 inline-block"></span>
                      <span>Institutional Lunch Interval</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)] inline-block"></span>
                      <span>Guaranteed Rest Gap / Free Period</span>
                    </span>
                  </div>
                  <span className="font-mono">Authoritative persisted allocation</span>
                </div>
              </div>
            )}

            {/* ── VIEW 2: FACULTY BREAK ANALYSIS & WORKLOAD PROFILE ── */}
            {viewMode === 'analysis' && (
              <div className="space-y-4">
                {/* Daily Granular Breakdown Table */}
                <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                  <div className="px-4 py-2.5 bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>Intraday Schedule & Rest-Gap Breakdown</span>
                    <span className="text-[11px] font-normal text-[var(--text-muted)]">Monday through Friday</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-surface-alt)]/50 text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        <th className="py-2 px-3 text-left">Day</th>
                        <th className="py-2 px-2 text-center">Periods Taught</th>
                        <th className="py-2 px-2 text-center">Span (First → Last)</th>
                        <th className="py-2 px-2 text-center">Consecutive Runs</th>
                        <th className="py-2 px-2 text-center">Idle Gap Hours</th>
                        <th className="py-2 px-2 text-center">Pre / Post Lunch</th>
                        <th className="py-2 px-2 text-center">Lunch Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {DAYS.map((day) => {
                        const dayMetrics = dailyAnalysis[day] || {};
                        const runs = dayMetrics.consecutiveRuns || [];
                        const gaps = dayMetrics.gapLengths || [];

                        return (
                          <tr key={day} className="hover:bg-[var(--bg-surface-alt)]/20">
                            <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">{day}</td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold">
                              {dayMetrics.dailyTeachingPeriods || 0} periods
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-[11px] text-[var(--text-secondary)]">
                              {dayMetrics.firstTeachingPeriod ? `P${dayMetrics.firstTeachingPeriod} → P${dayMetrics.lastTeachingPeriod}` : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {runs.length === 0 ? (
                                <span className="text-[var(--text-muted)]">—</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {runs.map((r, i) => (
                                    <span
                                      key={i}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                        r.length >= 3
                                          ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                          : r.length === 2
                                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                          : 'bg-emerald-500/15 text-emerald-600'
                                      }`}
                                    >
                                      {r.length}h (P{r.startPeriod}{r.length > 1 ? `-P${r.endPeriod}` : ''})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-[11px]">
                              {dayMetrics.totalIdleTime > 0 ? (
                                <span className="text-amber-600 font-semibold">{dayMetrics.totalIdleTime}h ({gaps.join('h, ')}h)</span>
                              ) : (
                                <span className="text-[var(--text-muted)]">0h</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-[11px]">
                              {dayMetrics.preLunchCount} pre / {dayMetrics.postLunchCount} post
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {dayMetrics.teachesAcrossLunch ? (
                                <span className="text-[10px] font-bold text-amber-600 px-1.5 py-0.5 rounded bg-amber-500/10">
                                  Flanked (P3+P4)
                                </span>
                              ) : dayMetrics.teachesBeforeLunch || dayMetrics.teachesAfterLunch ? (
                                <span className="text-[10px] text-emerald-600 font-medium">Clear Break</span>
                              ) : (
                                <span className="text-[var(--text-muted)]">Off</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Diagnostic Findings Callout */}
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Phase 1 Diagnostic Findings & Schedule Characteristics</span>
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {breakDiagnosticFindings.length} observation(s) recorded
                    </span>
                  </div>

                  {breakDiagnosticFindings.length === 0 ? (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>This faculty member has a balanced schedule with regular resting gaps throughout the week.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {breakDiagnosticFindings.map((finding, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                            finding.type === 'THREE_OR_MORE_CONSECUTIVE_PERIODS'
                              ? 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200'
                              : finding.type === 'UNBALANCED_DAILY_WORKLOAD'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                              : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <div className="flex-1">
                            <span className="font-bold text-[var(--text-primary)] mr-2">[{finding.day || 'Weekly'}]</span>
                            <span>{finding.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── VIEW 3: DETAILED TABLE / MANIFEST ── */}
            {viewMode === 'table' && (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-[var(--text-secondary)] text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 text-left font-bold">Day</th>
                      <th className="py-2.5 px-3 text-left font-bold">Period</th>
                      <th className="py-2.5 px-3 text-left font-bold">Class / Section</th>
                      <th className="py-2.5 px-3 text-left font-bold">Subject</th>
                      <th className="py-2.5 px-3 text-left font-bold">Room</th>
                      <th className="py-2.5 px-3 text-left font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {DAYS.flatMap((day) =>
                      PERIODS.map((period) => {
                        const slot = scheduleGrid[day]?.[period];
                        const isFree = !slot || slot.isFree || slot.subjectCode === 'FREE';

                        return (
                          <tr key={`${day}_${period}`} className={isFree ? 'bg-[var(--bg-surface-alt)]/10 text-[var(--text-muted)]' : 'hover:bg-[var(--bg-surface-alt)]/30'}>
                            <td className="py-2 px-3 font-semibold">{day}</td>
                            <td className="py-2 px-3 font-mono font-bold">P{period}</td>
                            <td className="py-2 px-3">
                              {isFree ? (
                                <span className="font-mono text-[10px] text-[var(--text-muted)]">FREE</span>
                              ) : (
                                <span className="font-semibold text-[var(--accent)]">{slot.className}</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {isFree ? (
                                <span className="text-[var(--text-muted)]">—</span>
                              ) : (
                                <div>
                                  <span className="font-semibold text-[var(--text-primary)]">{slot.subjectName}</span>
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
                            <td className="py-2 px-3">
                              {isFree ? (
                                <span className="text-[10px] text-emerald-600 font-medium">Rest / Free</span>
                              ) : (
                                <span className="text-[10px] text-blue-600 font-medium">Teaching Class</span>
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
