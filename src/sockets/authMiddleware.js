import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

// Mirrors verifyToken in your REST middleware: decode the JWT for userId
// only, then fetch the user fresh from the DB for role — matches your
// REST behavior exactly (role is never trusted from the token itself,
// so a role change takes effect immediately without reissuing tokens).
export async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('AUTH_NO_TOKEN'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return next(new Error('AUTH_USER_NOT_FOUND'));

    socket.userId = user.id;
    socket.userRole = user.role;

    next();
  } catch (err) {
    next(new Error('AUTH_INVALID_TOKEN'));
  }
}