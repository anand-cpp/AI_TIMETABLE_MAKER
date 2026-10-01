const mongoose = require('mongoose');

// Lab details sub-schema
const labDetailsSchema = new mongoose.Schema(
  {
    roomName: { type: String, trim: true, default: '' },
    duration: { type: Number, enum: [2, 3, 4], default: 2 },
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
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    labDetails: { type: labDetailsSchema, default: null },
    electiveDetails: { type: electiveDetailsSchema, default: null },
    isElective: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', subjectSchema);
