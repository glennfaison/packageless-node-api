const db = require("../db");
const helpers = require("../helpers");
const config = require("../config");

const checkController = {};
/**
 * Required: protocol, url, method, successCodes, timeoutSeconds
 * Optional: none
 * @param {*} req
 * @param {*} res
 * @returns
 */
checkController.post = async (req, res) => {
  // Validate the inputs
  const protocol = req.body.protocol && ["https", "http"].includes(req.body.protocol.trim().toLowerCase()) ? req.body.protocol.trim() : undefined;
  const url = req.body.url && req.body.url.trim().length > 0 ? req.body.url.trim() : undefined;
  const method = req.body.method && ["get", "post", "put", "delete"].includes(req.body.method.trim().toLowerCase()) ? req.body.method.trim() : undefined;
  const successCodes = Array.isArray(req.body.successCodes) && req.body.successCodes.length > 0 ? req.body.successCodes : undefined;
  let timeoutSeconds = Number(req.body.timeoutSeconds);
  timeoutSeconds = Math.floor(timeoutSeconds) === timeoutSeconds && timeoutSeconds >= 1 && timeoutSeconds <= 5 ? timeoutSeconds : null;

  // Stop the function if the right inputs are not provided
  if (!protocol || !url || !method || !successCodes || !timeoutSeconds) {
    return res.json({ error: `Missing or invalid required fields` }, 400);
  }
  // Get token from the headers
  const tokenId = req.headers.token || null;
  const token = await db.read("tokens", tokenId).catch(e => res.json({}, 403));
  // Get the related user
  const user = await db.read("users", token.phone).catch(e => res.json({}, 403));
  const userChecks = user.checks || [];
  // Verify that this user has less than the max number of `checks`
  if (userChecks.length >= config.maxChecks) {
    return res.json({ error: `User already has the maximum number of checks (${config.maxChecks})` }, 403);
  }
  // Create a random id for the check
  const checkId = helpers.createRandomString(20);
  // Create a new check
  const check = {
    id: checkId,
    userPhone: user.phone,
    protocol, url, method, successCodes, timeoutSeconds
  };
  await db.create("checks", checkId, check)
    .catch(e => res.json({ error: `Could not create new check` }, 500));
  // Add the checkId to the user object
  userChecks.push(checkId);
  user.checks = userChecks;
  await db.update("users", token.phone, user)
    .catch(e => res.json({ error: `Could not update user with new check` }, 500));
  return res.json(check, 200);
};

/**
 * Fetch a @Check
 * @required id
 * @optional none
 * @param {*} req
 * @param {*} res
 */
checkController.get = async (req, res) => {
  // Check that the id is valid
  const id = req.query.id && req.query.id.trim().length === 20 ? req.query.id.trim() : null;
  if (!id) { return res.json({ error: `Missing required field` }, 400); }
  // Lookup the check
  const check = await db.read("checks", id)
    .catch(e => res.json({ error: `Could not read check data` }, 404));
  const tokenId = req.headers.token || null;
  const authorized = await helpers.verifyToken(tokenId, check.userPhone).catch();
  if (!authorized) { return res.json({ error: `Missing or invalid token` }, 403); }
  return res.json(check, 200);
};

/**
 * Update a @Check object.
 * @required id
 * @optional protocol, url, method, successCodes, timeoutSeconds (one must be sent)
 * @param {*} req
 * @param {*} res
 */
checkController.put = async (req, res) => {
  const id = req.query.id && req.query.id.trim().length === 20 ? req.query.id.toString().trim() : null;

  const protocol = req.body.protocol && ["https", "http"].includes(req.body.protocol.trim().toLowerCase()) ? req.body.protocol.trim() : undefined;
  const url = req.body.url && req.body.url.trim().length > 0 ? req.body.url.trim() : undefined;
  const method = req.body.method && ["get", "post", "put", "delete"].includes(req.body.method.trim().toLowerCase()) ? req.body.method.trim() : undefined;
  const successCodes = Array.isArray(req.body.successCodes) && req.body.successCodes.length > 0 ? req.body.successCodes : undefined;
  let timeoutSeconds = Number(req.body.timeoutSeconds);
  timeoutSeconds = Math.floor(timeoutSeconds) === timeoutSeconds && timeoutSeconds >= 1 && timeoutSeconds <= 5 ? timeoutSeconds : null;

  // Check that the id field is valid
  if (!id) { return res.json({ error: `Missing required field` }, 400); }
  // Make sure at least one of the other fields is sent
  if (!protocol && !url && !method && !successCodes && !timeoutSeconds) { return res.json({ error: `Missing fields to update` }, 400); }
  const check = await db.read("checks", id)
    .catch(e => res.json({ error: `check ID did not exist` }, 400));
};

/**
 * Delete a @Token object.
 * @required id
 * @optional none
 * @param {*} req
 * @param {*} res
 */
checkController.delete = async (req, res) => {
  const id = req.query.id ? req.query.id.toString().trim() : null;
  if (!id) { return res.json({ error: `Missing required field` }, 400); }
  const token = await db.read("tokens", id);
  if (!token) { return res.json({ error: "Could not find the specified token" }, 404); }
  await db.delete("tokens", id)
    .catch(e => res.json({ error: "Error while deleting the token." }, 500));
  return res.json({}, 200);
};

checkController.verifyToken = async (tokenId, phone) => {
  let token = await db.read("tokens", tokenId);
  if (!token) { return false; }
  // Check that the token belongs to the user, and is not expired
  if (token.phone !== phone || token.expires < Date.now()) { return false; }
  return true;
};

module.exports = checkController;
