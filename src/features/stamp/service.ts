import moment from "moment-timezone";
import Settings from "../../models/settings";
import { Object } from "../../types";

export const stampCardSuperAdminQuery = async ({ status, start, end, search }: any) => {
  const query: any = { softDeleted: false };
  if (status === "all") {
    query.softDeleted = false;
  } else if (status === "deletedByRetailer") {
    query.softDeleted = true;
    query.deleteRef = "retailer";
  } else if (status === "deletedByAdmin") {
    query.softDeleted = true;
    query.deleteRef = "admin";
  } else if (status === "published") {
    query.isPublished = true;
  } else if (status === "drafted") {
    query.isPublished = false;
  } else if (status === "active") {
    query.status = true;
  } else if (status === "inactive") {
    query.status = false;
  } else if (status === "expired") {
    query.expiredAt = { $lt: new Date() };
  }

  if (start || end) {
    const settings = await Settings.findOne();

    const timezone = settings.general.timezone.label;

    let startDate, endDate;

    // Handle date logic
    if (start) {
      startDate = moment.tz(start, timezone).startOf("day").toDate();
      endDate = end ? moment.tz(end, timezone).endOf("day").toDate() : moment.tz(start, timezone).endOf("day").toDate(); // treat start as end
    }

    const dateFilter: Object = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;
    if (start || end) query.$or = [{ createdAt: dateFilter }, { expiredAt: dateFilter }];
  }

  if (search) {
    const regex = new RegExp(`.*${search}.*`, "i"); //case insensitive search. For sensitive remove i
    query.title = regex;
  }

  return query;
};
