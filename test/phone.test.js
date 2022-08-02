const fs = require('fs')
const wav = require('wav')
const { fake } = require('sinon')
const { PassThrough } = require('stream')
const expect = require('chai').expect;

const Phone = require('../src/phone.js')
const path = require('path');
const { default: sinonChaiInOrder } = require('sinon-chai-in-order');


describe("Phone", () => {
    
    it("reports nothing if no dialing happens", () => {
        expect(5).to.equal(5)
    })

    it("reports when a 1 is dialed", async () => {
        const micStream = await wavFileToStream('1-dial.wav')
        const dialListener = fake()

        Phone({
            inStream: micStream,
            onDial: dialListener
        })

        await new Promise(resolve => micStream.on("close", resolve))

        expect(dialListener).to.have.been.calledOnceWith(1)
    })

    it("reports when a 3 is dialed", async() => {
        const micStream = await wavFileToStream('3-dial.wav')
        const dialListener = fake()

        Phone({
            inStream: micStream,
            onDial: dialListener
        })

        await new Promise(resolve => micStream.on("close", resolve))

        expect(dialListener).to.have.been.calledOnceWith(3)
    })

    it("reports when a 6 is dialed", async() => {
        const micStream = await wavFileToStream('6-dial.wav')
        const dialListener = fake()

        Phone({
            inStream: micStream,
            onDial: dialListener
        })

        await new Promise(resolve => micStream.on("close", resolve))

        expect(dialListener).to.have.been.calledOnceWith(6)
    })

    it("reports when a 0 is dialed", async() => {
        const micStream = await wavFileToStream('0-dial.wav')
        const dialListener = fake()

        Phone({
            inStream: micStream,
            onDial: dialListener
        })

        await new Promise(resolve => micStream.on("close", resolve))

        expect(dialListener).to.have.been.calledOnceWith(0)
    })

    it("reports when the numbers 0 1 3 6 2 are dialed", async() => {
        const micStream = await wavFileToStream('01362-dial.wav')
        const dialListener = fake()

        Phone({
            inStream: micStream,
            onDial: dialListener
        })

        await new Promise(resolve => micStream.on("close", resolve))

        expect(dialListener).inOrder.to.have.been.calledWith(0)
            .subsequently.calledWith(1)
            .subsequently.calledWith(3)
            .subsequently.calledWith(6)
            .subsequently.calledWith(2)
    })    
})

async function wavFileToStream(filePath) {
    const fullPath = path.join(__dirname, filePath)
    const file = fs.createReadStream(fullPath)
    const audioStream = new PassThrough()
    const wavReader = new wav.Reader()

    let done
    const promise = new Promise(resolve => done = resolve)
    
    wavReader.on('format', () => {
        wavReader.pipe(audioStream)
        done(audioStream)
    })

    file.pipe(wavReader)
    return promise
}