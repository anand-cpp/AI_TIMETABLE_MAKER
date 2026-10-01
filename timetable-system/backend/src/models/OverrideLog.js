const mongoose = require('mongoose');

const overrideLogSchema = new mongoose.Schema(
  {
    timetableVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', default: null },
    requestType: {
      type: String,
      enum: ['TEACHER_OVERTIME', 'LAB_ROOM_CONFLICT', 'CONSECUTIVE_SPLIT', 'CROSS_DEPT_EXTENSION', 'GENERAL_OVERRIDE'],
      required: true,
    },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    teacherName: { type: String, default: '' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', default: null },
    subjectName: { type: String, default: '' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    className: { type: String, default: '' },
    issueDescription: { type: String, required: true },
    selectedOption: { type: String, required: true },
    impact: { type: String, default: '' },
    status: { type: String, enum: ['APPROVED', 'REJECTED', 'SKIPPED', 'REVERTED'], default: 'APPROVED' },
    adminNotes: { type: String, default: '' },
    approvedBy: { type: String, default: 'Admin' },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OverrideLog', overrideLogSchema);
