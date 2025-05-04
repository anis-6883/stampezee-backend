import nodemailer from "nodemailer";
import path from "path";
import Settings from "../../../models/settings";

export const sendCustomerWelcomeEmail = async (email: string, name: string) => {
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

  const headerPath = path.join(__dirname, "../../../../public/images/stampezee_header_logo.png");
  const footerPath = path.join(__dirname, "../../../../public/images/stampezee_footer_logo.png");

  const transporter = nodemailer.createTransport({
    host: settings?.mail?.host,
    port: Number(settings?.mail?.port),
    secure: true,
    auth: {
      user: settings?.mail?.username,
      pass: settings?.mail?.password,
    },
  });

  const template = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Welcome to StampEzee</title>
      </head>
      <body style="margin: 0; font-family: 'Segoe UI', sans-serif; background: #fefefe; color: #333">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); overflow: hidden; position: relative; z-index: 1;">
          <!-- Header -->
          <tr>
            <td style="background: #d32f2f; padding: 20px 30px; text-align: center; color: white">
              <img src="cid:stampezee_header_logo" alt="StampEzee Logo" width="100" style="margin-bottom: 10px" />
              <h1 style="margin: 0; font-size: 24px">Welcome to StampEzee!</h1>
              <p style="margin: 5px 0 0; font-size: 14px">Let the stamp collecting begin!</p>
            </td>
          </tr>
  
          <!-- Body -->
          <tr>
            <td style="padding: 30px">
              <h2 style="margin-top: 0; font-size: 20px; color: #b71c1c">Hey ${name}, our newest StampStar! ⭐</h2>
              <p style="font-size: 15px; line-height: 1.6">
                Thanks for joining <strong>StampEzee</strong> — your new go-to place for unlocking exciting rewards every time you shop! From your morning coffee runs to your favorite treats, you’ll start collecting stamps faster than you think.
              </p>
  
              <p style="font-size: 15px; margin-top: 20px">Here's what you can do:</p>
              <ul style="font-size: 15px; padding-left: 20px; margin-bottom: 20px">
                <li>🛍️ Visit your favorite stores</li>
                <li>📲 Scan your code to collect stamps</li>
                <li>🎁 Redeem rewards once your card is full</li>
              </ul>
  
              <p style="font-size: 15px">
                And guess what? We’re always cooking up new features and surprises to keep your rewards fresh and fun. So keep checking back!
              </p>
  
              <p style="margin-top: 30px; font-size: 15px">
                Got questions? Need help? Just tap “Help” inside the app or reply to this email.
              </p>
              <p style="font-size: 14px">Happy stamping!<br /><strong>– The StampEzee Team</strong></p>
            </td>
          </tr>
  
          <!-- Footer -->
          <tr>
            <td style="background: #f5f5f5; text-align: center; padding: 20px; font-size: 12px; color: #888">
              <img src="cid:stampezee_footer_logo" alt="StampEzee Logo" width="60" style="margin-bottom: 8px" />
              <div><strong>StampEzee</strong> – Collect. Redeem. Repeat.</div>
              <div>© 2025 StampEzee | Toronto, Canada</div>
              <div style="margin-top: 5px">
                <a href="${process.env.POLICY}" style="color: #d32f2f; text-decoration: none">Privacy Policy</a> |
                <a href="${process.env.CONTACT_URL}" style="color: #d32f2f; text-decoration: none">Support</a>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>`;

  const mailOptions = {
    from: settings?.mail?.username,
    to: email,
    subject: "Welcome to StampEzee!",
    html: template,
    attachments: [
      {
        filename: "stampezee_header_logo.png",
        path: headerPath,
        cid: "stampezee_header_logo",
        contentDisposition: "inline" as const,
      },
      {
        filename: "stampezee_footer_logo.png",
        path: footerPath,
        cid: "stampezee_footer_logo",
        contentDisposition: "inline" as const,
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Registration email sent successfully!");
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw new Error("Error sending welcome email!");
  }
};
