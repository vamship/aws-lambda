# @vamship/aws-lambda

_AWS lambda utilities that include a standardized wrapper for handlers that pre
configures logger and config objects, and supports promises for async handler
execution._

The primary export from this library is a wrapper object converts a simple
javascript function into an AWS lambda function, providing pre configured logger
objects for use by the handler, and built-in support for keep-warm invocations.

Future versions of this library will include additional capabilities such as:

1. Schema validation of input events
2. Access to a config object that is also validated against a schema on startup
   to ensure that the handler has access to expected configuration values.

## API Documentation

API documentation can be found [here](https://vamship.github.io/aws-lambda).

# Motivation

[AWS Lambda](https://aws.amazon.com/lambda) is a popular mechanism for
developing server less applications that do allow for on-demand execution of
code without requiring provisioning of servers. It is possible to use a
collection of loosely coupled, stateless lambda function to provide fairly
complex application functionality, by exposing lambda functionality via
[API Gateways](https://aws.amazon.com/api-gateway), and/or using event triggers
from a wide variety of
[sources](https://docs.aws.amazon.com/lambda/latest/dg/invoking-lambda-function.html#intro-core-components-event-sources).

An aspect to consider is when putting together complex functionality using AWS
Lambdas is the need for a consistent way of developing and testing lambda
functions. Most lambda functions will benefit from having a standard mechanism
for initialization of _logger_ objects.

- Having a consistent structure to the log messages allows logs to be loaded up
  into log analysis tools, which is especially important when trying to track a
  complex requests as it passes from one lambda function to another.

Finally, lambda functions that are not used for a period of time can
[experience delayed startup times](https://stackoverflow.com/questions/42877521/is-it-possible-to-keep-an-aws-lambda-function-warm),
and benefit from being "kept warm" - i.e., invoked periodically by a scheduler
to allow the function to stay in cache.

This library attempts to solve these problems by providing a wrapper around
simple nodejs functions converting them into lambda handlers with the following
features:

- **Logger**: The wrapper automatically initializes and injects logger and
  configuration objects for use within the handler. The
  [logger](https://github.com/vamship/logger) object emits JSON logs that
  include the handler name and the AWS Request Id. More properties may be
  injected if necessary.

- **Lambda Keep Warm**: The wrapper will skip all further processing if the
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
import { HandlerWrapper, Handler } from '@vamship/aws-lambda';
import { Context } from 'aws-lambda';

type LambdaInput = {
    // Define input event properties here
};

type LambdaOutput = {
    // Define output event properties here
};

// Lambda handler. Regular node.js function.
const handler: Handler<LambdaInput, LambdaOutput> =
                            (event, context, ext) => {
    const { logger, alias } = ext;

    logger.info({ alias }, 'Executing lambda handler');

    //Do something, and return a result
    return  {} as LambdaOutput;
};

const wrapper = new HandlerWrapper('MyApp');

// Wrapped lambda handler that can be used as the lambda handler.
export const handler = wrapper.wrap(handler, 'myHandler');
```

The export from the module can be used directly as the handler for the lambda
function. The `logger` and `alias` references will be generated and injected by
the wrapper returned from `wrapper.wrap()`.
