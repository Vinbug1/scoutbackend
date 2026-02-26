import prisma from '../lib/prisma.js';
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from '../config/nodemailer.js';

// Define valid roles based on your Prisma schema
const VALID_ROLES = ['PLAYER', 'SCOUT', 'ADMIN'];

// ===========================
// OTP GENERATOR HELPER
// ===========================
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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
      
      // // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      


        // Generate OTP + expiry
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            fullname,
            role: roleUpper,
            otp,
            otpExpiry,
            isVerified: false,
          },
          select: {
            id: true,
            email: true,
            fullname: true,
            role: true,
            createdAt: true,
          }
        });


      // 👇 Send OTP using your existing sendEmail utility
      await sendEmail({
        to: email,
        subject: "Verify Your Account",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">Welcome, ${fullname}! 👋</h2>
            <p style="color: #555;">Use the code below to verify your account. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; text-align: center; padding: 16px 0;">
              ${otp}
            </div>
            <p style="color: #999; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
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
  // VERIFY OTP
  // ===========================
  async verifyOTP(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, otp: true, otpExpiry: true, isVerified: true }
      });

      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.isVerified) {
        return res.status(400).json({ message: "Account is already verified" });
      }

      if (user.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      if (new Date() > new Date(user.otpExpiry)) {
        return res.status(400).json({ message: "OTP has expired. Please request a new one." });
      }

      await prisma.user.update({
        where: { email },
        data: { isVerified: true, otp: null, otpExpiry: null }
      });

      res.status(200).json({ message: "Account verified successfully!" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // RESEND OTP
  // ===========================
  async resendOTP(req, res) {
    try {
      const { email } = req.body;

      if (!email) return res.status(400).json({ message: "Email is required" });

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.isVerified) {
        return res.status(400).json({ message: "Account is already verified" });
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.user.update({
        where: { email },
        data: { otp, otpExpiry }
      });

      // 👇 Send new OTP using your existing sendEmail utility
      await sendEmail({
        to: email,
        subject: "Your New Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">New Verification Code</h2>
            <p style="color: #555;">Here is your new code. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; text-align: center; padding: 16px 0;">
              ${otp}
            </div>
            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      res.status(200).json({ message: "A new OTP has been sent to your email." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },


  // ===========================
  // FORGOT PASSWORD
  // ===========================
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      // Don't reveal whether the email exists or not (security best practice)
      if (!user) {
        return res.status(200).json({ 
          message: "If this email exists, a reset code has been sent." 
        });
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await prisma.user.update({
        where: { email },
        data: { otp, otpExpiry }
      });

      await sendEmail({
        to: email,
        subject: "Password Reset Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="color: #555;">Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; text-align: center; padding: 16px 0;">
              ${otp}
            </div>
            <p style="color: #999; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        `,
      });

      res.status(200).json({ 
        message: "If this email exists, a reset code has been sent." 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // VERIFY RESET OTP
  // ===========================
  async verifyResetOTP(req, res) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, otp: true, otpExpiry: true }
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      if (new Date() > new Date(user.otpExpiry)) {
        return res.status(400).json({ message: "OTP has expired. Please request a new one." });
      }

      // Generate a short-lived reset token valid for 15 minutes
      const resetToken = jwt.sign(
        { email, purpose: 'password-reset' },
        process.env.JWT_SECRET || 'your-secret-key-change-this',
        { expiresIn: '15m' }
      );

      // Clear OTP after successful verification
      await prisma.user.update({
        where: { email },
        data: { otp: null, otpExpiry: null }
      });

      res.status(200).json({ 
        message: "OTP verified. Use the reset token to set a new password.",
        resetToken  // frontend will send this back with the new password
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // RESET PASSWORD
  // ===========================
  async resetPassword(req, res) {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return res.status(400).json({ message: "Reset token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Verify the reset token
      let decoded;
      try {
        decoded = jwt.verify(
          resetToken, 
          process.env.JWT_SECRET || 'your-secret-key-change-this'
        );
      } catch (err) {
        return res.status(401).json({ message: "Invalid or expired reset token. Please start over." });
      }

      // Ensure token was specifically issued for password reset
      if (decoded.purpose !== 'password-reset') {
        return res.status(401).json({ message: "Invalid reset token" });
      }

      const user = await prisma.user.findUnique({ where: { email: decoded.email } });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { email: decoded.email },
        data: { password: hashedPassword }
      });

      // Send confirmation email
      await sendEmail({
        to: decoded.email,
        subject: "Password Changed Successfully",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">Password Updated ✅</h2>
            <p style="color: #555;">Your password has been changed successfully. If you did not make this change, please contact support immediately.</p>
          </div>
        `,
      });

      res.status(200).json({ message: "Password reset successfully. You can now log in." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  },

  // ===========================
  // UPDATE PASSWORD (Logged in)
  // ===========================
  async updatePassword(req, res) {
    try {
      const userId = req.user.userId; // set by auth middleware
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true, email: true, fullname: true }
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Prevent reusing the same password
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({ message: "New password must be different from current password" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      // Notify user of password change
      await sendEmail({
        to: user.email,
        subject: "Password Changed Successfully",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">Hi ${user.fullname},</h2>
            <p style="color: #555;">Your password was just changed. If this wasn't you, please contact support immediately.</p>
          </div>
        `,
      });

      res.status(200).json({ message: "Password updated successfully." });
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
  // async createUser(req, res) {
  //   try {
  //     const { email, password, fullname, role } = req.body;
      
  //     // Check for duplicates
  //     const existing = await prisma.user.findUnique({ where: { email } });
  //     if (existing) {
  //       return res.status(400).json({ message: "Email already in use" });
  //     }
      
  //     // Validate and normalize role
  //     const roleUpper = role?.toUpperCase() || 'PLAYER';
  //     if (!VALID_ROLES.includes(roleUpper)) {
  //       return res.status(400).json({ 
  //         message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` 
  //       });
  //     }
      
  //     // Hash password
  //     const hashedPassword = await bcrypt.hash(password, 10);
      
  //     const user = await prisma.user.create({
  //       data: {
  //         email,
  //         password: hashedPassword,
  //         fullname,
  //         role: roleUpper,
  //       },
  //       select: {
  //         id: true,
  //         email: true,
  //         fullname: true,
  //         role: true,
  //         createdAt: true,
  //       }
  //     });
      
  //     res.status(201).json(user);
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ message: "Server error" });
  //   }
  // },

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