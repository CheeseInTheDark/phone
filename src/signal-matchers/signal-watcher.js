module.exports = function signalWatcher({condition, minSamples, maxSamples, failureTolerance = 0}) {
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
