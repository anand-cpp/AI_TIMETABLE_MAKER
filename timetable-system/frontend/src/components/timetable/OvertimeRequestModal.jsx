import { useState, useEffect } from 'react';
import { AlertTriangle, Check, ShieldAlert, Sparkles, Clock, X } from 'lucide-react';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn select-none"
      onClick={(e) => {
        e.stopPropagation();
        if (onClose) onClose();
      }}
    >
      <div
        className="bg-surface border border-theme rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden transition-all duration-300 transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Progress Bar */}
        <div className="w-full bg-surface-alt h-2">
          <div
            className="bg-accent h-2 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-theme flex items-center justify-between bg-surface-alt/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-danger/10 text-danger animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-main flex items-center gap-2">
                <span>PLACEMENT DECISION REQUIRED</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent/15 text-accent font-mono font-bold">
                  Request {currentIndex + 1} of {totalRequests}
                </span>
              </h3>
              <p className="text-xs text-muted">Admin authorization required to complete schedule placement</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface border border-theme transition cursor-pointer"
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
            <div className="p-3 rounded-lg bg-surface-alt border border-theme/60">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Teacher</div>
              <div className="text-sm font-bold text-main mt-0.5 truncate">{request.teacherName || 'Faculty Member'}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-alt border border-theme/60">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Subject</div>
              <div className="text-sm font-bold text-main mt-0.5 truncate">{request.subjectName}</div>
            </div>
            <div className="p-3 rounded-lg bg-surface-alt border border-theme/60">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Class</div>
              <div className="text-sm font-bold text-main mt-0.5 truncate">{request.className}</div>
            </div>
          </div>

          {/* Issue Summary Box */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              <span>Constraint Conflict</span>
            </div>
            <p className="text-xs text-main leading-relaxed">
              {request.issueDescription}
            </p>
          </div>

          {/* Current Faculty Daily Load Breakdown */}
          {request.currentLoad && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Current Faculty Daily Load Breakdown:</span>
              </div>
              <div className="grid grid-cols-6 gap-2 text-center">
                {Object.entries(request.currentLoad).map(([day, load]) => (
                  <div key={day} className="p-2 rounded-lg bg-surface-alt border border-theme text-xs">
                    <div className="text-[10px] font-bold text-muted uppercase">{day}</div>
                    <div className="font-mono font-bold text-main mt-0.5">{load}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-main">
              <span>Choose a Solution (Required):</span>
              <span className="text-accent flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3 h-3" /> Recommended strategy
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
                        ? 'border-accent bg-accent/10 shadow-sm'
                        : 'border-theme hover:border-theme/80 bg-surface-alt/50 hover:bg-surface-alt'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <input
                          type="radio"
                          name="solution-option"
                          checked={isSelected}
                          onChange={() => setSelectedOptionId(opt.id)}
                          className="w-4 h-4 text-accent border-theme focus:ring-accent"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-main">{opt.label}</span>
                          {opt.isRecommended && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent flex items-center gap-1">
                              ★ Recommended
                            </span>
                          )}
                        </div>
                        {opt.impact && (
                          <p className="text-[11px] text-muted mt-0.5">
                            Impact: {opt.impact}
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
            <label className="text-xs font-semibold text-muted">
              Admin Justification Notes (Optional for audit trail):
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Enter notes for this schedule decision..."
              rows={2}
              className="w-full text-xs p-3 rounded-lg border border-theme bg-surface text-main focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-theme bg-surface-alt/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-medium border border-theme text-muted hover:text-main hover:bg-surface transition cursor-pointer"
          >
            Cancel / Keep Existing Timetable
          </button>

          <button
            onClick={handleApply}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover transition-all duration-200 shadow-lg flex items-center gap-2 cursor-pointer"
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
