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
      "any.required": "allowTotalBranch is required!",
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
      "any.required": "allowTotalTeamMember is required!",
      "number.base": "allowTotalTeamMember must be number!",
      "number.empty": "allowTotalTeamMember must not be empty!",
    }),
    otherwise: Joi.number().allow("").messages({
      "number.base": "allowTotalTeamMember must be number!",
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
});
