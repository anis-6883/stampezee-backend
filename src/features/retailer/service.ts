import nodemailer from "nodemailer";
import Settings from "../../models/settings";
import path from "path";

export const sendRegistrationMail = async (email: string, name: string, address: string, storeName: string) => {
  const settings = await Settings.findOne(
    {},
    {
      "mail.host": 1,
      "mail.port": 1,
      "mail.username": 1,
      "mail.password": 1,
      "general.companyName": 1,
    }
  );

  const transporter = nodemailer.createTransport({
    host: settings?.mail?.host,
    port: Number(settings?.mail?.port),
    secure: true,
    auth: {
      user: settings?.mail?.username,
      pass: settings?.mail?.password,
    },
  });

  const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to StampEzee</title>
</head>
<body style="margin:0; font-family:'Segoe UI', sans-serif; background:#fefefe; color:#333;">
  <div style="background-image: url('https://stampezee.vercel.app/_next/image?url=%2Flogo-red.png&w=640&q=75'); background-repeat: no-repeat; background-position: center center; background-size: 300px; opacity: 0.03; height: 100%; width: 100%; position: absolute; z-index: 0;"></div>
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:white; border-radius:12px; box-shadow:0 0 10px rgba(0,0,0,0.05); overflow:hidden; position: relative; z-index: 1;">
    <!-- Header -->
    <tr>
      <td style="background:#d32f2f; padding:20px 30px; text-align:center; color:white;">
        <img src="cid:logo" alt="StampEzee Logo" width="100" style="margin-bottom:10px;" />
        <h1 style="margin:0; font-size:24px;">Welcome to StampEzee!</h1>
        <p style="margin:5px 0 0; font-size:14px;">You're officially part of the loyalty revolution.</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:30px;">
        <h2 style="margin-top:0; font-size:20px; color:#b71c1c;">Hi ${name},</h2>
        <p style="font-size:15px; line-height:1.6;">
          We're absolutely thrilled to welcome you to the <strong>StampEzee Family!</strong> 🎉  
          Your loyalty journey has officially begun — and we’re honored to be part of your growth.
        </p>

        <table style="width:100%; font-size:15px; background:#f9f9f9; padding:10px; border-radius:8px; margin:20px 0;">
          <tr><td><strong>🛒 Store Name:</strong></td><td>${storeName}</td></tr>
          <tr><td><strong>📍 Location:</strong></td><td>${address}</td></tr>
          <tr><td><strong>📧 Account Email:</strong></td><td>${email}</td></tr>
        </table>

        <p style="font-size:15px;">
          We’re constantly working to roll out new features — so be sure to check your dashboard regularly and stay in the loop! 🛠️✨
        </p>

        <p style="margin-top:30px; font-size:15px;">
          We're here to support you at every step.  
          If you ever need help, ideas, or a virtual high-five — reach out anytime! 🙌  
        </p>
        <p style="font-size:14px;">Cheers,<br/><strong>The StampEzee Team</strong></p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#f5f5f5; text-align:center; padding:20px; font-size:12px; color:#888;">
        <img src="cid:logo" alt="StampEzee Logo" width="60" style="margin-bottom:8px;" />
        <div><strong>StampEzee</strong> – Collect. Redeem. Repeat.</div>
        <div>© 2025 StampEzee | Toronto, Canada</div>
        <div style="margin-top:5px;"><a href="#" style="color:#d32f2f; text-decoration:none;">Privacy Policy</a> | <a href="#" style="color:#d32f2f; text-decoration:none;">Support</a></div>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const headerPath = path.join(__dirname, "../../../public/images/stampezee_header_logo.png");
  const footerPath = path.join(__dirname, "../../../public/images/stampezee_footer_logo.png");
  const mailOptions = {
    from: settings?.mail?.username,
    to: email,
    subject: "Retailer Account Registration",
    html: template,
    attachments: [
      {
        filename: "stampezee_header_logo.png",
        path: headerPath,
        cid: "stampezee_header_logo", // same as in the HTML src
        contentDisposition: "inline" as const,
        contentType: "image/png",
      },
      {
        filename: "stampezee_footer_logo.png",
        path: footerPath,
        cid: "stampezee_footer_logo", // same as in the HTML src
        contentDisposition: "inline" as const,
        contentType: "image/png",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Registration email sent successfully!");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Error sending verification email!");
  }
};
