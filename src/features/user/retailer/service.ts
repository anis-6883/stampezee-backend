import moment from "moment-timezone";
import { PACKAGES } from "../../../configs/constants";
import Branch from "../../../models/branch";
import EnrollSubscription from "../../../models/enroll-subscription";
import Enrollment from "../../../models/enrollment";
import { IRetailer } from "../../../models/retailer";
import Subscription from "../../../models/subscription";
import { sendInvoiceToEmail } from "../../enroll-subscription/service";

export const freeTrialInvoiceGenerate = async (retailer: IRetailer) => {
  const freeTrial = await Subscription.findOne({ slug: "trial" });
  if (!freeTrial) throw new Error("Free trial subscription not found!");

  const enrollment: any = await Enrollment.create({
    retailerId: retailer._id,
    planExists: PACKAGES.TRIAL,
    paymentStatus: "trial",
    validityFrom: moment(),
    validityTo: freeTrial?.isUnlimited ? new Date("3030-01-01") : moment().add(freeTrial.duration, "days"),
    enrollStatus: "trial",
  });

  const enrollSubscription = await EnrollSubscription.create({
    enrollmentId: enrollment?._id,
    planSnapshot: freeTrial,
    status: true,
  });

  await Branch.create({
    name: retailer.storeName,
    address: {
      loc: { type: "Point", coordinates: [retailer.longitude, retailer.latitude] },
      name: retailer.address,
    },
    retailerId: retailer._id,
    enrollSubscriptionId: enrollSubscription._id,
    validityTill: freeTrial?.isUnlimited ? new Date("3030-01-01") : moment().add(freeTrial.duration, "days"),
    source: "subscription",
  });

  const customerInfo = {
    name: `${retailer.firstName?.length > 26 ? `${retailer.firstName?.slice(0, 26)}...` : retailer.firstName} ${retailer?.lastName?.length > 26 ? `${retailer?.lastName?.slice(0, 26)}...` : retailer?.lastName}`,
    phone: `${retailer?.dialCode}-${retailer?.phone}`,
    address: `${retailer?.address}`,
  };

  let subTotal = 0;
  const purchasedItems = [
    {
      title: enrollSubscription?.planSnapshot?.title,
      quantity: 1,
      unitPrice: `0.00 CAD`,
      total: `0.00 CAD`,
    },
  ];

  const invoiceMetadata = {
    invoiceNo: "INV-" + enrollment?._id.toHexString()?.slice(-8).toUpperCase(),
    subtotal: `${Number(subTotal).toFixed(2)} CAD`,
    total: `0.00 CAD`,
  };
  const paymentInfo = {
    bankName: "Fauget Bank",
    accountName: "Juliana Silva",
    accountNo: "123-456-7890",
    date: enrollment.createdAt,
  };

  // Send invoice and registration email
  sendInvoiceToEmail({ email: retailer?.email, customerInfo, purchasedItems, invoiceMetadata, paymentInfo });
};
