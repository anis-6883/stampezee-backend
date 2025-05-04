import nodemailer from "nodemailer";
import Settings from "../../models/settings";
import { otpTemplate } from "../../templates/otp";
import path from "path";
import { forgotPassOtpTemplate } from "../../templates/forgotPass";

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

  const template = otpTemplate(String(verificationCode), "stampezee_header_logo", "stampezee_footer_logo");
  const headerPath = path.join(__dirname, "../../../public/images/stampezee_header_logo.png");
  const footerPath = path.join(__dirname, "../../../public/images/stampezee_footer_logo.png");
  const mailOptions = {
    from: settings?.mail?.username,
    to: email,
    subject: "Email Verification",
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
    console.log("Verification email sent successfully!");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Error sending verification email!");
  }
};

export const sendForgotPassEmail = async (email: string, verificationCode: number, name: string) => {
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

  const template = forgotPassOtpTemplate(String(verificationCode), name);
  const headerPath = path.join(__dirname, "../../../public/images/stampezee_header_logo.png");
  const footerPath = path.join(__dirname, "../../../public/images/stampezee_footer_logo.png");
  const mailOptions = {
    from: settings?.mail?.username,
    to: email,
    subject: "Email Verification",
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
    console.log("Verification email sent successfully!");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Error sending verification email!");
  }
};
