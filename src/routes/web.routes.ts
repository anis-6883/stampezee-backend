import ejs from "ejs";
import express from "express";
import fs from "fs";
import pdf from "html-pdf";
import nodemailer from "nodemailer";
import path from "path";
import { ROLE } from "../configs/constants";
import billingRoutes from "../features/billing/route";
import branchRoutes from "../features/branch/route";
import { submitContact } from "../features/contact/controller";
import { getAllCurrencyExchanges, getTwoCurrencyExchangeRate } from "../features/currency-exchange/controller";
import customerRoutes from "../features/customer/routes/retailer";
import dashboardRoutes from "../features/dashboard/routes/retailer";
import subscriptionRoutes from "../features/enroll-subscription/route";
import { getAllFaqsForWeb } from "../features/faq/controller";
import { subscribeNewsletter } from "../features/newsletter/controller";
import notificationRoutes from "../features/notification/routes/retailer";
import refundRoutes from "../features/refund/routes/retailer";
import scansRoutes from "../features/scans/routes/retailer";
import { getCommonSettings, getSecretSettings } from "../features/settings/controller";
import Settings from "../features/settings/model";
import stampImageRoutes from "../features/stamp-image/route";
import stampRoutes from "../features/stamp/route";
import subAdminRoutes from "../features/sub-admin/route";
import { refreshAccessToken } from "../features/user/controller";
import retailerAuthRoutes from "../features/user/retailer/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

// Common Routes
router.get("/faqs", getAllFaqsForWeb);
router.post("/newsletter/join", subscribeNewsletter);
router.post("/contact/submit", submitContact);
router.get("/get-common-settings", getCommonSettings);
router.get("/get-secret-settings", authAndPermissionCheck("", false, false), getSecretSettings);
router.get("/refresh-token", authAndPermissionCheck("", false), refreshAccessToken);
router.get("/currency-exchange/list", getAllCurrencyExchanges);
router.get("/currency-exchange/rates", getTwoCurrencyExchangeRate);

// Testing for Generate PDF and Send mail with PDF
async function pdfBuffer(invoice?: any): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const html = fs.readFileSync(path.join(__dirname, "./file.ejs"), "utf-8");
    const emailTemplate = ejs.render(html, invoice, { cache: false });
    const options: any = {
      format: "A4",
    };

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

    pdf.create(emailTemplate, options).toBuffer((err: any, buffer: Buffer) => {
      if (err) {
        console.error(err);
        //   reject(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Error generating PDF"));
      } else {
        const outputFilePath = path.join(__dirname, "demoFile.pdf");

        // Ensure that the output folder exists, if not, create it
        fs.mkdir(path.dirname(outputFilePath), { recursive: true }, (err) => {
          if (err) {
            console.error("Error creating folder:", err);
          } else {
            // Write the PDF buffer to the file
            fs.writeFile(outputFilePath, buffer, (err) => {
              if (err) {
                console.error("Error writing PDF to file:", err);
              } else {
                console.log("PDF successfully written to", outputFilePath);
              }
            });
          }
        });

        resolve(buffer);
      }
    });

    const mailOptions = {
      from: settings?.mail?.username,
      to: "anisuzzaman.rootdevs@gmail.com",
      subject: "PDF Testing...",
      html: emailTemplate,
      attachments: [
        {
          filename: "file.pdf",
          path: `${__dirname}/demoFile.pdf`,
          contentType: "application/pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  });
}

router.get("/test-pdf", async function (req, res) {
  try {
    const buffer = await pdfBuffer();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="invoice.pdf"');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);
    // return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
    //   message: "An error occurred while generating the PDF"
    // });
  }
});

// Subscription Routes
router.use("/subscription-plans", subscriptionRoutes);

// Retailer Auth Routes
router.use("/retailer", retailerAuthRoutes);

// Retailer Panel Feature Routes
router.use(authAndPermissionCheck(ROLE.RETAILER));
router.use("/retailer/dashboard", dashboardRoutes);
router.use("/retailer/stamp", stampRoutes);
router.use("/retailer/scans", scansRoutes);
router.use("/retailer/branch", branchRoutes);
router.use("/retailer/sub-admin", subAdminRoutes);
router.use("/retailer/stamp-image", stampImageRoutes);
router.use("/retailer/billing", billingRoutes);
router.use("/retailer/notification", notificationRoutes);
router.use("/retailer/refund", refundRoutes);
router.use("/retailer/manage-customer", customerRoutes);

export default router;
