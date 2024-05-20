import Joi from "joi";

export const settingsSchema = Joi.object({
  general: Joi.object().messages({
    "object.base": "general must be object!",
  }),
  notification: Joi.object().messages({
    "object.base": "notification must be object!",
  }),
  pages: Joi.object().messages({
    "object.base": "pages must be object!",
  }),
  s3Bucket: Joi.object().messages({
    "object.base": "s3Bucket must be object!",
  }),
});
