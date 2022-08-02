const { chunkedBuffer } = require('./buffer')

const maxSampleValue = Math.pow(2, 15) - 1
const minSampleValue = -Math.pow(2, 15)

const fs = require('fs')

module.exports = function Phone({ inStream, onDial }) {
  
    inStream.on("data", readBuffer)

    const dialWatcher = createDialWatcher()

    function readBuffer(data) {
        chunkedBuffer(data, 2).forEach(bytes => {
            const sample = bytes.readInt16LE()

            const dialResult = dialWatcher.read(sample)
            if (dialResult.dialed) {
                onDial(dialResult.number)
            }
        })
    }
}

function millisToSampleCount(milliseconds) {
    return Math.ceil(44100 * milliseconds / 1000)
}

function createDialWatcher() {
    const file = fs.createWriteStream('debugstuff.txt')
    let pulses = 0
    let sampleCount = 0

    const steps = [
        () => debounce({
            condition: sample => sample > 0.95 * maxSampleValue,
            count: 40,
            timeout: millisToSampleCount(3)
        }),
        () => signalWatcher({ 
            condition: sample => sample > 0.95 * maxSampleValue, 
            minSamples: millisToSampleCount(6), 
            maxSamples: millisToSampleCount(13.5)
        }),
        () => debounce({
            condition: sample => sample < 0.95 * maxSampleValue,
            count: 10,
            timeout: millisToSampleCount(1)
        }),
        () => signalWatcher({
            condition: sample => sample < 0.95 * maxSampleValue && sample > 0.95 * minSampleValue,
            minSamples: millisToSampleCount(56.5),
            maxSamples: millisToSampleCount(68)
        }),
        () => debounce({
            condition: sample => sample < 0.95 * minSampleValue,
            count: 25,
            timeout: millisToSampleCount(1)
        }),
        () => signalWatcher({
            condition: sample => sample < 0.95 * minSampleValue,
            minSamples: millisToSampleCount(0.7),
            maxSamples: millisToSampleCount(18)
        }),
        () => {
            pulses++
            console.log("Made me a pulse", pulses)
            return signalWatcher({
                condition: sample => sample < 0.95 * maxSampleValue,
                minSamples: millisToSampleCount(20),
                maxSamples: millisToSampleCount(27)
            })
        }
    ]

    let currentWatcher = steps[0]()
    let currentStep = 0

    function read(sample) {
        sampleCount++
        const result = currentWatcher.read(sample)
        let toReturn = {
            dialed: false,
            number: undefined
        }
    
        if (result !== undefined) {
            result ? currentStep++ : currentStep = 0
            
            if (currentStep === steps.length) {
                currentStep = 0
            }
            console.log("Moving to step", currentStep, "result", result, "seconds", sampleCount/44100)

            currentWatcher = steps[currentStep]()

            if (!result) {
                if (pulses > 0) {
                    console.log("Returning dialed", pulses)
                    
                    toReturn = {
                        dialed: true,
                        number: pulses < 10 ? pulses : 0
                    }
                }
                console.log("Setting pulses to 0")
                pulses = 0
            }
        }
        return toReturn
    }


    return { read }
}

function signalWatcher({condition, minSamples, maxSamples}) {
    let sampleCount = 0

    function read(sample) {
        sampleCount++

        const matched = condition(sample)
        const failed = sampleCount > maxSamples || (!matched && sampleCount <= minSamples)
        const succeeded = !matched && sampleCount >= minSamples && sampleCount <= maxSamples

        
        return failed ? false : succeeded ? true : undefined
    }

    return {
        read
    }
}

function debounce({condition, count, maxSamples}) {
    let goodSamples = 0
    let samplesRead = 0

    let finished = false

    function read(sample) {
        samplesRead ++
        condition(sample) ? goodSamples++ : goodSamples = 0
        finished = goodSamples == count

        if (finished) return true

        if (maxSamples && samplesRead > maxSamples) return false
    }

    return {
        read
    }
}

