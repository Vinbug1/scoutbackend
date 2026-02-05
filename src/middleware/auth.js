import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB to get the role
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.user = {
      id: user.id,
      role: user.role, // ⬅️ Very important: set the role here
      email: user.email, // optional
      name: user.name, // optional
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// middleware/auth.js
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    try {
      // Assuming `req.user` was already set by verifyToken
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${roles.join(', ')}`,
        });
      }
      next(); // User has the right role -> continue
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Authorization error",
      });
    }
  };
};
