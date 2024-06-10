import Joi from "joi";
import { requiredStringField, stringField } from "../../helpers";

export const subscriptionSchema = Joi.object({
  title: requiredStringField("title"),
  slug: requiredStringField("slug"),
  descriptions: Joi.array()
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
    }),
  price: requiredStringField("price"),
  type: Joi.string().trim().required().lowercase().valid("addon", "subscription").messages({
    "any.required": "type is required!",
    "string.base": "type must be string!",
    "any.only": "type must be [addon, subscription]",
  }),
  duration: Joi.string().trim().valid("7", "30").messages({
    "string.base": "type must be string!",
    "any.only": "type must be [7, 30]",
  }),
  allowTotalBranch: Joi.alternatives().conditional("type", {
    is: "subscription",
    then: Joi.number().required().messages({
      "any.required": "allowTotalBranch is required when type is subscription!",
      "number.base": "allowTotalBranch must be number!",
      "number.empty": "allowTotalBranch must not be empty!",
    }),
    otherwise: Joi.number().allow("").messages({
      "number.base": "allowTotalBranch must be number!",
    }),
  }),
  allowTotalTeamMember: Joi.alternatives().conditional("type", {
    is: "subscription",
    then: Joi.number().required().messages({
      "any.required": "allowTotalTeamMember is required when type is subscription!",
      "number.base": "allowTotalTeamMember must be number!",
      "number.empty": "allowTotalTeamMember must not be empty!",
    }),
    otherwise: Joi.number().messages({
      "number.base": "allowTotalTeamMember must be number!",
    }),
  }),
  limit: Joi.alternatives().conditional("type", {
    is: "addon",
    then: Joi.number().required().messages({
      "any.required": "limit is required when type is addon!",
      "number.base": "limit must be number!",
      "number.empty": "limit must not be empty!",
    }),
    otherwise: Joi.number().messages({
      "number.base": "limit must be number!",
    }),
  }),
});

export const updateSubscriptionSchema = Joi.object({
  title: stringField("title"),
  descriptions: Joi.array()
    .items(
      Joi.string().required().messages({
        "string.empty": "descriptions must not be empty!",
      })
    )
    .messages({
      "array.base": "descriptions must be array!",
      "array.includesRequiredUnknowns": "At least one description is required!",
    }),
  price: stringField("price"),
  allowTotalBranch: Joi.number().messages({
    "number.base": "allowTotalBranch must be number!",
    "number.empty": "allowTotalBranch must not be empty!",
  }),
  allowTotalTeamMember: Joi.number().messages({
    "number.base": "allowTotalBranch must be number!",
    "number.empty": "allowTotalBranch must not be empty!",
  }),
  limit: Joi.number().messages({
    "number.base": "limit must be number!",
    "number.empty": "limit must not be empty!",
  }),
});

export const subscriptionStatusSchema = Joi.object({
  status: Joi.boolean().required().messages({
    "any.required": "status is required!",
    "boolean.base": "status must be boolean!",
    "boolean.empty": "status must not be empty!",
  }),
});
