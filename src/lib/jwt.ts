import jwt from "jsonwebtoken";
const SECRET = process.env.JWT_SECRET || "change_this_secret";

export function signToken(payload: any, expiresIn = process.env.JWT_EXPIRES_IN || "7d") {
  return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    return null;
  }
}
