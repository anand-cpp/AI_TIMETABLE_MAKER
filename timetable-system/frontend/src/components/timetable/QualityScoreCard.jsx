import { cn } from '../../utils/cn';
import {
  Users,
  Calendar,
  FlaskConical,
  Layers,
  MapPin,
  Clock,
  Brain,
  Star,
  Award,
} from 'lucide-react';

const scoreCategories = [
  { key: 'teacherLoad', label: 'Teacher Load Balance', code: 'LOD', icon: Users },
  { key: 'distribution', label: 'Subject Distribution', code: 'DST', icon: Calendar },
  { key: 'labPlacement', label: 'Lab Placement', code: 'LAB', icon: FlaskConical },
  { key: 'electiveSync', label: 'Elective Sync', code: 'ELC', icon: Layers, weight: 2 },
  { key: 'travelOptimization', label: 'Travel Optimization', code: 'TRV', icon: MapPin },
  { key: 'teacherGaps', label: 'Teacher Gaps', code: 'GAP', icon: Clock },
  { key: 'studentStress', label: 'Student Stress', code: 'STR', icon: Brain },
];

const QualityScoreCard = ({ qualityScore, compact = false }) => {
  if (!qualityScore) return null;

  const overall = qualityScore.overall || 0;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] text-xs font-mono font-medium">
        <Star className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.5} />
        <span>OVR {overall}/100</span>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-5 text-[var(--text-primary)]">
      {/* Overall Score Card Header */}
      <div className="p-4 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] mb-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[var(--text-label)] text-[11px] font-sans font-semibold uppercase tracking-widest">
              <Award className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />
              <span>Overall Quality Index</span>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="font-mono text-4xl font-bold text-[var(--text-primary)] leading-none">{overall}</span>
              <span className="text-sm font-sans text-[var(--text-muted)]">/100</span>
            </div>
          </div>
          
          <div className="w-12 h-12 rounded-sm bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center">
            <Star className="w-6 h-6 text-[var(--accent)]" strokeWidth={1.5} />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border)] p-0.5">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
              style={{ width: `${overall}%` }}
            />
          </div>
        </div>
      </div>

      {/* Score Breakdown List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <span className="text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-label)]">
            Quality Metrics Breakdown
          </span>
          <span className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Score</span>
        </div>

        {scoreCategories.map((cat) => {
          const score = qualityScore[cat.key] || 0;
          const Icon = cat.icon;
          return (
            <div key={cat.key} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--text-secondary)]">
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-sans text-[#EDE8D9] truncate flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded-xs bg-[#24201A] font-mono text-[10px] text-[#B89968] font-bold uppercase">{cat.code}</span>
                    <span className="text-[#EDE8D9] font-medium">{cat.label}</span>
                    {cat.weight && (
                      <span className="text-[10px] font-sans text-[#8A8577]">×{cat.weight}</span>
                    )}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#EDE8D9] ml-2 shrink-0">
                    {score}
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden border border-[var(--border)]">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QualityScoreCard;