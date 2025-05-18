import moment from "moment";
import EnrollSubscription from "../../models/enroll-subscription";
import Enrollment from "../../models/enrollment";
import { ISubscription } from "../../models/subscription";

export const updateRetailerFreePlan = async (subscription: ISubscription) => {
  const freeTrialEnrollment = await Enrollment.find({
    status: true,
    planExists: "trial",
  }).distinct("_id");

  const updateArr = [
    EnrollSubscription.updateMany({ enrollmentId: { $in: freeTrialEnrollment } }, { planSnapshot: subscription }),
  ];

  if (subscription.unlimitedFieldName) {
    updateArr.push(
      Enrollment.updateMany({ status: true, planExists: "trial" }, { validityTo: new Date("3030-01-01") })
    );
  } else {
    updateArr.push(
      Enrollment.updateMany(
        { status: true, planExists: "trial" },
        { validityTo: moment().add(subscription.duration, "days") }
      )
    );
  }

  Promise.all(updateArr);
};
