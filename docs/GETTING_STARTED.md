/**
 * Running the application
 * Author: Sarah Chen
 * Last modified: 2024-11-05
 */

# Getting Started

## Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+

## Installation

```bash
npm install
```

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your database and service credentials.

## Database Setup

Run migrations:

```bash
npm run migrate
```

## Development

Start the development server:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

Health check:
```bash
curl http://localhost:3000/health
```

## Production Build

```bash
npm run build
npm start
```

## Background Jobs

In a separate terminal, run the job worker:

```bash
npm run jobs:worker
```

## Running Reconciliation

Manually trigger reconciliation for a merchant:

```bash
curl -X POST http://localhost:3000/api/reconciliation/trigger \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "<merchant-id>",
    "batchSize": 100
  }'
```

## Testing

```bash
npm test
```

## Troubleshooting

### Database connection failed
- Check PostgreSQL is running
- Verify DB_HOST, DB_USER, DB_PASSWORD in .env

### Redis connection failed
- Check Redis is running
- Verify REDIS_HOST and REDIS_PORT

### Payment processing errors
- Ensure STRIPE_SECRET_KEY is configured
- Check payment service logs

## Notes

- First time setup may take a few minutes while migrations run
- Some features require proper environment configuration
- Mock gateway is for testing only - configure real gateway for production
