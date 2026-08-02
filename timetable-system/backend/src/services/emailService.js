const nodemailer = require('nodemailer');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');

/**
 * Email Service
 * Sends timetable emails to teachers, HODs, class reps
 * Per-recipient status returned
 * SMTP failure for one recipient does NOT stop others
 */

// ── Build transporter from config ──────────────────────────────────────────────
const buildTransporter = (smtpConfig) => {
  return nodemailer.createTransport({
    host: smtpConfig.host || 'smtp.gmail.com',
    port: smtpConfig.port || 587,
    secure: smtpConfig.secure || false,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    tls: { rejectUnauthorized: false },
  });
};

// ── Build teacher timetable HTML ───────────────────────────────────────────────
const buildTeacherTimetableHtml = (teacher, slots, timetable) => {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Group slots by day
  const byDay = {};
  for (const day of dayOrder) byDay[day] = [];
  for (const slot of slots) {
    if (byDay[slot.day]) byDay[slot.day].push(slot);
  }

  let rows = '';
  for (const day of dayOrder) {
    const daySlots = byDay[day].sort((a, b) => a.period - b.period);
    if (daySlots.length === 0) {
      rows += `<tr><td>${day}</td><td colspan="3" style="text-align:center;color:#999;">No classes</td></tr>`;
    } else {
      for (const slot of daySlots) {
        rows += `
          <tr>
            <td>${day}</td>
            <td>Period ${slot.period}</td>
            <td>${slot.subjectName} (${slot.subjectCode})</td>
            <td>${slot.className}</td>
          </tr>`;
      }
    }
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Your Timetable — ${new Date(timetable.acceptedAt || timetable.generatedAt).toLocaleDateString()}</h2>
      <p>Dear <strong>${teacher.name}</strong>,</p>
      <p>Please find your timetable for the current semester below.</p>
      <table style="width:100%; border-collapse:collapse; margin-top:16px;">
        <thead>
          <tr style="background:#2563eb; color:white;">
            <th style="padding:8px; text-align:left;">Day</th>
            <th style="padding:8px; text-align:left;">Period</th>
            <th style="padding:8px; text-align:left;">Subject</th>
            <th style="padding:8px; text-align:left;">Class</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin-top:24px; color:#666; font-size:12px;">
        This is an automated email from the Timetable Management System.
      </p>
    </div>
  `;
};

// ── Build class timetable HTML ─────────────────────────────────────────────────
const buildClassTimetableHtml = (cls, classTimetable, timetable, recipientLabel) => {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Group by day
  const byDay = {};
  for (const day of dayOrder) byDay[day] = [];
  for (const slot of classTimetable.slots || []) {
    if (!slot.isBreak && !slot.isEmpty && byDay[slot.day]) {
      byDay[slot.day].push(slot);
    }
  }

  let rows = '';
  for (const day of dayOrder) {
    const daySlots = byDay[day].sort((a, b) => a.period - b.period);
    if (daySlots.length === 0) {
      rows += `<tr><td>${day}</td><td colspan="3" style="text-align:center;color:#999;">No classes</td></tr>`;
    } else {
      for (const slot of daySlots) {
        rows += `
          <tr>
            <td>${day}</td>
            <td>Period ${slot.period}</td>
            <td>${slot.subjectName} (${slot.subjectCode})</td>
            <td>${slot.teacherNames?.join(', ') || ''}</td>
          </tr>`;
      }
    }
  }

  const deptName = cls.departmentId?.name || '';
  const className = `${deptName} Semester ${cls.semester} Section ${cls.section}`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Class Timetable — ${className}</h2>
      <p>Dear ${recipientLabel},</p>
      <p>The timetable for <strong>${className}</strong> has been finalized.</p>
      <table style="width:100%; border-collapse:collapse; margin-top:16px;">
        <thead>
          <tr style="background:#2563eb; color:white;">
            <th style="padding:8px; text-align:left;">Day</th>
            <th style="padding:8px; text-align:left;">Period</th>
            <th style="padding:8px; text-align:left;">Subject</th>
            <th style="padding:8px; text-align:left;">Teacher</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p style="margin-top:24px; color:#666; font-size:12px;">
        This is an automated email from the Timetable Management System.
      </p>
    </div>
  `;
};

// ── Send single email with error isolation ─────────────────────────────────────
const sendSingleEmail = async (transporter, mailOptions) => {
  try {
    await transporter.sendMail(mailOptions);
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
};

// ── Main send function ─────────────────────────────────────────────────────────
const sendTimetableEmails = async (timetable, emailConfig, recipients) => {
  const results = {
    teachers: [],
    hods: [],
    classReps: [],
    summary: { sent: 0, failed: 0, skipped: 0 },
  };

  const transporter = buildTransporter(emailConfig.smtpConfig);
  const fromAddress = `"${emailConfig.smtpConfig.fromName || 'Timetable System'}" <${emailConfig.smtpConfig.fromEmail || emailConfig.smtpConfig.user}>`;

  // ── Send to Teachers ───────────────────────────────────────────────────────
  if (recipients.teachers) {
    const teachers = await Teacher.find({ isActive: true }).select('name email username');

    for (const teacher of teachers) {
      if (!teacher.email || !teacher.email.trim()) {
        results.teachers.push({
          name: teacher.name,
          email: '',
          status: 'skipped',
          reason: 'No email address configured',
        });
        results.summary.skipped++;
        continue;
      }

      // Extract teacher's slots from timetable
      const teacherSlots = [];
      for (const classTT of timetable.classTimetables || []) {
        for (const slot of classTT.slots || []) {
          if (slot.isBreak || slot.isEmpty) continue;
          const teacherIds = (slot.teacherIds || []).map((id) => id.toString());
          if (teacherIds.includes(teacher._id.toString())) {
            teacherSlots.push({ ...slot, className: classTT.className });
          }
        }
      }

      const html = buildTeacherTimetableHtml(teacher, teacherSlots, timetable);

      const result = await sendSingleEmail(transporter, {
        from: fromAddress,
        to: teacher.email,
        subject: 'Your Timetable — New Schedule Published',
        html,
      });

      results.teachers.push({
        name: teacher.name,
        email: teacher.email,
        ...result,
      });

      if (result.status === 'sent') results.summary.sent++;
      else results.summary.failed++;
    }
  }

  // ── Send to HODs and Class Reps ────────────────────────────────────────────
  if (recipients.hods || recipients.classReps) {
    const classes = await Class.find().populate('departmentId', 'name code');

    for (const cls of classes) {
      const classTT = (timetable.classTimetables || []).find(
        (ct) => ct.classId.toString() === cls._id.toString()
      );

      if (!classTT) continue;

      // HOD email
      if (recipients.hods) {
        if (!cls.hodEmail || !cls.hodEmail.trim()) {
          results.hods.push({
            class: `${cls.departmentId?.code} S${cls.semester}${cls.section}`,
            email: '',
            status: 'skipped',
            reason: 'No HOD email configured for this class',
          });
          results.summary.skipped++;
        } else {
          const html = buildClassTimetableHtml(cls, classTT, timetable, 'HOD');
          const result = await sendSingleEmail(transporter, {
            from: fromAddress,
            to: cls.hodEmail,
            subject: `Timetable Published — ${cls.departmentId?.name} S${cls.semester}${cls.section}`,
            html,
          });

          results.hods.push({
            class: `${cls.departmentId?.code} S${cls.semester}${cls.section}`,
            email: cls.hodEmail,
            ...result,
          });

          if (result.status === 'sent') results.summary.sent++;
          else results.summary.failed++;
        }
      }

      // Class Rep email
      if (recipients.classReps) {
        if (!cls.classRepEmail || !cls.classRepEmail.trim()) {
          results.classReps.push({
            class: `${cls.departmentId?.code} S${cls.semester}${cls.section}`,
            email: '',
            status: 'skipped',
            reason: 'No class rep email configured for this class',
          });
          results.summary.skipped++;
        } else {
          const recipientLabel = cls.classRepName
            ? `${cls.classRepName} (Class Representative)`
            : 'Class Representative';

          const html = buildClassTimetableHtml(cls, classTT, timetable, recipientLabel);
          const result = await sendSingleEmail(transporter, {
            from: fromAddress,
            to: cls.classRepEmail,
            subject: `Your Class Timetable — ${cls.departmentId?.name} S${cls.semester}${cls.section}`,
            html,
          });

          results.classReps.push({
            class: `${cls.departmentId?.code} S${cls.semester}${cls.section}`,
            email: cls.classRepEmail,
            ...result,
          });

          if (result.status === 'sent') results.summary.sent++;
          else results.summary.failed++;
        }
      }
    }
  }

  return results;
};

module.exports = { sendTimetableEmails };