import { expect } from 'chai';
import 'mocha';

import { HandlerWrapper } from '../../src/handler-wrapper.js';
import * as _index from '../../src/index.js';

describe('index', function () {
    it('should export the expected modules and classes', () => {
        expect(_index.HandlerWrapper).to.equal(_index.HandlerWrapper);

        expect(_index.default).to.equal(HandlerWrapper);
    });
});
