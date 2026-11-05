const mongoose = require('mongoose');

// Lab details sub-schema
const labDetailsSchema = new mongoose.Schema(
  {
    roomName: { type: String, trim: true, default: '' },
    duration: { type: Number, enum: [2, 3, 4, 6, 12], default: 2 },
    isBatchSplit: { type: Boolean, default: false },
    batch1Teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    batch2Teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    batch1Room: { type: String, trim: true, default: '' },
    batch2Room: { type: String, trim: true, default: '' },
    morningPreference: { type: Boolean, default: false },
  },
  { _id: false }
);

const electiveOptionSchema = new mongoose.Schema(
  {
    optionName: { type: String, trim: true, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    roomName: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const electiveDetailsSchema = new mongoose.Schema(
  {
    electiveType: {
      type: String,
      enum: ['linked', 'open'],
      default: 'linked',
    },
    linkedGroupId: { type: String, trim: true, default: '' },
    linkedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    openElectiveOptions: [electiveOptionSchema],
    participatingClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    electiveGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ElectiveGroup',
      default: null,
    },
    optionIndex: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    type: { type: String, enum: ['theory', 'lab', 'elective'], required: true },
    weeklyHours: { type: Number, min: 1, default: 3 },
    L: { type: Number, min: 0, default: 0 },
    T: { type: Number, min: 0, default: 0 },
    P: { type: Number, min: 0, default: 0 },
    R: { type: Number, min: 0, default: 0 },
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    coInstructors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    labDetails: { type: labDetailsSchema, default: null },
    electiveDetails: { type: electiveDetailsSchema, default: null },
    isElective: { type: Boolean, default: false },
    labRoom: { type: String, trim: true, default: '' },
    // Feature A: Consecutive periods requirement for theory subjects
    requiresConsecutivePeriods: { type: Boolean, default: false },
    consecutivePeriodsCount: { type: Number, min: 1, default: 1 },
    // Feature B: Fixed slot constraints (multiple)
    fixedSlots: [{
      day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', ''], default: '' },
      period: { type: Number, min: 0, max: 10, default: 0 },
      isMandatory: { type: Boolean, default: true },
    }],
    // Shared elective tracking
    isShared: { type: Boolean, default: false },
    sharedWithSection: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', subjectSchema);
