import { expect, use as _useWithChai } from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import _sinonChai from 'sinon-chai';
import 'mocha';

_useWithChai(_sinonChai);
_useWithChai(_chaiAsPromised);

import _esmock from 'esmock';
import { spy, stub, SinonStub } from 'sinon';
import { ArgError } from '@vamship/error-types';
import logManager, { ILogger, LogManager } from '@vamship/logger';
import {
    ObjectMock,
    MockImportHelper,
    testValues as _testValues,
} from '@vamship/test-utils';
import { Context } from 'aws-lambda';

import {
    Handler,
    WrappedHandler,
    HandlerInput,
    IExtendedParameters,
} from '../../src/types/index.js';
import { HandlerWrapper } from '../../src/handler-wrapper.js';

describe('HandlerWrapper', async function () {
    type ImportResult = {
        testTarget: typeof HandlerWrapper;
        logManagerMock: ObjectMock<LogManager>;
        loggerMock: ObjectMock<ILogger>;
    };

    const DEFAULT_ALIAS = 'default';

    async function _import(): Promise<ImportResult> {
        type HandlerWrapperModule = {
            HandlerWrapper: HandlerWrapper;
        };

        const importHelper = new MockImportHelper<HandlerWrapperModule>(
            'project://src/handler-wrapper.js',
            {
                logger: '@vamship/logger',
            },
            import.meta.resolve('../../../working'),
        );

        const loggerMock: ObjectMock<ILogger> = [
            'silent',
            'trace',
            'debug',
            'info',
            'warn',
            'error',
            'fatal',
        ].reduce(
            (result, item) => result.addMock(item, spy()),
            new ObjectMock<ILogger>(),
        );
        loggerMock.addMock('child', () => loggerMock.instance);

        const logManagerMock = new ObjectMock<LogManager>();
        logManagerMock
            .addMock('getLogger', loggerMock.instance)
            .addMock('configure', () => logManagerMock.instance);

        importHelper.setMock('logger', {
            default: logManagerMock.instance,
        });

        const targetModule = await _esmock(
            importHelper.importPath,
            importHelper.getLibs(),
            importHelper.getGlobals(),
        );

        return {
            testTarget: targetModule.HandlerWrapper,
            logManagerMock,
            loggerMock,
        };
    }

    describe('ctor()', function () {
        _testValues.allButString('').forEach((appName) => {
            it(`should throw an error if invoked without a valid handler name (value=${appName})`, async function () {
                const { testTarget: HandlerWrapper } = await _import();
                const message = 'Invalid appName (arg #1)';
                const wrapper = (): HandlerWrapper => {
                    return new HandlerWrapper(appName as string);
                };
                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return an object with expected methods and properties when invoked', async function () {
            const { testTarget: HandlerWrapper } = await _import();
            const appName = _testValues.getString('appName');
            const wrapper = new HandlerWrapper(appName);

            expect(wrapper).to.be.an('object');
            expect(wrapper.wrap).to.be.a('function');
        });

        it('should configure the logger object using the correct parameters', async function () {
            const { testTarget: HandlerWrapper, logManagerMock } =
                await _import();
            const appName = _testValues.getString('appName');
            const configureMethod = logManagerMock.mocks.configure;
            const getLoggerMethod = logManagerMock.mocks.getLogger;

            // eslint-disable-next-line tsel/no-unused-expressions
            expect(configureMethod.stub).to.not.have.been.called;

            // eslint-disable-next-line tsel/no-unused-expressions
            expect(getLoggerMethod.stub).to.not.have.been.called;

            const instance = new HandlerWrapper(appName);

            // eslint-disable-next-line tsel/no-unused-expressions
            expect(configureMethod.stub).to.have.been.calledOnce;
            expect(configureMethod.stub.args[0][0]).to.equal(appName);
            expect(configureMethod.stub.args[0][1]).to.deep.equal({
                level: 'info',
            });

            expect(getLoggerMethod.stub).to.have.been.calledOnceWithExactly(
                'handler-wrapper',
            );
        });
    });

    describe('wrap()', function () {
        _testValues.allButFunction().forEach((handler) => {
            it(`should throw an error if invoked without a valid handler (value=${handler})`, async function () {
                const { testTarget: HandlerWrapper } = await _import();
                const message = 'Invalid handler (arg #1)';
                const wrapper = (): void => {
                    const handlerName = _testValues.getString('handlerName');
                    const wrapper = new HandlerWrapper('my-app');
                    wrapper.wrap(
                        handler as unknown as Handler<HandlerInput>,
                        handlerName,
                    );
                };
                expect(wrapper).to.throw(ArgError, message);
            });
        });

        _testValues.allButString('').forEach((handlerName) => {
            it(`should throw an error if invoked without a valid handler name (value=${handlerName})`, async function () {
                const { testTarget: HandlerWrapper } = await _import();
                const message = 'Invalid handlerName (arg #2)';
                const wrapper = (): void => {
                    const handler: Handler<HandlerInput> = async (
                        event,
                        context,
                        params,
                    ) => {};
                    const wrapper = new HandlerWrapper('my-app');
                    wrapper.wrap(handler, handlerName as unknown as string);
                };
                expect(wrapper).to.throw(ArgError, message);
            });
        });

        it('should return a function when invoked', async function () {
            const { testTarget: HandlerWrapper } = await _import();
            const wrapper = new HandlerWrapper('my-app');
            const handlerName = _testValues.getString('handlerName');
            const handler: Handler<HandlerInput> = spy();

            const wrappedHandler = wrapper.wrap(handler, handlerName);
            expect(wrappedHandler).to.be.a('function');
        });

        describe('[wrapper behavior]', async function () {
            type LambdaInput = {
                lambdaArg1: string;
            } & HandlerInput;

            type LambdaOutput = {
                lambdaResult: boolean;
            };

            class WrapperTester {
                public appName: string;
                public handlerName: string;
                public accountId: string;
                public region: string;
                public alias: string;
                public handler: SinonStub<unknown[], LambdaOutput>;
                public event: LambdaInput;
                public context: Context;
                public wrappedHandler?: WrappedHandler<
                    LambdaInput,
                    LambdaOutput
                >;
                public loggerMock?: ObjectMock<ILogger>;

                constructor(
                    event?: LambdaInput,
                    context?: Record<string, unknown>,
                ) {
                    this.appName = _testValues.getString('appName');
                    this.handlerName = _testValues.getString('handlerName');
                    this.handler = stub();
                    this.accountId = '123456789012';
                    this.region = 'us-east-1';
                    this.alias = '$LATEST';
                    this.context = {
                        ...context,
                    } as unknown as Context;
                    this.event = {
                        ...event,
                    } as LambdaInput;
                }

                public get qualifiedHandlerName(): string {
                    return this.alias
                        ? `${this.handlerName}:${this.alias}`
                        : this.handlerName;
                }

                public createContext(): Context {
                    const context = { ...this.context };
                    context.invokedFunctionArn = `arn:aws:lambda:${this.region}:${this.accountId}:function:${this.qualifiedHandlerName}`;
                    return context;
                }

                async init() {
                    const { testTarget: HandlerWrapper, loggerMock } =
                        await _import();
                    const wrapper = new HandlerWrapper(this.appName);
                    this.wrappedHandler = wrapper.wrap(
                        this.handler as unknown as Handler<
                            LambdaInput,
                            LambdaOutput
                        >,
                        this.handlerName,
                    );
                    this.loggerMock = loggerMock;
                }

                async invoke() {
                    const context = this.createContext();
                    if (!this.wrappedHandler) {
                        await this.init();
                    }
                    return await this.wrappedHandler!(this.event, context);
                }
            }
            const _consoleLog = console.log;
            const _consoleError = console.error;

            beforeEach(() => {
                console.log = () => {}; // Suppress console.log output in tests
                console.error = () => {}; // Suppress console.error output in tests
            });

            afterEach(() => {
                console.log = _consoleLog; // Restore console.log
                console.error = _consoleError; // Restore console.error
            });

            it('should invoke the handler when the wrapper is invoked', async function () {
                const wrapperTester = new WrapperTester();

                // eslint-disable-next-line tsel/no-unused-expressions
                expect(wrapperTester.handler).to.not.have.been.called;

                await wrapperTester.invoke();

                // eslint-disable-next-line tsel/no-unused-expressions
                expect(wrapperTester.handler).to.have.been.calledOnce;
            });

            it('should pass the event arg to the handler unchanged', async function () {
                const expectedEvent = {
                    lambdaArg1: _testValues.getString('lambdaArg1'),
                };
                const wrapperTester = new WrapperTester(expectedEvent);

                await wrapperTester.invoke();
                const event = wrapperTester.handler.args[0][0];

                expect(event).to.deep.equal(expectedEvent);
            });

            it('should pass the context arg to the handler unchanged', async function () {
                const region = _testValues.getString('region');
                const accountId = _testValues.getString('accountId');
                const handlerName = _testValues.getString('handlerName');
                const alias = _testValues.getString('alias');
                const expectedContext = {
                    invokedFunctionArn: `arn:aws:lambda:${region}:${accountId}:function:${handlerName}:${alias}`,
                    foo: 'bar',
                };
                const wrapperTester = new WrapperTester(
                    undefined,
                    expectedContext,
                );
                wrapperTester.region = region;
                wrapperTester.accountId = accountId;
                wrapperTester.handlerName = handlerName;
                wrapperTester.alias = alias;

                wrapperTester.context = expectedContext as unknown as Context;

                await wrapperTester.invoke();
                const context = wrapperTester.handler.args[0][1];

                expect(context).to.deep.equal(expectedContext);
            });

            it('should pass an additional third argument to the handler with expected properties', async function () {
                const alias = _testValues.getString('alias');
                const wrapperTester = new WrapperTester();
                wrapperTester.alias = alias;

                await wrapperTester.invoke();
                const ext = wrapperTester.handler
                    .args[0][2] as unknown as IExtendedParameters;

                expect(ext).to.be.an('object');
                expect(ext.logger).to.equal(wrapperTester.loggerMock!.instance);
                expect(ext.alias).to.equal(alias);
            });

            it('should set alias="default" if the lambda invocation is unqualified', async function () {
                const wrapperTester = new WrapperTester();
                wrapperTester.alias = '';

                await wrapperTester.invoke();
                const ext = wrapperTester.handler
                    .args[0][2] as unknown as IExtendedParameters;

                expect(ext.alias).to.equal(DEFAULT_ALIAS);
            });

            it('should set alias="default" if the the lambda is qualified with "$LATEST"', async function () {
                const wrapperTester = new WrapperTester();
                wrapperTester.alias = '$LATEST';

                await wrapperTester.invoke();
                const ext = wrapperTester.handler
                    .args[0][2] as unknown as IExtendedParameters;

                expect(ext.alias).to.equal(DEFAULT_ALIAS);
            });

            it('should configure the logger with the correct parameters', async function () {
                const handlerName = _testValues.getString('handlerName');
                const awsRequestId = _testValues.getString('awsRequestId');
                const alias = _testValues.getString('alias');
                const level = _testValues.getString('level');

                process.env.LOG_LEVEL = level;

                const wrapperTester = new WrapperTester();
                wrapperTester.handlerName = handlerName;
                wrapperTester.alias = alias;
                wrapperTester.context.awsRequestId = awsRequestId;

                await wrapperTester.invoke();

                const loggerMock = wrapperTester.loggerMock!;
                const childMethod = loggerMock.mocks.child;

                // eslint-disable-next-line tsel/no-unused-expressions
                expect(childMethod.stub).to.have.been.calledOnce;
                const loggerConfig = childMethod.stub.args[0][0];
                expect(childMethod.stub.args[0][0]).to.be.an('object');
                expect(childMethod.stub.args[0][0]).to.deep.equal({
                    handler: handlerName,
                    awsRequestId,
                });
                expect(loggerMock.instance.level).to.equal(level);
            });

            _testValues
                .allButSelected('null', 'undefined')
                .forEach((lambdaKeepWarm) => {
                    it(`should not invoke the handler if the input contains __LAMBDA_KEEP_WARM is truthy (value=${lambdaKeepWarm})`, async function () {
                        const event = {
                            lambdaArg1: _testValues.getString('lambdaArg1'),
                            __LAMBDA_KEEP_WARM:
                                lambdaKeepWarm as unknown as boolean,
                        };
                        const wrapperTester = new WrapperTester(event);

                        // eslint-disable-next-line tsel/no-unused-expressions
                        expect(wrapperTester.handler).to.not.have.been.called;

                        await wrapperTester.invoke();

                        // eslint-disable-next-line tsel/no-unused-expressions
                        expect(wrapperTester.handler).to.not.have.been.called;
                    });
                });

            it('should complete with the return if the handler executes successfully', async function () {
                const ret = _testValues.getString('return');
                const handler = stub().returns(ret);
                const wrapperTester = new WrapperTester();

                wrapperTester.handler = handler;

                // eslint-disable-next-line tsel/no-unused-expressions
                expect(wrapperTester.handler).to.not.have.been.called;

                const data = await wrapperTester.invoke();

                // eslint-disable-next-line tsel/no-unused-expressions
                expect(wrapperTester.handler).to.have.been.calledOnce;
                expect(data).to.equal(ret);
            });

            it('should complete with an error if the handler throws an error', async function () {
                const error = new Error('something went wrong!');
                const handler = stub().throws(error);
                const wrapperTester = new WrapperTester();
                wrapperTester.handler = handler;

                await expect(wrapperTester.invoke()).to.be.rejectedWith(error);
            });

            it('should gracefully handle any errors during handler initialization', async function () {
                const error = new Error('something went wrong!');
                const wrapperTester = new WrapperTester();

                await wrapperTester.init();
                const loggerMock = wrapperTester.loggerMock!;
                loggerMock.mocks.child.stub.throws(error);

                // eslint-disable-next-line tsel/no-unused-expressions
                expect(wrapperTester.handler).to.not.have.been.called;

                await expect(wrapperTester.invoke())
                    .to.be.rejectedWith(error)
                    .then(function () {
                        expect(wrapperTester.handler).to.not.have.been.called;
                    });
            });
        });
    });
});
