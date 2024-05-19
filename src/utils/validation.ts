/**
 * Request validation utilities
 * 
 * @module utils/validation
 * @author Sarah Chen
 * 
 * Provides schema validation using Joi with Express middleware integration.
 * Centralizes all request validation logic for consistency.
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from './error-handler';

/**
 * Validation schema for payment requests
 */
export const paymentSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  gatewayId: Joi.string().required(),
  metadata: Joi.object().optional(),
});

/**
 * Validation schema for order requests
 */
export const orderSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().positive().required(),
        price: Joi.number().positive().required(),
      }),
    )
    .min(1)
    .required(),
  shippingAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().required(),
  }).required(),
});

/**
 * Creates validation middleware
 * @param schema - Joi schema
 * @param property - Request property to validate (body, query, params)
 */
export const createValidator = (
  schema: Joi.Schema,
  property: 'body' | 'query' | 'params' = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.reduce((acc, err) => {
        acc[err.path.join('.')] = err.message;
        return acc;
      }, {} as Record<string, string>);

      throw new ValidationError('Validation failed', details);
    }

    req[property] = value;
    next();
  };
};

/**
 * Middleware factory for common validators
 */
export const validators = {
  payment: createValidator(paymentSchema),
  order: createValidator(orderSchema),
};
