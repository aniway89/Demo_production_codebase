import express, { Express, Request, Response, NextlewareHandler } from 'express';
import { authMiddleware } from './auth/middleware';
import { errorHandler } from './utils/error-handler';
import { requestLogger } from './utils/logger';
import { paymentRoutes } from './payments/routes';
import { orderRoutes } from './orders/routes';
import { inventoryRoutes } from './inventory/routes';
import { notificationRoutes } from './notifications/routes';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(requestLogger);
app.use(authMiddleware);

// Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
