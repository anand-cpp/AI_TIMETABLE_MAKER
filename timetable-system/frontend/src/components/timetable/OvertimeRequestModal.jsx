import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, ShieldAlert, Sparkles, Clock } from 'lucide-react';

const OvertimeRequestModal = ({
  isOpen,
  request,
  currentIndex = 0,
  totalRequests = 1,
  onApplyOption,
}) => {
  if (!isOpen || !request) return null;

  const [selectedOptionId, setSelectedOptionId] = useState(
    request.recommendedOptionId || (request.options && request.options[0]?.id)
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
      onClick={(e) => e.stopPropagation()}
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

        {/* Modal Header — NO CLOSE BUTTON */}
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
          <span className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded bg-danger/10 text-danger border border-danger/20">
            Cannot Skip
          </span>
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
            <p className="text-xs text-main leading-relaxed font-medium">
              {request.issueDescription}
            </p>
          </div>

          {/* Faculty Daily Load */}
          {request.currentLoad && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span>Current Faculty Daily Load Breakdown:</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 text-center font-mono text-xs">
                {Object.entries(request.currentLoad).map(([day, load]) => (
                  <div key={day} className="p-2 rounded-md bg-surface-alt border border-theme/60">
                    <div className="text-[10px] text-muted font-bold uppercase">{day}</div>
                    <div className="font-bold text-main mt-0.5">{load}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Options */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-main flex items-center justify-between">
              <span>Choose a Solution (Required):</span>
              <span className="text-[11px] text-accent font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> ⭐ Recommended strategy
              </span>
            </label>

            <div className="space-y-2">
              {request.options?.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const isRec = option.isRecommended || option.id === request.recommendedOptionId;

                return (
                  <label
                    key={option.id}
                    onClick={() => setSelectedOptionId(option.id)}
                    className={`block p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-accent bg-accent/10 ring-2 ring-accent'
                        : 'border-theme hover:bg-hover'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="resolutionOption"
                        checked={isSelected}
                        onChange={() => setSelectedOptionId(option.id)}
                        className="mt-0.5 text-accent focus:ring-accent"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-main">{option.label}</span>
                          {isRec && (
                            <span className="px-2 py-0.5 rounded-full bg-accent text-white text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 shadow-sm">
                              ⭐ Recommended
                            </span>
                          )}
                        </div>
                        {option.impact && (
                          <p className="text-[11px] text-muted mt-1 leading-normal">
                            Impact: {option.impact}
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
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

        {/* Modal Footer — NO SKIP / NO REJECT BUTTONS */}
        <div className="px-6 py-4 border-t border-theme bg-surface-alt/80 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Skipping disabled — every subject MUST be placed.</span>
          </div>

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
