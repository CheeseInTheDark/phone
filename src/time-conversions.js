module.exports = function millisToSampleCount(milliseconds) {
    return Math.ceil(44100 * milliseconds / 1000)
}