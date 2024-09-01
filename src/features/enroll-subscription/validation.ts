import Joi from "joi";
import { PACKAGES } from "../../configs/constants";
import { requiredStringField, stringField } from "../../helpers";

export const enrollSubscriptionSchema = Joi.object({
  slug: Joi.string()
    .required()
    .lowercase()
    .valid(
      ...[
        PACKAGES.TRIAL,
        PACKAGES.BASIC,
        PACKAGES.PRO,
        PACKAGES.ADVANCED,
        PACKAGES.BRANCH,
        PACKAGES.STAMP,
        PACKAGES.CUSTOM_STAMP_IMAGE,
        PACKAGES.PUSH_NOTIFICATION_USER,
        PACKAGES.PUSH_NOTIFICATION_LOCATION,
      ]
    )
    .messages({
      "any.required": "slugs is required!",
      "string.empty": "slugs must not be empty!",
      "any.only": `slug must be [${PACKAGES.TRIAL}, ${PACKAGES.BASIC}, ${PACKAGES.PRO}, ${PACKAGES.ADVANCED}, ${PACKAGES.STAMP}, ${PACKAGES.CUSTOM_STAMP_IMAGE}, ${PACKAGES.BRANCH}, ${PACKAGES.PUSH_NOTIFICATION_USER}, ${PACKAGES.PUSH_NOTIFICATION_LOCATION}]`,
    }),
  currency: requiredStringField("currency"),
  code: stringField("code"),
  branchIds: Joi.array().messages({
    "array.base": "branchIds must be array!",
  }),
});

export const couponSchema = Joi.object({
  code: requiredStringField("code"),
});
