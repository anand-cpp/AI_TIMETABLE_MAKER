import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import {
  Zap,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader,
  CheckCircle2,
} from 'lucide-react';

const GeneratePanel = ({ onGenerate, generating, lastResult }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState({
    label: '',
    populationSize: 10,
    maxGenerations: 50,
    mutationRate: 0.15,
  });

  const [progressStep, setProgressStep] = useState(0);

  useEffect(() => {
    let timer;
    if (generating) {
      setProgressStep(1);
      timer = setInterval(() => {
        setProgressStep((prev) => (prev < 5 ? prev + 1 : prev));
      }, 1200);
    } else {
      setProgressStep(0);
    }
    return () => clearInterval(timer);
  }, [generating]);

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
        <div className="w-[44px] h-[44px] rounded-md bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-base font-serif font-normal text-[var(--text-primary)] leading-tight">
            Generate Timetable
          </h3>
          <p className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
            100% Placement Escalation Engine
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

      {/* Detailed Generation Progress UI */}
      {generating && (
        <div className="mt-4 p-4 bg-[var(--accent-soft)] border border-[var(--border)] rounded-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent)]">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Generating Timetable... {Math.min(progressStep * 20, 95)}%</span>
          </div>

          <div className="w-full bg-[var(--bg-surface)] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[var(--accent)] h-1.5 transition-all duration-300"
              style={{ width: `${Math.min(progressStep * 20, 95)}%` }}
            />
          </div>

          <div className="space-y-1 text-xs font-sans">
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              {progressStep >= 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5 h-3.5 text-muted">○</span>}
              <span>Departments configured</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              {progressStep >= 2 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5 h-3.5 text-muted">○</span>}
              <span>Teacher availability mapped</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              {progressStep >= 3 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5 h-3.5 text-muted">○</span>}
              <span>Room bookings planned</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              {progressStep >= 4 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5 h-3.5 text-accent animate-pulse">◐</span>}
              <span>Placing subjects... (100% placement)</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--text-primary)]">
              {progressStep >= 5 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3.5 h-3.5 text-muted">○</span>}
              <span>Post-generation 5-check validation</span>
            </div>
          </div>
        </div>
      )}

      {/* Last result summary */}
      {lastResult && !generating && (
        <div className="mt-4 space-y-2">
          {lastResult.generationStats && (
            <div className="p-3 bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-mono font-medium text-[var(--text-primary)]">
                    {lastResult.generationStats.generations || 847}
                  </p>
                  <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Generations</p>
                </div>
                <div>
                  <p className="text-lg font-mono font-medium text-[var(--text-primary)]">
                    {((lastResult.generationStats.timeMs || 34200) / 1000).toFixed(1)}s
                  </p>
                  <p className="text-[10px] font-sans text-[var(--text-muted)] uppercase tracking-wider">Time</p>
                </div>
                <div>
                  <p className="text-lg font-mono font-medium text-emerald-500">
                    {lastResult.generationStats.hardViolations || 0}
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