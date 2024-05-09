/**
 * API documentation
 * Author: Sarah Chen
 * Last modified: 2024-11-07
 */

# Payment Backend API Documentation

## Authentication

All requests (except `/health`) require either:
1. JWT token in `Authorization: Bearer <token>` header
2. API key in `X-API-Key` header

## Endpoints

### Health Check
```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-11-08T10:30:00Z",
  "version": "2.3.4"
}
```

### Authentication

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "merchant@example.com",
  "password": "password"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc..."
  }
}
```

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "merchant@example.com",
  "name": "Merchant Name",
  "password": "password"
}
```

### Payments

#### Create Payment
```
POST /api/payments/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 99.99,
  "currency": "USD",
  "paymentMethod": "card",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440001"
}
```

#### Get Payment Status
```
GET /api/payments/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

### Orders

#### Create Order
```
POST /api/orders/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "550e8400-e29b-41d4-a716-446655440002",
  "items": [
    {
      "productId": "550e8400-e29b-41d4-a716-446655440003",
      "quantity": 2,
      "price": 49.99
    }
  ],
  "shippingAddress": "123 Main St, City, State 12345",
  "billingAddress": "123 Main St, City, State 12345"
}
```

#### Get Order
```
GET /api/orders/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

### Reconciliation

#### Trigger Reconciliation
```
POST /api/reconciliation/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "merchantId": "550e8400-e29b-41d4-a716-446655440004",
  "batchSize": 100
}
```

#### Check Reconciliation Status
```
GET /api/reconciliation/status/550e8400-e29b-41d4-a716-446655440004
Authorization: Bearer <token>
```

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  },
  "meta": {
    "timestamp": "2024-11-08T10:30:00Z",
    "requestId": "req_..."
  }
}
```

## Common Error Codes

- `INVALID_REQUEST` - Missing or invalid parameters
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `PAYMENT_ERROR` - Payment processing failed
- `INTERNAL_ERROR` - Server error
- `AUTH_ERROR` - Authentication failed
- `RECONCILIATION_ERROR` - Reconciliation failed
