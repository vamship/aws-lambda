# @vamship/aws-lambda

_AWS lambda utilities that include a standardized wrapper for handlers that pre
configures logger and config objects, and supports promises for async handler
execution._

The primary export from this library is a wrapper object converts a simple
javascript function into an AWS lambda function, providing pre configured logger
and config objects.

# Motivation

[AWS Lambda](https://aws.amazon.com/lambda) is a very popular mechanism for
developing server less applications that do allow for on-demand execution of
code without requiring provisioning of servers. It is possible to use a
collection of loosely coupled, stateless lambda function to provide fairly
complex application functionality, by exposing lambda functionality via
[API Gateways](https://aws.amazon.com/api-gateway), and/or using event triggers
from a wide variety of
[sources](https://docs.aws.amazon.com/lambda/latest/dg/invoking-lambda-function.html#intro-core-components-event-sources).

Lambda functions require the handler to accept a callback function that needs to
be invoked with an error or data values to indicate successful or failed
execution. While this is a well recognized paradigm in the nodejs world, the use
of [promises](https://www.promisejs.org) provides a more elegant (and perhaps
easier to understand) mechanism for dealing with asynchronous operations.
Oftentimes, developers will use promises within their handlers, invoking the
lambda callback on the completion of their promise chains.

Another aspect to consider is when putting together complex functionality using
AWS Lambdas is the need for a consistent way of developing and testing lambda
functions. Most lambda functions will benefit from having a standard mechanism
for initialization of _configuration_ and _logger_ objects.

*   Having a consistent structure to the log messages allows logs to be loaded up
    into log analysis tools, which is especially important when trying to track a
    complex requests as it passes from one lambda function to another.

*   Configuration data becomes especially important when multiple versions of the
    same lambda function have to be supported concurrently. Each version may have a
    different configuration, and having a simple mechanism for accessing version
    specific configuration is important.

Finally, lambda functions that are not used for a period of time can
[experience delayed startup times](https://stackoverflow.com/questions/42877521/is-it-possible-to-keep-an-aws-lambda-function-warm),
and benefit from being "kept warm" - i.e., invoked periodically by a scheduler
to allow the function to stay in cache.

This library attempts to solve these problems by providing a wrapper around
simple nodejs functions converting them into lambda handlers with the following
features:

*   **Promises**: The nodejs function can choose to return a promise to indicate
    asynchronous operations. The wrapper deals with the responses, and invokes the
    lambda callback immediately if no promise is returned (for synchronous
    operations), or waits for promise fulfillment/rejection if a promise is returned
    (for asynchronous operations).

*   **Logger and Config**: The wrapper automatically initializes and injects
    logger and configuration objects for use within the handler. The
    [logger](https://github.com/vamship/logger) object emits JSON logs that include
    the handler name and the AWS Request Id. More properties may be injected if
    necessary. The config object uses the lambda execution version/alias to create a
    [scoped config object](https://github.com/vamship/config) that contains version
    specific configuration.

*   **Lambda Keep Warm**: The wrapper will skip all further processing if the
    input event contains a `__LAMBDA_KEEP_WARM=true` property. The underlying
    handler is never invoked, but the invocation results in the lambda remaining in
    cache, improving start times for infrequently called functions.

## Installation

This library can be installed using npm:

```
npm install @vamship/aws-lambda
```

## Usage

### Creating a lambda handler

```
const { HandlerWrapper } = require('@vamship/aws-lambda');

// Lambda handler. Regular node.js function.
const handler = (event, context, ext) => {
    const { logger, config, alias } = ext;

    logger.info('Executing lambda handler', { alias });

    const url = config.get('apiserver.host');

    logger.trace('Connecting to API server', { host });


    //Do something, and return:
    // (1) Promise - for async operations.
    // (2) * - for all other operations
};

const wrapper = new HandlerWrapper('MyApp');

// Lambda handler
module.exports = wrapper.wrap(handler, 'myHandler');
```

The export from the module can be used directly as the handler for the lambda
function. The `config`, `logger` and `alias` references will be generated
and injected by the wrapper returned from `wrapper.wrap()`.

## Testing

When unit testing lambda functions, it is important to note that the function
under test is essentially a simple node.js function, and can be tested using
standard mocking/testing patterns. However, each test run requires a few common
operations such as:

*   Mocking of logger/config, with the ability to inject custom config values
*   Generation of lambda context parameters (invokedFunctionArn for alias)
*   Setting standard inputs on the handler
*   etc.

These common operations have been abstracted into the LambdaTestWrapper class
that is exported by the
[aws-test-utils](https://github.com/vamship/aws-test-utils) library. Feel free
to use this library if you think it fits your needs.
