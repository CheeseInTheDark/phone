const { expect } = require('chai')
const path = require('path')
const puppeteer = require('puppeteer-extra')
const sinon = require('sinon')

const openVoip = require('../src/voip-interface')

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

describe("Voip", () => {
    let subject
    let puppeteerStub
    let openBrowser

    async function openVoipWithPage(testPage) {
        root = path.join(__dirname, "voice-pages")
        fullPath = `file:///${path.join(root, testPage)}`
        return await openVoip(fullPath)
    }

    async function getVoipPage() {
        const pages = await openBrowser.pages()
        return pages[1]
    }

    async function getElement(selector) {
        const voipPage = await getVoipPage()
        return await voipPage.waitForSelector(selector)
    }

    beforeEach(() => {
        puppeteerStub = sinon.stub(puppeteer)
        puppeteerStub.launch.callsFake(function(options) {
            return puppeteerStub.launch.wrappedMethod.apply(this, [options]).then(browser => {
                openBrowser = browser
                return browser
            })
        })
    })

    afterEach(async () => {
        await subject.close()
    })

    describe("in idle state", () => {
        beforeEach(async () => {
            subject = await openVoipWithPage("voice.htm")
        })

        it("focuses dial input when a number is dialed", async () => {
            const input = await getElement(`input[id="il1"]`)
            input.evaluate(input => input.onfocus = window.dialInputFocused = true)

            await subject.dial(5)

            const page = await getVoipPage()
            await expect(page.evaluate(() => window.dialInputFocused)).to.eventually.equal(true)
        })

        it("dials a 1", async () => {
            const oneButton = await getElement(`button[aria-label~="'1'"]`)
            oneButton.evaluate(button => button.onclick = () => button.wasClicked = true )

            await subject.dial(1)
        
            await expect(oneButton.getProperty("wasClicked").then(property => property.jsonValue())).to.eventually.equal(true)
        })
    
        it("dials a 2 followed by a 3", async () => {
            const twoButton = await getElement(`button[aria-label~="'2'"]`)
            twoButton.evaluate(button => button.onclick = () => button.wasClicked = true )
            const threeButton = await getElement(`button[aria-label~="'3'"]`)
            threeButton.evaluate(button => button.onclick = () => button.wasClicked = true )

            await subject.dial(2)
            await subject.dial(3)
    
            await expect(twoButton.getProperty("wasClicked").then(property => property.jsonValue())).to.eventually.equal(true)
            await expect(threeButton.getProperty("wasClicked").then(property => property.jsonValue())).to.eventually.equal(true)
        })

        it("clears dialed numbers", async () => {
            await subject.dial(2)
            await subject.dial(3)

            await subject.clearDialed()

            const input = await getElement(`input[id="il1"]`)
            await expect(input.getProperty("value").then(property => property.jsonValue())).to.eventually.equal("")
        })
    })

    describe("with number entered", () => {
        beforeEach(async () => {
            subject = await openVoipWithPage("voice-number-entered.htm")
        })

        it("places a call", async() => {
            const callButton = await getElement(`button[gv-test-id="new-call-button"]`)
            await callButton.evaluate(button => button.onclick = () => window.clickedCallButton = true)

            await subject.startCall()

            const page = await getVoipPage()
            await expect(page.evaluate(() => window.clickedCallButton)).to.eventually.equal(true)
        })
    })

    describe("when a call is in progress", () => {
        beforeEach(async () => {
            subject = await openVoipWithPage("voice-call-in-progress.htm")

            const page = await getVoipPage()
            
            await getElement(`button[gv-test-id="in-call-end-call"]`)
            await page.$eval(`button[gv-test-id="in-call-end-call"]`, (endCallButton) => {
                const goodQualityButton = window.document.createElement("button")
                const buttonText = document.createTextNode("Good")
                goodQualityButton.setAttribute("gv-test-id", "good-quality-button")
                goodQualityButton.appendChild(buttonText)
                goodQualityButton.onclick = () => window.goodQualityButtonClicked = true
                endCallButton.onclick = () => {
                    document.body.appendChild(goodQualityButton)
                    window.clickedEndCallButton = true
                }
            })
        })

        it("ends a call", async() => {
            await subject.endCall()

            const page = await getVoipPage()
            
            await expect(page.evaluate(() => window.clickedEndCallButton)).to.eventually.equal(true)
        })

        it("immediately clicks the good call quality button after ending the call", async () => {
            const page = await getVoipPage()

            await subject.endCall()

            await expect(page.evaluate(() => window.goodQualityButtonClicked)).to.eventually.equal(true)
        })
    })

    describe("when call is incoming", () => {
        beforeEach(async () => {
            subject = await openVoipWithPage("voice-incoming-call.htm")
        })

        it("mutes incoming ring", async() => {
            const incomingCallRing = await getElement(`audio[gv-id="inbound_ring"]`)

            await waitUntilProperty(incomingCallRing, "muted")
           
            await expect(incomingCallRing.getProperty("muted").then(property => property.jsonValue())).to.eventually.equal(true)
        })

        it("reports an incoming call", async() => {
            callListener = sinon.spy()

            subject.onIncomingCall(callListener)

            const incomingCallAudio = await getElement(`audio[gv-id="inbound_ring"]`)
            await waitUntilProperty(incomingCallAudio, "onplay", value => value !== undefined)

            await incomingCallAudio.evaluate(audio => audio.play())

            await waitUntilProperty(incomingCallAudio, "paused", value => !value)

            expect(callListener).to.have.been.calledOnce
        })

        it("answers incoming call", async() => {
            const answerButton = await getElement(`button[gv-test-id="in-call-pickup-call"]`)
            await answerButton.evaluate(button => button.onclick = () => window.clickedAnswerButton = true)

            await subject.answerCall()

            const page = await getVoipPage()
            await expect(page.evaluate(() => window.clickedAnswerButton)).to.eventually.equal(true)
        })
    })

})


async function waitUntilProperty(element, propertyName, condition = value => value) {
    await new Promise(resolve => setTimeout(resolve, 2000))

    return element.getProperty(propertyName)
        .then(property => property.jsonValue())
        .then(value => condition(value) ? null : waitUntilProperty(element, propertyName))
}