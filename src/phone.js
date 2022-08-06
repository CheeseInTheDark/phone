const { chunkedBuffer } = require('./buffer')
const millisToSampleCount = require('./time-conversions')

const createHookStateWatcher = require('./hook-state-watcher')

const debounce = require('./signal-matchers/debounce')
const atLeastNSamples = require('./signal-matchers/at-least-n-samples')
const signalWatcher = require('./signal-matchers/signal-watcher')

const maxSampleValue = Math.pow(2, 15) - 1
const minSampleValue = -Math.pow(2, 15)


module.exports = function Phone({ inStream, onDial, onHookStateChanged }) {
  
    inStream.on("data", readBuffer)

    const dialWatcher = createDialWatcher()
    const hookStateWatcher = createHookStateWatcher()

    function readBuffer(data) {
        chunkedBuffer(data, 2).forEach(bytes => {
            const sample = bytes.readInt16LE()

            const dialResult = dialWatcher.read(sample)
            if (dialResult.dialed) {
                onDial(dialResult.number)
            }

            const offHookResult = hookStateWatcher.read(sample)
            if (offHookResult.hookStateChanged) {
                onHookStateChanged(offHookResult.hookState)
            }
        })
    }
}

function createDialWatcher() {
    let pulses = 0

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
        () => atLeastNSamples({
            condition: sample => sample < 0.95 * maxSampleValue,
            minSamples: millisToSampleCount(12),
            maxSamples: millisToSampleCount(20),
            failureTolerance: millisToSampleCount(2)
        })
    ]

    let currentWatcher = steps[0]()
    let currentStep = 0

    function read(sample) {
        const result = currentWatcher.read(sample)
        let toReturn = {
            dialed: false
        }
    
        if (result !== undefined) {
            result ? currentStep++ : currentStep = 0
            
            if (currentStep === steps.length) {
                if (result) pulses++ 
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
