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

// Check if consecutive period numbers cross a break.
// NOTE: the timeline array order is the source of truth (break entries may use
// any periodNumber, e.g. 0), so this validates contiguity by position, not just
// by numeric adjacency — otherwise a break sitting between P3 and P4 is missed.
const crossesBreak = (startPeriod, duration, timeline) => {
  if (!Array.isArray(timeline) || timeline.length === 0) return false;

  const indices = [];
  for (let i = 0; i < duration; i++) {
    const pNum = startPeriod + i;
    const idx = timeline.findIndex((t) => t.periodNumber === pNum && !t.isBreak);
    if (idx === -1) return true; // Period missing or is itself a break = invalid
    indices.push(idx);
  }

  const sorted = [...indices].sort((a, b) => a - b);

  // Teaching periods of the block must be physically adjacent in the timeline.
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return true;
  }

  // No break entry may sit between the first and last period of the block.
  for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
    if (timeline[i] && timeline[i].isBreak) return true;
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