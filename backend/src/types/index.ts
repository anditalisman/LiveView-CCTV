import { Role } from "@prisma/client";

export interface AuthTokenPayload {
  sub: string; // user id
  username: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}
