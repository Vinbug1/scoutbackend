import {
    createWaitlistEntry,
    getAllWaitlistEntries,
  } from "../services/waitlist.service.js";
  
  export const create = async (req, res) => {
    try {
      const { email, fullname, country, phone, age } = req.body;
  
      // Basic validation
      if (!email || !fullname || !country || !phone || !age) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }
  
      const entry = await createWaitlistEntry({
        email,
        fullname,
        country,
        phone,
        age,
      });
  
      return res.status(201).json({
        success: true,
        message: "Successfully added to the waitlist",
        data: entry,
      });
    } catch (error) {
      console.error("Create waitlist entry error:", error);
  
      if (error.message === "Email is already on the waitlist") {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
  
      return res.status(500).json({
        success: false,
        message: "Failed to add entry to waitlist",
      });
    }
  };
  
  export const getAll = async (req, res) => {
    try {
      const entries = await getAllWaitlistEntries();
  
      return res.status(200).json({
        success: true,
        message: "Waitlist entries retrieved successfully",
        data: entries,
      });
    } catch (error) {
      console.error("Get waitlist entries error:", error);
  
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve waitlist entries",
      });
    }
  };