# HND Gateway Payment System - Nkwa Pay Integration

## Overview

This document describes the complete payment integration with Nkwa Pay for the HND Gateway backend system. The implementation includes payment initiation, webhook handling, transaction tracking, and comprehensive security features.

## Features

- ✅ **1,000 FCFA Registration Fee** - Fixed fee for student registration
- ✅ **Nkwa Pay API Integration** - Live API integration with staging/production environments
- ✅ **Webhook Support** - Automatic payment status updates via webhooks
- ✅ **Transaction Tracking** - Complete payment history and status monitoring
- ✅ **Security** - Signature verification, IP whitelisting support, and idempotent operations
- ✅ **Admin Dashboard** - Payment statistics and management tools
- ✅ **Error Handling** - Comprehensive error handling and retry mechanisms
- ✅ **Phone Number Validation** - Automatic Cameroon phone number formatting

## API Endpoints

### Public Endpoints

#### Get Payment Fee
```http
GET /api/payment/fee
```
Returns current payment fee information.

**Response:**
```json
{
  "success": true,
  "data": {
    "amount": 1000,
    "currency": "XAF",
    "formattedAmount": "1,000 FCFA"
  }
}
```

#### Webhook Endpoint
```http
POST /api/payment/webhook
```
Receives payment status updates from Nkwa Pay.

**Headers:**
- `X-Signature` or `X-Nkwa-Signature`: Webhook signature for verification

**Payload:**
```json
{
  "reference": "HND_1708000000000_ABC123",
  "status": "successful",
  "transactionId": "NKWA_123456789",
  "amount": 1000,
  "phoneNumber": "237671234567"
}
```

### Authenticated User Endpoints

#### Initiate Payment
```http
POST /api/payment/initiate
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "phone": "671234567",
  "purpose": "registration_fee",
  "description": "HND Gateway Registration Fee"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "HND_1708000000000_ABC123",
    "nkwaTransactionId": "NKWA_123456789",
    "amount": 1000,
    "phoneNumber": "237671234567",
    "status": "processing",
    "message": "Payment request sent. Please check your phone for the payment prompt."
  }
}
```

#### Check Payment Status
```http
GET /api/payment/status/:transactionId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "HND_1708000000000_ABC123",
    "status": "success",
    "amount": 1000,
    "phoneNumber": "237671234567",
    "completedAt": "2026-02-15T10:30:00.000Z",
    "webhookReceived": true
  }
}
```

#### Get Payment History
```http
GET /api/payment/history?page=1&limit=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

### Admin Endpoints

#### Get All Payments
```http
GET /api/payment/admin/all?page=1&limit=20&status=success
Authorization: Bearer <admin_token>
```

#### Get Payment Statistics
```http
GET /api/payment/admin/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "byStatus": [
      { "_id": "success", "count": 150, "totalAmount": 150000 },
      { "_id": "pending", "count": 5, "totalAmount": 5000 }
    ],
    "totalPayments": 155,
    "successfulPayments": 150,
    "pendingPayments": 5,
    "totalRevenue": 150000,
    "todayPayments": 12,
    "paymentFee": 1000,
    "recentPayments": [...]
  }
}
```

#### Retry Payment Webhook
```http
POST /api/payment/admin/retry/:transactionId
Authorization: Bearer <admin_token>
```

## Environment Configuration

Add these variables to your `.env` file:

```env
# Nkwa Pay Integration
NKWAPAY_API_KEY=your_live_api_key_here
NKWAPAY_BASE_URL=https://api.pay.mynkwa.com
# For staging: https://api.pay.staging.mynkwa.com
NKWAPAY_WEBHOOK_SECRET=your_webhook_secret_here
PAYMENT_FEE=1000
WEBHOOK_URL=https://yourdomain.com/api/payment/webhook
```

## Phone Number Format

The system automatically formats Cameroon phone numbers:

- Input: `671234567` → Output: `237671234567`
- Input: `237671234567` → Output: `237671234567` (no change)
- Invalid formats will throw an error

## Payment States

| Status | Description | User Action Required |
|--------|-------------|---------------------|
| `pending` | Payment record created, waiting for Nkwa Pay response | None |
| `processing` | Payment sent to user's phone, awaiting confirmation | Check phone and confirm payment |
| `success` | Payment completed successfully | None |
| `failed` | Payment failed or was cancelled | Try again or contact support |
| `refunded` | Payment was refunded | None |

## Webhook Security

### Signature Verification

Webhooks are secured using HMAC-SHA256 signatures:

```javascript
const crypto = require('crypto');

const expectedSignature = crypto
  .createHmac('sha256', process.env.NKWAPAY_WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

### Best Practices

1. **Webhook Endpoint**: Make sure `/api/payment/webhook` is publicly accessible
2. **IP Whitelisting**: Configure allowed IPs in Nkwa Pay dashboard if needed
3. **SSL Certificate**: Use trusted SSL certificates for webhook security
4. **Idempotency**: The system handles duplicate webhooks automatically
5. **Timeout Handling**: Payments timeout after 10 minutes if not completed

## Testing

### Using the Test File

1. Update test credentials in `test-payment.js`
2. Start your server: `npm start`
3. Run tests: `node test-payment.js`

### Manual Testing with cURL

```bash
# Get payment fee
curl -X GET http://localhost:5000/api/payment/fee

# Initiate payment (requires auth token)
curl -X POST http://localhost:5000/api/payment/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "671234567"}'

# Test webhook
curl -X POST http://localhost:5000/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "TEST_123",
    "status": "successful",
    "transactionId": "NKWA_123",
    "amount": 1000,
    "phoneNumber": "237671234567"
  }'
```

## Database Schema

### Payment Model

```javascript
{
  transactionId: String,        // Our unique transaction ID
  nkwaTransactionId: String,    // Nkwa Pay transaction ID
  amount: Number,               // Payment amount in FCFA
  phoneNumber: String,          // User's phone number
  currency: String,             // Always 'XAF' for FCFA
  status: String,               // Payment status
  userId: ObjectId,             // Reference to User
  userEmail: String,            // User's email
  purpose: String,              // Payment purpose
  description: String,          // Payment description
  nkwaPayResponse: Mixed,       // Original Nkwa Pay response
  webhookReceived: Boolean,     // Whether webhook was received
  webhookData: Mixed,           // Webhook payload
  webhookAttempts: Number,      // Number of webhook attempts
  initiatedAt: Date,           // When payment was initiated
  completedAt: Date,           // When payment was completed
  metadata: Mixed,             // Additional data
  errorMessage: String,        // Error message if failed
  errorCode: String           // Error code if failed
}
```

### User Model Updates

New payment-related fields added to User model:

```javascript
{
  paymentStatus: String,        // 'pending', 'completed', 'failed', 'exempt'
  paymentDate: Date,           // When payment was completed
  paymentAmount: Number,       // Amount paid
  paymentTransactionId: String // Reference to payment transaction
}
```

## Error Handling

The system handles various error scenarios:

- **Network Issues**: Automatic retries and graceful degradation
- **Invalid Phone Numbers**: Clear validation errors
- **Duplicate Payments**: Prevention of multiple pending payments
- **Webhook Failures**: Automatic retry mechanisms
- **Timeout Handling**: Payments auto-fail after 10 minutes

## Production Deployment

### Nkwa Pay Configuration

1. **Get Live API Key**: Request production API key from Nkwa Pay
2. **Update Environment**: Change `NKWAPAY_BASE_URL` to production endpoint
3. **Configure Webhook**: Set your live webhook URL in Nkwa Pay dashboard
4. **IP Whitelisting**: Configure IP whitelist if required
5. **SSL Certificate**: Ensure valid SSL certificate on your domain

### Environment Variables for Production

```env
NKWAPAY_API_KEY=your_live_api_key
NKWAPAY_BASE_URL=https://api.pay.mynkwa.com
WEBHOOK_URL=https://your-live-domain.com/api/payment/webhook
```

## Monitoring and Logging

The system provides comprehensive logging:

- Payment initiation attempts
- Webhook receipts and processing
- Error conditions and failures
- Status changes and completions

Monitor these logs for:
- Payment success rates
- Webhook delivery issues
- Error patterns
- Performance metrics

## Support and Maintenance

### Common Issues

1. **Webhook Not Received**: Check webhook URL accessibility and SSL certificate
2. **Payment Timeout**: Verify user's mobile money account status
3. **Invalid Phone Number**: Ensure proper Cameroon number format
4. **Signature Verification Failed**: Verify webhook secret configuration

### Maintenance Tasks

- Monitor payment success rates
- Clean up old failed payments periodically
- Update webhook secrets regularly
- Monitor API rate limits
- Backup payment data regularly

## Security Considerations

1. **API Key Protection**: Never expose API keys in client-side code
2. **Webhook Authentication**: Always verify webhook signatures
3. **User Authorization**: Ensure users can only access their own payments
4. **Data Validation**: Validate all input data thoroughly
5. **Error Logging**: Don't expose sensitive information in error messages
6. **Rate Limiting**: Implement rate limiting on payment endpoints

## Contact

For technical issues or questions about the payment integration, contact:
- Backend Developer: [Your contact information]
- Nkwa Pay Support: [Nkwa Pay support details]