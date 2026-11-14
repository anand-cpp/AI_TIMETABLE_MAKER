import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  ShieldAlert,
  Sparkles,
  Clock,
  X,
  User,
  BookOpen,
  GraduationCap,
  Info,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

const OvertimeRequestModal = ({
  isOpen,
  request,
  currentIndex = 0,
  totalRequests = 1,
  onApplyOption,
  onClose,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState(
    request?.recommendedOptionId || request?.options?.[0]?.id
  );
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (request) {
      setSelectedOptionId(
        request.recommendedOptionId || (request.options && request.options[0]?.id)
      );
      setAdminNotes('');
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const selectedOptionObj = request.options?.find((o) => o.id === selectedOptionId);

  const handleApply = () => {
    if (!selectedOptionObj) return;
    onApplyOption({
      request,
      selectedOption: selectedOptionObj,
      adminNotes,
    });
  };

  const progressPercent = Math.round(((currentIndex + 1) / totalRequests) * 100);

  // Parse daily load to provide intuitive visual status badges
  const parseDayStatus = (day, loadStr) => {
    if (!loadStr || loadStr === '—') return { isWeekend: true, label: 'Weekend' };
    const parts = loadStr.split('/');
    const current = parseInt(parts[0], 10);
    const max = parseInt(parts[1], 10);
    if (isNaN(current) || isNaN(max)) return { label: loadStr };
    if (current === 0) return { isFree: true, current, max, label: 'FREE · 0 periods' };
    if (current >= max) return { isFull: true, current, max, label: 'FULL · Ceiling' };
    return { isNormal: true, current, max, label: `${current}/${max} assigned` };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none"
      onClick={(e) => {
        e.stopPropagation();
        if (onClose) onClose();
      }}
    >
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transition-all duration-300 transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Progress Bar */}
        <div className="w-full bg-[var(--bg-surface-alt)] h-1.5">
          <div
            className="bg-[var(--accent)] h-1.5 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-surface-alt)]/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>Schedule Placement Decision Required</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-mono font-bold">
                  Request {currentIndex + 1} of {totalRequests}
                </span>
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Intelligent faculty workload diagnosis & schedule rebalancing assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition cursor-pointer"
                title="Close and keep current timetable"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto custom-scrollbar">
          {/* Metadata Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <User className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Teacher</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate">
                {request.teacherName || 'Faculty Member'}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                Max 4 periods/day · 20 hrs/week
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>Subject</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate" title={request.subjectName}>
                {request.subjectName}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                Curriculum Viva / Theory
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)]">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                <span>Target Class</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate">
                {request.className}
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
                {request.className?.includes('S8') ? 'Thu & Fri Reserved for Capstone' : 'Active Semester'}
              </div>
            </div>
          </div>

          {/* Contextual Conflict Diagnosis Box */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Conflict Diagnosis & Workload Analysis</span>
            </div>
            <p className="text-xs text-[var(--text-primary)] leading-relaxed">
              {request.issueDescription}
            </p>
            {request.className?.includes('S8') && (
              <div className="flex items-start gap-2 pt-1 border-t border-amber-500/20 text-[11px] text-[var(--text-secondary)]">
                <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Schedule Insight:</strong> Since S8 CSE B is committed to Capstone Project Phase-2 on Thursday and Friday, Wednesday is the only viable weekday slot. Rebalancing {request.teacherName}&apos;s non-S8 sessions from Wednesday to Thursday/Friday frees up Wednesday with zero additional hours.
                </span>
              </div>
            )}
          </div>

          {/* Current Faculty Daily Load Breakdown (Visual Day Bars) */}
          {request.currentLoad && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Faculty Daily Teaching Load Distribution:</span>
                </div>
                <span className="text-[11px] font-normal text-[var(--text-muted)]">
                  Green indicates days with open capacity for rebalancing
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 text-center">
                {Object.entries(request.currentLoad).map(([day, load]) => {
                  const status = parseDayStatus(day, load);
                  return (
                    <div
                      key={day}
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        status.isFree
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                          : status.isFull
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/20'
                          : status.isWeekend
                          ? 'bg-[var(--bg-surface-alt)]/50 border-[var(--border)] text-[var(--text-muted)]'
                          : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider">{day}</div>
                      <div className="font-mono font-bold text-sm my-0.5">{load}</div>
                      <div className="text-[9px] font-medium leading-tight">
                        {status.isFree ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> FREE
                          </span>
                        ) : status.isFull ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">FULL (4/4)</span>
                        ) : status.isWeekend ? (
                          <span>Off-day</span>
                        ) : (
                          <span className="text-[var(--text-secondary)]">{status.current} taught</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Options Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
              <span>Choose an Intelligent Resolution Strategy (Required):</span>
              <span className="text-[var(--accent)] flex items-center gap-1 text-[11px] font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Zero-friction rebalancing
              </span>
            </div>

            <div className="space-y-2">
              {request.options?.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20 shadow-sm'
                        : 'border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--bg-surface-alt)]/40 hover:bg-[var(--bg-surface-alt)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <input
                          type="radio"
                          name="solution-option"
                          checked={isSelected}
                          onChange={() => setSelectedOptionId(opt.id)}
                          className="w-4 h-4 text-[var(--accent)] border-[var(--border)] focus:ring-[var(--accent)] cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{opt.label}</span>
                          {opt.isRecommended && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center gap-1">
                              ★ Recommended Solution
                            </span>
                          )}
                        </div>
                        {opt.impact && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                            <strong className="text-[var(--text-muted)]">Impact:</strong> {opt.impact}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Admin Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              Admin Notes / Justification (Optional for institutional audit trail):
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Approved faculty load rebalance to Thursday/Friday to preserve Capstone Project block."
              rows={2}
              className="w-full text-xs p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-alt)]/70 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
          >
            Cancel / Keep Existing Timetable
          </button>

          <button
            onClick={handleApply}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-all duration-200 shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>✓ Apply Selected Solution</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OvertimeRequestModal;
