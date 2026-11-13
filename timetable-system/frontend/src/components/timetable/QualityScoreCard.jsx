import { useState } from 'react';
import {
  Users,
  Calendar,
  FlaskConical,
  Layers,
  Clock,
  Brain,
  Star,
  Award,
  HelpCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import ExplainableQualityModal from './ExplainableQualityModal';

const scoreCategories = [
  { key: 'workloadCompleteness', label: 'Workload Completeness', code: 'WKL', max: 20 },
  { key: 'facultyConflicts', label: 'Faculty Conflicts', code: 'FAC', max: 15 },
  { key: 'classConflicts', label: 'Class Conflicts', code: 'CLS', max: 15 },
  { key: 'electiveSync', label: 'Elective Sync', code: 'ELC', max: 10 },
  { key: 'lockedSlots', label: 'Locked Slots', code: 'LCK', max: 10 },
  { key: 'labIntegrity', label: 'Lab Integrity', code: 'LAB', max: 10 },
  { key: 'dailyBalance', label: 'Daily Balance', code: 'BAL', max: 10 },
  { key: 'facultyContinuity', label: 'Faculty Continuity', code: 'CON', max: 10 },
];

const QualityScoreCard = ({ qualityScore, compact = false }) => {
  const [showModal, setShowModal] = useState(false);

  if (!qualityScore) return null;

  const overall = qualityScore.overall ?? 0;
  const isGated = qualityScore.isGated;
  const breakdown = qualityScore.breakdown || [];

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] text-xs font-mono font-medium hover:opacity-90 transition-opacity cursor-pointer"
          title="Click to view full 8-dimension quality explanation"
        >
          <Star className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.5} />
          <span>OVR {overall}/100</span>
        </button>
        <ExplainableQualityModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          qualityScore={qualityScore}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-5 text-[var(--text-primary)]">
        {/* Overall Score Card Header */}
        <div
          onClick={() => setShowModal(true)}
          className="p-4 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] mb-4 cursor-pointer hover:border-[var(--accent)] transition-all group"
          title="Click to inspect transparent score breakdown"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[var(--text-label)] text-[11px] font-sans font-semibold uppercase tracking-widest">
                <Award className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />
                <span>Timetable Quality Index</span>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="font-mono text-4xl font-bold text-[var(--text-primary)] leading-none">
                  {overall}
                </span>
                <span className="text-sm font-sans text-[var(--text-muted)]">/100</span>
              </div>
            </div>

            <div className={`w-12 h-12 rounded-sm border flex items-center justify-center font-mono font-bold text-lg ${
              overall >= 90
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--border)]'
            }`}>
              <Star className="w-6 h-6 fill-current" strokeWidth={1.5} />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border)] p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overall >= 90 ? 'bg-emerald-500' : 'bg-[var(--accent)]'
                }`}
                style={{ width: `${overall}%` }}
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-secondary)]">
              {overall >= 90 ? 'Fully Optimized & Conflict-Free' : 'Inspect deductions & issues'}
            </span>
            <span className="text-[var(--accent)] font-medium group-hover:underline">
              View Breakdown →
            </span>
          </div>
        </div>

        {/* 8 Transparent Dimensions Quick View */}
        <div className="space-y-2">
          {breakdown.length > 0 ? (
            breakdown.map((item) => (
              <div
                key={item.id}
                onClick={() => setShowModal(true)}
                className="flex items-center justify-between p-2 rounded-xs bg-[var(--bg-surface-alt)]/40 hover:bg-[var(--bg-surface-alt)] border border-transparent hover:border-[var(--border)] cursor-pointer text-xs transition-colors"
              >
                <span className="text-[var(--text-secondary)] truncate font-medium">{item.name}</span>
                <span className="font-mono font-bold text-[var(--text-primary)] shrink-0 ml-2">
                  <span className={item.score === item.maxScore ? 'text-emerald-500' : 'text-amber-500'}>
                    {item.score}
                  </span>
                  <span className="text-[var(--text-muted)] font-normal">/{item.maxScore}</span>
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-[var(--text-muted)]">
              Click to view breakdown details
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Modal */}
      <ExplainableQualityModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        qualityScore={qualityScore}
      />
    </>
  );
};

export default QualityScoreCard;
