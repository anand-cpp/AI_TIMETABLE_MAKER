import { useState } from 'react';
import { cn } from '../../utils/cn';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';
import {
  Zap,
  AlertTriangle,
  CheckCircle,
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
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Generate Timetable</h3>
          <p className="text-xs text-gray-500">AI-powered genetic algorithm engine</p>
        </div>
      </div>

      {/* Label */}
      <div className="mb-4">
        <label className="form-label">Version Label (optional)</label>
        <input
          type="text"
          value={options.label}
          onChange={(e) => setOptions((o) => ({ ...o, label: e.target.value }))}
          placeholder="e.g. Week 1 Draft"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 mb-3 transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Advanced Engine Options
      </button>

      {showAdvanced && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3 border border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs">Population Size</label>
              <input
                type="number"
                min={5}
                max={50}
                value={options.populationSize}
                onChange={(e) => setOptions((o) => ({
                  ...o, populationSize: Number(e.target.value)
                }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="form-hint">5-50 (default: 10)</p>
            </div>
            <div>
              <label className="form-label text-xs">Max Generations</label>
              <input
                type="number"
                min={10}
                max={200}
                value={options.maxGenerations}
                onChange={(e) => setOptions((o) => ({
                  ...o, maxGenerations: Number(e.target.value)
                }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="form-hint">10-200 (default: 50)</p>
            </div>
          </div>
          <div>
            <label className="form-label text-xs">
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
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>5% (stable)</span>
              <span>50% (exploratory)</span>
            </div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
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
        leftIcon={!generating && <Zap className="w-4 h-4" />}
        disabled={generating}
      >
        {generating ? 'Generating Timetable...' : 'Generate New Timetable'}
      </Button>

      {generating && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader className="w-4 h-4 text-blue-600 animate-spin" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                AI Engine Running...
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
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
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">
                    {lastResult.warnings.length} Warning(s)
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {lastResult.warnings.slice(0, 3).map((w, i) => (
                      <li key={i} className="text-xs text-amber-700">• {w}</li>
                    ))}
                    {lastResult.warnings.length > 3 && (
                      <li className="text-xs text-amber-600">
                        + {lastResult.warnings.length - 3} more...
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {lastResult.unplacedSubjects?.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-800">
                    {lastResult.unplacedSubjects.length} Subject(s) Not Placed
                  </p>
                  {lastResult.unplacedSubjects.slice(0, 3).map((s, i) => (
                    <p key={i} className="text-xs text-red-700 mt-0.5">
                      • {s.subjectName}: {s.reason}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {lastResult.generationStats && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {lastResult.generationStats.generations}
                  </p>
                  <p className="text-xs text-gray-500">Generations</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {(lastResult.generationStats.timeMs / 1000).toFixed(1)}s
                  </p>
                  <p className="text-xs text-gray-500">Time</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {lastResult.generationStats.hardViolations}
                  </p>
                  <p className="text-xs text-gray-500">Violations</p>
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