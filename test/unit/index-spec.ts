import { expect, use as _useWithChai } from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import _sinonChai from 'sinon-chai';
import 'mocha';

import { HandlerWrapper } from '../../src/handler-wrapper.js';
import * as _index from '../../src/index.js';

_useWithChai(_sinonChai);
_useWithChai(_chaiAsPromised);

describe('index', function () {
    it('should export the expected modules and classes', () => {
        expect(_index.HandlerWrapper).to.equal(HandlerWrapper);
    });
});
