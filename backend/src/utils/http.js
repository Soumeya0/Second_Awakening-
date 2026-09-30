// Throw httpError(400, 'message') anywhere in a route; the error handler in server.js turns it into JSON.
export function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}
