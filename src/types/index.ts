import { Request } from "express";
import mongoose from "mongoose";

export interface IConfig {
  [key: string]: {
    corsOptions: {
      origin: string[];
      credentials: boolean;
    };
    databaseURI: string;
    port: number | string;
    apiKey: string;
    appSecret: string;
    cookieName: string;
  };
}

export interface IUser {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  image: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
  otp?: number;
  otpExpiry?: Date;
}

export interface IApiRequest extends Request {
  user?: IUser;
  otp?: string;
  token?: string;
}
