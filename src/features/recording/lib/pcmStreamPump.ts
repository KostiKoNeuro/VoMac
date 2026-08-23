/**
 * AudioWorklet-based PCM tap: batches mic input into ~128 ms Float32 chunks
 * (2048 frames at 16 kHz) and posts them to the main thread for streaming.
 */

const WORKLET_SOURCE = `
class PcmChunkProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(2048);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input) {
      let idx = 0;
      while (idx < input.length) {
        const space = this._buffer.length - this._offset;
        const take = Math.min(space, input.length - idx);
        this._buffer.set(input.subarray(idx, idx + take), this._offset);
        this._offset += take;
        idx += take;

        if (this._offset === this._buffer.length) {
          this.port.postMessage(this._buffer.slice(0));
          this._offset = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-chunk-processor', PcmChunkProcessor);
`;

export async function attachPcmStreamPump(
  audioContext: AudioContext,
  sourceNode: MediaStreamAudioSourceNode,
  onChunk: (chunk: Float32Array) => void,
): Promise<AudioWorkletNode> {
  const moduleUrl = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: "application/javascript" }),
  );

  try {
    await audioContext.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  const worklet = new AudioWorkletNode(audioContext, "pcm-chunk-processor");
  worklet.port.onmessage = (event) => {
    onChunk(event.data as Float32Array);
  };

  sourceNode.connect(worklet);
  return worklet;
}
