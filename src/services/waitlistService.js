import prisma from "../lib/prisma.js";
import { sendEmail } from "../config/nodemailer.js";
import { waitlistConfirmationEmail } from "../config/Waitlistconfirmationemail.js";

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

      // Fire the confirmation email — don't let a mail failure block
      // the waitlist signup itself.
      const firstName = fullname?.trim().split(/\s+/)[0] || "there";

      try {
        await sendEmail({
          to: email,
          subject: "You're on the waitlist! 🎉",
          html: waitlistConfirmationEmail(firstName),
        });
      } catch (emailError) {
        console.error("Failed to send waitlist confirmation email:", emailError);
      }

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











// import prisma from "../lib/prisma.js";

// const waitlistService = {

//     async  createWaitlistEntry (data) {
//       const { email, fullname, country, phone, age } = data;
    
//       // Check if email already exists
//       const existingEntry = await prisma.waitlistEntry.findUnique({
//         where: { email },
//       });
    
//       if (existingEntry) {
//         throw new Error("Email is already on the waitlist");
//       }
    
//       const waitlistEntry = await prisma.waitlistEntry.create({
//         data: {
//           email,
//           fullname,
//           country,
//           phone,
//           age,
//         },
//       });
    
//       return waitlistEntry;
//     },
    
//     async  getAllWaitlistEntries (){
//       const entries = await prisma.waitlistEntry.findMany({
//         orderBy: {
//           createdAt: "desc",
//         },
//       });
    
//       return entries;
//     },
// };

// export default waitlistService;
