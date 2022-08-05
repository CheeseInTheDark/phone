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
    let pulses = 0
    let sampleCount = 0

    const steps = [
        () => debounce({
            condition: sample => sample > 0.90 * maxSampleValue,
            count: 5,
            maxSamples: millisToSampleCount(15)
        }),
        () => signalWatcher({ 
            condition: sample => sample > 0.90 * maxSampleValue, 
            minSamples: millisToSampleCount(1), 
            maxSamples: millisToSampleCount(40),
            failureTolerance: millisToSampleCount(3)
        }),
        () => debounce({
            condition: sample => sample < 0.90 * maxSampleValue,
            count: 10,
            maxSamples: millisToSampleCount(1)
        }),
        () => signalWatcher({
            condition: sample => sample < 0.90 * maxSampleValue && sample >= 0,
            minSamples: millisToSampleCount(4),
            maxSamples: millisToSampleCount(40),
            failureTolerance: millisToSampleCount(2)
        }),
        () => signalWatcher({
            condition: sample => sample < 0 * maxSampleValue && sample > 0.95 * minSampleValue,
            minSamples: millisToSampleCount(30),
            maxSamples: millisToSampleCount(60),
            failureTolerance: millisToSampleCount(2)
        }),
        () => debounce({
            condition: sample => sample < 0.95 * minSampleValue,
            count: 25,
            maxSamples: millisToSampleCount(5)
        }),
        () => signalWatcher({
            condition: sample => sample < 0.95 * minSampleValue,
            minSamples: millisToSampleCount(1),
            maxSamples: millisToSampleCount(25),
            failureTolerance: millisToSampleCount(2)
        }),
        () => forMinSampleCount({
            condition: sample => sample < 0.95 * maxSampleValue,
            minSamples: millisToSampleCount(12),
            maxSamples: millisToSampleCount(20),
            failureTolerance: millisToSampleCount(2)
        })
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
                if (result) pulses++ 
                if (result) console.log("Pulses at " + sampleCount/ 44100, pulses)
                currentStep = 0
            }

            currentWatcher = steps[currentStep]()

            if (!result) {
                if (pulses > 0) {
                    
                    toReturn = {
                        dialed: true,
                        number: pulses < 10 ? pulses : 0
                    }
                }

                pulses = 0
            }
        }
        return toReturn
    }


    return { read }
}


function forMinSampleCount({condition, minSamples, maxSamples, failureTolerance=0}) {
    let failures = 0 
    let sampleCount = 0

    function read(sample) {
        sampleCount++

        const matched = condition(sample)

        if (!matched) failures++

        const failed = failures > failureTolerance && sampleCount < minSamples
        const succeeded = (failures > failureTolerance && sampleCount >= minSamples) || sampleCount === maxSamples

        
        return failed ? false : succeeded ? true : undefined
    }

    return {
        read
    } 
}


function signalWatcher({condition, minSamples, maxSamples, failureTolerance = 0}) {
    let failures = 0 
    let sampleCount = 0

    function read(sample) {
        sampleCount++

        const matched = condition(sample)
        
        if (!matched) failures++

        const failed = sampleCount > maxSamples || (failures > failureTolerance && sampleCount < minSamples)
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

        if (maxSamples && samplesRead > maxSamples && goodSamples === 0) return false
    }

    return {
        read
    }
}

