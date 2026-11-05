// Convert "HH:MM" to total minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

// Convert total minutes to "HH:MM"
const minutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Check if two time ranges overlap
const timesOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && e1 > s2;
};

// Check if period timeline is logically ordered (start before end, no overlaps)
const validateTimeline = (timeline) => {
  const errors = [];

  for (let i = 0; i < timeline.length; i++) {
    const period = timeline[i];

    if (!period.startTime || !period.endTime) {
      errors.push(`Period ${period.periodNumber}: missing start or end time`);
      continue;
    }

    const start = timeToMinutes(period.startTime);
    const end = timeToMinutes(period.endTime);

    if (start >= end) {
      errors.push(
        `Period ${period.periodNumber}: start time must be before end time`
      );
    }

    // Check overlap with next period
    if (i < timeline.length - 1) {
      const next = timeline[i + 1];
      if (next.startTime) {
        const nextStart = timeToMinutes(next.startTime);
        if (end > nextStart) {
          errors.push(
            `Period ${period.periodNumber} overlaps with period ${next.periodNumber}`
          );
        }
      }
    }
  }

  return errors;
};

// Get non-break periods from timeline
const getTeachingPeriods = (timeline) => {
  return timeline.filter((p) => !p.isBreak).map((p) => p.periodNumber);
};

// Check if consecutive period numbers cross a LUNCH break.
// Short breaks (≤20 min) between periods are ALLOWED in lab blocks.
// Only lunch breaks (>20 min) break the lab block continuity.
const crossesBreak = (startPeriod, duration, timeline, options = {}) => {
  if (!Array.isArray(timeline) || timeline.length === 0) return false;
  
  const { maxShortBreakMinutes = 20 } = options;

  const indices = [];
  for (let i = 0; i < duration; i++) {
    const pNum = startPeriod + i;
    const idx = timeline.findIndex((t) => t.periodNumber === pNum && !t.isBreak);
    if (idx === -1) return true; // Period missing or is itself a break = invalid
    indices.push(idx);
  }

  const sorted = [...indices].sort((a, b) => a - b);

  // Teaching periods of the block must be physically adjacent in the timeline.
  // Allow gaps that are only short breaks (≤ maxShortBreakMinutes)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      // There's a gap - check if it's only short breaks
      const gapStart = sorted[i - 1] + 1;
      const gapEnd = sorted[i] - 1;
      let onlyShortBreaks = true;
      for (let g = gapStart; g <= gapEnd; g++) {
        if (timeline[g] && timeline[g].isBreak) {
          // Check if this break is short (≤20 min) or lunch
          const breakStart = timeToMinutes(timeline[g].startTime);
          const breakEnd = timeToMinutes(timeline[g].endTime);
          const breakDuration = breakEnd - breakStart;
          if (breakDuration > maxShortBreakMinutes) {
            onlyShortBreaks = false;
            break;
          }
        } else if (timeline[g] && !timeline[g].isBreak) {
          // There's a teaching period in the gap - not contiguous
          onlyShortBreaks = false;
          break;
        }
      }
      if (!onlyShortBreaks) return true;
    }
  }

  // No LUNCH break entry may sit between the first and last period of the block.
  // Short breaks are allowed.
  for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
    if (timeline[i] && timeline[i].isBreak) {
      const breakStart = timeToMinutes(timeline[i].startTime);
      const breakEnd = timeToMinutes(timeline[i].endTime);
      const breakDuration = breakEnd - breakStart;
      if (breakDuration > maxShortBreakMinutes) return true;
    }
  }

  return false;
};

// Get day index (Monday = 0)
const dayIndex = (day) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days.indexOf(day);
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  timesOverlap,
  validateTimeline,
  getTeachingPeriods,
  crossesBreak,
  dayIndex,
};