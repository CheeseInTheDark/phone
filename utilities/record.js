const AudioRecorder = require('node-audiorecorder')

let audioRecorder = new AudioRecorder({
  channels: 1,
  program: 'sox',
  silence: 0,
  device: "hw:0,0"
}, console)


const fs = require('fs')

const out = fs.createWriteStream("out.wav", { encoding: 'binary' })

audioRecorder.start().stream().pipe(out)

process.stdin.resume();
console.warn('Press ctrl+c to exit.');