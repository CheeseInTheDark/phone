const AudioRecorder = require('node-audiorecorder')
const { PassThrough } = require('stream')

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


const Phone = require('./src/phone')

audioRecorder.start().stream().pipe(audioStream)

Phone({
    inStream: audioStream,
    onDial: console.log,
    onHookStateChanged: () => {}
})

process.stdin.resume();
console.warn('Press ctrl+c to exit.');