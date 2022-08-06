module.exports = function debounce({condition, count, maxSamples}) {
    let goodSamples = 0
    let samplesRead = 0

    let finished = false

    function read(sample) {
        samplesRead++
        condition(sample) ? goodSamples++ : goodSamples = 0
        finished = goodSamples == count

        if (finished) return true

        if (maxSamples && samplesRead > maxSamples && goodSamples === 0) return false
    }

    return {
        read
    }
}