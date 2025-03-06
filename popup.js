// Popup script that runs when the extension popup is opened

document.addEventListener('DOMContentLoaded', function() {
  // Button to show the overlay
  document.getElementById('showBtn').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "showOverlay"});
    });
    window.close(); // Close the popup
  });
  
  // Button to clear all screenshots and analysis
  document.getElementById('clearBtn').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "clearScreenshots"});
    });
    
    // Clear storage
    chrome.storage.local.set({ screenshots: [], currentAnalysis: '' });
    
    // Close the popup
    window.close();
  });
});