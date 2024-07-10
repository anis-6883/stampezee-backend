import Joi from "joi";

export const settingsSchema = Joi.object({
  general: Joi.object().messages({
    "object.base": "general must be object!",
  }),
  notification: Joi.object().messages({
    "object.base": "notification must be object!",
  }),
  page: Joi.object().messages({
    "object.base": "page must be object!",
  }),
  s3Bucket: Joi.object().messages({
    "object.base": "s3Bucket must be object!",
  }),
  stripe: Joi.object().messages({
    "object.base": "s3Bucket must be object!",
  }),
  googleMap: Joi.object().messages({
    "object.base": "s3Bucket must be object!",
  }),
});
