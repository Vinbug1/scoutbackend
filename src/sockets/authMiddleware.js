import jwt from 'jsonwebtoken';

// Runs once per socket connection, before any handler is registered
// (spec §5.1/§13.1: "Auth middleware verifying JWT on socket handshake").
//
// ⚠️ VINCENT — verify this against your actual REST authMiddleware. Past
// sessions on this codebase hit a recurring bug where JWT payloads were
// read inconsistently as `req.user.id` in some controllers and
// `req.user.userId` in others. This checks both (`payload.id ??
// payload.userId`) so it doesn't matter which your token issuer uses —
// but confirm that's actually the right field, not just a guess that
// happens not to crash. Every socket handler downstream assumes
// `socket.user.id` is a valid integer user id; if this is wrong, every
// service call fails with a confusing 403 (membership lookups silently
// resolve to "not a member") instead of an auth error.
export default function authMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id ?? payload.userId;
    if (!id) {
      return next(new Error('Invalid token payload'));
    }

    socket.user = { id: parseInt(id), role: payload.role };
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
}