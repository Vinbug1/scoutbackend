import prisma from "../config/prisma.js";

const waitlistService = {

    async  createWaitlistEntry (data) {
      const { email, fullname, country, phone, age } = data;
    
      // Check if email already exists
      const existingEntry = await prisma.waitlistEntry.findUnique({
        where: { email },
      });
    
      if (existingEntry) {
        throw new Error("Email is already on the waitlist");
      }
    
      const waitlistEntry = await prisma.waitlistEntry.create({
        data: {
          email,
          fullname,
          country,
          phone,
          age,
        },
      });
    
      return waitlistEntry;
    },
    
    async  getAllWaitlistEntries (){
      const entries = await prisma.waitlistEntry.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    
      return entries;
    },
};

export default waitlistService;
