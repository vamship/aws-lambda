'use strict';

const Promise = require('bluebird').Promise;
const { argValidator: _argValidator } = require('@vamship/arg-utils');
const _logger = require('@vamship/logger');
const _config = require('@vamship/config');

const DEFAULT_ALIAS = 'default';

/**
 * Utility class that creates wrappers for AWS Lambda functions by wrapping a
 * simple Node.js function that serves as a lambda handler. These wrappers
 * initialize and inject configuration and logger objects, and also allow
 * underlying implementations to return promises for asynchronous operations.
 */
class HandlerWrapper {
    /**
     * A function that contains the core execution logic of the lambda function.
     * This function receives the input and context from the AWS lambda, along
     * with some extended properties, and can return any value, including a
     * Promise for asynchronous operations.
     *
     * @callback HandlerWrapper.Handler
     * @param {Object} event The input to the lambda function, not altered
     *        in any way by the wrapper.
     * @param {Object} contex The
     *        [AWS lambda context]{@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html},
     *        not altered in any way by the wrapper.
     * @param {Object} ext Extended parameters passed to the handler. These
     *        are values injected by the wrapper, providing utility objects
     *        that the handler can optionally utilize.
     * @param {Object} ext.config A properly scoped configuration object. This
     *        object contains configuration parameters for a specific
     *        environment, based on the lambda alias value.
     * @param {Object} ext.logger A logger object that can be used to write log
     *        messages. The logger object is pre initialized with some metadata
     *        that includes the application name, lambda handler name and the
     *        lamnda execution id. More properties may be added to it if
     *        necessary by invoking <code>logger.child()</code>.
     * @param {String} ext.alias The alias with which the lambda function was
     *        invoked. If the lambda was not invoked unqualified or as latest
     *        version ($LATEST), the alias value will be set to "default".
     *
     * @return {Promise|*} The response from the lambda handler execution. If
     *         a promise is returned, the the wrapper will wait for resolution
     *         or rejection of the promise, and use the corresponding result
     *         as the response value of the lambda.
     */

    /**
     * A function that conforms to the AWS signature. This function initializes
     * the logger and config objects, and delegates actual execution to a
     * [handler function]{@link HandlerWrapper.Handler}.
     *
     * <p>The wrapper also provides lambda keep warm capability that can be
     * used to keep the lambda in cache without actually invoking the
     * [handler function]{@link HandlerWrapper.Handler}.
     * This can be accomplished by passing a parameter called
     * <code>__LAMBDA_KEEP_WARM</code> with a truthy value to the wrapper.
     * </p>
     *
     * @callback HandlerWrapper.Wrapper
     * @param {Object} event The input to the lambda function, not altered
     *        in any way by the wrapper.
     * @param {Object} contex The
     *        [AWS lambda context]{@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html}.
     * @param {Function} callback The
     *        [callback]{@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html#nodejs-prog-model-handler-callback}
     *        function passed to the AWS lambda.
     */

    /**
     * @param {String} appName The name of the application to which the lambda
     *        functions returned by this object belong. This value will be
     *        injected into log statements emitted by the logger.
     */
    constructor(appName) {
        _argValidator.checkString(appName).throw('Invalid appName (arg #1)');

        this._appName = appName;
        this._config = _config.configure(this._appName, {
            log: {
                level: 'info'
            }
        });
        this._logger = _logger.configure(this._appName, {
            level: 'info'
        });
    }

    /**
     * Creates and returns a wrapper lambda handler.
     *
     * @param {HandlerWrapper.Handler} handler A function that contains the
     *        intended lambda functionality.
     * @param {String} handlerName The name of the handler. Used for logging.
     *
     * @return {HandlerWrapper.Wrapper} A function that can be used as the
     *         AWS lambda handler.
     */
    wrap(handler, handlerName) {
        _argValidator.checkFunction(handler).throw('Invalid handler (arg #1)');
        _argValidator
            .checkString(handlerName)
            .throw('Invalid handler name (arg #2)');

        return (event, context, callback) => {
            Promise.try(() => {
                let alias = context.invokedFunctionArn.split(':')[7];
                if (typeof alias === 'undefined' || alias === '$LATEST') {
                    alias = DEFAULT_ALIAS;
                }
                // eslint-disable-next-line no-console
                console.log(`Setting lambda alias to: [${alias}]`);

                const config = this._config.getConfig(alias);
                const logger = this._logger.getLogger(handlerName, {
                    awsRequestId: context.awsRequestId
                });
                logger.level = config.get('log.level');

                if (event.__LAMBDA_KEEP_WARM) {
                    // eslint-disable-next-line no-console
                    console.log('Keep warm request received. Skipping');
                    return;
                } else {
                    return handler(event, context, {
                        logger,
                        config,
                        alias
                    });
                }
            })
                .then((data) => {
                    // eslint-disable-next-line no-console
                    console.log('Lambda execution completed');

                    callback(null, data);
                })
                .catch((ex) => {
                    // eslint-disable-next-line no-console
                    console.error('Error processing lambda function', ex);

                    callback(ex);
                });
        };
    }
}

module.exports = HandlerWrapper;
