import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { APP_SECRET } from "../configs/constants";
import User from "../modules/user/model";

export const asyncHandler = (func: any) => async (req: Request, res: Response) => {
  try {
    await func(req, res);
  } catch (err) {
    return res.status(400).json({ status: false, message: err.message });
  }
};

export const apiResponse = (res: Response, statusCode: number, status: boolean, message: string, data?: any) => {
  return res.status(statusCode).json({ status, message, data });
};

export const validateBody = (schema: any, body: Object): Boolean => {
  const result = schema.validate(body, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (result.error) return false;
  return true;

  // if (result.error) {
  //   const format: any = {};
  //   result.error.details.forEach((detail: any) => {
  //     format[detail.context.label] = detail.message;
  //   });
  // }
};

export const decodeAuthToken = async (token: string) => {
  try {
    const decoded: any = jwt.verify(token, process.env.APP_SECRET!);
    const user = await User.findOne({ email: decoded?.email });
    if (!user) throw new Error("User not found!");
    return user;
  } catch (err) {
    console.error(err);
  }
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

export const exclude = (existingApp: any, keys: any[]) => {
  for (let key of keys) {
    delete existingApp[key];
  }
  return existingApp;
};
