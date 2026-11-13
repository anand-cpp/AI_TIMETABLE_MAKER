import { useState, useMemo, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  User,
  BookOpen,
  FlaskConical,
  Search,
  Filter,
  CheckCircle2,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';

const SEVERITY_BADGES = {
  CRITICAL: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  ERROR: 'bg-red-500/10 text-red-600 border-red-500/30',
  WARNING: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  INFO: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  OPTIMIZATION: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
};

const ConflictDiagnosticsModal = ({
  isOpen,
  onClose,
  diagnostics,
  initialTab = 'HARD_CONFLICTS',
  onNavigateToCell,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState('ALL');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const summary = diagnostics?.summary || {};
  const hardConflicts = diagnostics?.hardConflicts || [];
  const softWarnings = diagnostics?.softWarnings || [];
  const optimizations = diagnostics?.optimizations || [];
  const version = diagnostics?.version;

  const hardCount = hardConflicts.length;
  const softCount = softWarnings.length;
  const optCount = optimizations.length;

  const currentItems = useMemo(() => {
    let items = [];
    if (activeTab === 'HARD_CONFLICTS') items = hardConflicts;
    else if (activeTab === 'SOFT_WARNINGS') items = softWarnings;
    else if (activeTab === 'OPTIMIZATION') items = optimizations;

    return items.filter((item) => {
      if (selectedDayFilter !== 'ALL' && item.day !== selectedDayFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchText = [
        item.title,
        item.className,
        item.subjectCode,
        item.subjectName,
        item.teacherName,
        item.roomName,
        item.explanation,
        item.resolution,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchText.includes(q);
    });
  }, [activeTab, hardConflicts, softWarnings, optimizations, selectedDayFilter, searchQuery]);

  if (!isOpen || !diagnostics) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Timetable Conflict Diagnostics & Optimization Intelligence"
      size="xl"
    >
      <div className="space-y-5 font-sans text-[var(--text-primary)]">
        {/* Top Summary Banner */}
        <div className="flex items-center justify-between p-4 rounded-md bg-[var(--bg-surface-alt)] border border-[var(--border)] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-md border flex items-center justify-center ${
                hardCount === 0
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
              }`}
            >
              {hardCount === 0 ? (
                <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
              ) : (
                <ShieldAlert className="w-5 h-5" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span>Timetable Diagnostics · Version {version || 1}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    hardCount === 0
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-rose-500/10 text-rose-600'
                  }`}
                >
                  {hardCount === 0 ? '0 Hard Conflicts · PASSED' : `${hardCount} Hard Conflict(s) · FAILED`}
                </span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {hardCount === 0
                  ? 'All faculty schedules, room allocations, elective synchronizations, and daily limits are 100% compliant.'
                  : 'Review critical constraints and conflicting assignments below before publication.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block font-mono">
                Quality Index
              </span>
              <span className="text-base font-mono font-bold text-[var(--text-primary)]">
                {summary.qualityScore || 100} / 100
              </span>
            </div>
          </div>
        </div>

        {/* Diagnostic Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('HARD_CONFLICTS')}
            className={`px-3 py-1.5 rounded-xs text-xs font-medium flex items-center gap-2 border transition-colors cursor-pointer ${
              activeTab === 'HARD_CONFLICTS'
                ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 font-semibold'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-transparent hover:border-[var(--border)]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Hard Conflicts</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                hardCount === 0
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {hardCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('SOFT_WARNINGS')}
            className={`px-3 py-1.5 rounded-xs text-xs font-medium flex items-center gap-2 border transition-colors cursor-pointer ${
              activeTab === 'SOFT_WARNINGS'
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 font-semibold'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-transparent hover:border-[var(--border)]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Soft Warnings</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
              {softCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('OPTIMIZATION')}
            className={`px-3 py-1.5 rounded-xs text-xs font-medium flex items-center gap-2 border transition-colors cursor-pointer ${
              activeTab === 'OPTIMIZATION'
                ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 font-semibold'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-transparent hover:border-[var(--border)]'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Optimization Opportunities</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300">
              {optCount}
            </span>
          </button>
        </div>

        {/* Category Context & About Banner */}
        <div className={`p-3 rounded-md border text-xs leading-relaxed ${
          activeTab === 'HARD_CONFLICTS'
            ? 'bg-rose-500/5 border-rose-500/20 text-rose-900 dark:text-rose-200'
            : activeTab === 'SOFT_WARNINGS'
            ? 'bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-200'
            : 'bg-purple-500/5 border-purple-500/20 text-purple-900 dark:text-purple-200'
        }`}>
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              {activeTab === 'HARD_CONFLICTS'
                ? 'About Hard Conflicts (Critical Infeasibilities)'
                : activeTab === 'SOFT_WARNINGS'
                ? 'About Soft Warnings (Teaching Quality Alerts)'
                : 'About Optimization Opportunities (Schedule Enhancements)'}
            </span>
          </div>
          <p className="text-[11px] opacity-90">
            {activeTab === 'HARD_CONFLICTS'
              ? (summary.aboutHardConflicts || 'Hard conflicts represent physical or statutory impossibilities (e.g. two classes assigned to the same laboratory room at the same hour, or faculty double-booked simultaneously). These violate basic institutional feasibility and MUST be resolved before publishing.')
              : activeTab === 'SOFT_WARNINGS'
              ? (summary.aboutSoftWarnings || 'Soft warnings identify non-blocking pedagogical quality issues, such as instructors assigned to 4 or more back-to-back teaching periods without an intervening rest break. Addressing these ensures faculty fatigue is minimized.')
              : (summary.aboutOptimization || 'Optimization opportunities are non-critical schedule improvements, such as eliminating awkward 1-period idle gaps before afternoon classes or providing restorative lunch buffers.')}
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by class, subject, teacher, room, or issue..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-xs text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="ALL">All Days</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
            </select>
          </div>
        </div>

        {/* Diagnostics List Container */}
        <div className="max-h-[500px] overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {currentItems.length === 0 ? (
            <div className="p-8 text-center rounded-md bg-[var(--bg-surface-alt)]/50 border border-[var(--border)]">
              {activeTab === 'HARD_CONFLICTS' ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" strokeWidth={1.5} />
                  <h4 className="text-sm font-semibold text-emerald-600">Zero Hard Conflicts Detected</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
                    The active published timetable has passed all strict hard constraint checks including faculty
                    availability, lab room allocations, elective synchronizations, daily subject uniqueness, and KTU
                    workload hours.
                  </p>
                </>
              ) : activeTab === 'SOFT_WARNINGS' ? (
                <>
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" strokeWidth={1.5} />
                  <h4 className="text-sm font-semibold text-emerald-600">Zero Soft Warnings</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    No faculty fatigue or timetable fragmentation issues detected.
                  </p>
                </>
              ) : (
                <>
                  <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-2" strokeWidth={1.5} />
                  <h4 className="text-sm font-semibold text-purple-600">Timetable Fully Optimized</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    No further automated gap reduction or resting buffer opportunities identified.
                  </p>
                </>
              )}
            </div>
          ) : (
            currentItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-4 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-all space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border font-mono ${
                          SEVERITY_BADGES[item.severity] || SEVERITY_BADGES.WARNING
                        }`}
                      >
                        {item.severity}
                      </span>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        {item.title}
                      </h4>
                      {item.status && (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          [{item.status}]
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Direct Cell Navigation Button */}
                  {onNavigateToCell && (item.classId || item.primaryAssignment?.classId) && (
                    <button
                      onClick={() =>
                        onNavigateToCell({
                          classId: item.classId || item.primaryAssignment?.classId,
                          day: item.day,
                          period: item.period,
                          title: item.title,
                          explanation: item.explanation,
                          conflictingAssignment: item.conflictingAssignment,
                        })
                      }
                      className="px-2.5 py-1 rounded-xs bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 text-xs font-medium flex items-center gap-1 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                      title="Navigate directly to affected timetable cell"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Locate in Grid</span>
                    </button>
                  )}
                </div>

                {/* Metadata Pills */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--text-secondary)]">
                  {item.className && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)] font-medium">
                      <BookOpen className="w-3 h-3 text-[var(--accent)]" />
                      <span>{item.className}</span>
                    </span>
                  )}
                  {item.day && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)] font-mono">
                      <Calendar className="w-3 h-3 text-muted" />
                      <span>{item.day}</span>
                    </span>
                  )}
                  {item.period && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)] font-mono">
                      <Clock className="w-3 h-3 text-muted" />
                      <span>Period {item.period}</span>
                    </span>
                  )}
                  {item.subjectCode && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)] font-mono">
                      <span>{item.subjectCode}</span>
                    </span>
                  )}
                  {item.teacherName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)]">
                      <User className="w-3 h-3 text-muted" />
                      <span>{item.teacherName}</span>
                    </span>
                  )}
                  {item.roomName && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border)]">
                      <FlaskConical className="w-3 h-3 text-muted" />
                      <span>{item.roomName}</span>
                    </span>
                  )}
                </div>

                {/* Explanation */}
                <div className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--bg-surface-alt)]/50 p-2.5 rounded border border-[var(--border)]">
                  <p className="font-medium text-[var(--text-primary)]">{item.explanation}</p>

                  {/* Conflicting Assignment Side-by-Side if present */}
                  {item.primaryAssignment && item.conflictingAssignment && (
                    <div className="mt-2.5 pt-2 border-t border-[var(--border)] grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-rose-500/5 border border-rose-500/20">
                        <div className="font-semibold text-rose-600 flex items-center justify-between">
                          <span>Primary Assignment:</span>
                          {onNavigateToCell && (
                            <button
                              onClick={() =>
                                onNavigateToCell({
                                  classId: item.primaryAssignment.classId,
                                  day: item.primaryAssignment.day,
                                  period: item.primaryAssignment.period,
                                  title: item.title,
                                  explanation: item.explanation,
                                })
                              }
                              className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5"
                            >
                              <span>View</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[var(--text-primary)] mt-1 font-medium">
                          {item.primaryAssignment.className} · {item.primaryAssignment.subjectName || item.primaryAssignment.subjectCode}
                        </p>
                        <p className="text-[var(--text-secondary)] text-[10px] font-mono mt-0.5">
                          {item.primaryAssignment.day} P{item.primaryAssignment.period} {item.primaryAssignment.roomName && `· ${item.primaryAssignment.roomName}`}
                        </p>
                      </div>

                      <div className="p-2 rounded bg-rose-500/5 border border-rose-500/20">
                        <div className="font-semibold text-rose-600 flex items-center justify-between">
                          <span>Conflicting Assignment:</span>
                          {onNavigateToCell && (
                            <button
                              onClick={() =>
                                onNavigateToCell({
                                  classId: item.conflictingAssignment.classId,
                                  day: item.conflictingAssignment.day,
                                  period: item.conflictingAssignment.period,
                                  title: item.title,
                                  explanation: item.explanation,
                                })
                              }
                              className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5"
                            >
                              <span>View</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[var(--text-primary)] mt-1 font-medium">
                          {item.conflictingAssignment.className} · {item.conflictingAssignment.subjectName || item.conflictingAssignment.subjectCode}
                        </p>
                        <p className="text-[var(--text-secondary)] text-[10px] font-mono mt-0.5">
                          {item.conflictingAssignment.day} P{item.conflictingAssignment.period} {item.conflictingAssignment.roomName && `· ${item.conflictingAssignment.roomName}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Optimization Arrangement if applicable */}
                  {item.currentArrangement && item.suggestedArrangement && (
                    <div className="mt-2.5 pt-2 border-t border-[var(--border)] space-y-1.5 text-[11px]">
                      <div>
                        <span className="font-semibold text-[var(--text-muted)]">Current: </span>
                        <span>{item.currentArrangement}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-purple-600">Suggested: </span>
                        <span className="font-medium text-[var(--text-primary)]">{item.suggestedArrangement}</span>
                      </div>
                      {item.expectedBenefit && (
                        <div>
                          <span className="font-semibold text-emerald-600">Expected Benefit: </span>
                          <span>{item.expectedBenefit}</span>
                        </div>
                      )}
                      {item.constraintsPreserved && (
                        <div>
                          <span className="font-semibold text-[var(--text-muted)]">Safety Check: </span>
                          <span>{item.constraintsPreserved}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Root cause and resolution */}
                {(item.rootCause || item.resolution) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    {item.rootCause && (
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                          Root Cause:
                        </span>
                        <p className="text-[var(--text-secondary)] text-[11px]">{item.rootCause}</p>
                      </div>
                    )}
                    {item.resolution && (
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider block">
                          Recommended Resolution:
                        </span>
                        <p className="text-[var(--text-primary)] text-[11px] font-medium">{item.resolution}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">
            Showing {currentItems.length} record(s) in {activeTab.replace('_', ' ')}
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Diagnostics
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConflictDiagnosticsModal;
