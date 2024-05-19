/**
 * API Response standardization utilities
 * 
 * @module utils/response
 * @author Sarah Chen
 * 
 * Provides consistent response formatting across all API endpoints
 * with proper error handling and metadata.
 */

import { Response } from 'express';

/**
 * Standard API response format
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Send successful response
 * @param res - Express response object
 * @param data - Response data
 * @param statusCode - HTTP status code (default 200)
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  requestId?: string,
): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
  } as ApiResponse<T>);
};

/**
 * Send error response
 * @param res - Express response object
 * @param code - Error code
 * @param message - Error message
 * @param statusCode - HTTP status code (default 400)
 * @param details - Optional error details
 */
export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: Record<string, any>,
): Response => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  } as ApiResponse<never>);
};

export const ApiResponses = {
  sendSuccess,
  sendError,
};
