document_addEventListener('DOMContentLoaded', async () => {
    const cookieListContainer = document.getElementById('cookie-list-container');
    const loadingMessage = document.getElementById('loading-message');
    const totalCountElement = document.getElementById('total-count');
    const exportAllBtn = document.getElementById('export-all-btn');
    const importAllBtn = document.getElementById('import-all-btn');

    // Export Modal Elements
    const exportModal = document.getElementById('export-modal');
    const btnCopy = document.getElementById('btn-copy-clipboard');
    const btnSave = document.getElementById('btn-save-file');
    const btnCancel = document.getElementById('btn-cancel-export');
    const exportDesc = document.getElementById('export-description');

    // Import Modal Elements
    const importModal = document.getElementById('import-modal');
    const btnConfirmImport = document.getElementById('btn-confirm-import');
    const btnCancelImport = document.getElementById('btn-cancel-import');
    const importJsonText = document.getElementById('import-json-text');
    const importFileInput = document.getElementById('import-file-input');

    let currentExportCookies = [];
    let allCookiesCache = [];

    // --- Export Logic ---
    function openExportModal(cookies, description) {
        currentExportCookies = cookies;
        exportDesc.textContent = description || `Exporting ${cookies.length} cookies`;
        exportModal.style.display = 'flex';
    }

    function closeExportModal() {
        exportModal.style.display = 'none';
        currentExportCookies = [];
    }

    btnCancel.onclick = closeExportModal;

    btnCopy.onclick = async () => {
        try {
            const json = JSON.stringify(currentExportCookies, null, 2);
            await navigator.clipboard.writeText(json);
            const originalText = btnCopy.textContent;
            btnCopy.textContent = 'Copied!';
            setTimeout(() => {
                btnCopy.textContent = originalText;
                closeExportModal();
            }, 1000);
        } catch (err) {
            console.error('Failed to copy', err);
            btnCopy.textContent = 'Failed';
        }
    };

    btnSave.onclick = () => {
        const json = JSON.stringify(currentExportCookies, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cookies_export_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        closeExportModal();
    };

    exportAllBtn.onclick = () => {
        if (allCookiesCache.length > 0) {
            openExportModal(allCookiesCache, `Exporting all ${allCookiesCache.length} cookies`);
        }
    };

    // --- Import Logic ---
    function openImportModal() {
        importModal.style.display = 'flex';
        importJsonText.value = '';
        importFileInput.value = '';
    }

    function closeImportModal() {
        importModal.style.display = 'none';
    }

    importAllBtn.onclick = openImportModal;
    btnCancelImport.onclick = closeImportModal;

    btnConfirmImport.onclick = async () => {
        let jsonString = importJsonText.value.trim();

        // If file is selected and text is empty, read file
        if (!jsonString && importFileInput.files.length > 0) {
            const file = importFileInput.files[0];
            try {
                jsonString = await file.text();
            } catch (err) {
                alert('Failed to read file');
                return;
            }
        }

        if (!jsonString) {
            alert('Please paste JSON or select a file.');
            return;
        }

        try {
            const cookiesToImport = JSON.parse(jsonString);
            if (!Array.isArray(cookiesToImport)) {
                throw new Error('JSON is not an array of cookies');
            }

            let successCount = 0;
            let failCount = 0;

            for (const cookie of cookiesToImport) {
                try {
                    // chrome.cookies.set url inference
                    const protocol = cookie.secure ? 'https://' : 'http://';
                    // Remove leading dot for URL construction if present, though 
                    // generally chrome.cookies.set handles specific domain matching.
                    // Important: `url` is required.
                    const domainClean = cookie.domain.replace(/^\./, '');
                    const url = `${protocol}${domainClean}${cookie.path}`;

                    // Construct config object, filtering out read-only props
                    const setDetails = {
                        url: url,
                        name: cookie.name,
                        value: cookie.value,
                        domain: cookie.domain,
                        path: cookie.path,
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        sameSite: cookie.sameSite,
                        expirationDate: cookie.expirationDate,

                    };

                    // Remove undefined properties
                    Object.keys(setDetails).forEach(key => setDetails[key] === undefined && delete setDetails[key]);

                    // hostOnly and session are read-only or inferred, do not pass them.

                    await browser.cookies.set(setDetails);
                    successCount++;
                } catch (e) {
                    console.error('Import individual cookie failed', e, cookie);
                    failCount++;
                }
            }

            alert(`Import complete.\nSuccess: ${successCount}\nFailed: ${failCount}`);
            closeImportModal();
            // Reload to show changes
            window.location.reload();

        } catch (err) {
            alert('Invalid JSON: ' + err.message);
        }
    };

    // --- Main Load Logic ---
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url) {
            loadingMessage.textContent = 'Unable to access tab information.';
            return;
        }

        const url = new URL(tab.url);
        const rootDomain = getRootDomain(url.hostname);
        let allCookies = await browser.cookies.getAll({ domain: rootDomain });

        try {
            const frames = await browser.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: () => window.location.href
            });

            for (const frame of frames) {
                if (!frame.result) continue;
                const frameCookies = await browser.cookies.getAll({ url: frame.result });
                allCookies = allCookies.concat(frameCookies);
            }
        } catch (scriptError) {
            console.warn('Frame access warning:', scriptError);
        }

        const uniqueCookies = new Map();
        allCookies.forEach(c => {
            const key = `${c.name}|${c.domain}|${c.path}|${c.storeId}`;
            uniqueCookies.set(key, c);
        });

        allCookiesCache = Array.from(uniqueCookies.values());
        const cookies = allCookiesCache;

        totalCountElement.textContent = `${cookies.length} Cookies`;
        loadingMessage.style.display = 'none';

        if (cookies.length === 0) {
            const noCookiesMsg = document.createElement('div');
            noCookiesMsg.className = 'no-cookies';
            noCookiesMsg.textContent = 'No cookies found for any frame on this page.';
            cookieListContainer.appendChild(noCookiesMsg);
            return;
        }

        const cookiesByDomain = {};
        cookies.forEach(cookie => {
            const domain = cookie.domain;
            if (!cookiesByDomain[domain]) {
                cookiesByDomain[domain] = [];
            }
            cookiesByDomain[domain].push(cookie);
        });

        const sortedDomains = Object.keys(cookiesByDomain).sort();

        sortedDomains.forEach(domain => {
            const groupCookies = cookiesByDomain[domain];
            groupCookies.sort((a, b) => a.name.localeCompare(b.name));

            const domainGroup = document.createElement('div');
            domainGroup.className = 'domain-group';

            const header = document.createElement('div');
            header.className = 'domain-header';

            const titleContainer = document.createElement('div');
            titleContainer.style.display = 'flex';
            titleContainer.style.alignItems = 'center';
            titleContainer.style.gap = '8px';

            const domainTitle = document.createElement('span');
            domainTitle.textContent = domain;
            const domainCount = document.createElement('span');
            domainCount.className = 'domain-count';
            domainCount.textContent = groupCookies.length;

            titleContainer.appendChild(domainTitle);
            titleContainer.appendChild(domainCount);

            const exportBtn = document.createElement('button');
            exportBtn.className = 'btn-icon';
            exportBtn.title = `Export cookies for ${domain}`;
            exportBtn.innerHTML = '<img src="icons/export.png" alt="Export" width="14" height="14">'; // Use image here too
            exportBtn.style.padding = '4px';
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                openExportModal(groupCookies, `Exporting ${groupCookies.length} cookies for ${domain}`);
            };

            header.appendChild(titleContainer);
            header.appendChild(exportBtn);
            domainGroup.appendChild(header);

            groupCookies.forEach(cookie => {
                const card = createCookieCard(cookie);
                domainGroup.appendChild(card);
            });

            cookieListContainer.appendChild(domainGroup);
        });

    } catch (error) {
        console.error('Error fetching cookies:', error);
        loadingMessage.textContent = 'Error fetching cookies. Check permissions.';
    }
});

function createCookieCard(cookie) {
    const card = document.createElement('div');
    card.className = 'card';

    const summary = document.createElement('div');
    summary.className = 'cookie-summary';
    summary.onclick = () => {
        card.classList.toggle('expanded');
    };

    const summaryTitle = document.createElement('div');
    summaryTitle.className = 'cookie-summary-title';

    const domBadge = document.createElement('span');
    domBadge.className = 'cookie-domain-badge';
    domBadge.textContent = cookie.domain;

    const nameText = document.createElement('span');
    nameText.textContent = cookie.name;

    summaryTitle.appendChild(domBadge);
    summaryTitle.appendChild(nameText);

    const expandIcon = document.createElement('span');
    expandIcon.innerHTML = '&#9662;'; // Down arrow
    expandIcon.style.color = 'var(--text-secondary)';

    summary.appendChild(summaryTitle);
    summary.appendChild(expandIcon);
    card.appendChild(summary);

    const details = document.createElement('div');
    details.className = 'cookie-details';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'mb-2';
    const nameLabel = document.createElement('div');
    nameLabel.className = 'label';
    nameLabel.textContent = 'Full Name';
    const fullName = document.createElement('div');
    fullName.className = 'cookie-name';
    fullName.textContent = cookie.name;
    headerDiv.appendChild(nameLabel);
    headerDiv.appendChild(fullName);
    details.appendChild(headerDiv);

    const valueGroup = document.createElement('div');
    valueGroup.className = 'mb-2';
    const valueLabel = document.createElement('div');
    valueLabel.className = 'label';
    valueLabel.textContent = 'Value';
    const valueText = document.createElement('div');
    valueText.className = 'cookie-value';
    valueText.textContent = cookie.value;
    valueGroup.appendChild(valueLabel);
    valueGroup.appendChild(valueText);
    details.appendChild(valueGroup);

    const metaGrid = document.createElement('div');
    metaGrid.className = 'cookie-meta-grid';

    const size = new Blob([cookie.name + cookie.value]).size;
    const isCrossSite = cookie.sameSite === 'no_restriction' ? 'Yes' : 'No';

    const fields = [
        { label: 'Domain', value: cookie.domain },
        { label: 'Path', value: cookie.path },
        { label: 'Expires', value: cookie.session ? 'Session' : new Date(cookie.expirationDate * 1000).toLocaleString() },
        { label: 'Size', value: `${size} bytes` },
        { label: 'Priority', value: cookie.priority || 'Medium' },
        { label: 'SameSite', value: cookie.sameSite },
        { label: 'Cross Site', value: isCrossSite },
        { label: 'Partition Key', value: cookie.partitionKey ? cookie.partitionKey.topLevelSite : 'None' }
    ];

    fields.forEach(field => {
        const item = document.createElement('div');
        item.className = 'meta-item';
        const label = document.createElement('div');
        label.className = 'meta-label';
        label.textContent = field.label;
        const val = document.createElement('div');
        val.className = 'meta-value';
        val.textContent = field.value;
        item.appendChild(label);
        item.appendChild(val);
        metaGrid.appendChild(item);
    });

    details.appendChild(metaGrid);

    const flagsDiv = document.createElement('div');
    flagsDiv.className = 'flags';

    const flagList = [
        { label: 'Secure', active: cookie.secure },
        { label: 'HttpOnly', active: cookie.httpOnly },
        { label: 'HostOnly', active: cookie.hostOnly },
        { label: 'Session', active: cookie.session }
    ];

    flagList.forEach(flag => {
        const span = document.createElement('span');
        span.className = `flag ${flag.active ? 'active' : ''}`;
        span.textContent = flag.label;
        flagsDiv.appendChild(span);
    });

    details.appendChild(flagsDiv);
    card.appendChild(details);

    return card;
}

function getRootDomain(hostname) {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost') {
        return hostname;
    }
    const parts = hostname.split('.');
    if (parts.length > 2) {
        const last = parts[parts.length - 1];
        const secondLast = parts[parts.length - 2];
        if (secondLast.length <= 3 && last.length <= 2) {
            return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
    }
    return hostname;
}

function document_addEventListener(event, callback) {
    if (document.readyState === 'loading') {
        document.addEventListener(event, callback);
    } else {
        callback();
    }
}
