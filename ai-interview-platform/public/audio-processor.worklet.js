class AudioProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input[0] && input[0].length > 0) {
            // CRITICAL: Copy the buffer! The original is reused by the browser
            // and may be overwritten before the main thread reads it.
            const copy = new Float32Array(input[0]);
            this.port.postMessage(copy, [copy.buffer]);
        }
        return true;
    }
}
registerProcessor('audio-processor', AudioProcessor);
