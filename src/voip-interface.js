const puppeteer = require('puppeteer-extra')

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

async function attachToIncomingCalls(voipPage, listeners) {
    await voipPage.waitForSelector(`audio[gv-id="inbound_ring"]`)
    await voipPage.$eval(`audio[gv-id="inbound_ring"]`, (incomingRingAudio) => incomingRingAudio.muted = true)
    listenForIncomingCalls(voipPage, listeners)
}

async function listenForIncomingCalls(voipPage, listeners) {
    const alreadyPlaying = await voipPage.$eval(`audio[gv-id="inbound_ring"]`, (audio) => !audio.paused)

    if (alreadyPlaying) listeners.forEach(listener => listener())

    while (!voipPage.isClosed()) {
        await voipPage.$eval(`audio[gv-id="inbound_ring"]`, (incomingRingAudio) => {
            return new Promise(resolve => incomingRingAudio.onplay = resolve)
        })
        listeners.forEach(listener => listener())    
    }

}

module.exports = async function openVoip(address) {

    const browser = await puppeteer.launch({ headless: false})
    const voipPage = await browser.newPage()
    
    voipPage.setDefaultTimeout(0)
    voipPage.goto(address)
    
    let incomingCallListeners = []
    attachToIncomingCalls(voipPage, incomingCallListeners)

    async function dial(number) {
        const button = await voipPage.waitForSelector(`button[aria-label~="'${number}'"]`)
        await button.evaluate(button => button.click())
    }

    async function startCall() {
        const callButton = await voipPage.waitForSelector(`button[gv-test-id="new-call-button"]`)
        await callButton.evaluate(button => button.click())
    }

    async function endCall() {
        const endCallButton = await voipPage.waitForSelector(`button[gv-test-id="in-call-end-call"]`)
        await endCallButton.evaluate(button => button.click())

        const goodButton = await voipPage.waitForSelector(`button[gv-test-id="good-quality-button"]`)
        await goodButton.evaluate(button => button.click())
    }

    async function answerCall() {
        const answerCallButton = await voipPage.waitForSelector(`button[gv-test-id="in-call-pickup-call"]`)
        await answerCallButton.evaluate(button => button.click())
    }

    async function clearDialed() {
        await voipPage.waitForSelector(`input[id="il1"]`)
        await voipPage.$eval(`input[id="il1"]`, (input) => {
            input.value = ""
            input.dispatchEvent(new KeyboardEvent("keydown", {key: "Backspace", keyCode: 8}))
        })
    }

    async function close() {
        await browser.close()
    }


    function onIncomingCall(listener) {
        incomingCallListeners.push(listener)
    }

    return {
        dial,
        clearDialed,
        startCall,
        endCall,
        answerCall,
        onIncomingCall,
        close
    }
}