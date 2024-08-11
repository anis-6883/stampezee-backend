import nodemailer from "nodemailer";

export const sendRegistrationMail = async (
  email: string,
  name: string,
  password: string,
  storeName: string,
  branchName: string
) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
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
