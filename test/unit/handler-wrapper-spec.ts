import { expect, use as _useWithChai } from 'chai';
import _sinonChai from 'sinon-chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import bluebird from 'bluebird';

_useWithChai(_sinonChai);
_useWithChai(_chaiAsPromised);

import { stub, spy } from 'sinon';
import _esmock from 'esmock';

const { Promise } = bluebird;

import {
    testValues as _testValues,
    ObjectMock,
    MockImportHelper,
} from '@vamship/test-utils';
import { ArgError } from '@vamship/error-types';

import { HandlerWrapper } from '../../src/handler-wrapper.js';
import { LogManager, ILogger } from '@vamship/logger';

describe('HandlerWrapper', () => {
    function _createHandlerWrapper(appName: string) {
        appName = appName || _testValues.getString('appName');
        return new HandlerWrapper(appName);
    }
    type ImportResult = {
        testTarget: typeof HandlerWrapper;
        logManagerMock: ObjectMock<LogManager>;
    };
    async function _import(): Promise<ImportResult> {
        const LOG_METHODS = [
            'trace',
            'debug',
            'info',
            'warn',
            'error',
            'fatal',
            'silent',
        ];
        const loggerMock = new ObjectMock<ILogger>();
        LOG_METHODS.reduce(
            (result, level) => result.addMock(level, stub()),
            loggerMock
        );
        const logManagerInstance = {} as LogManager;
        const logManagerMock: ObjectMock<LogManager> =
            new ObjectMock<LogManager>(logManagerInstance)
                .addMock(
                    'configure',
                    stub().callsFake(() => logManagerInstance)
                )
                .addMock(
                    'getLogger',
                    stub().callsFake(() => loggerMock.instance)
                );

        const importHelper = new MockImportHelper<HandlerWrapper>(
            'project://src/handler-wrapper.js',
            {
                logManager: '@vamship/logger',
            },
            import.meta.resolve('../../../working')
        ).setMock('logManager', { default: logManagerMock.instance });

        const targetModule = await _esmock(
            importHelper.importPath,
            importHelper.getLibs(),
            importHelper.getGlobals()
        );
        return {
            testTarget: targetModule.HandlerWrapper,
            logManagerMock,
        };
    }
    describe('ctor()', async function () {
        (_testValues.allButString('') as string[]).forEach(
            (appName: string) => {
                it(`should throw an error if invoked without a valid appName (value=${appName})`, async function () {
                    const { testTarget: TargetClass } = await _import();
                    const message = 'Invalid appName (arg #1)';

                    const wrapper = () => {
                        return new TargetClass(appName);
                    };

                    expect(wrapper).to.throw(ArgError, message);
                });
            }
        );
        it('should return an object with expected methods and properties when invoked', async function () {
            const appName = _testValues.getString('appName');
            const { testTarget: TargetClass } = await _import();
            const wrapper = new TargetClass(appName);

            expect(wrapper).to.be.an('object');
            expect(wrapper.wrap).to.be.a('function');
        });

        it('should configure the logger object using the correct parameters', async function () {
            const appName = _testValues.getString('appName');
            const { testTarget: TargetClass, logManagerMock } = await _import();
            const configureMethod = logManagerMock.mocks.configure;

            expect(logManagerMock.ctor).to.not.have.been.called;
            expect(configureMethod.stub).to.not.have.been.called;

            const instance = new TargetClass(appName);

            expect(configureMethod.stub).to.have.been.calledOnce;
        });
    });

    describe('wrap()', () => {
        _testValues.allButFunction().forEach((handler: any) => {
            it(`should throw an error if invoked with an invalid handler (value=${handler})`, async function () {
                const { testTarget: TargetClass } = await _import();
                const message = '[ArgError] Invalid handler (arg #1)';

                const wrapper = () => {
                    const wrapper = new TargetClass('appName');
                    wrapper.wrap(handler, 'name');
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });
        _testValues.allButString().forEach((handlerName: any) => {
            it(`should throw an error if invoked with an invalid handler name (value=${handlerName})`, async function () {
                const { testTarget: TargetClass } = await _import();
                const message = '[ArgError] Invalid handler name (arg #2)';

                const wrapper = () => {
                    const wrapper = new TargetClass('appName');
                    const handler = spy();
                    wrapper.wrap(handler, handlerName);
                };

                expect(wrapper).to.throw(ArgError, message);
            });
        });
        it('should return a function when invoked', async function () {
            const appName = _testValues.getString('appName');
            const { testTarget: TargetClass } = await _import();
            const wrapper = new TargetClass(appName);

            const handlerName = _testValues.getString('handlerName');
            const handler = spy();

            const wrappedHandler = wrapper.wrap(handler, handlerName);
            expect(wrappedHandler).to.be.a('function');
        });
    });

    describe('[wrapper behavior]', () => {
        class TestWrapper {
            definition: any;
            handler: any;
            event: any;
            context: any;
            promise: Promise<unknown>;
            callback: any;
            wrappedHandler: (event: any, context: any, callback: any) => void;
            constructor(definition: any, context: any, event: any) {
                const defaultDefinition = {
                    appName: _testValues.getString('appName'),
                    handlerName: _testValues.getString('handlerName'),
                    handler: stub(),
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
                const promiseMethods: any = {};
                this.promise = new Promise((resolve, reject) => {
                    promiseMethods.__resolve = resolve;
                    promiseMethods.__reject = reject;
                });
                this.callback = stub().callsFake((err, data) => {
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
                this.wrappedHandler(event, context, callback);
                // this.promise.finally(() => {
                // });
                return this.promise;
            }
        }

        it('should invoke the handler when the wrapper is invoked', function (done) {
            const testWrapper = new TestWrapper({}, {}, {});

            expect(testWrapper.handler).to.not.have.been.called;

            const promise = testWrapper.invoke();

            expect(testWrapper.handler).to.have.been.calledOnce;

            promise.then(done, done);
        });

        it('should pass the event arg to the handler unchanged', function (done) {
            const expectedEvent = {
                foo: _testValues.getString('foo'),
                bar: _testValues.getNumber(100, 0),
                options: {
                    timestamp: _testValues.getTimestamp(Date.now(), 0),
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

        it('should pass the context arg to the handler unchanged', function (done) {
            const expectedContext = {
                invokedFunctionArn: `arn:aws:lambda:__region__:__accountId__:function:foo`,
            };
            const copy = Object.assign({}, expectedContext);
            const testWrapper = new TestWrapper({}, copy, {});

            const promise = testWrapper.invoke();
            const context = testWrapper.handler.args[0][1];

            expect(context).to.deep.equal(expectedContext);
            expect(context).to.not.equal(expectedContext);

            promise.then(done, done);
        });

        it('should pass an additional third argument to the handler with expected properties', function (done) {
            const alias = _testValues.getString('alias');
            const testWrapper = new TestWrapper(
                {
                    alias,
                },
                {},
                {}
            );

            const promise = testWrapper.invoke();
            const ext = testWrapper.handler.args[0][2];

            expect(ext).to.be.an('object');
            // expect(ext.logger).to.equal();
            expect(ext.alias).to.equal(alias);

            promise.then(done, done);
        });

        it('should set alias="default" if the lambda invocation is unqualified', function (done) {
            const testWrapper = new TestWrapper(
                {
                    alias: undefined,
                },
                {},
                {}
            );

            const promise = testWrapper.invoke();
            const alias = testWrapper.handler.args[0][2].alias;
            expect(alias).to.equal('default');

            promise.then(done, done);
        });

        it('should set alias="default" if the the lambda is qualified with "$LATEST"', function (done) {
            const testWrapper = new TestWrapper(
                {
                    alias: '$LATEST',
                },
                {},
                {}
            );

            const promise = testWrapper.invoke();
            const alias = testWrapper.handler.args[0][2].alias;
            expect(alias).to.equal('default');

            promise.then(done, done);
        });

        // it('should configure the logger with the correct parameters', function (done) {
        //     const testWrapper = new TestWrapper({
        //         alias: '$LATEST',
        //     }, {}, {});

        //     const promise = testWrapper.invoke();
        //     const alias = testWrapper.handler.args[0][2].alias;
        //     expect(alias).to.equal('default');

        //     promise.then(done, done);
        // });

        it('should not invoke the handler if the input contains __LAMBDA_KEEP_WARM=true', function (done) {
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
                .reduce((result, item: any) => item && result)
                .then(done, done);
        });

        it('should complete with the return if the handler executes successfully', (done) => {
            const ret = _testValues.getString('return');
            const handler = stub().returns(ret);
            const testWrapper = new TestWrapper({ handler }, {}, {});

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
            const handler = stub().throws(error);
            const testWrapper = new TestWrapper({ handler }, {}, {});

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
            let resolveHandler: Function = () => {};
            const handlerPromise = new Promise((resolve, reject) => {
                resolveHandler = resolve;
            });
            const handler = stub().returns(handlerPromise);
            const testWrapper = new TestWrapper({ handler }, {}, {});

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
            let rejectHandler: Function = () => {};
            const handlerPromise = new Promise((resolve, reject) => {
                rejectHandler = reject;
            });
            const handler = stub().returns(handlerPromise);
            const testWrapper = new TestWrapper({ handler }, {}, {});

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
            let resolveHandler: Function = () => {};
            const handlerPromise = new Promise((resolve, reject) => {
                resolveHandler = resolve;
            });
            const handler = stub().returns(handlerPromise);
            const testWrapper = new TestWrapper({ handler }, {}, {});

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
    });
});
