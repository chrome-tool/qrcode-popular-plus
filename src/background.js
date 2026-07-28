chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.storage.local.set({
      onboardingComplete: false,
      installAt: Date.now()
    });
  }

  await enableSidePanelOnActionClick();
});

chrome.runtime.onStartup.addListener(async () => {
  await enableSidePanelOnActionClick();
});

async function enableSidePanelOnActionClick() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
