import { Building2, Pencil, Trash2, MapPin, Layers, Zap } from 'lucide-react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { getPaletteForIndex } from '../../utils/palette';
import { useTheme } from '../../context/ThemeContext';

const DepartmentList = ({ departments, loading, onEdit, onDelete }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-[var(--bg-surface-alt)] rounded-md border border-dashed border-[var(--border)]">
        <div className="w-10 h-10 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mx-auto mb-3 border border-[var(--border)]">
          <Building2 className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <h4 className="font-serif font-normal text-[var(--text-primary)] text-lg">
          No Departments Found
        </h4>
        <p className="text-xs font-sans text-[var(--text-secondary)] mt-1">
          Click "Add Department" above to create your first department in the stack.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 text-xs font-sans font-semibold uppercase tracking-widest text-[var(--text-label)]">
        <span className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} /> Department Stack ({departments.length})
        </span>
        <span>Actions</span>
      </div>

      {/* STACK OF DEPARTMENT CARDS */}
      <div className="space-y-3">
        {departments.map((dept, index) => {
          const paletteStyle = getPaletteForIndex(index, isDark);
          return (
            <div
              key={dept._id || index}
              className="bg-[var(--bg-surface)] p-5 rounded-md border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] transition-colors duration-150"
            >
              <div className="flex items-center gap-4">
                {/* 44x44px Muted Palette Avatar Square */}
                <div
                  style={paletteStyle}
                  className="w-[44px] h-[44px] rounded-md font-sans font-bold text-sm flex items-center justify-center border shrink-0 uppercase tracking-wider"
                >
                  {dept.code || dept.name.substring(0, 3).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-serif font-normal text-lg text-[var(--text-primary)]">
                      {dept.name}
                    </h4>
                    {/* Small Tag Pill */}
                    <span className="px-2 py-0.5 rounded-sm bg-[var(--bg-surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] font-sans font-semibold text-[11px] uppercase tracking-wider">
                      {dept.code}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-sans text-[var(--text-secondary)] mt-1">
                    {(dept.building || dept.floor) ? (
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.5} />
                        {[dept.building, dept.floor].filter(Boolean).join(' • ')}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">No Location Specified</span>
                    )}
                    {dept.travelOptimization && (
                      <span className="px-2 py-0.5 rounded-sm bg-[var(--accent-soft)] text-[var(--success)] border border-[var(--success)]/30 font-sans font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-[var(--success)]" strokeWidth={1.5} /> Travel Optimized
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(dept)}
                  leftIcon={<Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(dept)}
                  className="text-[var(--error)] hover:bg-[var(--bg-hover)]"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DepartmentList;