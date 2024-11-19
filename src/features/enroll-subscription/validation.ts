import Joi from "joi";
import { PACKAGES } from "../../configs/constants";
import { requiredStringField, stringField } from "../../helpers";

export const enrollmentSchema = Joi.object({
  slugs: Joi.array()
    .items(
      Joi.string()
        .required()
        .lowercase()
        .valid(
          ...[
            PACKAGES.TRIAL,
            PACKAGES.BASIC,
            PACKAGES.PRO,
            PACKAGES.ADVANCED,
            PACKAGES.STAMP,
            PACKAGES.BRANCH,
            PACKAGES.CUSTOM_STAMP_IMAGE,
            PACKAGES.PUSH_NOTIFICATION_USER,
            PACKAGES.PUSH_NOTIFICATION_LOCATION,
          ]
        )
        .messages({
          "string.empty": "slugs must not be empty!",
          "any.only": `type must be [${PACKAGES.TRIAL},${PACKAGES.BASIC},${PACKAGES.PRO},${PACKAGES.ADVANCED},${PACKAGES.STAMP},${PACKAGES.BRANCH},${PACKAGES.CUSTOM_STAMP_IMAGE},${PACKAGES.PUSH_NOTIFICATION_USER},${PACKAGES.PUSH_NOTIFICATION_LOCATION}]`,
        })
    )
    .messages({
      "any.required": "slugs is required!",
      "array.base": "slugs must be array!",
      "array.includesRequiredUnknowns": "At least one slug is required!",
    }),
  currency: requiredStringField("currency"),
  code: stringField("code"),
  branchIds: Joi.array().messages({
    "array.base": "branchIds must be array!",
  }),
  stampIds: Joi.array().messages({
    "array.base": "stampIds must be array!",
  }),
});

export const couponSchema = Joi.object({
  code: requiredStringField("code"),
  slugs: Joi.array()
    .items(
      Joi.string()
        .required()
        .lowercase()
        .valid(
          ...[
            PACKAGES.TRIAL,
            PACKAGES.BASIC,
            PACKAGES.PRO,
            PACKAGES.ADVANCED,
            PACKAGES.STAMP,
            PACKAGES.BRANCH,
            PACKAGES.CUSTOM_STAMP_IMAGE,
            PACKAGES.PUSH_NOTIFICATION_USER,
            PACKAGES.PUSH_NOTIFICATION_LOCATION,
          ]
        )
        .messages({
          "string.empty": "slugs must not be empty!",
          "any.only": `type must be [${PACKAGES.TRIAL},${PACKAGES.BASIC},${PACKAGES.PRO},${PACKAGES.ADVANCED},${PACKAGES.STAMP},${PACKAGES.BRANCH},${PACKAGES.CUSTOM_STAMP_IMAGE},${PACKAGES.PUSH_NOTIFICATION_USER},${PACKAGES.PUSH_NOTIFICATION_LOCATION}]`,
        })
    )
    .messages({
      "any.required": "slugs is required!",
      "array.base": "slugs must be array!",
      "array.includesRequiredUnknowns": "At least one slug is required!",
    }),
});

export const extraAddonSchema = Joi.object({
  currency: requiredStringField("currency"),
});
