// Load config
chrome.storage.local.get(['server', 'token'], (data) => {
  if (data.server && data.token) {
    document.getElementById('server').value = data.server;
    document.getElementById('token').value = data.token;
    showJobSection();
  }
});

document.getElementById('save-config').onclick = () => {
  const server = document.getElementById('server').value;
  const token = document.getElementById('token').value;
  chrome.storage.local.set({ server, token }, () => {
    showJobSection();
  });
};

function showJobSection() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('job-section').style.display = 'block';
  // Get job info from content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getJobInfo' }, (response) => {
      if (response) {
        document.getElementById('job-title').textContent = response.title || 'Unknown Job';
        document.getElementById('job-company').textContent = response.company || '';
      }
    });
  });
}

document.getElementById('save-job').onclick = async () => {
  const status = document.getElementById('status');
  status.textContent = 'Saving...';
  status.className = 'status';

  const { server, token } = await chrome.storage.local.get(['server', 'token']);
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  // Get job info from content script
  chrome.tabs.sendMessage(tab.id, { action: 'getJobInfo' }, async (job) => {
    try {
      const resp = await fetch(`${server}/api/extension/save-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ url: tab.url, ...job }),
      });
      if (resp.ok) {
        status.textContent = 'Saved!';
        status.className = 'status saved';
      } else {
        status.textContent = 'Failed: ' + (await resp.text());
        status.className = 'status error';
      }
    } catch (e) {
      status.textContent = 'Error: ' + e.message;
      status.className = 'status error';
    }
  });
};
