import nodemailer from "nodemailer";
import Settings from "../../models/settings";
import { otpTemplate } from "../../templates/otp";

export const sendVerificationEmail = async (email: string, verificationCode: number, context: string = "reg") => {
  const settings = await Settings.findOne(
    {},
    {
      "mail.host": 1,
      "mail.port": 1,
      "mail.username": 1,
      "mail.password": 1,
      "general.companyName": 1,
      "general.address": 1,
      "general.postalCode": 1,
      "general.province": 1,
      "general.country": 1,
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

  const template = otpTemplate(String(verificationCode));

  const mailOptions = {
    from: settings?.mail?.username,
    to: email,
    subject: "Email Verification",
    html: template,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent successfully!");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Error sending verification email!");
  }
};
