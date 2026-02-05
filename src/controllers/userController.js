import prisma from '../lib/prisma.js';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Define valid roles based on your Prisma schema
const VALID_ROLES = ['PLAYER', 'SCOUT', 'ADMIN'];

const UserController = {
  // ===========================
  // REGISTER USER
  // ===========================
  async register(req, res) {
    try {
      const { email, password, fullname, role } = req.body;

      // Validate required fields
      if (!email || !password || !fullname) {
        return res.status(400).json({ 
          message: "Email, password, and fullname are required" 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Validate password strength (min 6 characters)
      if (password.length < 6) {
        return res.status(400).json({ 
          message: "Password must be at least 6 characters long" 
        });
      }
      
      // Check for duplicates
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }
      
      // Validate and normalize role
      const roleUpper = role?.toUpperCase() || 'PLAYER';
      if (!VALID_ROLES.includes(roleUpper)) {
        return res.status(400).json({ 
          message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
        });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          fullname,
          role: roleUpper,
        },
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          createdAt: true,
          // Don't return password
        }
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key-change-this',
        { expiresIn: '7d' }
      );
      
      res.status(201).json({ 
        message: "Registration successful",
        user,
        token 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // LOGIN USER
  // ===========================
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ 
          message: "Email and password are required" 
        });
      }

      // Find user by email
      const user = await prisma.user.findUnique({ 
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          fullname: true,
          role: true,
          createdAt: true,
        }
      });

      if (!user) {
        return res.status(401).json({ 
          message: "Invalid email or password" 
        });
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          message: "Invalid email or password" 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key-change-this',
        { expiresIn: '7d' }
      );

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.status(200).json({ 
        message: "Login successful",
        user: userWithoutPassword,
        token 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // GET CURRENT USER (ME)
  // ===========================
  async getCurrentUser(req, res) {
    try {
      // req.user is set by auth middleware
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          createdAt: true,
          profile: true,
        }
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // CREATE USER (Admin only)
  // ===========================
  async createUser(req, res) {
    try {
      const { email, password, fullname, role } = req.body;
      
      // Check for duplicates
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }
      
      // Validate and normalize role
      const roleUpper = role?.toUpperCase() || 'PLAYER';
      if (!VALID_ROLES.includes(roleUpper)) {
        return res.status(400).json({ 
          message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
        });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          fullname,
          role: roleUpper,
        },
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          createdAt: true,
        }
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // GET ALL USERS
  // ===========================
  async getUsers(req, res) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          createdAt: true,
          profile: true,
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
              videos: true,
            }
          }
        },
      });
      res.status(200).json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // GET SINGLE USER
  // ===========================
  async getUserById(req, res) {
    try {
      const id = parseInt(req.params.id);
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          createdAt: true,
          profile: true,
          videos: true,
          posts: true,
          _count: {
            select: {
              followers: true,
              following: true,
              videos: true,
              posts: true,
              comments: true,
            }
          }
        },
      });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // UPDATE USER
  // ===========================
  async updateUser(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { email, password, fullname, role } = req.body;
      
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Validate role if provided
      if (role) {
        const roleUpper = role.toUpperCase();
        if (!VALID_ROLES.includes(roleUpper)) {
          return res.status(400).json({ 
            message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
          });
        }
      }
      
      let hashedPassword = user.password;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }
      
      const updated = await prisma.user.update({
        where: { id },
        data: {
          email: email ?? user.email,
          password: hashedPassword,
          fullname: fullname ?? user.fullname,
          role: role ? role.toUpperCase() : user.role,
        },
        select: {
          id: true,
          email: true,
          fullname: true,
          role: true,
          createdAt: true,
        }
      });
      
      res.status(200).json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // DELETE USER
  // ===========================
  async deleteUser(req, res) {
    try {
      const id = parseInt(req.params.id);
      
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      await prisma.user.delete({ where: { id } });
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },
};

export default UserController;