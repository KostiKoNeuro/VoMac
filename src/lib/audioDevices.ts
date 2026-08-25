import { translate } from "./i18n";

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

/** WebView2 only reports device labels after mic permission was granted once. */
async function ensureMicPermission(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // The picker still renders (unlabeled); recording surfaces its own error.
  }
}

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  let devices = await navigator.mediaDevices.enumerateDevices();
  const hasLabels = devices.some(
    (device) => device.kind === "audioinput" && device.label,
  );
  if (!hasLabels) {
    await ensureMicPermission();
    devices = await navigator.mediaDevices.enumerateDevices();
  }

  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label:
        device.label || `${translate("recording.microphone.unnamed")} ${index + 1}`,
    }));
}
