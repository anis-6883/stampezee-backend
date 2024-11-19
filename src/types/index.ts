import { Request } from "express";
import mongoose from "mongoose";

export interface Object {
  [key: string]: any;
}

export interface DataItem {
  _id: string;
  slugs: string[];
}

export interface IEnrollPayment {
  id: string;
  metadata: any;
  payment_intent: any;
  amount_total: number;
}
export interface IEnrollSubscriptionBody {
  slugs: string[];
  branchIds?: string[];
  stampIds?: string[];
  code: string;
  currency: string;
}

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
  fullName?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  dialCode?: string;
  storeName?: string;
  branchId?: string;
  retailerId?: string;
  email: string;
  password: string;
  image: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
  otp: number;
  otpExpiry: Date;
  isVerified: boolean;
  verifiedAt: Date;
  takeFreeTrial: boolean;
  provider?: string;
  address?: {
    loc: {
      type: string;
      coordinates: number[];
    };
    name: string;
  };
  _doc?: any;
  businessCurrency?: any;
}

export interface IApiRequest extends Request {
  user?: IUser;
  otp?: string;
  token?: string;
  role: string;
}

export interface ILineItem {
  price?: string | any;
  price_data?: {
    unit_amount: number;
    currency: string;
    product_data: { name: string; description?: string; metadata?: { enrollSubscriptionId: string; prev?: string } };
    recurring?: { interval: "day" | "week" | "month" | "year" };
  };
  quantity: number;
}

export interface IOwn {
  totalStampCollected: Number;
  rewardTaken: Boolean;
  stampCollectionDate: { createdAt: Date }[];
}

export interface IStamp {
  rewardCollected: boolean;
  createdAt: Date;
}

export interface INumberObject {
  [key: string]: string | number;
}

export interface IJWTQuery {
  email: string;
  token?: string;
}

export interface IJWTQuery {
  email: string;
  token?: string;
}

export interface IRetailerScanQuery {
  retailerId?: mongoose.Types.ObjectId;
  customerId?: object;
  rewardCollected?: boolean;
}

export interface ISuperAdminScanQuery {
  $or?: object[];
}
