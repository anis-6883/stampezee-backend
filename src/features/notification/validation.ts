import Joi from "joi";
import { numberField, requiredNumberField, requiredStringField, stringField } from "../../helpers";

export const notificationSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
  imageType: stringField("imageType"),
  image: stringField("image"),
});

export const superAdminNotificationSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
  imageType: stringField("imageType"),
  image: stringField("image"),
  scheduleAt: stringField("scheduleAt"),
  type: Joi.string().required().trim().lowercase().valid("all", "location").messages({
    "any.required": "type is required!",
    "string.base": "type must be string!",
    "any.only": "type must be [all, location]",
    "string.empty": "type must not be empty!",
  }),
  address: Joi.alternatives().conditional("type", {
    is: "all",
    then: stringField("address"),
    otherwise: requiredStringField("address"),
  }),
  radius: Joi.alternatives().conditional("type", {
    is: "all",
    then: numberField("radius"),
    otherwise: requiredNumberField("longitude"),
  }),
  longitude: Joi.alternatives().conditional("type", {
    is: "all",
    then: stringField("longitude"),
    otherwise: requiredStringField("longitude"),
  }),
  latitude: Joi.alternatives().conditional("type", {
    is: "all",
    then: stringField("latitude"),
    otherwise: requiredStringField("latitude"),
  }),
});

export const notificationBasedOnLocationSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
  imageType: stringField("imageType"),
  image: stringField("image"),
  address: requiredStringField("address"),
  radius: requiredNumberField("radius"),
  longitude: requiredStringField("longitude"),
  latitude: requiredStringField("latitude"),
});
