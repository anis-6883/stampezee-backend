import Joi from "joi";
import { PACKAGES } from "../../configs/constants";

export const enrollSubscriptionSchema = Joi.object({
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
            PACKAGES.PUSH_NOTIFICATION_USER,
            PACKAGES.PUSH_NOTIFICATION_LOCATION,
          ]
        )
        .messages({
          "string.empty": "slugs must not be empty!",
          "any.only": `type must be [${PACKAGES.TRIAL},${PACKAGES.BASIC},${PACKAGES.PRO},${PACKAGES.ADVANCED},${PACKAGES.PUSH_NOTIFICATION_USER},${PACKAGES.PUSH_NOTIFICATION_LOCATION}]`,
        })
    )
    .messages({
      "any.required": "slugs is required!",
      "array.base": "slugs must be array!",
      "array.includesRequiredUnknowns": "At least one slug is required!",
    }),
});
