import Joi from "joi";
import { numberField, requiredStringField, stringField } from "../../helpers";

export const notificationSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
  imageType: requiredStringField("imageType"),
  image: stringField("image"),
  address: requiredStringField("address"),
  radius: numberField("radius"),
  longitude: requiredStringField("longitude"),
  latitude: requiredStringField("latitude"),
});
