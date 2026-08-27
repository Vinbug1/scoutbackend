function waitlistConfirmationEmail(firstName) {
    return `
      <div style="background-color:#0b0e14; padding:32px 16px; font-family: Arial, Helvetica, sans-serif;">
        <div style="max-width:520px; margin:auto; background-color:#10141d; border:1px solid #1f2530; border-radius:12px; padding:32px 28px;">
  
          <div style="text-align:center; margin-bottom:24px;">
            <span style="font-size:22px; font-weight:800; letter-spacing:1px; color:#e8a87c;">SCOUTER</span><span style="font-size:22px; font-weight:800; letter-spacing:1px; color:#3ecfb2;">PRO</span>
          </div>
  
          <div style="text-align:center; margin-bottom:28px;">
            <span style="display:inline-block; border:1px solid #3ecfb2; color:#3ecfb2; font-size:11px; font-weight:600; letter-spacing:1px; padding:8px 16px; border-radius:20px;">
              EARLY ACCESS &middot; LAUNCHING SOON
            </span>
          </div>
  
          <h1 style="color:#f2c9a0; font-size:22px; margin:0 0 20px;">
            Hi ${firstName}, you're on the list! &#9917;
          </h1>
  
          <p style="color:#c7ccd6; font-size:15px; line-height:1.6; margin:0 0 16px;">
            Thank you for joining the waitlist for <strong style="color:#ffffff;">The Scouter Pro</strong> — the AI-powered scouting platform helping elite players get discovered by clubs, academies, and scouts.
          </p>
  
          <p style="color:#c7ccd6; font-size:15px; line-height:1.6; margin:0 0 28px;">
            We're building something built for you: real performance data, not just highlight reels. You're now part of an early group who'll get first access when we launch — and the earliest players are always the first ones scouts see.
          </p>
  
          <div style="border:1px solid #1f2530; border-radius:10px; padding:20px 20px; margin-bottom:28px;">
            <p style="color:#3ecfb2; font-size:12px; font-weight:700; letter-spacing:1px; margin:0 0 14px;">
              WHAT HAPPENS NEXT
            </p>
            <p style="color:#c7ccd6; font-size:14px; line-height:1.6; margin:0 0 12px;">
              &#128274; Just hold tight — we'll email you the moment the app is ready for download.
            </p>
            <p style="color:#c7ccd6; font-size:14px; line-height:1.6; margin:0;">
              &#128233; In the meantime, keep an eye on your inbox for early-access perks and behind-the-scenes updates.
            </p>
          </div>
  
          <div style="text-align:center;">
            <a href="https://thescouterpro.com" style="display:inline-block; background-color:#3ecfb2; color:#0b0e14; font-weight:700; font-size:14px; text-decoration:none; padding:14px 32px; border-radius:8px;">
              Visit The Scouter Pro
            </a>
          </div>
  
        </div>
      </div>
    `;
  }
  
  export { waitlistConfirmationEmail };