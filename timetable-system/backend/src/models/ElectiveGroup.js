const mongoose = require('mongoose');

const electiveOptionSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    teacherIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
      },
    ],
    weeklyHours: {
      type: Number,
      default: 3,
    },
  },
  { _id: true }
);

const electiveGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    semester: {
      type: Number,
      required: true,
    },
    sections: [
      {
        type: String,
        trim: true,
      },
    ],
    options: [electiveOptionSchema],
    fixedSlot: {
      day: {
        type: String,
        default: '',
      },
      period: {
        type: Number,
        default: 0,
      },
      isMandatory: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ElectiveGroup', electiveGroupSchema);
