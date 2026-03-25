// Extract job info from supported platforms
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'getJobInfo') return;

  const host = window.location.hostname;
  let info = { title: document.title, company: '', description: '' };

  if (host.includes('linkedin.com')) {
    info.title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
    info.company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() || '';
    info.description = document.querySelector('.jobs-description__content')?.textContent?.trim() || '';
  } else if (host.includes('indeed.com')) {
    info.title = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
    info.company = document.querySelector('[data-testid="inlineHeader-companyName"]')?.textContent?.trim() || '';
    info.description = document.querySelector('#jobDescriptionText')?.textContent?.trim() || '';
  } else if (host.includes('glassdoor.com')) {
    info.title = document.querySelector('[data-test="jobTitle"]')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
    info.company = document.querySelector('[data-test="employerName"]')?.textContent?.trim() || '';
    info.description = document.querySelector('.jobDescriptionContent')?.textContent?.trim() || '';
  } else if (host.includes('wellfound.com')) {
    info.title = document.querySelector('h1')?.textContent?.trim() || '';
    info.company = document.querySelector('h2 a')?.textContent?.trim() || '';
    info.description = document.querySelector('.description')?.textContent?.trim() || '';
  } else if (host.includes('remoteok.com')) {
    info.title = document.querySelector('h2[itemprop="title"]')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
    info.company = document.querySelector('h3[itemprop="name"]')?.textContent?.trim() || '';
    info.description = document.querySelector('.description')?.textContent?.trim() || '';
  } else if (host.includes('weworkremotely.com')) {
    info.title = document.querySelector('.listing-header-container h1')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
    info.company = document.querySelector('.company-card h2 a')?.textContent?.trim() || '';
    info.description = document.querySelector('.listing-container')?.textContent?.trim() || '';
  }
  // Add more platforms as needed

  sendResponse(info);
});
