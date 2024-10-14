import Joi from "joi";
import {
  numberField,
  requiredBooleanField,
  requiredNumberField,
  requiredStringField,
  stringField,
} from "../../helpers";

const type = Joi.string().trim().lowercase().valid("addon", "subscription").messages({
  "string.base": "type must be string!",
  "any.only": "type must be [addon, subscription]",
});

// const duration = Joi.string().trim().valid("7", "30").messages({
//   "string.base": "type must be string!",
//   "any.only": "type must be [7, 30]",
// });

const duration = Joi.number().messages({
  "number.base": "duration must be number!",
});

const descriptions = Joi.array()
  .items(
    Joi.string().required().messages({
      "string.empty": "descriptions must not be empty!",
    })
  )
  .messages({
    "array.base": "descriptions must be array!",
    "array.includesRequiredUnknowns": "At least one description is required!",
  });

export const subscriptionSchema = Joi.object({
  title: requiredStringField("title"),
  slug: requiredStringField("slug"),
  type: type.required().messages({
    "any.required": "type is required!",
  }),
  duration,
  descriptions: descriptions.required().messages({
    "any.required": "descriptions is required!",
  }),
  price: requiredNumberField("price"),
  allowTotalBranch: Joi.alternatives().conditional("type", {
    is: "subscription",
    then: requiredNumberField("allowTotalBranch"),
    otherwise: numberField("allowTotalBranch"),
  }),
  allowTotalTeamMember: Joi.alternatives().conditional("type", {
    is: "subscription",
    then: requiredNumberField("allowTotalTeamMember"),
    otherwise: numberField("allowTotalTeamMember"),
  }),
  allowTotalStamp: Joi.alternatives().conditional("type", {
    is: "subscription",
    then: requiredNumberField("allowTotalStamp"),
    otherwise: numberField("allowTotalStamp"),
  }),
  limit: Joi.alternatives().conditional("type", {
    is: "addon",
    then: requiredNumberField("limit"),
    otherwise: numberField("limit"),
  }),
});

export const updateSubscriptionSchema = Joi.object({
  title: stringField("title"),
  slug: stringField("slug"),
  type,
  duration,
  price: numberField("price"),
  descriptions,
  allowTotalBranch: numberField("allowTotalBranch"),
  allowTotalTeamMember: numberField("allowTotalTeamMember"),
  allowTotalStamp: numberField("allowTotalStamp"),
  limit: numberField("limit"),
});

export const subscriptionStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
