function chunkedBuffer(buffer, chunkSize) {

    function forEach(fn) {
        let current = 0

        while (current < buffer.length) {
            const next = buffer.slice(current, current + chunkSize)
            current += chunkSize
            fn(next)
        }
    }

    return {
        forEach
    }
}

module.exports = {
    chunkedBuffer
}