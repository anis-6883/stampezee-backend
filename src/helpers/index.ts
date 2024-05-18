import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { APP_SECRET } from "../configs/constants";

export const asyncHandler = (func: any) => async (req: Request, res: Response) => {
  try {
    await func(req, res);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ status: false, message: "Something went wrong!" });
  }
};

export const apiResponse = (res: Response, statusCode: number, status: boolean, message: string, data?: any) => {
  return res.status(statusCode).json({ status, message, data });
};

export const validateBody = (schema: any, body: Object): Object => {
  const result = schema.validate(body, {
    allowUnknown: true,
    abortEarly: false,
  });

  const format: any = {};

  if (result.error) {
    result.error.details.forEach((detail: any) => {
      format[detail.context.label] = detail.message;
    });
  }

  return format;
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
