document.addEventListener('DOMContentLoaded', function() {
  const keywordInput = document.getElementById('keywordInput');
  const addKeywordButton = document.getElementById('addKeyword');
  const keywordsList = document.getElementById('keywordsList');

  // Load existing keywords
  loadKeywords();

  // Add keyword event listener
  addKeywordButton.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addKeyword();
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

  // Add theme detection
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function handleThemeChange(e) {
    document.body.classList.toggle('dark-theme', e.matches);
  }
  darkModeMediaQuery.addListener(handleThemeChange);
  handleThemeChange(darkModeMediaQuery);
}); 