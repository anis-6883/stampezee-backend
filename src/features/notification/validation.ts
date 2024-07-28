import Joi from "joi";
import { requiredNumberField, requiredStringField, stringField } from "../../helpers";

export const notificationSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
  imageType: stringField("imageType"),
  image: stringField("image"),
  address: requiredStringField("address"),
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
