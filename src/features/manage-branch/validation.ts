import Joi from "joi";

const name = Joi.string().trim().required().messages({
  "any.required": "name is required!",
  "string.base": "name must be string!",
});

const address = Joi.string().trim().required().messages({
  "any.required": "address is required!",
  "string.base": "address must be string!",
});

const longitude = Joi.string().trim().required().messages({
  "any.required": "longitude is required!",
  "string.base": "longitude must be string!",
});

const latitude = Joi.string().trim().required().messages({
  "any.required": "latitude is required!",
  "string.base": "latitude must be string!",
});

const status = Joi.boolean().default(true);

export const branchSchema = Joi.object({
  name,
  address,
  longitude,
  latitude,
  status,
});
