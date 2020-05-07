'use strict';

const _sinon = require('sinon');
const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const Promise = require('bluebird').Promise;
const _rewire = require('rewire');

const {
    testValues: _testValues,
    ObjectMock,
    consoleHelper: _consoleHelper,
} = require('@vamship/test-utils');
const _dotProp = require('dot-prop');
const { ArgError } = require('@vamship/error-types').args;

let HandlerWrapper = null;

describe('HandlerWrapper', () => {
    function _createHandlerWrapper(appName) {
        appName = appName || _testValues.getString('appName');
        return new HandlerWrapper(appName);
    }
    const LOG_METHODS = [
        'trace',
        'debug',
        'info',
        'warn',
        'error',
        'fatal',
        'silent',
    ];
    const DEFAULT_ALIAS = 'default';
    let _loggerMock = null;
    let _configMock = null;

    beforeEach(() => {
        _loggerMock = new ObjectMock()
            .addMock('configure', () => _loggerMock.instance)
            .addMock('getLogger', () => _loggerMock.__loggerInstance);
        _loggerMock.__loggerInstance = LOG_METHODS.reduce((result, method) => {
            result[method] = _sinon.spy();
            return result;
        }, {});

        _configMock = new ObjectMock()
            .addMock('configure', () => _configMock.instance)
            .addMock('getConfig', () => _configMock.__configInstance);
        _configMock.__data = {};
        _configMock.__configInstance = {
            get: (key) => _dotProp.get(_configMock.__data, key),
        };

        HandlerWrapper = _rewire('../../src/handler-wrapper');

        HandlerWrapper.__set__('_logger', _loggerMock.instance);
        HandlerWrapper.__set__('_config', _configMock.instance);
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid appName', () => {
            const message = 'Invalid appName (arg #1)';
            const inputs = _testValues.allButString('');

            inputs.forEach((appName) => {
                const wrapper = () => {
                    return new HandlerWrapper(appName);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return an object with expected methods and properties when invoked', () => {
            const appName = _testValues.getString('appName');
            const wrapper = new HandlerWrapper(appName);

            expect(wrapper).to.be.an('object');
            expect(wrapper.wrap).to.be.a('function');
        });

        it('should configure the config object using the correct parameters', () => {
            const appName = _testValues.getString('appName');
            const configureMethod = _configMock.mocks.configure;

            expect(configureMethod.stub).to.not.have.been.called;

            new HandlerWrapper(appName);

            expect(configureMethod.stub).to.have.been.calledOnce;
            expect(configureMethod.stub.args[0][0]).to.equal(appName);
            expect(configureMethod.stub.args[0][1]).to.deep.equal({
                log: {
                    level: 'info',
                },
            });
        });

        it('should configure the logger object using the correct parameters', () => {
            const appName = _testValues.getString('appName');
            const configureMethod = _loggerMock.mocks.configure;

            expect(configureMethod.stub).to.not.have.been.called;

            new HandlerWrapper(appName);

            expect(configureMethod.stub).to.have.been.calledOnce;
            expect(configureMethod.stub.args[0][0]).to.equal(appName);
            expect(configureMethod.stub.args[0][1]).to.deep.equal({
                level: 'info',
                extreme: false,
            });
        });
    });

    describe('wrap()', () => {
        it('should throw an error if invoked with an invalid handler', () => {
            const message = 'Invalid handler (arg #1)';
            const inputs = _testValues.allButFunction();

            inputs.forEach((handler) => {
                const wrapper = () => {
                    const wrapper = _createHandlerWrapper();
                    wrapper.wrap(handler);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should throw an error if invoked with an invalid handler name', () => {
            const message = 'Invalid handler name (arg #2)';
            const inputs = _testValues.allButString('');

            inputs.forEach((handlerName) => {
                const wrapper = () => {
                    const wrapper = _createHandlerWrapper();
                    const handler = _sinon.spy();
                    wrapper.wrap(handler, handlerName);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return a function when invoked', () => {
            const wrapper = _createHandlerWrapper();
            const handlerName = _testValues.getString('handlerName');
            const handler = _sinon.spy();

            const wrappedHandler = wrapper.wrap(handler, handlerName);
            expect(wrappedHandler).to.be.a('function');
        });

        describe('[wrapper behavior]', () => {
            class TestWrapper {
                constructor(definition, context, event) {
                    const defaultDefinition = {
                        appName: _testValues.getString('appName'),
                        handlerName: _testValues.getString('handlerName'),
                        handler: _sinon.stub(),
                        accountId: '123456789012',
                        region: 'us-east-1',
                        alias: '$LATEST',
                    };
                    definition = Object.assign(defaultDefinition, definition);

                    // Initialize context.
                    const { region, accountId, alias } = definition;
                    const { handlerName } = definition;
                    let qualifiedHandlerName = handlerName;
                    if (alias) {
                        qualifiedHandlerName = `${handlerName}:${alias}`;
                    }
                    const defaultContext = {
                        invokedFunctionArn: `arn:aws:lambda:${region}:${accountId}:function:${qualifiedHandlerName}`,
                    };
                    context = Object.assign(defaultContext, context);

                    // Initialize event.
                    event = event || {
                        lambdaArg1: _testValues.getString('lambdaArg1'),
                    };

                    // Create a wrapper object.
                    const { appName, handler } = definition;
                    const wrapper = _createHandlerWrapper(appName);

                    this.definition = definition;
                    this.handler = handler;
                    this.event = event;
                    this.context = Object.assign(defaultContext, context);
                    const promiseMethods = {};
                    this.promise = new Promise((resolve, reject) => {
                        promiseMethods.__resolve = resolve;
                        promiseMethods.__reject = reject;
                    });
                    this.callback = _sinon.stub().callsFake((err, data) => {
                        _consoleHelper.unmute();
                        if (err) {
                            promiseMethods.__reject(err);
                            return;
                        }
                        promiseMethods.__resolve(data);
                    });
                    this.wrappedHandler = wrapper.wrap(handler, handlerName);
                }

                invoke() {
                    const { event, context, callback } = this;
                    _consoleHelper.mute();
                    this.wrappedHandler(event, context, callback);
                    // this.promise.finally(() => {
                    // });
                    return this.promise;
                }
            }

            it('should invoke the handler when the wrapper is invoked', (done) => {
                const testWrapper = new TestWrapper();

                expect(testWrapper.handler).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(testWrapper.handler).to.have.been.calledOnce;

                promise.then(done, done);
            });

            it('should pass the event arg to the handler unchanged', (done) => {
                const expectedEvent = {
                    foo: _testValues.getString('foo'),
                    bar: _testValues.getNumber(),
                    options: {
                        timestamp: _testValues.getTimestamp(),
                    },
                };
                const copy = Object.assign({}, expectedEvent);
                copy.options = Object.assign({}, expectedEvent.options);
                const testWrapper = new TestWrapper(null, null, copy);

                const promise = testWrapper.invoke();
                const event = testWrapper.handler.args[0][0];

                expect(event).to.deep.equal(expectedEvent);
                expect(event).to.not.equal(expectedEvent);

                promise.then(done, done);
            });

            it('should pass the context arg to the handler unchanged', (done) => {
                const expectedContext = {
                    invokedFunctionArn: `arn:aws:lambda:__region__:__accountId__:function:foo`,
                };
                const copy = Object.assign({}, expectedContext);
                const testWrapper = new TestWrapper(null, copy);

                const promise = testWrapper.invoke();
                const context = testWrapper.handler.args[0][1];

                expect(context).to.deep.equal(expectedContext);
                expect(context).to.not.equal(expectedContext);

                promise.then(done, done);
            });

            it('should pass an additional third argument to the handler with expected properties', (done) => {
                const alias = _testValues.getString('alias');
                const testWrapper = new TestWrapper({
                    alias,
                });

                const promise = testWrapper.invoke();
                const ext = testWrapper.handler.args[0][2];

                expect(ext).to.be.an('object');
                expect(ext.logger).to.equal(_loggerMock.__loggerInstance);
                expect(ext.config).to.equal(_configMock.__configInstance);
                expect(ext.alias).to.equal(alias);

                promise.then(done, done);
            });

            it('should set alias="default" if the lambda invocation is unqualified', (done) => {
                const testWrapper = new TestWrapper({
                    alias: undefined,
                });

                const promise = testWrapper.invoke();
                const alias = testWrapper.handler.args[0][2].alias;
                expect(alias).to.equal(DEFAULT_ALIAS);

                promise.then(done, done);
            });

            it('should set alias="default" if the the lambda is qualified with "$LATEST"', (done) => {
                const testWrapper = new TestWrapper({
                    alias: '$LATEST',
                });

                const promise = testWrapper.invoke();
                const alias = testWrapper.handler.args[0][2].alias;
                expect(alias).to.equal(DEFAULT_ALIAS);

                promise.then(done, done);
            });

            it('should configure the config with the correct parameters', (done) => {
                const alias = _testValues.getString('alias');

                const testWrapper = new TestWrapper({
                    alias,
                });

                const getConfigMethod = _configMock.mocks.getConfig;

                const promise = testWrapper.invoke();

                expect(getConfigMethod.stub).to.have.been.calledOnce;
                expect(getConfigMethod.stub.args[0][0]).to.equal(alias);

                promise.then(done, done);
            });

            it('should configure the logger with the correct parameters', (done) => {
                const handlerName = _testValues.getString('handlerName');
                const awsRequestId = _testValues.getString('awsRequestId');
                const alias = _testValues.getString('alias');
                const level = _testValues.getString('level');

                const testWrapper = new TestWrapper(
                    {
                        handlerName,
                        alias,
                    },
                    {
                        awsRequestId,
                    }
                );

                _configMock.__data = {
                    log: {
                        level,
                    },
                };
                const getLoggerMethod = _loggerMock.mocks.getLogger;

                const promise = testWrapper.invoke();

                expect(getLoggerMethod.stub).to.have.been.calledOnce;
                expect(getLoggerMethod.stub.args[0][0]).to.equal(handlerName);
                expect(getLoggerMethod.stub.args[0][1]).to.deep.equal({
                    awsRequestId,
                });
                expect(_loggerMock.__loggerInstance.level).to.equal(level);

                promise.then(done, done);
            });

            it('should not invoke the handler if the input contains __LAMBDA_KEEP_WARM=true', (done) => {
                const inputs = _testValues.allButSelected('null', 'undefined');

                Promise.mapSeries(inputs, (value) => {
                    const event = {
                        __LAMBDA_KEEP_WARM: value,
                    };
                    const testWrapper = new TestWrapper(null, null, event);

                    expect(testWrapper.handler).to.not.have.been.called;
                    expect(testWrapper.callback).to.not.have.been.called;

                    const promise = testWrapper.invoke();

                    return expect(promise).to.be.fulfilled.then((data) => {
                        expect(testWrapper.handler).to.not.have.been.called;
                        expect(testWrapper.callback).to.have.been.calledOnce;
                        expect(testWrapper.callback.args[0][0]).to.be.null;
                        expect(testWrapper.callback.args[0][1]).to.be.undefined;
                        expect(testWrapper.callback.args[0][1]).to.equal(data);
                    });
                })
                    .reduce((result, item) => item && result)
                    .then(done, done);
            });

            it('should complete with the return if the handler executes successfully', (done) => {
                const ret = _testValues.getString('return');
                const handler = _sinon.stub().returns(ret);
                const testWrapper = new TestWrapper({ handler });

                expect(testWrapper.handler).to.not.have.been.called;
                expect(testWrapper.callback).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(promise)
                    .to.be.fulfilled.then((data) => {
                        expect(testWrapper.handler).to.have.been.calledOnce;
                        expect(testWrapper.callback).to.have.been.calledOnce;
                        expect(testWrapper.callback.args[0][0]).to.be.null;
                        expect(testWrapper.callback.args[0][1]).to.equal(ret);
                    })
                    .then(done, done);
            });

            it('should complete with an error if the handler throws an error', (done) => {
                const error = new Error('something went wrong!');
                const handler = _sinon.stub().throws(error);
                const testWrapper = new TestWrapper({ handler });

                expect(testWrapper.handler).to.not.have.been.called;
                expect(testWrapper.callback).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(promise)
                    .to.be.rejected.then(() => {
                        expect(testWrapper.handler).to.have.been.calledOnce;
                        expect(testWrapper.callback).to.have.been.calledOnce;
                        expect(testWrapper.callback.args[0][0]).to.equal(error);
                        expect(testWrapper.callback.args[0][1]).to.be.undefined;
                    })
                    .then(done, done);
            });

            it('should wait for resolution if the handler returns a promise', (done) => {
                let resolveHandler = null;
                const handlerPromise = new Promise((resolve, reject) => {
                    resolveHandler = resolve;
                });
                const handler = _sinon.stub().returns(handlerPromise);
                const testWrapper = new TestWrapper({ handler });

                expect(testWrapper.handler).to.not.have.been.called;
                expect(testWrapper.callback).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(testWrapper.callback).to.not.have.been.called;
                expect(testWrapper.handler).to.have.been.calledOnce;

                resolveHandler();

                expect(promise)
                    .to.be.fulfilled.then(() => {
                        expect(testWrapper.callback).to.have.been.calledOnce;
                    })
                    .then(done, done);
            });

            it('should complete with an error if the handler promise is rejected', (done) => {
                const error = 'something went wrong!';
                let rejectHandler = null;
                const handlerPromise = new Promise((resolve, reject) => {
                    rejectHandler = reject;
                });
                const handler = _sinon.stub().returns(handlerPromise);
                const testWrapper = new TestWrapper({ handler });

                expect(testWrapper.handler).to.not.have.been.called;
                expect(testWrapper.callback).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(testWrapper.callback).to.not.have.been.called;
                expect(testWrapper.handler).to.have.been.calledOnce;

                rejectHandler(error);

                expect(promise)
                    .to.be.rejected.then(() => {
                        expect(testWrapper.callback).to.have.been.calledOnce;
                        expect(testWrapper.callback.args[0][0]).to.equal(error);
                        expect(testWrapper.callback.args[0][1]).to.be.undefined;
                    })
                    .then(done, done);
            });

            it('should complete with the return value if the handler promise is resolved', (done) => {
                const ret = _testValues.getString('return');
                let resolveHandler = null;
                const handlerPromise = new Promise((resolve, reject) => {
                    resolveHandler = resolve;
                });
                const handler = _sinon.stub().returns(handlerPromise);
                const testWrapper = new TestWrapper({ handler });

                expect(testWrapper.handler).to.not.have.been.called;
                expect(testWrapper.callback).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(testWrapper.callback).to.not.have.been.called;
                expect(testWrapper.handler).to.have.been.calledOnce;

                resolveHandler(ret);

                expect(promise)
                    .to.be.fulfilled.then(() => {
                        expect(testWrapper.callback).to.have.been.calledOnce;
                        expect(testWrapper.callback.args[0][0]).to.be.null;
                        expect(testWrapper.callback.args[0][1]).to.equal(ret);
                    })
                    .then(done, done);
            });

            it('should gracefully handle any errors during handler initialization', (done) => {
                const error = new Error('something went wrong!');
                _configMock.mocks.getConfig.stub.throws(error);
                const testWrapper = new TestWrapper();

                expect(testWrapper.handler).to.not.have.been.called;
                expect(testWrapper.callback).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(promise)
                    .to.be.rejected.then(() => {
                        expect(testWrapper.handler).to.not.have.been.called;
                        expect(testWrapper.callback).to.have.been.calledOnce;
                        expect(testWrapper.callback.args[0][0]).to.equal(error);
                        expect(testWrapper.callback.args[0][1]).to.be.undefined;
                    })
                    .then(done, done);
            });

            it('should gracefully handle any errors during handler initialization', (done) => {
                const error = new Error('something went wrong!');
                _loggerMock.mocks.getLogger.stub.throws(error);
                const testWrapper = new TestWrapper();

                expect(testWrapper.handler).to.not.have.been.called;
                expect(testWrapper.callback).to.not.have.been.called;

                const promise = testWrapper.invoke();

                expect(promise)
                    .to.be.rejected.then(() => {
                        expect(testWrapper.handler).to.not.have.been.called;
                        expect(testWrapper.callback).to.have.been.calledOnce;
                        expect(testWrapper.callback.args[0][0]).to.equal(error);
                        expect(testWrapper.callback.args[0][1]).to.be.undefined;
                    })
                    .then(done, done);
            });
        });
    });
});
