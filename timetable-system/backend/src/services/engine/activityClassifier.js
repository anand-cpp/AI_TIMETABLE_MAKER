/**
 * Centralized Authoritative Activity Classification Engine
 * 
 * Defines explicit academic activity categories, defensible classification rules,
 * and conservative policies for fatigue analysis and timetable optimization.
 * 
 * At minimum distinguishes:
 * - THEORY: Traditional classroom lecture/discussion courses.
 * - PRACTICAL: Hands-on technical sessions and hardware workshops.
 * - LAB: Authorized department software/hardware laboratory blocks.
 * - PROJECT: Capstone project (CST416/CSD416) and Mini project (PCCSP608).
 * - VIVA: Comprehensive course oral evaluations (CST404).
 * - PLACEMENT: Career preparation, aptitude, and recruitment training.
 * - TUTORIAL: Dedicated problem-solving and recitation sessions.
 * - OTHER: Seminars, mentoring, library, and value-added sessions.
 * - UNKNOWN: Unrecognized or malformed activities requiring explicit review.
 */

const ACTIVITY_TYPES = Object.freeze({
  THEORY: 'THEORY',
  PRACTICAL: 'PRACTICAL',
  LAB: 'LAB',
  PROJECT: 'PROJECT',
  VIVA: 'VIVA',
  PLACEMENT: 'PLACEMENT',
  TUTORIAL: 'TUTORIAL',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Authoritatively classifies any scheduled slot into an explicit activity category.
 * 
 * @param {Object} slot - Timetable slot object
 * @returns {Object|null} Classification result or null if empty/break
 */
function classifyActivity(slot) {
  if (!slot || slot.isEmpty || slot.isBreak) {
    return null;
  }

  const code = (slot.subjectCode || '').toUpperCase().trim();
  const name = (slot.subjectName || '').toLowerCase().trim();
  const subType = (slot.subjectType || '').toLowerCase().trim();

  // If slot has literally no identification at all
  if (!code && !name && !slot.subjectId) {
    return {
      type: ACTIVITY_TYPES.UNKNOWN,
      isInstitutionalBlock: false,
      isOrdinaryTheory: false,
      isExemptFromFatigue: false,
      requiresReview: true,
      reason: 'Empty slot identification metadata',
    };
  }

  // 1. VIVA: Oral evaluation blocks (e.g. CST404 Comprehensive Course Viva)
  if (code === 'CST404' || name.includes('viva') || name.includes('comprehensive course viva')) {
    return {
      type: ACTIVITY_TYPES.VIVA,
      isInstitutionalBlock: true,
      isOrdinaryTheory: false,
      isExemptFromFatigue: true,
      requiresReview: false,
      reason: 'Oral comprehensive examination/viva block',
    };
  }

  // 2. PROJECT: Capstone projects & Mini projects
  if (
    code === 'CST416' ||
    code === 'CSD416' ||
    code === 'PCCSP608' ||
    name.includes('project phase') ||
    name.includes('mini project') ||
    name.includes('capstone project')
  ) {
    return {
      type: ACTIVITY_TYPES.PROJECT,
      isInstitutionalBlock: true,
      isOrdinaryTheory: false,
      isExemptFromFatigue: true,
      requiresReview: false,
      reason: 'Authorized institutional project or capstone research block',
    };
  }

  // 3. PLACEMENT: Training, placement hours, and campus readiness
  if (
    code.startsWith('PLACE') ||
    code.includes('PLACEMENT') ||
    name.includes('placement') ||
    subType === 'placement'
  ) {
    return {
      type: ACTIVITY_TYPES.PLACEMENT,
      isInstitutionalBlock: false,
      isOrdinaryTheory: false,
      isExemptFromFatigue: true,
      requiresReview: false,
      reason: 'Career placement, aptitude, and recruitment training session',
    };
  }

  // 4. TUTORIAL: Dedicated recitation/problem sessions
  if (
    code.endsWith('-T') ||
    code.includes('TUTORIAL') ||
    name.includes('tutorial') ||
    subType === 'tutorial'
  ) {
    return {
      type: ACTIVITY_TYPES.TUTORIAL,
      isInstitutionalBlock: false,
      isOrdinaryTheory: false,
      isExemptFromFatigue: true,
      requiresReview: false,
      reason: 'Dedicated tutorial / recitation session',
    };
  }

  // 5. WORKSHOP / PRACTICAL: Hands-on workshop courses
  if (
    code === 'GXESL208' ||
    name.includes('workshop') ||
    code.includes('WORKSHOP') ||
    name.includes('practical') ||
    subType === 'practical'
  ) {
    return {
      type: ACTIVITY_TYPES.PRACTICAL,
      isInstitutionalBlock: true,
      isOrdinaryTheory: false,
      isExemptFromFatigue: true,
      requiresReview: false,
      reason: 'Hands-on practical engineering workshop session',
    };
  }

  // 6. LAB: Laboratory practical courses (PCCSL, ESL, CSL, -P suffix, lab naming)
  if (
    code === 'PCCSL407' ||
    code === 'PCCSL408' ||
    code === 'PCCSL607' ||
    code === 'GXEST204-P' ||
    code.includes('CSL') ||
    code.includes('ESL') ||
    code.endsWith('-P') ||
    name.includes('lab') ||
    name.includes('laboratory') ||
    slot.isLabBlock === true ||
    subType === 'lab'
  ) {
    return {
      type: ACTIVITY_TYPES.LAB,
      isInstitutionalBlock: true,
      isOrdinaryTheory: false,
      isExemptFromFatigue: true,
      requiresReview: false,
      reason: 'Authorized laboratory practical session',
    };
  }

  // 7. OTHER: Seminars, mentoring, library, sports, value-added
  if (
    name.includes('seminar') ||
    name.includes('library') ||
    name.includes('mentoring') ||
    name.includes('sports') ||
    subType === 'seminar' ||
    subType === 'other'
  ) {
    return {
      type: ACTIVITY_TYPES.OTHER,
      isInstitutionalBlock: false,
      isOrdinaryTheory: false,
      isExemptFromFatigue: true,
      requiresReview: false,
      reason: 'Co-curricular or institutional value-added activity',
    };
  }

  // 8. THEORY: Core lecture & elective courses
  // Explicit guard: PBCST404 (Computer Org) is pure theory
  const isRecognizedTheoryPrefix =
    code === 'PBCST404' ||
    code.startsWith('CST') ||
    code.startsWith('PCCST') ||
    code.startsWith('PBCST') ||
    code.startsWith('GAMAT') ||
    code.startsWith('GAPHT') ||
    code.startsWith('GXEST') ||
    code.startsWith('GAEST') ||
    code.startsWith('UCEST') ||
    code.startsWith('UCHWT') ||
    code.startsWith('UCHUT') ||
    code.startsWith('PECST') ||
    code.startsWith('PE-');

  const isConfiguredElectiveOrMinor =
    slot.isElective === true ||
    slot.isMinor === true ||
    subType === 'elective' ||
    subType === 'minor';

  if (isRecognizedTheoryPrefix || isConfiguredElectiveOrMinor) {
    return {
      type: ACTIVITY_TYPES.THEORY,
      isInstitutionalBlock: false,
      isOrdinaryTheory: true,
      isExemptFromFatigue: false,
      requiresReview: false,
      reason: 'Ordinary classroom theory lecture course',
    };
  }

  // 9. UNKNOWN: Unrecognized activity requiring explicit review
  // Conservative Policy:
  // - Not silently treated as an exemption (isExemptFromFatigue = false).
  // - Not silently counted as ordinary theory (isOrdinaryTheory = false).
  // - Flagged with requiresReview = true for diagnostic visibility and administrative audit.
  return {
    type: ACTIVITY_TYPES.UNKNOWN,
    isInstitutionalBlock: false,
    isOrdinaryTheory: false,
    isExemptFromFatigue: false,
    requiresReview: true,
    reason: `Unrecognized academic activity [code: ${code || 'NONE'}, name: ${name || 'NONE'}, type: ${subType || 'NONE'}]`,
  };
}

/**
 * Checks whether an activity is an authorized institutional laboratory, practical, or project block.
 */
function isInstitutionalLabOrProject(slot) {
  const classification = classifyActivity(slot);
  return Boolean(classification && classification.isInstitutionalBlock);
}

/**
 * Checks whether an activity is ordinary classroom theory.
 */
function isOrdinaryTheory(slot) {
  const classification = classifyActivity(slot);
  return Boolean(classification && classification.type === ACTIVITY_TYPES.THEORY);
}

/**
 * Checks whether an activity is placement training.
 */
function isPlacement(slot) {
  const classification = classifyActivity(slot);
  return Boolean(classification && classification.type === ACTIVITY_TYPES.PLACEMENT);
}

/**
 * Checks whether an activity is a tutorial.
 */
function isTutorial(slot) {
  const classification = classifyActivity(slot);
  return Boolean(classification && classification.type === ACTIVITY_TYPES.TUTORIAL);
}

/**
 * Checks whether an activity is unclassified/unknown.
 */
function isUnknownActivity(slot) {
  const classification = classifyActivity(slot);
  return Boolean(classification && classification.type === ACTIVITY_TYPES.UNKNOWN);
}

module.exports = {
  ACTIVITY_TYPES,
  classifyActivity,
  isInstitutionalLabOrProject,
  isOrdinaryTheory,
  isPlacement,
  isTutorial,
  isUnknownActivity,
};
