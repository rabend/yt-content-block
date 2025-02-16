// Function to check if a video should be blocked based on its title
function shouldBlockVideo(title, keywords) {
  title = title.toLowerCase();
  return keywords.some(keyword => title.includes(keyword.toLowerCase()));
}

// Function to extract video ID from various YouTube elements
function getVideoId(videoElement) {
  // Try to find video ID from thumbnail
  const thumbnail = videoElement.querySelector('a#thumbnail');
  if (thumbnail && thumbnail.href) {
    const match = thumbnail.href.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }
  return null;
}

// Function to create placeholder content
function createPlaceholder() {
  const isDarkMode = document.documentElement.getAttribute('dark') === 'true';
  const placeholder = document.createElement('div');
  placeholder.className = 'removed-video-placeholder';
  placeholder.innerHTML = `
    <div class="placeholder-content ${isDarkMode ? 'dark' : 'light'}">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="${isDarkMode ? '#ffffff' : '#1a1a1a'}" opacity="0.1"/>
        <path d="M16 16 L32 32 M32 16 L16 32" stroke="${isDarkMode ? '#ffffff' : '#1a1a1a'}" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
      </svg>
      <p>Video removed</p>
      <button class="undo-removal">Undo removal</button>
    </div>
  `;
  return placeholder;
}

// Function to handle permanent removal of a video
function handlePermanentRemoval(videoElement, videoId) {
  // Prevent processing this element again during this removal
  videoElement.dataset.beingRemoved = 'true';
  
  const titleElement = videoElement.querySelector('#video-title, #title');
  const videoTitle = titleElement ? titleElement.textContent : '';
  
  // Get the keyword that triggered the block
  chrome.storage.sync.get(['blockedKeywords'], function(result) {
    const keywords = result.blockedKeywords || [];
    const matchedKeyword = keywords.find(keyword => 
      videoTitle.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Update the storage with video ID and the keyword that caused removal
    chrome.storage.sync.get(['permanentlyRemoved'], function(result) {
      const permanentlyRemoved = result.permanentlyRemoved || [];
      if (!permanentlyRemoved.some(item => item.id === videoId)) {
        permanentlyRemoved.push({
          id: videoId,
          keyword: matchedKeyword,
          title: videoTitle
        });
        chrome.storage.sync.set({ permanentlyRemoved: permanentlyRemoved }, function() {
          videoElement.remove();
        });
      } else {
        videoElement.remove();
      }
    });
  });
}

// Function to process a single video element
function processVideoElement(videoElement) {
  // Skip if the element is currently being removed or already processed
  if (videoElement.dataset.beingRemoved === 'true' || videoElement.dataset.processed === 'true') {
    return;
  }

  const videoId = getVideoId(videoElement);
  if (!videoId) return;

  // Mark as processed
  videoElement.dataset.processed = 'true';
  
  chrome.storage.sync.get(['blockedKeywords', 'permanentlyRemoved'], function(result) {
    const keywords = result.blockedKeywords || [];
    const permanentlyRemoved = result.permanentlyRemoved || [];
    
    // Handle permanently removed videos - now just remove them from DOM
    const removedVideo = permanentlyRemoved.find(item => item.id === videoId);
    if (removedVideo && keywords.includes(removedVideo.keyword)) {
      videoElement.remove();
      return;
    }
    
    // Handle keyword-based blocking
    const titleElement = videoElement.querySelector('#video-title, #title');
    if (titleElement) {
      const videoTitle = titleElement.textContent;
      
      if (shouldBlockVideo(videoTitle, keywords)) {
        videoElement.classList.add('blocked-content');
        
        // Create or update blocked overlay if it doesn't exist
        if (!videoElement.querySelector('.blocked-overlay')) {
          const overlay = document.createElement('div');
          overlay.className = 'blocked-overlay';
          overlay.innerHTML = `
            <p>Content blocked due to keyword match</p>
            <div class="overlay-buttons">
              <button class="show-anyway">Press and hold to peek</button>
              <button class="remove-permanently">Remove permanently</button>
            </div>
          `;
          
          // Add peek functionality
          const showButton = overlay.querySelector('.show-anyway');
          
          showButton.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            videoElement.classList.remove('blocked-content');
          });
          
          showButton.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            videoElement.classList.add('blocked-content');
          });
          
          // Handle cases where mouse leaves the button while pressed
          showButton.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            videoElement.classList.add('blocked-content');
          });
          
          // Prevent text selection while holding
          showButton.addEventListener('selectstart', (e) => {
            e.preventDefault();
          });
          
          // Add permanent removal functionality
          const removeButton = overlay.querySelector('.remove-permanently');
          removeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (videoId) {
              handlePermanentRemoval(videoElement, videoId);
            }
          });
          
          videoElement.appendChild(overlay);
        }
      } else {
        videoElement.classList.remove('blocked-content');
        const overlay = videoElement.querySelector('.blocked-overlay');
        if (overlay) {
          overlay.remove();
        }
      }
    }
  });
}

// Function to process video elements (now only processes new elements)
function processVideoElements(elements = null) {
  const videoElements = elements || document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer');
  videoElements.forEach(processVideoElement);
}

// Watch for theme changes and new content
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'dark') {
      // Refresh all placeholders when theme changes
      document.querySelectorAll('.removed-video-placeholder').forEach(placeholder => {
        const videoElement = placeholder.closest('ytd-rich-item-renderer, ytd-compact-video-renderer');
        const videoId = getVideoId(videoElement);
        if (videoId) {
          placeholder.remove();
          videoElement.appendChild(createPlaceholder());
        }
      });
    }
    if (mutation.addedNodes.length) {
      // Process only newly added video elements
      const newVideoElements = Array.from(mutation.addedNodes)
        .filter(node => node.nodeType === 1) // Only element nodes
        .flatMap(node => {
          if (node.matches('ytd-rich-item-renderer, ytd-compact-video-renderer')) {
            return [node];
          }
          return Array.from(node.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer'));
        });
      
      if (newVideoElements.length > 0) {
        processVideoElements(newVideoElements);
      }
    }
  });
});

// Start observing the document with the configured parameters
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['dark']
});
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial processing of existing videos
processVideoElements();

// Function to clear all stored data
function clearAllData() {
  chrome.storage.sync.set({
    blockedKeywords: [],
    permanentlyRemoved: []
  }, function() {
    // Reprocess all videos to show everything
    document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer')
      .forEach(element => {
        delete element.dataset.processed;
        processVideoElement(element);
      });
  });
}

// Listen for changes in blocked keywords or removed videos
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedKeywords) {
    const newKeywords = changes.blockedKeywords.newValue || [];
    const oldKeywords = changes.blockedKeywords.oldValue || [];
    
    // Check if this is a complete reset (all data cleared)
    if (newKeywords.length === 0 && oldKeywords && oldKeywords.length > 0) {
      // This is likely a reset, reprocess all videos
      document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer')
        .forEach(element => {
          delete element.dataset.processed;
          processVideoElement(element);
        });
      return;
    }
    
    const removedKeywords = oldKeywords.filter(k => !newKeywords.includes(k));
    
    if (removedKeywords.length > 0) {
      // Get permanently removed videos and filter out ones removed by the removed keywords
      chrome.storage.sync.get(['permanentlyRemoved'], function(result) {
        const permanentlyRemoved = result.permanentlyRemoved || [];
        const updatedRemoved = permanentlyRemoved.filter(item => 
          !removedKeywords.includes(item.keyword)
        );
        
        // Update storage with filtered list
        chrome.storage.sync.set({ permanentlyRemoved: updatedRemoved }, function() {
          // Reprocess all videos to show restored ones
          document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer')
            .forEach(element => {
              delete element.dataset.processed;
              processVideoElement(element);
            });
        });
      });
    } else {
      // Just reprocess videos for other keyword changes
      document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer')
        .forEach(element => {
          delete element.dataset.processed;
          processVideoElement(element);
        });
    }
  }
});

// Add message listener for commands from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearAllData') {
    clearAllData();
    sendResponse({ success: true });
  }
}); 