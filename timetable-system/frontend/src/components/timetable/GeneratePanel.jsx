import { useState } from 'react';
import Button from '../ui/Button';
import {
  Zap,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader,
} from 'lucide-react';

const GeneratePanel = ({ onGenerate, generating, lastResult }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState({
    label: '',
    populationSize: 10,
    maxGenerations: 50,
    mutationRate: 0.15,
  });

  const handleGenerate = () => {
    onGenerate({
      label: options.label || undefined,
      populationSize: options.populationSize,
      maxGenerations: options.maxGenerations,
      mutationRate: options.mutationRate,
    });
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md p-5">
      {/* Top Header Row */}
      <div className="flex items-center gap-3 mb-5">
        {/* 44x44px Icon Square in Theme Colors */}
        <div className="w-[44px] h-[44px] rounded-md bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-base font-serif font-normal text-[var(--text-primary)] leading-tight">
            Generate Timetable
          </h3>
          <p className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
            AI-powered genetic algorithm engine
          </p>
        </div>
      </div>

      {/* Version Label */}
      <div className="mb-4 space-y-1.5">
        <label className="block text-[11px] font-sans font-semibold uppercase tracking-widest text-[var(--text-label)]">
          Version Label (optional)
        </label>
        <input
          type="text"
          value={options.label}
          onChange={(e) => setOptions((o) => ({ ...o, label: e.target.value }))}
          placeholder="e.g. Week 1 Draft"
          className="w-full px-3 py-2 text-sm font-sans bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border)] rounded-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
        />
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="flex items-center gap-2 text-xs font-sans text-[var(--text-primary)] hover:text-[var(--accent)] mb-3 transition-colors cursor-pointer"
      >
        {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
        <span>Advanced Engine Options</span>
      </button>

      {showAdvanced && (
        <div className="mb-4 p-4 bg-[var(--bg-surface-alt)] rounded-sm space-y-3 border border-[var(--border)] font-sans text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-sans font-semibold uppercase tracking-wider text-[var(--text-label)] mb-1">
                Population Size
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={options.populationSize}
                onChange={(e) => setOptions((o) => ({
                  ...o, populationSize: Number(e.target.value)
                }))}
                className="w-full px-3 py-1.5 text-sm bg-transparent text-[var(--text-primary)] border border-[var(--border)] rounded-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">5-50 (default: 10)</p>
            </div>
            <div>
              <label className="block text-[10px] font-sans font-semibold uppercase tracking-wider text-[var(--text-label)] mb-1">
                Max Generations
              </label>
              <input
                type="number"
                min={10}
                max={200}
                value={options.maxGenerations}
                onChange={(e) => setOptions((o) => ({
                  ...o, maxGenerations: Number(e.target.value)
                }))}
                className="w-full px-3 py-1.5 text-sm bg-transparent text-[var(--text-primary)] border border-[var(--border)] rounded-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">10-200 (default: 50)</p>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-sans font-semibold uppercase tracking-wider text-[var(--text-label)] mb-1">
              Mutation Rate: {(options.mutationRate * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.05}
              value={options.mutationRate}
              onChange={(e) => setOptions((o) => ({
                ...o, mutationRate: Number(e.target.value)
              }))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
              <span>5% (stable)</span>
              <span>50% (exploratory)</span>
            </div>
          </div>
          <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-sm">
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Higher population + more generations = better quality but slower.
              Larger mutation = more exploration but less stable.
            </p>
          </div>
        </div>
      )}

      <Button
        fullWidth
        onClick={handleGenerate}
        loading={generating}
        size="lg"
        leftIcon={!generating && <Zap className="w-4 h-4" strokeWidth={1.5} />}
        disabled={generating}
      >
        {generating ? 'Generating Timetable...' : 'Generate New Timetable'}
      </Button>

      {generating && (
        <div className="mt-4 p-4 bg-[var(--accent-soft)] border border-[var(--border)] rounded-sm">
          <div className="flex items-center gap-3">
            <Loader className="w-4 h-4 text-[var(--accent)] animate-spin" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-sans font-semibold text-[var(--text-primary)]">
                AI Engine Running...
              </p>
              <p className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
                Running genetic algorithm. This may take up to 5 minutes for complex setups.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last result summary */}
      {lastResult && !generating && (
        <div className="mt-4 space-y-2">
          {lastResult.warnings?.length > 0 && (
            <div className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--warning)]/40 rounded-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--warning)] mt-0.5 shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-sans font-semibold text-[var(--warning)]">
                    {lastResult.warnings.length} Warning(s)
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {lastResult.warnings.slice(0, 3).map((w, i) => (
                      <li key={i} className="text-xs font-sans text-[var(--text-secondary)]">• {w}</li>
                    ))}
                    {lastResult.warnings.length > 3 && (
                      <li className="text-xs font-sans text-[var(--text-muted)]">
                        + {lastResult.warnings.length - 3} more...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {lastResult.unplacedSubjects?.length > 0 && (
            <div className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--error)]/40 rounded-sm">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-[var(--error)] mt-0.5 shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-sans font-semibold text-[var(--error)]">
                    {lastResult.unplacedSubjects.length} Subject(s) Not Placed
                  </p>
                  {lastResult.unplacedSubjects.slice(0, 3).map((s, i) => (
                    <p key={i} className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
                      • {s.subjectName}: {s.reason}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {lastResult.generationStats && (
            <div className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-mono font-medium text-[var(--text-primary)]">
                    {lastResult.generationStats.generations}
                  </p>
                  <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Generations</p>
                </div>
                <div>
                  <p className="text-lg font-mono font-medium text-[var(--text-primary)]">
                    {(lastResult.generationStats.timeMs / 1000).toFixed(1)}s
                  </p>
                  <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Time</p>
                </div>
                <div>
                  <p className="text-lg font-mono font-medium text-[var(--text-primary)]">
                    {lastResult.generationStats.hardViolations}
                  </p>
                  <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Violations</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GeneratePanel;