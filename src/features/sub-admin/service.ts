import nodemailer from "nodemailer";
import path from "path";
import Settings from "../../models/settings";

export const sendRegistrationMail = async (
  contactEmail: string,
  email: string,
  name: string,
  password: string,
  storeName: string,
  branchName: string
) => {
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
  const headerPath = path.join(__dirname, "../../../public/images/stampezee_header_logo.png");
  const footerPath = path.join(__dirname, "../../../public/images/stampezee_footer_logo.png");
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
  <title>StampEzee Loyalty Executive Account Created</title>
</head>
<body style="margin:0; font-family:'Segoe UI', sans-serif; background:#fefefe; color:#333;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:white; border-radius:12px; box-shadow:0 0 10px rgba(0,0,0,0.05); overflow:hidden; position: relative; z-index: 1;">
    <tr>
      <td style="background:#d32f2f; padding:20px 30px; text-align:center; color:white;">
        <img src="cid:stampezee_header_logo" alt="StampEzee Logo" width="100" style="margin-bottom:10px;" />
        <h1 style="margin:0; font-size:24px;">Welcome to StampEzee!</h1>
        <p style="margin:5px 0 0; font-size:14px;">Your loyalty-executive account is now live.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:30px;">
        <h2 style="margin-top:0; font-size:20px; color:#b71c1c;">Hello ${name},</h2>
        <p style="font-size:15px; line-height:1.6;">
          🎉 You’ve been added as a <strong>StampEzee Loyalty Executive</strong> for one of our partnered retailers on StampEzee! You now have access to manage loyalty operations for your branch.
        </p>
        <table style="width:100%; font-size:15px; background:#f9f9f9; padding:10px; border-radius:8px; margin:20px 0;">
          <tr><td><strong>🛒 Store:</strong></td><td>${storeName}</td></tr>
          <tr><td><strong>📍 Branch:</strong></td><td>${branchName}</td></tr>
          <tr><td><strong>📧 Email:</strong></td><td>${email}</td></tr>
          <tr><td><strong>🔐 Password:</strong></td><td>${password}</td></tr>
        </table>
        <p style="font-size:14px; color:#d32f2f;"><strong>🔒 Please don’t share your credentials with anyone.</strong></p>
        <p style="margin-top:30px;">You can now log in and start managing stamps, users, and redemptions for your store. If you need help, our support team is just a click away!</p>
        <p style="font-size:14px;">Welcome aboard, and happy rewarding!<br/><strong>– The StampEzee Team</strong></p>
      </td>
    </tr>
    <tr>
      <td style="background:#f5f5f5; text-align:center; padding:20px; font-size:12px; color:#888;">
        <img src="cid:stampezee_footer_logo" alt="StampEzee Logo" width="60" style="margin-bottom:8px;" />
        <div><strong>StampEzee</strong> – Collect. Redeem. Repeat.</div>
        <div>© 2025 StampEzee | Toronto, Canada</div>
        <div style="margin-top:5px;"><a href="${process.env.POLICY}" style="color:#d32f2f; text-decoration:none;">Privacy Policy</a> | <a href="${process.env.CONTACT_URL}" style="color:#d32f2f; text-decoration:none;">Support</a></div>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const mailOptions = {
    from: settings?.mail?.username,
    to: contactEmail,
    subject: "StampEzee Loyalty Executive Account Registration",
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

export const generateUniqueSubAdminEmail = (email: string, subAdminNumber: string) => {
  return email.replace(/@(.+)/, (match, domain) => `@${subAdminNumber}.${domain}`);
};

export const isValidEmail = (email: string) => {
  const regex = /^[a-zA-Z0-9._%+-]+\.s[0-9]+@stampezee\.com$/;
  return regex.test(email);
};
