export const AWS_BUCKET_EXPIRE_TIME = 60 * 60 * 12; // 12 Hours
export const EXPIRE_TIME = 60 * 60 * 24 * 29 * 1000; // 29 Days
export const APP_SECRET = process.env.APP_SECRET;
export const COOKIE_KEY = "act";
export const REFRESH_TOKEN_KEY = "rft";
export const ROLE = {
  SUPER_ADMIN: "super_admin",
  RETAILER: "retailer",
  SUB_ADMIN: "sub_admin",
  CUSTOMER: "customer",
};

export const PACKAGES = {
  TRIAL: "trial",
  BASIC: "basic",
  PRO: "pro",
  ADVANCED: "advanced",
  STAMP: "stamp",
  CUSTOM_STAMP_IMAGE: "custom_stamp_image",
  BRANCH: "branch",
  PUSH_NOTIFICATION_USER: "push_notification_user",
  PUSH_NOTIFICATION_LOCATION: "push_notification_location",
};
