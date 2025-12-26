/**
 * Express Type Extensions
 * 
 * Extends Express Request interface with custom properties used in middleware
 */

declare global {
  namespace Express {
    interface Request {
      /**
       * User object attached by authentication middleware (if present)
       * This is optional as not all requests are authenticated
       */
      user?: {
        id: string;
        [key: string]: unknown;
      };
    }
  }
}

export {};



