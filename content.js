// Content script that runs in the context of the web page

// Create the UI container for our extension's overlay
function createOverlay() {
    // Check if overlay already exists
    if (document.getElementById('exam-helper-overlay')) {
        return;
    }

    // Create main container
    const overlay = document.createElement('div');
    overlay.id = 'exam-helper-overlay';

    // Create screenshots container
    const screenshotsContainer = document.createElement('div');
    screenshotsContainer.id = 'exam-helper-screenshots';

    // Create analysis container
    const analysisContainer = document.createElement('div');
    analysisContainer.id = 'exam-helper-analysis';
    analysisContainer.innerHTML = '<div class="placeholder">Press Alt+S to take screenshots and Alt+A to analyze them</div>';

    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.id = 'exam-helper-close';
    closeButton.innerText = '×';
    closeButton.addEventListener('click', function () {
        overlay.classList.add('hidden');
    });

    // Create the shortcuts info
    const shortcuts = document.createElement('div');
    shortcuts.id = 'exam-helper-shortcuts';
    shortcuts.innerHTML = '<span>Alt+S: Screenshot</span><span>Alt+A: Analyze</span><span>Alt+Q: Clear</span>';

    // Add everything to the DOM
    overlay.appendChild(closeButton);
    overlay.appendChild(screenshotsContainer);
    overlay.appendChild(analysisContainer);
    overlay.appendChild(shortcuts);
    document.body.appendChild(overlay);

    // Make the overlay draggable
    makeDraggable(overlay);

    // Make sure it's initially visible
    setTimeout(() => overlay.classList.remove('hidden'), 100);

    // Load any existing screenshots and analysis
    loadExistingContent();
}

// Make an element draggable
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    element.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
        // Skip if clicking on a button or scrollable area
        if (e.target.tagName === 'BUTTON' ||
            e.target.id === 'exam-helper-screenshots' ||
            e.target.id === 'exam-helper-analysis') {
            return;
        }

        e.preventDefault();
        // Get mouse position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementDrag);
    }

    function elementDrag(e) {
        e.preventDefault();
        // Calculate new position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        // Stop moving when mouse button is released
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
    }
}

// Take a screenshot of the visible part of the page
async function takeScreenshot() {
    // console.log('Taking screenshot...');
    const overlay = document.getElementById('exam-helper-overlay');

    // Temporarily hide our overlay for the screenshot
    overlay.classList.add('hidden');

    // Small delay to ensure the overlay is hidden
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        // Use html2canvas to capture the visible part of the page
        const canvas = await html2canvas(document.body, {
            allowTaint: true,
            useCORS: true,
            logging: false
        });

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png');

        // Add to our UI
        addScreenshotToUI(dataUrl);

        // Send to background script
        chrome.runtime.sendMessage({
            action: "screenshotTaken",
            screenshot: dataUrl
        });

        // Show overlay again
        overlay.classList.remove('hidden');
    } catch (error) {
        console.error('Screenshot error:', error);
        overlay.classList.remove('hidden');
        showError('Failed to take screenshot');
    }
}

// Add a screenshot to the UI
function addScreenshotToUI(dataUrl) {
    const container = document.getElementById('exam-helper-screenshots');

    const thumbnail = document.createElement('div');
    thumbnail.className = 'screenshot-thumbnail';

    const img = document.createElement('img');
    img.src = dataUrl;

    thumbnail.appendChild(img);
    container.appendChild(thumbnail);

    // Scroll to show newest screenshot
    container.scrollLeft = container.scrollWidth;
}

// Analyze screenshots using Gemini API
async function analyzeScreenshots() {
    const analysisContainer = document.getElementById('exam-helper-analysis');

    // Show loading message
    analysisContainer.innerHTML = '<div class="loading">Analyzing screenshots...</div>';

    // Get screenshots from background script
    chrome.runtime.sendMessage({ action: "getScreenshots" }, async (response) => {
        const screenshots = response.screenshots;

        if (!screenshots || screenshots.length === 0) {
            analysisContainer.innerHTML = '<div class="error">No screenshots to analyze</div>';
            return;
        }

        try {
            // Call our Cloud Function endpoint that will interface with Gemini API
            const result = await callGeminiAPI(screenshots);

            // Update UI with result
            analysisContainer.textContent = result;

            // Store result in background script
            chrome.runtime.sendMessage({
                action: "analysisResult",
                result: result
            });
        } catch (error) {
            console.error('Analysis error:', error);
            analysisContainer.innerHTML = `<div class="error">Analysis failed: ${error.message}</div>`;
        }
    });
}

// Helper function to get the Gemini API key from storage
function getGeminiApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["geminiApiKey"], (result) => {
            resolve(result.geminiApiKey || "");
        });
    });
}

// Analyze screenshots using Gemini API (updated implementation)
async function callGeminiAPI(screenshots) {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        throw new Error("No Gemini API key set. Please add your key in the popup.");
    }

    // Dynamically import the GoogleGenerativeAI library and related constants
    const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = await import(chrome.runtime.getURL('generative-ai.js'));

    // Initialize the Gemini model with your API key and desired configuration
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            temperature: 0.69
        },
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ],
        systemInstruction: "Analyze the provided screenshots for questions and problems. Provide the answer concisely."
    });

    // Prepare image parts by stripping the data URL prefix and setting MIME type
    const imageContents = screenshots.map(screenshot => {
        const base64Data = screenshot.split(',')[1];
        return {
            inlineData: {
                data: base64Data,
                mimeType: 'image/png'
            }
        };
    });

    // Build the parts for the request: a text prompt plus the images
    const parts = [
        { text: "Please analyze the image(s) and provide the answer to the exam question shown. Be concise and direct." },
        ...imageContents
    ];

    // Call Gemini API and return the response text
    const response = await model.generateContent({
        contents: [{ role: "user", parts }]
    });
    return response.response.text();
}

// Clear all screenshots and analysis
function clearScreenshots() {
    const screenshotsContainer = document.getElementById('exam-helper-screenshots');
    const analysisContainer = document.getElementById('exam-helper-analysis');

    // Clear UI
    screenshotsContainer.innerHTML = '';
    analysisContainer.innerHTML = '<div class="placeholder">Press Alt+S to take screenshots and Alt+A to analyze them</div>';
}

// Display error message
function showError(message) {
    const analysisContainer = document.getElementById('exam-helper-analysis');

    const errorElement = document.createElement('div');
    errorElement.className = 'error';
    errorElement.textContent = message;

    analysisContainer.innerHTML = '';
    analysisContainer.appendChild(errorElement);

    // Clear error after 3 seconds
    setTimeout(() => {
        if (analysisContainer.contains(errorElement)) {
            analysisContainer.removeChild(errorElement);

            // If there's no other content, show placeholder
            if (analysisContainer.children.length === 0) {
                analysisContainer.innerHTML = '<div class="placeholder">Press Alt+S to take screenshots and Alt+A to analyze them</div>';
            }
        }
    }, 3000);
}

// Load existing screenshots and analysis from storage
function loadExistingContent() {
    chrome.runtime.sendMessage({ action: "getScreenshots" }, (response) => {
        const screenshots = response.screenshots || [];

        if (screenshots.length > 0) {
            screenshots.forEach(screenshot => {
                addScreenshotToUI(screenshot);
            });
        }
    });

    chrome.runtime.sendMessage({ action: "getCurrentAnalysis" }, (response) => {
        const currentAnalysis = response.currentAnalysis;

        if (currentAnalysis) {
            const analysisContainer = document.getElementById('exam-helper-analysis');
            analysisContainer.textContent = currentAnalysis;
        }
    });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "ping") {
        // Just respond to confirm content script is loaded
        sendResponse({ status: "content script active" });
        return true;
    }
    else if (message.action === "takeScreenshot") {
        // Ensure overlay exists
        if (!document.getElementById('exam-helper-overlay')) {
            createOverlay();
        }

        // Make sure overlay is visible
        document.getElementById('exam-helper-overlay').classList.remove('hidden');

        // Take screenshot
        takeScreenshot();
        sendResponse({ success: true });
    }
    else if (message.action === "analyzeScreenshots") {
        // Ensure overlay exists
        if (!document.getElementById('exam-helper-overlay')) {
            createOverlay();
        }

        // Make sure overlay is visible
        document.getElementById('exam-helper-overlay').classList.remove('hidden');

        // Analyze screenshots
        analyzeScreenshots();
        sendResponse({ success: true });
    }
    else if (message.action === "clearScreenshots") {
        if (document.getElementById('exam-helper-overlay')) {
            clearScreenshots();
        }
        sendResponse({ success: true });
    }
    return true;
});

// Load html2canvas library dynamically
function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('html2canvas.min.js');
        script.onload = () => {
            console.log('html2canvas loaded successfully');
            resolve();
        };
        script.onerror = (e) => {
            console.error('Failed to load html2canvas:', e);
            reject(e);
        };
        document.head.appendChild(script);
    });
}

// Initialize on page load
(async function () {
    try {
        await loadHtml2Canvas();
        createOverlay();
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
})();