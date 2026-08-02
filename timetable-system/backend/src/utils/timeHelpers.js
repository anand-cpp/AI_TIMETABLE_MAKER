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

// Check if consecutive period numbers cross a break
const crossesBreak = (startPeriod, duration, timeline) => {
  const periodNumbers = [];
  for (let i = startPeriod; i < startPeriod + duration; i++) {
    periodNumbers.push(i);
  }

  // Find if any period in the block is a break
  for (const pNum of periodNumbers) {
    const found = timeline.find((t) => t.periodNumber === pNum);
    if (!found) return true; // Period doesn't exist = invalid
    if (found.isBreak) return true; // Crosses break
  }

  // Also check if there's a break between any two consecutive periods in block
  for (let i = 0; i < periodNumbers.length - 1; i++) {
    const current = periodNumbers[i];
    const next = periodNumbers[i + 1];
    // Check if any break period sits between current and next
    const inBetween = timeline.filter(
      (t) => t.periodNumber > current && t.periodNumber < next && t.isBreak
    );
    if (inBetween.length > 0) return true;
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