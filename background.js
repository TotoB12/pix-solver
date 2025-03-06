// Background script to handle keyboard shortcuts and messaging

// Initialize the extension state
let screenshots = [];
let currentAnalysis = '';

// Listen for keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'take-screenshot' || command === 'analyze-screenshots' || command === 'clear-screenshots') {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTabId = tabs[0].id;
      
      // Check if we can send a message to the content script
      try {
        // First try to send a ping message to see if content script is loaded
        await chrome.tabs.sendMessage(activeTabId, { action: "ping" });
        // If we get here, content script is loaded, send the actual command
        chrome.tabs.sendMessage(activeTabId, { action: command === 'take-screenshot' ? 'takeScreenshot' : 
                                                      command === 'analyze-screenshots' ? 'analyzeScreenshots' : 
                                                      'clearScreenshots' });
      } catch (error) {
        // Content script is not loaded yet, inject it first
        await chrome.scripting.executeScript({
          target: { tabId: activeTabId },
          files: ['content.js']
        });
        
        // Wait a moment for the content script to initialize
        setTimeout(() => {
          chrome.tabs.sendMessage(activeTabId, { action: command === 'take-screenshot' ? 'takeScreenshot' : 
                                                       command === 'analyze-screenshots' ? 'analyzeScreenshots' : 
                                                       'clearScreenshots' });
        }, 500);
      }
    }
  });

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "screenshotTaken") {
    // Store the screenshot
    screenshots.push(message.screenshot);
    chrome.storage.local.set({ screenshots: screenshots });
    sendResponse({ success: true });
    return true;
  } 
  else if (message.action === "getScreenshots") {
    sendResponse({ screenshots: screenshots });
    return true;
  }
  else if (message.action === "analysisResult") {
    // Store the analysis result
    currentAnalysis = message.result;
    chrome.storage.local.set({ currentAnalysis: currentAnalysis });
    sendResponse({ success: true });
    return true;
  }
  else if (message.action === "getCurrentAnalysis") {
    sendResponse({ currentAnalysis: currentAnalysis });
    return true;
  }
});

// On extension install/update, initialize storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ screenshots: [], currentAnalysis: '' });
});