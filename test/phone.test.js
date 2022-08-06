const fs = require('fs')
const wav = require('wav')

const { PassThrough } = require('stream')
const expect = require('chai').expect;

const Phone = require('../src/phone.js')
const path = require('path');


describe("Phone", () => {
    it("reports when a 1 is dialed", async () => {
        const { dialedNumbers } = await testPhoneInput('1-dial.wav')

        expect(dialedNumbers).to.have.members([1])
    })

    it("reports when a 3 is dialed", async() => {
        const { dialedNumbers } = await testPhoneInput('3-dial.wav')

        expect(dialedNumbers).to.have.members([3])
    })

    it("reports when a 6 is dialed", async() => {
        const { dialedNumbers } = await testPhoneInput('6-dial.wav')

        expect(dialedNumbers).to.have.members([6])
    })

    it("reports when a 0 is dialed", async() => {
        const { dialedNumbers } = await testPhoneInput('0-dial.wav')

        expect(dialedNumbers).to.have.members([0])
    })

    it("reports when the numbers 0 1 3 6 2 are dialed", async() => {
        const { dialedNumbers } = await testPhoneInput('01362-dial.wav')

        expect(dialedNumbers).to.have.members([0, 1, 3, 6, 2])
    })

    it("reports dialing 1-867-5309", async() => {
        const { dialedNumbers } = await testPhoneInput('18675309-dial.wav')

        expect(dialedNumbers).to.have.members([1, 8, 6, 7, 5, 3, 0, 9])
    })

    it("reports dialing 1-808-967-8866", async() => {
        const { dialedNumbers } = await testPhoneInput('18089678866-dial.wav')

        expect(dialedNumbers).to.have.members([1, 8, 0, 8, 9, 6, 7, 8, 8, 6, 6])
    })

    it("reports dialing 1's, 2's, and 3's mixed together", async() => {
        const { dialedNumbers } = await testPhoneInput('112231122-dial.wav')

        expect(dialedNumbers).to.have.members([1, 1, 2, 2, 3, 1, 1, 2, 2])
    })

    it("reports several 2's dialed in succession", async() => {
        expectedNumbers = Array(29).fill(2)

        const { dialedNumbers } = await testPhoneInput('29x2-dial.wav')

        expect(dialedNumbers).to.have.members(expectedNumbers)
    })

    it("reports off-hook states when the phone starts on hook", async() => {
        const { offHookStates } = await testPhoneInput('off-hooks.wav')

        expect(offHookStates).to.have.members([false, true, false, true, false, true, false, true, false, true, false, true, false])
    })

    it("reports off-hook states when the phone starts off hook", async() => {
        const { offHookStates } = await testPhoneInput('off-hooks-starting-off.wav')

        expect(offHookStates).to.have.members([true, false, true, false, true, false, true, false, true, false, true, false])
    })

    it("does not misreport other noise as off-hook states", async() => {
        const { offHookStates } = await testPhoneInput('off-hooks-and-dials.wav')

        expect(offHookStates).to.have.members([true, false, true, false, true, false, true, false, true, false])
    })
})

async function testPhoneInput(inputFilePath) {
    const dialedNumbers = []
    const hookStates = []
    const micStream = await wavFileToStream(inputFilePath)

    Phone({
        inStream: micStream,
        onDial: number => dialedNumbers.push(number),
        onHookStateChanged: offHookState => hookStates.push(offHookState)
    })

    await new Promise(resolve => micStream.on("close", resolve))

    return {
        dialedNumbers,
        offHookStates: hookStates
    }
}

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