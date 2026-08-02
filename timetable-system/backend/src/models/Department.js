const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    building: {
      type: String,
      trim: true,
      default: '',
    },
    floor: {
      type: String,
      trim: true,
      default: '',
    },
    travelOptimization: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Case-insensitive name index
departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Department', departmentSchema);