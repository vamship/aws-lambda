'use strict';

/**
 * Utilities for AWS Lambda functions, and a wrapper for lambda functions that
 * injects logger and configuration objects into the lambda handler.
 */
module.exports = {
    /**
     * Handler wrapper.
     */
    HandlerWrapper: require('./handler-wrapper')
};
