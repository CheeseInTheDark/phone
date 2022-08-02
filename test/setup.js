const sinon = require('sinon')

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require('sinon-chai')
const sinonChaiInOrder = require('sinon-chai-in-order').default 

chai.use(chaiAsPromised);
chai.use(sinonChai);
chai.use(sinonChaiInOrder);

exports.mochaHooks = {
    afterEach() {
        sinon.restore()
    }
}