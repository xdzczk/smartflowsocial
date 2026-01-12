/**
 * Type declarations for @getalby/sdk/lnclient
 */
import type {
  LN as LNType,
  USD as USDType,
  Amount,
} from "@getalby/sdk/dist/types/lnclient";

declare module "@getalby/sdk/lnclient" {
  export * from "@getalby/sdk/dist/types/lnclient";

  // Explicit exports for TypeScript module resolution
  export type LN = LNType;
  export type USD = USDType;

  // Constructor functions
  export const LN: new (credentials: string) => LNType;
  // USD returns an Amount type that can be used with requestPayment
  export function USD(amount: unknown): Amount;
}
