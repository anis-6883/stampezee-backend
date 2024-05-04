import { NextFunction, Response } from "express";
import { COOKIE_KEY } from "../configs/constants";
import { apiResponse, decodeAuthToken } from "../helpers";
import { ApiRequest } from "../types";

export default async function auth(req: ApiRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const token = req?.cookies?.[COOKIE_KEY] || req.headers?.authorization?.replace("Bearer ", "");
    if (!token) return apiResponse(res, 401, false, "Unauthorized!");

    const user = await decodeAuthToken(token);
    if (!user) return apiResponse(res, 401, false, "Unauthorized!");

    req.token = token;
    req.user = user;
    return next();
  } catch (err) {
    console.error(err);
    return apiResponse(res, 401, false, "Unauthorized!");
  }
}
