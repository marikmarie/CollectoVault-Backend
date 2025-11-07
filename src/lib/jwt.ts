import * as jwt from "jsonwebtoken";

const SECRET: jwt.Secret = process.env.JWT_SECRET ?? "change_this_secret";

export function signToken(
  payload: string | object,
  expiresIn: jwt.SignOptions["expiresIn"] = "7d" 
): string {
  return jwt.sign(payload as jwt.JwtPayload | string, SECRET, { expiresIn });
}

export function verifyToken(token: string): string | jwt.JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as string | jwt.JwtPayload;
  } catch {
    return null;
  }
}


