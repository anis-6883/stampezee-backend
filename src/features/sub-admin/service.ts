import nodemailer from "nodemailer";
import Settings from "../settings/model";

export const sendRegistrationMail = async (
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

  const transporter = nodemailer.createTransport({
    host: settings?.mail?.host,
    port: Number(settings?.mail?.port),
    secure: true,
    auth: {
      user: settings?.mail?.username,
      pass: settings?.mail?.password,
    },
  });

  const template = `<h1>Welcome to StampEzee</h1>
      <p>Hello ${name},</p>
      <p>Your are assigned as a sub-admin.</p>
      <h4>Store Name: ${storeName}</h4>
      <h4>Branch Name: ${branchName}</h4>
      
      <h3>Your Login Credentials are:</h3>
      <h4>Email: ${email}</h4>
      <h4>Password: ${password}</h4>
      <p>Don't share your credentials with anyone!</p>
      <p>Thank you for joining with us!</p>
      <p>Best Regards,</p>
      <p>${settings?.general?.companyName} Team</p>`;

  const mailOptions = {
    from: settings?.mail?.username,
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
