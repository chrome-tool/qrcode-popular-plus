// @ts-ignore
import QrScanner from "../libs/qr-scanner/qr-scanner.min.js";

QrScanner.WORKER_PATH = chrome.runtime.getURL("libs/qr-scanner/qr-scanner-worker.min.js");

export async function scanImage(input) {
  const value = await QrScanner.scanImage(input);
  return typeof value === "string" ? value : value?.data;
}

export async function hasCamera() {
  return QrScanner.hasCamera();
}

export async function startCamera(videoEl, onDetected) {
  const scanner = new QrScanner(videoEl, (result) => {
    const value = typeof result === "string" ? result : result?.data;
    if (value) {
      onDetected(value);
    }
  });
  await scanner.start();
  return scanner;
}
