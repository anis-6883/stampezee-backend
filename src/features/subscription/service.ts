import Enrollment from "../../models/enrollment";
import EnrollSubscription from "../../models/enroll-subscription";
import { Types } from "mongoose";
export const updateRetailerFreePlan = async (subscription: any) => {
  const freeTrialEnrollment = await Enrollment.find({
    status: true,
    planExists: "trial",
  }).distinct("_id");

  EnrollSubscription.updateMany({ enrollmentId: { $in: freeTrialEnrollment } }, { planSnapshot: subscription }).then(
    (result) => {
      console.log("Hesll");
    }
  );
};
