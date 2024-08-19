import Joi from "joi";
import {
  numberField,
  requiredBooleanField,
  requiredNumberField,
  requiredStringField,
  stringField,
} from "../../helpers";

const type = Joi.string().trim().required().lowercase().valid("addon", "subscription").messages({
  "any.required": "type is required!",
  "string.base": "type must be string!",
  "any.only": "type must be [addon, subscription]",
});

const duration = Joi.string().trim().valid("7", "30").messages({
  "string.base": "type must be string!",
  "any.only": "type must be [7, 30]",
});

const descriptions = Joi.array()
  .items(
    Joi.string().required().messages({
      "string.empty": "descriptions must not be empty!",
    })
  )
  .required()
  .messages({
    "array.base": "descriptions must be array!",
    "any.required": "descriptions is required!",
    "array.includesRequiredUnknowns": "At least one description is required!",
  });

export const subscriptionSchema = Joi.object({
  title: requiredStringField("title"),
  productId: requiredStringField("productId"),
  slug: requiredStringField("slug"),
  originalPriceId: requiredStringField("originalPriceId"),
  originalPrice: requiredNumberField("originalPrice"),
  taxPriceId: requiredStringField("taxPriceId"),
  taxPrice: requiredNumberField("taxPrice"),
  type,
  duration,
  descriptions,
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
  productId: stringField("productId"),
  slug: stringField("slug"),
  originalPriceId: stringField("originalPriceId"),
  originalPrice: numberField("originalPrice"),
  taxPriceId: stringField("taxPriceId"),
  taxPrice: numberField("taxPrice"),
  type,
  duration,
  descriptions,
  allowTotalBranch: numberField("limit"),
  allowTotalTeamMember: numberField("limit"),
  allowTotalStamp: numberField("limit"),
  limit: numberField("limit"),
});

export const subscriptionStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
