import bcrypt from "bcrypt";
import { Request, Response } from "express";
import { COOKIE_KEY, REFRESH_TOKEN_KEY } from "../../configs/constants";
import operations from "../../controllers/operations";
import { apiResponse, generateSignature } from "../../helpers";
import { IUser } from "../../types";
import User from "./model";

export const createUser = async (req: Request, res: Response, role: string) => {
  const existingAdmin = await operations.findOne({ table: User, key: { email: req.body.email } });
  if (existingAdmin) return apiResponse(res, 400, false, "User already exists!");

  req.body.password = await bcrypt.hash(req.body.password, 10);

  const admin: IUser = await operations.create({ table: User, key: { ...req.body, role: role } });

  const accessToken = generateSignature({ email: admin.email, role: admin.role }, "1d");
  const refreshToken = generateSignature({ email: admin.email, role: admin.role }, "7d");

  res.cookie(COOKIE_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  res.cookie(REFRESH_TOKEN_KEY, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    sameSite: process.env.NODE_ENV === "development" ? "lax" : "none",
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return apiResponse(res, 201, true, "Admin Registration Successfully!", admin);
};
