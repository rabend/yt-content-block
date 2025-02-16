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
  
  // Remove blocked state and overlay first
  videoElement.classList.remove('blocked-content');
  const existingOverlay = videoElement.querySelector('.blocked-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Hide the original content
  const contentContainer = videoElement.querySelector('#content');
  if (contentContainer) {
    contentContainer.style.display = 'none';
  }

  // Create and add the placeholder
  const placeholder = createPlaceholder();
  videoElement.classList.add('permanently-removed');
  
  // Add undo functionality
  const undoButton = placeholder.querySelector('.undo-removal');
  undoButton.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.storage.sync.get(['permanentlyRemoved'], function(result) {
      const updatedRemoved = (result.permanentlyRemoved || []).filter(id => id !== videoId);
      chrome.storage.sync.set({ permanentlyRemoved: updatedRemoved }, function() {
        videoElement.classList.remove('permanently-removed');
        delete videoElement.dataset.beingRemoved;
        placeholder.remove();
        if (contentContainer) {
          contentContainer.style.display = '';
        }
        processVideoElements(); // Reprocess to apply any keyword blocks
      });
    });
  });
  
  videoElement.appendChild(placeholder);
  
  // Update the storage
  chrome.storage.sync.get(['permanentlyRemoved'], function(result) {
    const permanentlyRemoved = result.permanentlyRemoved || [];
    if (!permanentlyRemoved.includes(videoId)) {
      permanentlyRemoved.push(videoId);
      chrome.storage.sync.set({ permanentlyRemoved: permanentlyRemoved }, function() {
        // Remove the processing flag after storage is updated
        delete videoElement.dataset.beingRemoved;
      });
    } else {
      // Remove the processing flag if the video was already removed
      delete videoElement.dataset.beingRemoved;
    }
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
    
    // Handle permanently removed videos
    if (permanentlyRemoved.includes(videoId)) {
      videoElement.classList.add('permanently-removed');
      // Only add placeholder if it doesn't exist
      if (!videoElement.querySelector('.removed-video-placeholder')) {
        const placeholder = createPlaceholder();
        
        // Add undo functionality
        const undoButton = placeholder.querySelector('.undo-removal');
        undoButton.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.storage.sync.get(['permanentlyRemoved'], function(result) {
            const updatedRemoved = (result.permanentlyRemoved || []).filter(id => id !== videoId);
            chrome.storage.sync.set({ permanentlyRemoved: updatedRemoved }, function() {
              videoElement.classList.remove('permanently-removed');
              placeholder.remove();
              const contentContainer = videoElement.querySelector('#content');
              if (contentContainer) {
                contentContainer.style.display = '';
              }
              delete videoElement.dataset.processed;
              processVideoElement(videoElement); // Reprocess to apply any keyword blocks
            });
          });
        });
        
        // Clear existing content and add placeholder
        const contentContainer = videoElement.querySelector('#content');
        if (contentContainer) {
          contentContainer.style.display = 'none';
          videoElement.appendChild(placeholder);
        }
      }
      return;
    } else {
      // Remove placeholder and show content if video is no longer permanently removed
      videoElement.classList.remove('permanently-removed');
      const placeholder = videoElement.querySelector('.removed-video-placeholder');
      const contentContainer = videoElement.querySelector('#content');
      if (placeholder) {
        placeholder.remove();
        if (contentContainer) {
          contentContainer.style.display = '';
        }
      }
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

// Listen for changes in blocked keywords or removed videos
chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedKeywords || changes.permanentlyRemoved) {
    // When keywords or removal list changes, we need to reprocess all videos
    document.querySelectorAll('ytd-rich-item-renderer, ytd-compact-video-renderer')
      .forEach(element => {
        delete element.dataset.processed;
        processVideoElement(element);
      });
  }
}); 