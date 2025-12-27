/**
 * Payment factory for creating test payments
 * Uses builder pattern for flexible test data creation
 */

import type { Payment, PaymentStatus } from "@prisma/client";

import { TEST_USER_ID } from "../utils/test-helpers";

export interface PaymentFactoryOptions {
  id?: string;
  userId?: string;
  amount?: number;
  amountUsd?: number | null;
  invoice?: string;
  paymentHash?: string;
  preimage?: string | null;
  status?: PaymentStatus;
  description?: string | null;
  subscriptionId?: string | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  paymentMethod?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PaymentFactory {
  private options: PaymentFactoryOptions;

  constructor(options: PaymentFactoryOptions = {}) {
    const paymentId = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.options = {
      id: paymentId,
      userId: TEST_USER_ID,
      amount: 1000, // 1000 sats
      amountUsd: null,
      invoice: `lnbc${Math.random().toString(36).substring(7)}`,
      paymentHash: `hash-${Math.random().toString(36).substring(7)}`,
      preimage: null,
      status: "PENDING",
      description: null,
      subscriptionId: null,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      paidAt: null,
      failedAt: null,
      failureReason: null,
      paymentMethod: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...options,
    };
  }

  withId(id: string): this {
    this.options.id = id;
    return this;
  }

  withUserId(userId: string): this {
    this.options.userId = userId;
    return this;
  }

  withAmount(amount: number, amountUsd?: number): this {
    this.options.amount = amount;
    this.options.amountUsd = amountUsd || null;
    return this;
  }

  withInvoice(invoice: string): this {
    this.options.invoice = invoice;
    return this;
  }

  withPaymentHash(paymentHash: string): this {
    this.options.paymentHash = paymentHash;
    return this;
  }

  asPending(): this {
    this.options.status = "PENDING";
    this.options.paidAt = null;
    this.options.failedAt = null;
    return this;
  }

  asPaid(paidAt?: Date): this {
    this.options.status = "COMPLETED";
    this.options.paidAt = paidAt || new Date();
    this.options.failedAt = null;
    this.options.preimage = `preimage-${Math.random().toString(36).substring(7)}`;
    return this;
  }

  asFailed(failureReason?: string, failedAt?: Date): this {
    this.options.status = "FAILED";
    this.options.failedAt = failedAt || new Date();
    this.options.failureReason = failureReason || "Payment failed";
    this.options.paidAt = null;
    return this;
  }

  withSubscription(subscriptionId: string): this {
    this.options.subscriptionId = subscriptionId;
    return this;
  }

  withDescription(description: string): this {
    this.options.description = description;
    return this;
  }

  withExpiresAt(expiresAt: Date): this {
    this.options.expiresAt = expiresAt;
    return this;
  }

  build(): Payment {
    return {
      id: this.options.id!,
      userId: this.options.userId!,
      amount: this.options.amount || 0,
      amountUsd: this.options.amountUsd || null,
      invoice: this.options.invoice || "",
      paymentHash: this.options.paymentHash || "",
      preimage: this.options.preimage || null,
      status: this.options.status || "PENDING",
      description: this.options.description || null,
      subscriptionId: this.options.subscriptionId || null,
      expiresAt: this.options.expiresAt || null,
      paidAt: this.options.paidAt || null,
      failedAt: this.options.failedAt || null,
      failureReason: this.options.failureReason || null,
      paymentMethod: this.options.paymentMethod || null,
      createdAt: this.options.createdAt || new Date(),
      updatedAt: this.options.updatedAt || new Date(),
    } as Payment;
  }
}

/**
 * Convenience functions for common payment types
 */
export const paymentFactory = {
  /**
   * Create a pending payment
   */
  pending: (overrides?: PaymentFactoryOptions) => {
    return new PaymentFactory(overrides).asPending().build();
  },

  /**
   * Create a completed payment
   */
  paid: (overrides?: PaymentFactoryOptions) => {
    return new PaymentFactory(overrides).asPaid().build();
  },

  /**
   * Create a failed payment
   */
  failed: (failureReason?: string, overrides?: PaymentFactoryOptions) => {
    return new PaymentFactory(overrides).asFailed(failureReason).build();
  },

  /**
   * Create multiple payments
   */
  many: (count: number, overrides?: PaymentFactoryOptions) => {
    return Array.from({ length: count }, (_, i) =>
      new PaymentFactory({ ...overrides, id: `payment-${i + 1}` }).build(),
    );
  },
};







