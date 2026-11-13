const mongoose = require('mongoose');

const minorSlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    period: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    subjectCode: {
      type: String,
      trim: true,
      default: '',
    },
    subjectName: {
      type: String,
      trim: true,
      default: '',
    },
    teacherIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
      },
    ],
    teacherNames: [
      {
        type: String,
        trim: true,
      },
    ],
    roomName: {
      type: String,
      trim: true,
      default: '',
    },
    studentGroup: {
      type: String,
      trim: true,
      default: 'All',
    },
    weeklyHours: {
      type: Number,
      default: 1,
    },
  },
  { _id: true }
);

const minorSubjectOptionSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
    },
    subjectCode: { type: String, default: '' },
    subjectName: { type: String, default: '' },
    teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    teacherNames: [{ type: String }],
    weeklyHours: { type: Number, default: 1 },
    studentGroup: { type: String, default: 'All' },
  },
  { _id: true }
);

const subMinorItemSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      default: null,
    },
    subjectCode: { type: String, default: '', trim: true },
    subjectName: { type: String, required: true, trim: true },
    teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    teacherNames: [{ type: String, trim: true }],
    weeklyHours: { type: Number, default: 1 },
    roomName: { type: String, default: 'Classroom', trim: true },
    description: { type: String, default: '' },
  },
  { _id: true }
);

const classConfigSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    className: { type: String, required: true },
    section: { type: String, default: '' },
    subMinors: [subMinorItemSchema],
    allocatedSlots: [minorSlotSchema],
  },
  { _id: true }
);

const fixedMinorSlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    period: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    label: { type: String, default: '' },
  },
  { _id: true }
);

const minorGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'S4 CSE Minor Group',
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    semester: {
      type: Number,
      required: true,
      default: 4,
    },
    sections: [
      {
        type: String,
        trim: true,
      },
    ],
    weeklyHours: {
      type: Number,
      default: 4,
      min: 1,
      max: 6,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    slots: [minorSlotSchema],
    options: [minorSubjectOptionSchema],
    classConfigs: [classConfigSchema],
    fixedSlots: [fixedMinorSlotSchema],
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MinorGroup', minorGroupSchema);
