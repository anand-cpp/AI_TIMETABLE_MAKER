const sendSuccess = (res, statusCode = 200, data = {}, message = 'Success') => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendError = (res, statusCode = 500, message = 'Internal server error', data = undefined) => {
  const payload = { success: false, message };
  if (data !== undefined) payload.data = data;
  return res.status(statusCode).json(payload);
};

const sendPaginated = (res, data, total, page, limit) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
};

module.exports = { sendSuccess, sendError, sendPaginated };