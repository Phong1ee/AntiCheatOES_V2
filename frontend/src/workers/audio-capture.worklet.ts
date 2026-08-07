class ProctoringAudioCapture extends AudioWorkletProcessor {
  private samples = new Float32Array(2048);
  private length = 0;
  private pending = false;
  constructor() { super(); this.port.onmessage = ({ data }) => { if (data.type === "ack") this.pending = false; }; }
  process(inputs: Float32Array[][]) {
    const input = inputs[0]?.[0]; if (!input) return true;
    if (this.length + input.length > this.samples.length) {
      if (this.pending) { this.length = 0; this.port.postMessage({ type: "dropped" }); return true; }
      const chunk = this.samples.slice(0, this.length); this.length = 0; this.pending = true; this.port.postMessage({ type: "pcm", samples: chunk }, [chunk.buffer]);
    }
    this.samples.set(input, this.length); this.length += input.length;
    return true;
  }
}
registerProcessor("proctoring-audio-capture", ProctoringAudioCapture);
