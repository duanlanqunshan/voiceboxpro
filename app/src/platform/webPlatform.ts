import type { Platform, UpdateStatus } from '@/platform/types';

const noop = async () => {};
const noop2 = async (_?: unknown) => {};
const noop3 = async (_?: unknown, __?: unknown) => {};
const noopUnsubscribe = () => {};

export const webPlatform: Platform = {
  metadata: {
    isTauri: false,
    getVersion: async () => '0.5.0',
  },
  filesystem: {
    saveFile: async (filename: string, blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    openPath: noop,
    pickDirectory: async () => null,
  },
  audio: {
    isSystemAudioSupported: async () => false,
    startSystemAudioCapture: noop,
    stopSystemAudioCapture: async () => new Uint8Array(),
    listOutputDevices: async () => [],
    playToDevices: noop,
    stopPlayback: () => {},
  },
  updater: {
    checkForUpdates: noop,
    downloadAndInstall: noop,
    restartAndInstall: noop,
    getStatus: () => ({
      checking: false,
      available: false,
      downloading: false,
      installing: false,
      readyToInstall: false,
    }),
    subscribe: () => noopUnsubscribe,
  },
  lifecycle: {
    startServer: async () => 'http://127.0.0.1:18792',
    stopServer: noop,
    restartServer: async () => 'http://127.0.0.1:18792',
    setKeepServerRunning: noop2,
    setupWindowCloseHandler: noop,
    subscribeToServerLogs: () => noopUnsubscribe,
    onServerReady: undefined,
  },
};