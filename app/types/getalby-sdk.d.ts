/**
 * Type declarations for @getalby/sdk/lnclient
 */
declare module "@getalby/sdk/lnclient" {
  export * from "@getalby/sdk/dist/types/lnclient";

  // Explicit exports for TypeScript module resolution
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports, sonarjs/no-duplicate-string -- Type-only import needed for type declarations; module path literal in type declaration
  export type LN = import("@getalby/sdk/dist/types/lnclient").LN;
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Type-only import needed for type declarations
  export type USD = import("@getalby/sdk/dist/types/lnclient").USD;

  // Constructor functions
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Type-only import needed for type declarations
  export const LN: new (
    credentials: string
  ) => import("@getalby/sdk/dist/types/lnclient").LN;
  // USD returns an Amount type that can be used with requestPayment
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Type-only import needed for type declarations
  export function USD(
    amount: unknown
  ): import("@getalby/sdk/dist/types/lnclient").Amount;
}
