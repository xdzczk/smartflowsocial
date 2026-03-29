-- AlterEnum
ALTER TYPE "BillingPaymentMethod" ADD VALUE 'btc_btcpay_onchain';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "btcpayInvoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_btcpayInvoiceId_key" ON "Payment"("btcpayInvoiceId");
