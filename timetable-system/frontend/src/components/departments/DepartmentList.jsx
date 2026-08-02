import { Building2, Pencil, Trash2, MapPin, Layers } from 'lucide-react';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';

const DepartmentList = ({ departments, loading, onEdit, onDelete }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-3">
          <Building2 className="w-6 h-6" />
        </div>
        <h4 className="font-display font-bold text-slate-900 dark:text-white text-base">
          No Departments Found
        </h4>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
          Click "Add Department" above to create your first department in the stack.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-2 text-xs font-black uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-blue-500" /> Department Stack ({departments.length})
        </span>
        <span>Actions</span>
      </div>

      {/* STACK OF DEPARTMENT CARDS */}
      <div className="space-y-3">
        {departments.map((dept, index) => (
          <div
            key={dept._id || index}
            className="glass-panel p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-blue-500/50 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-display font-black text-sm flex items-center justify-center shadow-md shrink-0">
                {dept.code || dept.name.substring(0, 3).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-display font-extrabold text-base text-slate-900 dark:text-white">
                    {dept.name}
                  </h4>
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-black uppercase">
                    {dept.code}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {(dept.building || dept.floor) ? (
                    <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      {[dept.building, dept.floor].filter(Boolean).join(' • ')}
                    </span>
                  ) : (
                    <span className="text-slate-400">No Location Specified</span>
                  )}
                  {dept.travelOptimization && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                      ⚡ Travel Optimized
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(dept)}
                leftIcon={<Pencil className="w-3.5 h-3.5" />}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(dept)}
                className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DepartmentList;