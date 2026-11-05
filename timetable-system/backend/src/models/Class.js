const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    year: {
      type: Number,
      min: 1,
      max: 4,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    roomNumber: {
      type: String,
      trim: true,
      default: '',
    },
    studentCount: {
      type: Number,
      default: 60,
      min: 1,
    },
    strength: {
      type: Number,
      default: 60,
      min: 1,
    },
    classRepName: {
      type: String,
      trim: true,
      default: '',
    },
    classRepEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    hodEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
  },
  { timestamps: true }
);

// Unique constraint: same department + semester + section
classSchema.index(
  { departmentId: 1, semester: 1, section: 1 },
  { unique: true }
);

module.exports = mongoose.model('Class', classSchema);