import { ILogger } from '@vamship/logger';
import { Context } from 'aws-lambda';

/**
 * Defines the extended parameters that are passed to the lambda handler by the
 * handler wrapper.
 *
 * These properties include utility objects such as a logger that the handler
 * can then use in its execution.
 */
export interface IExtendedParameters {
    /**
     * A logger instance to use for logging within the handler.
     */
    logger: ILogger;

    /**
     * An alias for the Lambda function, used for logging purposes.
     */
    alias: string;
}

/**
 * Default input type for Lambda handlers, which includes an optional property
 * to indicate if the invocation is a keep-warm event.
 */
export type HandlerInput = {
    /**
     * Indicates whether the Lambda function is being invoked to keep it warm.
     * This is typically used to prevent cold starts by invoking the function
     * periodically.
     *
     * If omitted, the assumption is that the function is not being invoked
     * for keep-warm purposes.
     */
    __LAMBDA_KEEP_WARM?: boolean;
}

/**
 * Response from the handler wrapper when the Lambda is invoked for keep-warm
 * purposes.
 */
export type KeepWarmResponse = {
    __LAMBDA_KEEP_WARM: boolean;
}

/**
 * Handler function that implements the core execution logic for a Lambda
 * function.
 *
 * @param event Input arguments to the Lambda function - passed directly from
 * the lambda event.
 * @param context The Lambda context object that provides information about
 * the invocation, function, and execution environment.
 * @param params Additional parameters that can be used during lambda execution.
 *
 * @returns A promise that resolves when the handler has completed its
 * execution.
 */
export type Handler<TInput extends HandlerInput, TOutput=void> = (
    event: TInput,
    context: Context,
    params: IExtendedParameters
) => Promise<TOutput>;

/**
 * A lambda handler wrapper function that wraps the actual handler logic. This
 * is invoked by AWS Lambda directly, and delegates to the actual handler if the
 * input event is not a keep-warm event.
 *
 * @param event Input arguments to the Lambda function - passed directly from
 * the lambda event.
 * @param context The Lambda context object that provides information about
 * the invocation, function, and execution environment.
 *
 * @returns A promise that resolves with either the handler's output or a
 *          keep-warm response.
 */
export type WrappedHandler<TInput extends HandlerInput, TOutput=void> = (
    event: TInput,
    context: Context
) => Promise<TOutput | KeepWarmResponse>;
