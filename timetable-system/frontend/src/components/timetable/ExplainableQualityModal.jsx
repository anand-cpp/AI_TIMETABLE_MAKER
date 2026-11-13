import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Clock,
  Layers,
  Users,
  Calendar,
  Lock,
  FlaskConical,
  Activity,
  ArrowRight
} from 'lucide-react';

const DIMENSION_ICONS = {
  workloadCompleteness: CheckCircle2,
  facultyConflicts: Users,
  classConflicts: Activity,
  electiveSync: Layers,
  lockedSlots: Lock,
  labIntegrity: FlaskConical,
  dailyBalance: Calendar,
  facultyContinuity: Clock,
};

const ExplainableQualityModal = ({ isOpen, onClose, qualityScore, onNavigateToBuilder }) => {
  if (!qualityScore) return null;

  const overall = qualityScore.overall || 0;
  const isGated = qualityScore.isGated;
  const gateReason = qualityScore.gateReason;
  const breakdown = qualityScore.breakdown || [];
  const issues = qualityScore.issues || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Timetable Quality Assessment & Score Explanation"
      size="lg"
    >
      <div className="space-y-6 font-sans text-[var(--text-primary)]">
        {/* Top Summary Banner */}
        <div className="flex items-center justify-between p-5 rounded-md bg-[var(--bg-surface-alt)] border border-[var(--border)]">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center font-mono font-bold text-xl border ${
              overall >= 90
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : overall >= 75
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
            }`}>
              {overall}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-medium">Timetable Quality: {overall}/100</h3>
                <Badge variant={overall >= 90 ? 'success' : overall >= 75 ? 'warning' : 'danger'}>
                  {overall >= 90 ? 'Institution Ready' : overall >= 75 ? 'Acceptable' : 'Needs Optimization'}
                </Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Transparent evaluation across 8 critical academic, constraint, and teacher wellbeing dimensions.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">Target</span>
            <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">100 / 100</span>
          </div>
        </div>

        {/* Hard Constraint Gate Warning if applicable */}
        {isGated && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-md flex items-start gap-3 text-xs text-rose-500">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Hard Constraint Gate Active</p>
              <p className="mt-0.5 leading-relaxed">
                {gateReason || 'Critical hard constraint violations prevent this timetable from receiving a passing grade.'}
              </p>
            </div>
          </div>
        )}

        {/* 8 Transparent Dimensions Table */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
            Scoring Dimensions Breakdown (Total: 100 Points)
          </h4>
          <div className="border border-[var(--border)] rounded-md overflow-hidden bg-[var(--bg-surface)]">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-surface-alt)] border-b border-[var(--border)] text-[var(--text-secondary)] text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 text-left font-semibold">Dimension</th>
                  <th className="py-2.5 px-3 text-center font-semibold w-24">Score</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Status & Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {breakdown.map((dim) => {
                  const Icon = DIMENSION_ICONS[dim.id] || HelpCircle;
                  const isFull = dim.score === dim.maxScore;
                  return (
                    <tr key={dim.id} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 shrink-0 ${isFull ? 'text-emerald-500' : 'text-amber-500'}`} />
                          <span className="font-medium text-[var(--text-primary)]">{dim.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className={`font-bold ${isFull ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {dim.score}
                        </span>
                        <span className="text-[var(--text-muted)] font-normal"> / {dim.maxScore}</span>
                      </td>
                      <td className="py-3 px-3 text-[var(--text-secondary)] leading-relaxed">
                        {dim.explanation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Specific Missing Points Diagnosis & Resolution */}
        {issues.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Identified Deductions & Correction Guidance
            </h4>
            <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
              {issues.map((issue, idx) => (
                <div key={idx} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-500">{issue.dimension}</span>
                    {issue.day && issue.period && (
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {issue.day} Period {issue.period}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--text-primary)]">{issue.reason}</p>
                  <div className="flex items-start gap-1.5 text-[var(--accent)] text-[11px] font-medium pt-0.5">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>How to fix: {issue.fix}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {issues.length === 0 && (
          <div className="p-4 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-600 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold">Zero Academic or Quality Flaws</p>
              <p className="text-[var(--text-secondary)] mt-0.5">
                Every required academic hour is placed, faculty loads are balanced, electives are synchronized, and labs meet room requirements.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Breakdown
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ExplainableQualityModal;
