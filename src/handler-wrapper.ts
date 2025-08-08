import { argValidator as _argValidator } from '@vamship/arg-utils';
import _logManager, { ILogger } from '@vamship/logger';
import {
    HandlerInput,
    KeepWarmResponse,
    Handler,
    WrappedHandler,
} from './types/index.js';
import { Context } from 'aws-lambda';

const DEFAULT_ALIAS = 'default';

/**
 * Utility class that creates wrappers for AWS Lambda functions by wrapping a
 * simple Node.js function that serves as a lambda handler. These wrappers
 * initialize and inject a logger object, and also allow underlying
 * implementations to return promises for asynchronous operations.
 */
export class HandlerWrapper {
    private _appName: string;
    private _logger: ILogger;

    /**
     * @param appName The name of the application to which the lambda functions
     * returned by this object belong. This value will be injected into log
     * statements emitted by the logger.
     *
     * A single wrapper instance can be used to wrap multiple lambda handlers,
     * so the appName is more like a namespace/group name for the handlers.
     */
    constructor(appName: string) {
        _argValidator.checkString(appName, 1, 'Invalid appName (arg #1)');

        this._appName = appName;
        this._logger = _logManager
            .configure(this._appName, {
                level: 'info',
            })
            .getLogger('handler-wrapper');
    }

    /**
     * Creates and returns a wrapper lambda handler.
     *
     * @param handler A function that contains the intended lambda
     * functionality.
     * @param handlerName The name of the handler. Used for logging.
     *
     * @return {WrappedHandler} A function that can be used as the AWS lambda
     * handler.
     */
    wrap<TInput extends HandlerInput, TOutput = void>(
        handler: Handler<TInput, TOutput>,
        handlerName: string,
    ): WrappedHandler<TInput, TOutput> {
        _argValidator.checkFunction(handler, 'Invalid handler (arg #1)');
        _argValidator.checkString(
            handlerName,
            1,
            'Invalid handlerName (arg #2)',
        );

        // Create and return a wrapper function that can be used as the
        // AWS Lambda handler.
        return async (event, context) => {
            try {
                let alias = context.invokedFunctionArn.split(':')[7];
                if (typeof alias === 'undefined' || alias === '$LATEST') {
                    alias = DEFAULT_ALIAS;
                }

                const logger = this._logger.child({
                    handler: handlerName,
                    awsRequestId: context.awsRequestId,
                });
                logger.level = process.env.LOG_LEVEL || logger.level;

                if (event.__LAMBDA_KEEP_WARM) {
                    // eslint-disable-next-line no-console
                    console.log('Keep warm request received. Skipping');
                    return { __LAMBDA_KEEP_WARM: true };
                } else {
                    // eslint-disable-next-line no-console
                    console.log(`Invoking handler [${handlerName}:${alias}]`);
                    const result = await handler(event, context, {
                        logger,
                        alias,
                    });

                    // eslint-disable-next-line no-console
                    console.log(
                        `Handler [${handlerName}:${alias}] completed successfully`,
                    );
                    return result;
                }
            } catch (ex) {
                // eslint-disable-next-line no-console
                console.error('Error processing lambda function', ex);
                throw ex;
            }
        };
    }
}
