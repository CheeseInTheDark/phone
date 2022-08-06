const { minSampleValue, maxSampleValue } = require('./signal-matchers/sample-limits')
const atLeastNSamples = require('./signal-matchers/signal-watcher')
const debounce = require('./signal-matchers/debounce')
const millisToSampleCount = require('./time-conversions')

module.exports = function createHookStateWatcher() {

    let sampleCount = 0    
    let phoneOffHook
    let currentWatcher

    const initialOnHookWatcher = createInitialOnHookWatcher()

    function read(sample) {
        const changed = updateCurrentState(sample)

        if (changed) updateWatcher()

        return changed ?
            { hookStateChanged: true, hookState: phoneOffHook } :
            { hookStateChanged: false }
    }

    function updateCurrentState(sample) {
        nextState = phoneOffHook === undefined ?
            readInitial(sample) :
            readNext(sample)

        const previousState = phoneOffHook
        phoneOffHook = nextState ?? phoneOffHook

        return nextState !== previousState
    }

    function readInitial(sample) {
        const isOnHook = initialOnHookWatcher.read(sample)

        if (isOnHook !== undefined) return !isOnHook
    }

    function readNext(sample) {
        const stateChanged = currentWatcher.read(sample)

        return stateChanged ? !phoneOffHook : phoneOffHook
    }

    function updateWatcher() {
        currentWatcher = phoneOffHook ? onHookWatcher() : offHookWatcher()
    }

    return { read }
}

function onHookWatcher() {
    const steps = [
        () => debounce({
            condition: sample => sample > 0.95 * maxSampleValue,
            count: 15,
            maxSamples: millisToSampleCount(1)
        }),
        () => debounce({ 
            condition: noSignalCondition, 
            count: millisToSampleCount(15),
            maxSamples: millisToSampleCount(385),

        }),
    ]

    let currentWatcher = steps[0]()
    let currentStep = 0

    function read(sample) {
        const result = currentWatcher.read(sample)
    
        if (result !== undefined) {
            result ? currentStep++ : currentStep = 0
            
            if (currentStep === steps.length) return true

            currentWatcher = steps[currentStep]()
        }
    }

    return { read }
}

const offHookWatcher = () => debounce({
    condition: sample => sample < minSampleValue * 0.95,
    count: millisToSampleCount(5)
})

const createInitialOnHookWatcher = () => atLeastNSamples({
    condition: noSignalCondition,
    minSamples: millisToSampleCount(100),
    maxSamples: millisToSampleCount(1000)
})

const noSignalCondition = sample => sample > minSampleValue * 0.01 && sample < maxSampleValue * 0.01