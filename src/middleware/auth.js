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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }, // ✅ fixed: was decoded.id, JWT signs userId not id
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.user = {
      userId: user.id, // ✅ fixed: was id, controllers expect userId
      role: user.role,
      email: user.email,
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${roles.join(', ')}`,
        });
      }
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Authorization error' });
    }
  };
};

