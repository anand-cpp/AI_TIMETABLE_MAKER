const mongoose = require('mongoose');

// Individual slot entry
const slotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    period: { type: Number, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    subjectName: { type: String, default: '' },
    subjectCode: { type: String, default: '' },
    subjectType: { type: String, enum: ['theory', 'lab', 'elective', 'break', 'empty', 'autofill'], default: 'empty' },
    teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    teacherNames: [{ type: String }],
    roomName: { type: String, default: '' },
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
    notes: { type: String, default: '' },
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
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    editedBy: { type: String, default: 'admin' },
    editedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const timetableSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
    isAccepted: {
      type: Boolean,
      default: false,
    },
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
    },
    classTimetables: [classTimetableSchema],
    warnings: [{ type: String }],
    unplacedSubjects: [
      {
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        subjectName: { type: String },
        reason: { type: String },
      },
    ],
    editHistory: [editHistorySchema],
    generationStats: {
      generations: { type: Number, default: 0 },
      timeMs: { type: Number, default: 0 },
      hardViolations: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Timetable', timetableSchema);