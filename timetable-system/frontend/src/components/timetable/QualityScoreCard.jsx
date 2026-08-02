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

const getScoreColor = (score) => {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  if (score >= 40) return 'text-orange-500 dark:text-orange-400';
  return 'text-rose-600 dark:text-rose-400';
};

const getBarColor = (score) => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-rose-500';
};

const getOverallBg = (score) => {
  if (score >= 80) return 'from-emerald-600 via-teal-600 to-emerald-800';
  if (score >= 60) return 'from-amber-500 via-yellow-600 to-amber-700';
  if (score >= 40) return 'from-orange-500 via-amber-600 to-red-600';
  return 'from-rose-600 via-red-700 to-rose-900';
};

const QualityScoreCard = ({ qualityScore, compact = false }) => {
  if (!qualityScore) return null;

  const overall = qualityScore.overall || 0;

  if (compact) {
    return (
      <div className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-xs font-black shadow-md border border-white/20',
        `bg-gradient-to-r ${getOverallBg(overall)}`
      )}>
        <Star className="w-3.5 h-3.5 fill-white" />
        <span>OVR {overall}/100</span>
      </div>
    );
  }

  return (
    <div className="fifa-card fifa-card-gold p-0.5 rounded-3xl">
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md rounded-[22px] p-6 text-white">
        
        {/* Main Overall Rating FUT Shield */}
        <div className={cn(
          'rounded-2xl p-6 mb-6 text-white bg-gradient-to-br shadow-xl relative overflow-hidden border border-white/20',
          getOverallBg(overall)
        )}>
          {/* Subtle sheen background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-white/90 text-xs font-extrabold uppercase tracking-widest">
                <Award className="w-4 h-4 text-amber-300" />
                <span>Overall Quality Index</span>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="font-display text-5xl font-black tracking-tight drop-shadow-lg leading-none">{overall}</span>
                <span className="text-xl font-bold text-white/75">/100</span>
              </div>
            </div>
            
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-lg">
              <Star className="w-8 h-8 text-amber-300 fill-amber-300 drop-shadow" />
            </div>
          </div>

          {/* Master Progress Bar */}
          <div className="relative z-10 mt-5">
            <div className="h-2.5 bg-black/30 rounded-full overflow-hidden p-0.5 backdrop-blur-sm border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-white rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${overall}%` }}
              />
            </div>
          </div>
        </div>

        {/* Score Breakdown List */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">
              FUT Quality Metrics Breakdown
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Score (0-100)</span>
          </div>

          {scoreCategories.map((cat) => {
            const score = qualityScore[cat.key] || 0;
            const Icon = cat.icon;
            return (
              <div key={cat.key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] font-black text-amber-300 uppercase">{cat.code}</span>
                      {cat.label}
                      {cat.weight && (
                        <span className="text-[10px] font-extrabold text-amber-400">×{cat.weight}</span>
                      )}
                    </span>
                    <span className={cn('text-xs font-black ml-2 shrink-0', getScoreColor(score))}>
                      {score}
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden p-0.5">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500 shadow-sm', getBarColor(score))}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default QualityScoreCard;