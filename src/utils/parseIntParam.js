/**
 * Parse an integer from a request parameter with NaN validation.
 * Returns the parsed integer, or sends a 400 response and returns null.
 */
function parseIntParam(req, res, paramName) {
  const value = parseInt(req.params[paramName], 10);
  if (isNaN(value)) {
    res.status(400).json({ error: { message: `Invalid ${paramName}: must be an integer` } });
    return null;
  }
  return value;
}

module.exports = { parseIntParam };
