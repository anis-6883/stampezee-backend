import nodemailer from "nodemailer";
import Settings from "../settings/model";

export const sendRegistrationMail = async (email: string, name: string, password: string) => {
  const mailSettings = await Settings.findOne(
    {},
    {
      "general.emailHost": 1,
      "general.emailPort": 1,
      "general.emailUsername": 1,
      "general.emailPassword": 1,
    }
  );

  const { emailHost, emailPort, emailUsername, emailPassword } = mailSettings.general ?? {};

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: Number(emailPort),
    secure: true,
    auth: {
      user: emailUsername,
      pass: emailPassword,
    },
  });

  const template = `<h1>Welcome to StampEzee</h1>
      <p>Hello ${name},</p>
      <p>You are registered as a customer by the Super Admin of StampEzee!</p>

      <h3>Your Login Credentials are:</h3>
      <h4>Email: ${email}</h4>
      <h4>Password: ${password}</h4>
      <p>Don't share your credentials with anyone!</p>
      <p>Thank you for joining with us!</p>
      <p>Best Regards,</p>
      <p>${process.env.APP_NAME} Team</p>`;

  const mailOptions = {
    from: process.env.MAIL_USERNAME,
    to: email,
    subject: "Membership Account Registration",
    html: template,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Registration email sent successfully!");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Error sending verification email!");
  }
};
