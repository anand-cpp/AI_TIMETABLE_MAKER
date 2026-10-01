import { useMemo } from 'react';
import { Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

const KNOWN_LABS = [
  { code: 'CS-LAB-1', dept: 'CSE', capacity: 30, sharedBy: ['S3 CSE A', 'S3 CSE B', 'S5 CSE A', 'S5 CSE B', 'S7 CSE A'] },
  { code: 'CS-LAB-2', dept: 'CSE', capacity: 30, sharedBy: ['S1 CSE A', 'S1 CSE B'] },
  { code: 'EC-LAB-1', dept: 'ECE', capacity: 30, sharedBy: ['S3 ECE A', 'S5 ECE A', 'S7 ECE A'] },
  { code: 'EE-LAB-1', dept: 'EEE', capacity: 30, sharedBy: ['S3 EEE A', 'S5 EEE A'] },
  { code: 'ME-WORKSHOP', dept: 'ME', capacity: 30, sharedBy: ['S1 ME A', 'S3 ME A', 'S5 ME A', 'S7 ME A'] },
  { code: 'CV-LAB', dept: 'CE', capacity: 30, sharedBy: ['S3 CE A', 'S5 CE A'] },
  { code: 'AI-LAB', dept: 'AIML', capacity: 30, sharedBy: ['S3 AIML A', 'S5 AIML A'] },
];

const TOTAL_WEEKLY_SLOTS = 35; // 5 days x 7 periods

const LabUtilizationReport = ({ timetableVersion, classTimetables }) => {
  const allTimetables = useMemo(() => {
    if (timetableVersion?.classTimetables) return timetableVersion.classTimetables;
    if (classTimetables) return classTimetables;
    return [];
  }, [timetableVersion, classTimetables]);

  const labStats = useMemo(() => {
    const stats = {};
    for (const lab of KNOWN_LABS) {
      stats[lab.code] = {
        ...lab,
        usedSlots: 0,
        assignedClasses: new Set(),
        conflicts: 0,
        slotSchedule: {}, // "day_period" -> array of class names
      };
    }

    for (const ct of allTimetables) {
      const className = ct.className || ct.classId?.name || 'Class';
      for (const slot of ct.slots || []) {
        if (!slot || slot.isEmpty || slot.isBreak) continue;

        const rooms = [];
        if (slot.roomName && slot.subjectType === 'lab') rooms.push(slot.roomName);
        if (slot.isBatchSplit) {
          if (slot.batch1?.roomName) rooms.push(slot.batch1.roomName);
          if (slot.batch2?.roomName) rooms.push(slot.batch2.roomName);
        }

        for (const roomCode of rooms) {
          if (!stats[roomCode]) {
            stats[roomCode] = {
              code: roomCode,
              dept: 'General',
              capacity: 30,
              sharedBy: [className],
              usedSlots: 0,
              assignedClasses: new Set(),
              conflicts: 0,
              slotSchedule: {},
            };
          }

          const st = stats[roomCode];
          st.usedSlots += 1;
          st.assignedClasses.add(className);

          const slotKey = `${slot.day}_${slot.period}`;
          if (!st.slotSchedule[slotKey]) st.slotSchedule[slotKey] = [];
          st.slotSchedule[slotKey].push(className);

          if (st.slotSchedule[slotKey].length > 1) {
            st.conflicts += 1;
          }
        }
      }
    }

    return Object.values(stats);
  }, [allTimetables]);

  if (!allTimetables || allTimetables.length === 0) return null;

  return (
    <div className="mt-6 border border-[var(--border)] rounded-md p-4 bg-[var(--bg-surface)] font-sans space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[var(--accent)]" strokeWidth={1.5} />
          <h3 className="font-serif text-lg font-normal text-[var(--text-primary)]">
            Lab Room Utilization & Sharing Report
          </h3>
        </div>
        <span className="text-xs text-[var(--text-muted)] font-mono">
          KTU Multi-Year Shared Infrastructure
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {labStats.map((stat) => {
          const pct = Math.min(100, Math.round((stat.usedSlots / TOTAL_WEEKLY_SLOTS) * 100));
          const isHeavy = pct > 40;
          const isConflict = stat.conflicts > 0;
          const classesList = Array.from(stat.assignedClasses).length > 0
            ? Array.from(stat.assignedClasses).join(', ')
            : stat.sharedBy.join(', ');

          return (
            <div
              key={stat.code}
              className={cn(
                'p-3 border rounded-sm flex flex-col justify-between space-y-2.5 transition-colors',
                isConflict
                  ? 'border-[var(--error)]/50 bg-[var(--error)]/5'
                  : isHeavy
                  ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)]/20'
                  : 'border-[var(--border)] bg-[var(--bg-surface-alt)]'
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                    📊 {stat.code}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)]">
                    {pct}% Used ({stat.usedSlots}/{TOTAL_WEEKLY_SLOTS} hrs)
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1 truncate" title={classesList}>
                  Shared by: {classesList}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    isConflict ? 'bg-[var(--error)]' : isHeavy ? 'bg-amber-500' : 'bg-[var(--accent)]'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-between text-[11px]">
                {isConflict ? (
                  <span className="text-[var(--error)] flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Conflict ({stat.conflicts})
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" /> conflict-free
                  </span>
                )}

                {isHeavy && !isConflict && (
                  <span className="text-amber-600 dark:text-amber-400 text-[10px] font-mono">
                    ⚠ heavily booked
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LabUtilizationReport;
