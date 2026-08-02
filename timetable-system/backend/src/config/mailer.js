const nodemailer = require('nodemailer');

let transporter = null;

const createTransporter = (smtpConfig) => {
  transporter = nodemailer.createTransport({
    host: smtpConfig.host || 'smtp.gmail.com',
    port: smtpConfig.port || 587,
    secure: smtpConfig.secure || false,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
};

const getTransporter = () => transporter;

const verifyTransporter = async (smtpConfig) => {
  const t = createTransporter(smtpConfig);
  await t.verify();
  return true;
};

module.exports = {
  createTransporter,
  getTransporter,
  verifyTransporter,
};