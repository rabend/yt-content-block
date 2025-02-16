document.addEventListener('DOMContentLoaded', function() {
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordButton = document.getElementById('addKeyword');
  const keywordsList = document.getElementById('keywordsList');
  const blockedVideosList = document.getElementById('blockedVideosList');
  const resetAllButton = document.getElementById('resetAll');

  // Load existing keywords and blocked videos
  loadKeywords();
  loadBlockedVideos();

  // Add keyword event listener
  addKeywordButton.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addKeyword();
    }
  });

  // Add reset functionality
  resetAllButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to reset all data? This will remove all keywords and unblock all videos. This action cannot be undone.')) {
      // Clear storage
      chrome.storage.sync.set({
        blockedKeywords: [],
        permanentlyRemoved: []
      }, function() {
        // Clear the keywords list and blocked videos in popup
        displayKeywords([]);
        displayBlockedVideos([], []);
        
        // Send message to content script to clear data
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'clearAllData'});
          }
        });
      });
    }
  });

  function addKeyword() {
    const keyword = keywordInput.value.trim().toLowerCase();
    if (keyword) {
      chrome.storage.sync.get(['blockedKeywords'], function(result) {
        const keywords = result.blockedKeywords || [];
        if (!keywords.includes(keyword)) {
          keywords.push(keyword);
          chrome.storage.sync.set({ blockedKeywords: keywords }, function() {
            displayKeywords(keywords);
            keywordInput.value = '';
          });
        }
      });
    }
  }

  function loadKeywords() {
    chrome.storage.sync.get(['blockedKeywords'], function(result) {
      const keywords = result.blockedKeywords || [];
      displayKeywords(keywords);
    });
  }

  function displayKeywords(keywords) {
    keywordsList.innerHTML = '';
    keywords.forEach(keyword => {
      const keywordElement = document.createElement('div');
      keywordElement.className = 'keyword-item';
      
      const keywordText = document.createElement('span');
      keywordText.className = 'keyword-text';
      keywordText.textContent = keyword;
      
      const removeButton = document.createElement('button');
      removeButton.className = 'remove-btn';
      removeButton.textContent = 'Remove';
      removeButton.onclick = () => removeKeyword(keyword);
      
      keywordElement.appendChild(keywordText);
      keywordElement.appendChild(removeButton);
      keywordsList.appendChild(keywordElement);
    });
  }

  function removeKeyword(keyword) {
    chrome.storage.sync.get(['blockedKeywords'], function(result) {
      const keywords = result.blockedKeywords || [];
      const updatedKeywords = keywords.filter(k => k !== keyword);
      chrome.storage.sync.set({ blockedKeywords: updatedKeywords }, function() {
        displayKeywords(updatedKeywords);
      });
    });
  }

  function loadBlockedVideos() {
    chrome.storage.sync.get(['blockedKeywords', 'permanentlyRemoved'], function(result) {
      const keywords = result.blockedKeywords || [];
      const permanentlyRemoved = result.permanentlyRemoved || [];
      displayBlockedVideos(keywords, permanentlyRemoved);
    });
  }

  function displayBlockedVideos(keywords, permanentlyRemoved) {
    blockedVideosList.innerHTML = '';

    if (permanentlyRemoved.length === 0) {
      blockedVideosList.innerHTML = '<div class="no-blocked-videos">No blocked videos yet</div>';
      return;
    }

    // Group videos by keyword
    const videosByKeyword = {};
    permanentlyRemoved.forEach(video => {
      if (keywords.includes(video.keyword)) { // Only show videos whose keywords are still active
        if (!videosByKeyword[video.keyword]) {
          videosByKeyword[video.keyword] = [];
        }
        videosByKeyword[video.keyword].push(video);
      }
    });

    // Create sections for each keyword
    Object.keys(videosByKeyword).sort().forEach(keyword => {
      const videos = videosByKeyword[keyword];
      const keywordGroup = document.createElement('div');
      keywordGroup.className = 'keyword-group';

      // Create header
      const header = document.createElement('div');
      header.className = 'keyword-header';
      header.innerHTML = `
        <span class="keyword-text">"${keyword}"</span>
        <span class="keyword-count">${videos.length} video${videos.length === 1 ? '' : 's'}</span>
      `;

      // Create video list container
      const videoList = document.createElement('div');
      videoList.className = 'blocked-video-list';

      // Add click handler to toggle list
      header.addEventListener('click', () => {
        videoList.classList.toggle('expanded');
      });

      // Add videos to the list
      videos.forEach(video => {
        const videoItem = document.createElement('div');
        videoItem.className = 'blocked-video-item';
        
        const videoTitle = document.createElement('div');
        videoTitle.className = 'blocked-video-title';
        videoTitle.title = video.title;
        videoTitle.textContent = video.title;

        const restoreButton = document.createElement('button');
        restoreButton.className = 'restore-video-btn';
        restoreButton.textContent = 'Restore';
        restoreButton.onclick = (e) => {
          e.stopPropagation();
          restoreVideo(video.id);
        };

        videoItem.appendChild(videoTitle);
        videoItem.appendChild(restoreButton);
        videoList.appendChild(videoItem);
      });

      keywordGroup.appendChild(header);
      keywordGroup.appendChild(videoList);
      blockedVideosList.appendChild(keywordGroup);
    });
  }

  function restoreVideo(videoId) {
    chrome.storage.sync.get(['permanentlyRemoved'], function(result) {
      const permanentlyRemoved = result.permanentlyRemoved || [];
      const updatedRemoved = permanentlyRemoved.filter(item => item.id !== videoId);
      
      chrome.storage.sync.set({ permanentlyRemoved: updatedRemoved }, function() {
        // Reload the blocked videos list
        loadBlockedVideos();
        
        // Send message to content script to refresh
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'clearAllData'});
          }
        });
      });
    });
  }

  // Add storage change listener to update blocked videos list
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockedKeywords || changes.permanentlyRemoved) {
      loadBlockedVideos();
    }
  });

  // Add theme detection
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function handleThemeChange(e) {
    document.body.classList.toggle('dark-theme', e.matches);
  }
  darkModeMediaQuery.addListener(handleThemeChange);
  handleThemeChange(darkModeMediaQuery);
}); 