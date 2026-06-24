import { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Express 4 tidak otomatis menangkap rejection dari async handler,
// sehingga error (ApiError, ZodError) tidak akan sampai ke errorHandler tanpa wrapper ini.
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
