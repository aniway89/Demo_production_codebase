/**
 * Inventory Management Routes
 * 
 * @module inventory/routes
 * @author Daniel Lee
 * 
 * Simple CRUD operations for inventory items
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/connection';
import { sendSuccess, sendError } from '../utils/response';
import { getLogger } from '../utils/logger';

const router = Router();
const logger = getLogger('inventory');

/**
 * Get all inventory items
 * 
 * Returns a paginated list of all products in inventory
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Fetch products from database
    const items = await query(
      `SELECT id, name, sku, quantity, price, status FROM products LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    sendSuccess(res, { items, page, limit });
  } catch (err) {
    next(err);
  }
});

/**
 * Get inventory item by ID
 * 
 * Returns details for a specific product
 */
router.get('/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;

    const result = await query(
      `SELECT * FROM products WHERE id = $1`,
      [itemId],
    );

    if (!result || result.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Product not found', 404);
    }

    sendSuccess(res, result[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * Update inventory quantity
 * 
 * Adjusts the stock quantity for a product
 */
router.patch(
  '/:itemId/quantity',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId } = req.params;
      const { quantity } = req.body;

      if (typeof quantity !== 'number') {
        return sendError(res, 'INVALID_INPUT', 'Quantity must be a number', 400);
      }

      // Update quantity
      await query(
        `UPDATE products SET quantity = $1 WHERE id = $2`,
        [quantity, itemId],
      );

      sendSuccess(res, { updated: true, quantity });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Create new inventory item
 * 
 * Adds a new product to inventory
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, sku, quantity, price } = req.body;

    if (!name || !sku || quantity === undefined || !price) {
      return sendError(res, 'INVALID_INPUT', 'Missing required fields', 400);
    }

    const id = require('uuid').v4();

    await query(
      `INSERT INTO products (id, name, sku, quantity, price, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, name, sku, quantity, price, 'active'],
    );

    sendSuccess(res, { id, name, sku, quantity, price }, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * Delete inventory item
 * 
 * Removes a product from inventory
 */
router.delete('/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;

    await query(
      `DELETE FROM products WHERE id = $1`,
      [itemId],
    );

    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export const inventoryRoutes = router;
