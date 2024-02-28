'use strict';
import { HandlerWrapper } from './handler-wrapper.js';
/**
 * Utilities for AWS Lambda functions, and a wrapper for lambda functions that
 * injects logger and configuration objects into the lambda handler.
 */
export * from './handler-wrapper.js';
export default HandlerWrapper;
