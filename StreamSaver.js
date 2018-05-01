;((name, definition) => {
	'undefined' != typeof module ? module.exports = definition() :
	'function' == typeof define && 'object' == typeof define.amd ? define(definition) :
	this[name] = definition()
})('streamSaver', () => {
	'use strict'

	let
	loaded,
	secure = location.protocol == 'https:' || location.hostname == 'localhost',
	streamSaver = {
		createWriteStream,
		supported: false,
		version: {
			full: '1.0.0',
			major: 1, minor: 0, dot: 0
		}
	}

	try {
		// Some browser has it but ain't allowed to construct a stream yet
		streamSaver.supported = 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
	} catch(err) {
		// if you are running chrome < 52 then you can enable it
		// `chrome://flags/#enable-experimental-web-platform-features`
	}

	function createWriteStream(filename, queuingStrategy, size) {

		// normalize arguments
		if (Number.isFinite(queuingStrategy))
			[size, queuingStrategy] = [queuingStrategy, size]

		let channel = new MessageChannel,
		popup,
		setupChannel = () => new Promise((resolve, reject) => {
			channel.port1.onmessage = evt => {
				if(evt.data.download) {
					resolve()
					let link = document.createElement('a')
					let click = new MouseEvent('click')

					link.href = evt.data.download
					link.dispatchEvent(click)
				}
            }

            let data = {filename, size}
            navigator.serviceWorker.getRegistration('./').then(swReg => {
                return swReg || navigator.serviceWorker.register('sw.js', {scope: './'})
            }).then(swReg => {

                let swRegTmp = swReg.installing || swReg.waiting

                if (swReg.active)
                    return swReg.active.postMessage(data, [channel.port1])

                swRegTmp.onstatechange = () => {
                    if (swRegTmp.state === 'activated')
                        swReg.active.postMessage(data, [channel.port1])
                }
            })

            window.postMessage({filename, size}, '*', [channel.port2])

        })

        return new WritableStream({
            start(error) {
                // is called immediately, and should perform any actions
                // necessary to acquire access to the underlying sink.
                // If this process is asynchronous, it can return a promise
                // to signal success or failure.
                return setupChannel()
            },
            write(chunk) {
                // is called when a new chunk of data is ready to be written
                // to the underlying sink. It can return a promise to signal
                // success or failure of the write operation. The stream
                // implementation guarantees that this method will be called
                // only after previous writes have succeeded, and never after
                // close or abort is called.

                // TODO: Kind of important that service worker respond back when
                // it has been written. Otherwise we can't handle backpressure
                channel.port1.postMessage(chunk)
            },
                close() {
                    channel.port1.postMessage('end')
                        console.log('All data successfully read!')
                },
                abort(e) {
                    channel.port1.postMessage('abort')
                }
        }, queuingStrategy)
    }

    return streamSaver
})
