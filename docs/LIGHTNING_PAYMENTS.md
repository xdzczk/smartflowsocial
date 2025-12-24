# Lightning Payments System

This documentation covers the Lightning Network payment integration for SmartFlow Social plan subscriptions.

## Overview

The payment system uses the owner's Lightning wallet (via NWC - Nostr Wallet Connect) to receive payments from users purchasing plans. When users select a paid plan, an invoice is generated and they pay to the owner's wallet. Upon payment completion, their account is automatically activated with the selected plan features.

## Architecture

### Models (`app/models/payment.server.ts`)
- `createPlanInvoice()` - Generates Lightning invoices using owner's NWC
- `handlePaymentCompleted()` - Processes successful payments
- `updateUserSubscription()` - Updates user's plan and enables account
- `checkPaymentStatus()` - Checks if payment has been completed
- `getUserSubscription()` - Gets user's current subscription info
- `getAllPlans()` - Fetches available plans from database

### Payment Flow
1. **User selects plan** → Creates invoice via owner's NWC
2. **User pays invoice** → Lightning payment to owner's wallet
3. **Payment detected** → Triggers `onPaid()` callback
4. **Database updated** → User subscription activated, account enabled
5. **User gets access** → Full plan features unlocked

## Environment Variables

```env
# Owner's Nostr Wallet Connect string for receiving payments
OWNER_NWC=nostr+walletconnect://...
```

## Usage Examples

### Basic Invoice Creation
```typescript
import { createPlanInvoice } from "~/models/payment.server";

const invoice = await createPlanInvoice({
  planId: "basic", // plan ID from database
  userId: "user123",
  description: "SmartFlow Social Basic Plan"
});

// Returns:
// {
//   invoice: "lnbc...", // Lightning invoice string
//   paymentHash: "abc123...",
//   amount: 2800, // amount in satoshis
//   amountUsd: 28, // amount in USD
//   expiresAt: Date, // 30 minutes from creation
//   paymentId: "basic_1697123456_user123"
// }
```

### Check Payment Status
```typescript
import { checkPaymentStatus } from "~/models/payment.server";

const status = await checkPaymentStatus("basic_1697123456_user123");

// Returns:
// {
//   status: "COMPLETED", // PENDING, COMPLETED, EXPIRED, FAILED
//   paid: true,
//   paidAt: Date
// }
```

### Get User Subscription
```typescript
import { getUserSubscription } from "~/models/payment.server";

const subscription = await getUserSubscription("user123");

// Returns subscription with plan details, status, billing dates, etc.
```

## Payment Callbacks

The system automatically handles payment completion using the Alby SDK:

```typescript
// In createPlanInvoice()
request
  .onPaid(async () => {
    // Automatically triggered when payment is received
    await handlePaymentCompleted(paymentId, userId, planId);
  })
  .onTimeout(30 * 60, async () => { 
    // Triggered if no payment after 30 minutes
    await handlePaymentTimeout(paymentId);
  });
```

## Database Schema

### Payment Model
- `id` - Unique payment identifier
- `userId` - User making the payment
- `amount` - Amount in satoshis
- `amountUsd` - Amount in USD
- `invoice` - Lightning invoice string
- `paymentHash` - Lightning payment hash
- `status` - PENDING, COMPLETED, EXPIRED, FAILED, CANCELED
- `subscriptionId` - Link to user's subscription
- `expiresAt` - Invoice expiration time

### Subscription Model
- `userId` - User ID (unique)
- `planId` - Selected plan ID
- `status` - ACTIVE, INACTIVE, CANCELED, etc.
- `currentPeriodStart/End` - Billing period dates
- `nextPaymentDue` - Next payment date (null for lifetime)

## Frontend Integration

The `/plans` route handles the complete user flow:

1. **Display Plans** - Shows all available plans with features
2. **Plan Selection** - User clicks "Choose Plan" button
3. **Invoice Generation** - Action creates invoice via payment model
4. **Payment Modal** - Shows Lightning invoice for user to pay
5. **Status Checking** - User can check if payment completed
6. **Success State** - Shows success message and reloads page

### Key UI Components
- Plan cards with feature comparison
- Lightning invoice modal with copy functionality
- Payment status checking
- Success/error message handling
- Loading states during processing

## Security Features

- **Server-side validation** of all payment data
- **Authenticated users only** can purchase plans
- **Payment expiration** (30 minutes) prevents stale invoices
- **Status tracking** prevents duplicate payments
- **Error handling** with proper user feedback

## Testing

### Test with Free Plan
The free plan bypasses Lightning payments and immediately activates:

```typescript
// Free plan creates completed payment record instantly
const freeInvoice = await createPlanInvoice({
  planId: "free",
  userId: "testuser",
});

// Returns { invoice: "free_plan", paid: true, ... }
```

### Test Environment Setup
1. Set up a test Lightning wallet with NWC
2. Configure `OWNER_NWC` environment variable
3. Seed database with test plans: `npm run db:seed`
4. Test the full payment flow on development server

## Error Handling

The system handles various error scenarios:

- **Missing OWNER_NWC** - Throws configuration error
- **Invalid plan ID** - Throws plan not found error
- **Payment timeout** - Marks payment as expired
- **Network issues** - Graceful error messages to user
- **Database failures** - Proper error logging and user feedback

## Monitoring

Key metrics to monitor:
- Payment completion rates
- Invoice expiration rates
- Average time to payment
- Failed payment reasons
- User conversion by plan type

All payment events are logged for debugging and analytics.