const AudioRecorder = require('node-audiorecorder')
const { PassThrough } = require('stream')
const openVoip = require('./voip-interface')
const Phone = require('./phone')

const audioStream = new PassThrough()

let audioRecorder = new AudioRecorder({
  channels: 1,
  program: 'sox',
  thresholdStart: 0,
  thresholdStop: 0,
  rate: 44100,
  silence: 0,
  device: "hw:0,0"
}, console)


audioRecorder.start().stream().pipe(audioStream)

openVoip("https://voice.google.com/").then(voip => {

    let isOffHook
    let currentDialTimeout
    let dialedNumbers = []

    function dialNumber(number) {
        if (!isOffHook) return
        
        voip.dial(number)
        dialedNumbers.push(number)

        if (currentDialTimeout) clearTimeout(currentDialTimeout)
        currentDialTimeout = setTimeout(tryCall, 5000)
    }

    function tryCall() {
        console.log("Trying call", dialedNumbers.length, dialedNumbers)
        voip.startCall()
    }

    async function onHookStateChanged(newOffHookState) {
        isOffHook = newOffHookState
        isOffHook ? answer() : hangup()
    }

    function hangup() {
        console.log("Hanging up")
        voip.endCall()
        voip.clearDialed()
        dialedNumbers = []
        if (currentDialTimeout) clearTimeout(currentDialTimeout)
    }

    function answer() {
        console.log("Answering")
        voip.answerCall()
    }

    Phone({
        inStream: audioStream,
        onDial: dialNumber,
        onHookStateChanged
    })
})

process.stdin.resume();
console.warn('Press ctrl+c to exit.');