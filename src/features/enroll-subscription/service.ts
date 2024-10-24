import nodemailer from "nodemailer";

import path from "path";
import { htmlToPdf } from "../../helpers";
import { getInvoiceTemplate } from "../../templates/invoice";
import Settings from "../settings/model";

export const sendInvoiceToEmail = async ({
  email,
  customerInfo,
  purchasedItems,
  invoiceMetadata,
  paymentInfo,
}: {
  email: string;
  customerInfo: any;
  purchasedItems: any;
  invoiceMetadata: any;
  paymentInfo: any;
}) => {
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

  await htmlToPdf({ customerInfo, purchasedItems, invoiceMetadata, paymentInfo });

  const transporter = nodemailer.createTransport({
    host: settings?.mail?.host,
    port: Number(settings?.mail?.port),
    secure: true,
    auth: {
      user: settings?.mail?.username,
      pass: settings?.mail?.password,
    },
  });

  const mailOptions = {
    from: settings?.mail?.username,
    to: email,
    subject: "Subscription Invoice",
    html: getInvoiceTemplate({ customerInfo, purchasedItems, invoiceMetadata, paymentInfo }),
    attachments: [
      {
        path: path.join(process.cwd(), "/src/features/enroll-subscription/temp/invoice.pdf"),
        filename: "invoice.pdf",
        contentType: "contentType",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Demo PDF created successfully!");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Error sending verification email!");
  }
};
