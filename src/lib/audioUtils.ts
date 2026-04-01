/**
 * Converts an audio blob (like WebM or OGG) to a standard PCM WAV blob.
 * This ensures compatibility with AI APIs and proxies that lack robust EBML parsing.
 */
export async function convertToWav(blob: Blob): Promise<Blob> {
  const audioContext = new window.AudioContext({ sampleRate: 16000 });

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    writeUTFBytes(view, 0, "RIFF");
    view.setUint32(4, 36 + length, true);
    writeUTFBytes(view, 8, "WAVE");

    writeUTFBytes(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numOfChan * 2, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);

    writeUTFBytes(view, 36, "data");
    view.setUint32(40, length, true);

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numOfChan; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        let s = Math.max(-1, Math.min(1, sample));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, s, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: "audio/wav" });
  } finally {
    if (audioContext.state !== "closed") {
      void audioContext.close();
    }
  }
}

function writeUTFBytes(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
