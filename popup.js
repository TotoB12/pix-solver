// Load any saved Gemini API key when the popup opens
document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(["geminiApiKey"], (result) => {
    document.getElementById("gemini-api-key").value = result.geminiApiKey || "";
  });
  
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
    // Clear storage for screenshots and analysis if needed
    chrome.storage.local.set({ screenshots: [], currentAnalysis: '' });
    window.close();
  });
  
  // Save API key button functionality
  document.getElementById("save-api-key").addEventListener("click", () => {
    const key = document.getElementById("gemini-api-key").value.trim();
    chrome.storage.local.set({ geminiApiKey: key }, () => {
      alert("Gemini API key saved.");
    });
  });
});
