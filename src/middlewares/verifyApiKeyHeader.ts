import { NextFunction, Request, Response } from "express";

const verifyApiKeyHeader = (req: Request, res: Response, next: NextFunction) => {
  const API_KEY = req.headers["x-api-key"];
  if (API_KEY !== process.env.API_KEY) {
    res.status(401).json({
      status: false,
      message: "Unauthorized: Please provide a valid API Key!",
    });
  } else {
    next();
  }
};

export default verifyApiKeyHeader;

// export function checkRole(allowed) {
//   return async (req, res, next) => {
//     try {
//       if (allowed.includes(req.user.role)) return next();
//       else throw new Error('Unauthorized.');
//     } catch (e) {
//       res.status(401).send(UNAUTHORIZED);
//     }
//   };
// }

// export async function auth(req, res, next) {
//   try {
//     const token = req?.cookies?.[process.env.COOKIE_KEY] || req?.headers?.authorization?.replace('Bearer', '');

//     if (!token) {
//       return res.status(401).send(UNAUTHORIZED);
//     }

//     const { user, decoded } = await decodeAuthToken(token, process.env.JWT_SECRET_ACCESS);

//     if (!user || !decoded) {
//       return res.status(403).send(FORBIDDEN);
//     }

//     req.user = user;
//     next();
//   } catch (err) {
//     console.log(err);
//     res.status(500).send(SERVER_ERR);
//   }
// }
