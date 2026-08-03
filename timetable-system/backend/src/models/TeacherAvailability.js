const mongoose = require('mongoose');

const teacherAvailabilitySchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    unavailability: [
      {
        day: { type: String, required: true },
        period: { type: Number, required: true },
      },
    ],
    source: {
      type: String,
      enum: ['manual', 'ocr', 'imported'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeacherAvailability', teacherAvailabilitySchema);
