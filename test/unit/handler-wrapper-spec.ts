import { expect, use as _useWithChai } from 'chai';
import _sinonChai from 'sinon-chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
// import bluebird from 'bluebird';

_useWithChai(_sinonChai);
_useWithChai(_chaiAsPromised);

import { stub } from 'sinon';
import _esmock from 'esmock';

// const { Promise } = bluebird;

import {
    testValues as _testValues,
    ObjectMock,
    MockImportHelper,
} from '@vamship/test-utils';
import { ArgError } from '@vamship/error-types';

import { HandlerWrapper } from '../../src/handler-wrapper.js';
import { LogManager, ILogger } from '@vamship/logger';

describe.only('HandlerWrapper', () => {
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
});
