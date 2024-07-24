import bcrypt from "bcrypt";
import { Request, Response } from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { APP_SECRET } from "../configs/constants";

const objectIdExtension = (Joi: any) => ({
  type: "objectId",
  base: Joi.string(),
  messages: {
    "objectId.base": "{{#label}} must be a valid ObjectId",
  },
  validate(value: mongoose.Types.ObjectId, helpers: Joi.CustomHelpers) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return { value, errors: helpers.error("objectId.base") };
    }
  },
});

const JoiExtended = Joi.extend(objectIdExtension);

export const asyncHandler = (func: any) => async (req: Request, res: Response) => {
  try {
    await func(req, res);
  } catch (err) {
    console.error(err);
    if (err.isJoi) {
      const format: any = {};
      err.details.forEach((detail: any) => {
        format[detail.context.label] = detail.message;
      });
      return apiResponse(res, 400, false, "Invalid Request!", format);
    }

    if (err.code == 11000) {
      return apiResponse(res, 400, false, "Duplicate value found!");
    }

    return apiResponse(res, 400, false, err || "Something went wrong!");
  }
};

export const apiResponse = (
  res: Response,
  statusCode: number,
  status: boolean,
  message: string,
  data?: any,
  pagination?: any
) => {
  return res.status(statusCode).json({ status, message, data, pagination });
};

export const emailField = Joi.string().email().trim().lowercase().messages({
  "string.base": "email must be string!",
  "string.email": "email must be valid format!",
  "string.empty": "email must not be empty!",
});

export const requiredEmailField = emailField.required().messages({
  "any.required": "email is required!",
});

export const requiredObjectIdField = (fieldName: string) =>
  JoiExtended.objectId()
    .required()
    .messages({
      "any.required": `${fieldName} is required!`,
      "objectId.base": `${fieldName} must be a valid ObjectId!`,
      "string.empty": `${fieldName} must not be empty!`,
    });

export const requiredStringField = (fieldName: string) =>
  Joi.string()
    .trim()
    .required()
    .messages({
      "any.required": `${fieldName} is required!`,
      "string.base": `${fieldName} must be string!`,
      "string.empty": `${fieldName} must not be empty!`,
    });

export const stringField = (fieldName: string) =>
  Joi.string()
    .trim()
    .messages({
      "string.base": `${fieldName} must be string!`,
      "string.empty": `${fieldName} must not be empty!`,
    });

export const numberField = (fieldName: string) =>
  Joi.number().messages({
    "number.base": `${fieldName} must be number!`,
  });

export const requiredLowercaseStringField = (fieldName: string) =>
  Joi.string()
    .trim()
    .lowercase()
    .required()
    .messages({
      "any.required": `${fieldName} is required!`,
      "string.base": `${fieldName} must be string!`,
      "string.empty": `${fieldName} must not be empty!`,
    });

export const lowercaseStringField = (fieldName: string) =>
  Joi.string()
    .trim()
    .lowercase()
    .messages({
      "string.base": `${fieldName} must be string!`,
      "string.empty": `${fieldName} must not be empty!`,
    });

export const weakPasswordField = (length: number) =>
  Joi.string()
    .required()
    .min(length)
    .messages({
      "any.required": "password is required!",
      "string.base": "password must be string!",
      "string.min": `password must be ${length} characters long!`,
    });

export const formatErrorMsg = (result: any): string => {
  const format: any = {};

  if (result.error) {
    result.error.details.forEach((detail: any) => {
      format[detail.context.label] = detail.message;
    });
  }

  const firstKey = Object.keys(format)[0];
  const errorMsg = format[firstKey];

  return errorMsg;
};

export const generateSalt = async () => {
  return await bcrypt.genSalt();
};

export const generatePassword = async (password: string, salt: string) => {
  return await bcrypt.hash(password, salt);
};

export const generateSignature = (payload: any, expiresIn: number | string) => {
  return jwt.sign(payload, APP_SECRET, { expiresIn });
};

export const validatePassword = async (enteredPassword: string, savedPassword: string, salt: string) => {
  return (await generatePassword(enteredPassword, salt)) === savedPassword;
};

export const excludeMany = async (array: any[], keys: any[]): Promise<any[]> => {
  let newArray: any[] = [];
  array?.map((item) => {
    const temp: any = { ...item._doc };
    for (let key of keys) {
      delete temp[key];
    }
    newArray.push(temp);
  });
  return newArray;
};

export const exclude = (existingApp: { [key: string]: any }, keys: any[]) => {
  for (let key of keys) {
    delete existingApp[key];
  }
  return existingApp;
};

export const getRandomInteger = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const flattenObject = (obj: any, parentKey: string = "", result: any = {}) => {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      let newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
        flattenObject(obj[key], newKey, result);
      } else {
        result[newKey] = obj[key];
      }
    }
  }
  return result;
};

export const fileValidation = (
  file: any,
  size: number = 1024 * 1024 * 100,
  types: string[] = ["image/jpeg", "image/png", "image/jpg"]
) => {
  if (file?.size > size) {
    return {
      status: false,
      message: "File size is too large!",
    };
  } else if (!types.includes(file.mimetype)) {
    return {
      status: false,
      message: "Invalid file type!",
    };
  } else {
    return {
      status: true,
      message: "File is valid!",
    };
  }
};

export const makePaginate = (docs: any[], page: number, limit: number, skip: number, total: number) => {
  const hasNext = total > skip + Number(limit);
  const hasPrev = Number(page) > 1;

  return {
    docs,
    page: +page,
    limit: +limit,
    totalPage: Math.ceil(total / Number(limit)),
    totalDocs: total,
    hasNext,
    hasPrev,
  };
};

export const makePaginateForMobile = (page: number, limit: number, skip: number, total: number) => {
  const hasNext = total > skip + Number(limit);
  const hasPrev = Number(page) > 1;

  return {
    page: +page,
    limit: +limit,
    totalPage: Math.ceil(total / Number(limit)),
    totalDocs: total,
    hasNext,
    hasPrev,
  };
};

export const checkCombination = (arr: string[], words: string[]): boolean => {
  let count = 0;

  for (let letter of words) {
    if (arr.includes(letter)) {
      count++;
      if (count > 1) {
        return false; // Present
      }
    }
  }

  return true;
};

export const checkDuplicates = (arr: string[]): boolean => {
  const uniqueElements = new Set();

  for (let element of arr) {
    if (uniqueElements.has(element)) {
      return false; // Present
    }
    uniqueElements.add(element);
  }

  return true;
};

export const getUTC = (localTime: Date | string, timeZoneOffset: number, endOfDay: boolean = false) => {
  const currentTime = new Date(localTime);

  // Adjust to UTC end of day
  const utcEndOfDay = new Date(
    Date.UTC(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 23, 59, 59, 999)
  );

  const currentTimeInMs = endOfDay ? utcEndOfDay.getTime() : currentTime.getTime();

  const utcTimeInMs = currentTimeInMs - timeZoneOffset * 60 * 60 * 1000;

  const utcTime = new Date(utcTimeInMs);

  return utcTime;
};

export const checkPlanChange = (plans: string[], previousPlan: string, currentPlan: string): number => {
  const previousIndex = plans.indexOf(previousPlan);
  const currentIndex = plans.indexOf(currentPlan);

  if (previousIndex === -1 || currentIndex === -1) {
    throw "Invalid plan provided!";
  }

  if (currentIndex > previousIndex) {
    return 1;
  } else if (currentIndex < previousIndex) {
    return -1;
  } else {
    return 0;
  }
};

export const calculateBalanceAmount = (startDate: Date, expirationDate: Date, planPrice: number) => {
  const start = new Date(startDate);
  const end = new Date(expirationDate);
  const today = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw "Invalid start date or expiration date !";
  }

  const totalDuration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDuration = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  // Ensure the elapsed duration is not negative or exceeding the total duration
  const effectiveElapsedDuration = Math.min(Math.max(elapsedDuration, 0), totalDuration);
  const consumedPrice = (effectiveElapsedDuration / totalDuration) * planPrice;

  return parseFloat((planPrice - consumedPrice).toFixed(2)); // return 2 decimal places
  // return planPrice - consumedPrice;
};
