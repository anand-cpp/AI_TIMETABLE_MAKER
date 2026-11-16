const mongoose = require('mongoose');

// Individual slot entry
const slotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    period: { type: Number, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    subjectName: { type: String, default: '' },
    subjectCode: { type: String, default: '' },
    subjectType: { type: String, enum: ['theory', 'lab', 'elective', 'break', 'empty', 'autofill', 'minor'], default: 'empty' },
    teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    teacherNames: [{ type: String }],
    roomName: { type: String, default: '' },
    allowedLabs: [{ type: String }],
    isLocked: { type: Boolean, default: false },
    isBreak: { type: Boolean, default: false },
    isLabBlock: { type: Boolean, default: false },
    labBlockIndex: { type: Number, default: 0 },
    isBatchSplit: { type: Boolean, default: false },
    batch1: {
      teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
      teacherName: { type: String, default: '' },
      roomName: { type: String, default: '' },
    },
    batch2: {
      teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
      teacherName: { type: String, default: '' },
      roomName: { type: String, default: '' },
    },
    isElective: { type: Boolean, default: false },
    electiveGroupId: { type: String, default: '' },
    isMinor: { type: Boolean, default: false },
    minorGroupId: { type: String, default: '' },
    minorSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    minorSubjectName: { type: String, default: '' },
    minorSubjectCode: { type: String, default: '' },
    isAutoFill: { type: Boolean, default: false },
    autoFillType: { type: String, default: '' },
    icon: { type: String, default: '' },
    notes: { type: String, default: '' },
    isEmpty: { type: Boolean, default: false },
    isOverride: { type: Boolean, default: false },
    overrideType: { type: String, default: '' },
    overrideDetails: { type: String, default: '' },
    isPendingFaculty: { type: Boolean, default: false },
    sharedSessionId: { type: String, default: null },
    isSharedSession: { type: Boolean, default: false },
    isSharedProject: { type: Boolean, default: false },
  },
  { _id: false }
);

// Per-class timetable grid
const classTimetableSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    className: { type: String, default: '' },
    slots: [slotSchema],
  },
  { _id: false }
);

// Edit history entry
const editHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    day: { type: String },
    period: { type: Number },
    targetDay: { type: String, default: null },
    targetPeriod: { type: Number, default: null },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    details: { type: mongoose.Schema.Types.Mixed },
    revision: { type: Number, default: 1 },
    userId: { type: String, default: null },
    editedBy: { type: String, default: 'admin' },
    editedAt: { type: Date, default: Date.now },
    result: { type: String, default: 'success' },
    idempotencyKey: { type: String, default: null },
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    revision: {
      type: Number,
      default: 1,
    },
    appliedIdempotencyKeys: [
      {
        key: { type: String },
        appliedAt: { type: Date, default: Date.now },
      },
    ],
    label: {
      type: String,
      default: '',
      trim: true,
    },
    isAccepted: {
      type: Boolean,
      default: false,
    },
    publicationStatus: {
      type: String,
      enum: ['DRAFT', 'GENERATING', 'VALIDATING', 'VALIDATION_FAILED', 'READY_TO_PUBLISH', 'PUBLISHED'],
      default: 'DRAFT',
    },
    publicationGatePassed: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    validationErrors: { type: mongoose.Schema.Types.Mixed, default: [] },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    qualityScore: {
      overall: { type: Number, default: 0 },
      teacherLoad: { type: Number, default: 0 },
      distribution: { type: Number, default: 0 },
      labPlacement: { type: Number, default: 0 },
      electiveSync: { type: Number, default: 0 },
      travelOptimization: { type: Number, default: 0 },
      teacherGaps: { type: Number, default: 0 },
      studentStress: { type: Number, default: 0 },
      teacherComfort: { type: Number, default: 0 },
      isGated: { type: Boolean, default: false },
      gateReason: { type: String, default: null },
      breakdown: { type: mongoose.Schema.Types.Mixed, default: [] },
      issues: { type: mongoose.Schema.Types.Mixed, default: [] },
    },
    facultyQualityScore: { type: mongoose.Schema.Types.Mixed, default: null },
    facultyOptimization: { type: mongoose.Schema.Types.Mixed, default: null },
    classTimetables: [classTimetableSchema],
    isComplete: { type: Boolean, default: false },
    validationChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    autoFillStats: { type: mongoose.Schema.Types.Mixed, default: {} },
    warnings: [{ type: String }],
    unplacedSubjects: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        subjectName: { type: String },
        subjectType: { type: String },
        classId: { type: String },
        className: { type: String },
        placed: { type: Number },
        expected: { type: Number },
        missing: { type: Number },
        reason: { type: String },
      },
    ],
    permissionRequests: { type: mongoose.Schema.Types.Mixed, default: [] },
    editHistory: [editHistorySchema],
    undoStack: [{ type: mongoose.Schema.Types.Mixed }],
    redoStack: [{ type: mongoose.Schema.Types.Mixed }],
    generationStats: {
      generations: { type: Number, default: 0 },
      seedsTried: { type: Number, default: 0 },
      timeMs: { type: Number, default: 0 },
      hardViolations: { type: Number, default: 0 },
      softViolations: { type: Number, default: 0 },
      subjectsPlaced: { type: String, default: '' },
      emptySlotsCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

timetableSchema.index({ version: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);