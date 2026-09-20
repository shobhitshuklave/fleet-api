const jwt = require("jsonwebtoken");

/**
 * Optional middleware to protect routes with the JWT issued by
 * POST /api/auth/login. Not wired up to any route by default —
 * add it to a router (e.g. `router.use(requireAuth)`) wherever
 * you want to require a logged-in user.
 *
 * Expects: Authorization: Bearer <token>
 * On success, sets req.userId to the authenticated user's id.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = requireAuth;