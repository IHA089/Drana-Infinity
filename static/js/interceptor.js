const socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

const requestsBox = document.getElementById('requests');
const flowStore = {};
let blacklistRules = [];

const savedBlacklist = localStorage.getItem('drana_blacklist');
if (savedBlacklist) blacklistRules = JSON.parse(savedBlacklist);

const modal = document.getElementById('details-modal');
const modalHeader = document.getElementById('modal-header');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalRequestRaw = document.getElementById('modal-request-raw');
const modalResponseRaw = document.getElementById('modal-response-raw');
const modalResponseRender = document.getElementById('modal-response-render');
const rawBtn = document.getElementById('raw-btn');
const renderBtn = document.getElementById('render-btn');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const resendBtn = document.getElementById('resend-btn');

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchClearBtn = document.getElementById('search-clear-btn');
const searchCase = document.getElementById('search-case-sensitive');
const searchRegex = document.getElementById('search-regex');

const startupModal = document.getElementById('startup-modal');
const startupBtn = document.getElementById('startup-btn');
const targetInput = document.getElementById('target-url-input');
const startupStatus = document.getElementById('startup-status');

const completionModal = document.getElementById('completion-modal');

const descBox = document.getElementById('mode-description');
const defaultDesc = "Hover over a mode to see details...";
const projectModal = document.getElementById('project-modal');
const projectNameInput = document.getElementById('project-name-input');
const createProjectBtn = document.getElementById('create-project-btn');
const projectError = document.getElementById('project-error');
let currentProjectUUID = null;

const projectListContainer = document.getElementById('project-list-container');

const analysisContentArea = document.getElementById('analysis-content-area');
const reconContentArea = document.getElementById('recon-content-area');

window.addEventListener('load', () => {
    if (SERVER_PROJECT_ID) {
        console.log("Direct access to project:", SERVER_PROJECT_ID);
        projectModal.style.display = 'none';
        startupModal.style.display = 'none';
        loadExistingProject(SERVER_PROJECT_ID);
    }
    else {
        projectModal.style.display = 'flex';
        startupModal.style.display = 'none';
        projectNameInput.focus();
        loadProjectList();
    }
});

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- METHOD FILTER FUNCTIONS ---
function updateMethodFilter() {
    const methodCounts = {};

    // Count all unique methods in flowStore
    for (let flowId in flowStore) {
        const method = flowStore[flowId].summary.method;
        if (method) {
            methodCounts[method] = (methodCounts[method] || 0) + 1;
        }
    }

    // Get sorted methods
    const methods = Object.keys(methodCounts).sort();

    // Render filter options in popup
    const filterContainer = document.getElementById('method-filter-options');

    // Store currently checked values before updating
    const currentChecked = new Set();
    filterContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        currentChecked.add(checkbox.value);
    });

    filterContainer.innerHTML = '';

    if (methods.length === 0) {
        filterContainer.innerHTML = '<div style="padding: 12px 16px; color: var(--color-text-grey); font-size: 12px; text-align: center;">No requests captured</div>';
        return;
    }

    methods.forEach(method => {
        const count = methodCounts[method];
        const label = document.createElement('label');
        label.className = 'method-checkbox-item ' + method;
        label.innerHTML = `
            <input type="checkbox" value="${method}" class="method-filter-checkbox">
            <span class="method-checkbox-label">
                <span class="method-badge">${method}</span>
                <span class="method-count">(${count})</span>
            </span>
        `;

        // Re-check if it was previously checked
        if (currentChecked.has(method)) {
            label.querySelector('input').checked = true;
        }

        label.querySelector('input').addEventListener('change', applyMethodFilter);
        filterContainer.appendChild(label);
    });
}

function applyMethodFilter() {
    applyAllFilters();
}

function applyAllFilters() {
    // Get selected methods
    const selectedMethods = new Set();
    document.querySelectorAll('.method-filter-checkbox:checked').forEach(checkbox => {
        selectedMethods.add(checkbox.value);
    });

    // Get selected status codes
    const selectedStatuses = new Set();
    document.querySelectorAll('.status-filter-checkbox:checked').forEach(checkbox => {
        selectedStatuses.add(checkbox.value);
    });

    // Get selected file types
    const selectedFileTypes = new Set();
    document.querySelectorAll('.filetype-filter-checkbox:checked').forEach(checkbox => {
        selectedFileTypes.add(checkbox.value);
    });

    // Filter request entries based on ALL filters (AND logic)
    document.querySelectorAll('.request-entry').forEach(entry => {
        const methodSpan = entry.querySelector('.method');
        const method = methodSpan ? methodSpan.textContent.trim() : '';
        const status = entry.getAttribute('data-status');
        const fileType = entry.getAttribute('data-filetype');

        // If no filters selected, show all
        if (selectedMethods.size === 0 && selectedStatuses.size === 0 && selectedFileTypes.size === 0) {
            entry.style.display = '';
            return;
        }

        // Check method filter
        let methodMatches = selectedMethods.size === 0 || selectedMethods.has(method);

        // Check status filter
        let statusMatches = selectedStatuses.size === 0 || selectedStatuses.has(status);

        // Check file type filter
        let fileTypeMatches = selectedFileTypes.size === 0 || selectedFileTypes.has(fileType);

        // Show only if ALL match (AND logic)
        entry.style.display = (methodMatches && statusMatches && fileTypeMatches) ? '' : 'none';
    });
}

function openMethodFilterPopup() {
    document.getElementById('status-filter-popup').classList.remove('show');
    document.getElementById('filetype-filter-popup').classList.remove('show');
    const popup = document.getElementById('method-filter-popup');
    const overlay = document.getElementById('filter-overlay');
    // Toggle behavior: if it's already open, clicking again should close it.
    if (popup.classList.contains('show')) {
        popup.classList.remove('show');
        overlay.classList.remove('show');
    } else {
        popup.classList.add('show');
        overlay.classList.add('show');
    }
}

function closeMethodFilterPopup() {
    const popup = document.getElementById('method-filter-popup');
    const overlay = document.getElementById('filter-overlay');
    popup.classList.remove('show');
    overlay.classList.remove('show');
}

function resetMethodFilter() {
    document.querySelectorAll('.method-filter-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    applyMethodFilter();
}

// --- STATUS CODE FILTER FUNCTIONS ---
function updateStatusFilter() {
    const statusCounts = {};

    // Count all unique status codes in flowStore
    for (let flowId in flowStore) {
        const statusCode = flowStore[flowId].summary.status;
        if (statusCode) {
            statusCounts[statusCode] = (statusCounts[statusCode] || 0) + 1;
        }
    }

    // Get sorted status codes
    const statusCodes = Object.keys(statusCounts).sort((a, b) => parseInt(a) - parseInt(b));

    // Render filter options in popup
    const filterContainer = document.getElementById('status-filter-options');

    // Store currently checked values before updating
    const currentChecked = new Set();
    filterContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        currentChecked.add(checkbox.value);
    });

    filterContainer.innerHTML = '';

    if (statusCodes.length === 0) {
        filterContainer.innerHTML = '<div style="padding: 12px 16px; color: var(--color-text-grey); font-size: 12px; text-align: center;">No requests captured</div>';
        return;
    }

    statusCodes.forEach(code => {
        const count = statusCounts[code];
        const statusClass = code.startsWith('2') ? 'status-2xx' :
            code.startsWith('3') ? 'status-3xx' :
                code.startsWith('4') ? 'status-4xx' : 'status-5xx';

        const label = document.createElement('label');
        label.className = `status-checkbox-item ${statusClass}`;
        label.innerHTML = `
            <input type="checkbox" class="status-filter-checkbox" value="${code}" ${currentChecked.has(code) ? 'checked' : ''}>
            <span class="status-checkbox-label">
                <span class="status-badge">${code}</span>
                <span class="status-count">(${count})</span>
            </span>
        `;
        label.addEventListener('change', applyStatusFilter);
        filterContainer.appendChild(label);
    });
}

function applyStatusFilter() {
    applyAllFilters();
}

function openStatusFilterPopup() {
    document.getElementById('method-filter-popup').classList.remove('show');
    document.getElementById('filetype-filter-popup').classList.remove('show');
    const popup = document.getElementById('status-filter-popup');
    const overlay = document.getElementById('filter-overlay');
    // Toggle behavior: if it's already open, clicking again should close it.
    if (popup.classList.contains('show')) {
        popup.classList.remove('show');
        overlay.classList.remove('show');
    } else {
        popup.classList.add('show');
        overlay.classList.add('show');
    }
}

function closeStatusFilterPopup() {
    const popup = document.getElementById('status-filter-popup');
    const overlay = document.getElementById('filter-overlay');
    popup.classList.remove('show');
    overlay.classList.remove('show');
}

function resetStatusFilter() {
    document.querySelectorAll('.status-filter-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    applyStatusFilter();
}

// --- FILE TYPE FILTER FUNCTIONS ---
function updateFiletypeFilter() {
    const fileTypeCounts = {};

    // Count all unique file types in flowStore
    for (let flowId in flowStore) {
        const contentType = flowStore[flowId].summary.content_type || 'unknown';
        // Extract main type (e.g., "text/html" -> "html")
        const fileType = getFileTypeCategory(contentType);
        if (fileType) {
            fileTypeCounts[fileType] = (fileTypeCounts[fileType] || 0) + 1;
        }
    }

    // Get sorted file types
    const fileTypes = Object.keys(fileTypeCounts).sort();

    // Render filter options in popup
    const filterContainer = document.getElementById('filetype-filter-options');

    // Store currently checked values before updating
    const currentChecked = new Set();
    filterContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        currentChecked.add(checkbox.value);
    });

    filterContainer.innerHTML = '';

    if (fileTypes.length === 0) {
        filterContainer.innerHTML = '<div style="padding: 12px 16px; color: var(--color-text-grey); font-size: 12px; text-align: center;">No requests captured</div>';
        return;
    }

    fileTypes.forEach(type => {
        const count = fileTypeCounts[type];

        const label = document.createElement('label');
        label.className = `filetype-checkbox-item ${type}`;
        label.innerHTML = `
            <input type="checkbox" class="filetype-filter-checkbox" value="${type}" ${currentChecked.has(type) ? 'checked' : ''}>
            <span class="filetype-checkbox-label">
                <span class="filetype-badge">${type}</span>
                <span class="filetype-count">(${count})</span>
            </span>
        `;
        label.addEventListener('change', applyAllFilters);
        filterContainer.appendChild(label);
    });
}

function getFileTypeCategory(contentType) {
    if (!contentType) return 'unknown';

    contentType = contentType.toLowerCase();

    if (contentType.includes('html')) return 'html';
    if (contentType.includes('json')) return 'json';
    if (contentType.includes('javascript')) return 'javascript';
    if (contentType.includes('css')) return 'css';
    if (contentType.includes('image')) return 'image';
    if (contentType.includes('font')) return 'font';
    if (contentType.includes('video')) return 'video';
    if (contentType.includes('audio')) return 'audio';
    if (contentType.includes('xml')) return 'xml';
    if (contentType.includes('text')) return 'text';

    return 'unknown';
}

function openFiletypeFilterPopup() {
    document.getElementById('method-filter-popup').classList.remove('show');
    document.getElementById('status-filter-popup').classList.remove('show');
    const popup = document.getElementById('filetype-filter-popup');
    const overlay = document.getElementById('filter-overlay');
    // Toggle behavior: if it's already open, clicking again should close it.
    if (popup.classList.contains('show')) {
        popup.classList.remove('show');
        overlay.classList.remove('show');
    } else {
        popup.classList.add('show');
        overlay.classList.add('show');
    }
}

function closeFiletypeFilterPopup() {
    const popup = document.getElementById('filetype-filter-popup');
    const overlay = document.getElementById('filter-overlay');
    popup.classList.remove('show');
    overlay.classList.remove('show');
}

function resetFiletypeFilter() {
    document.querySelectorAll('.filetype-filter-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    applyAllFilters();
}

// Set up button click handler
const methodFilterBtn = document.getElementById('method-filter-btn');
if (methodFilterBtn) {
    methodFilterBtn.addEventListener('click', openMethodFilterPopup);
}

// Set up status button click handler
const statusFilterBtn = document.getElementById('status-filter-btn');
if (statusFilterBtn) {
    statusFilterBtn.addEventListener('click', openStatusFilterPopup);
}

// Set up file type button click handler
const filetypeFilterBtn = document.getElementById('filetype-filter-btn');
if (filetypeFilterBtn) {
    filetypeFilterBtn.addEventListener('click', openFiletypeFilterPopup);
}

// Close popup when clicking outside
document.addEventListener('click', (e) => {
    const container = document.getElementById('method-filter-container');
    const methodFilterBtn = document.getElementById('method-filter-btn');
    const statusFilterBtn = document.getElementById('status-filter-btn');
    const filetypeFilterBtn = document.getElementById('filetype-filter-btn');

    // If the click is not inside the popup container AND not on any of the filter buttons, close all popups.
    // This prevents the popup from closing immediately when a filter button is clicked.
    if (
        !container.contains(e.target) &&
        !methodFilterBtn.contains(e.target) &&
        !statusFilterBtn.contains(e.target) &&
        !filetypeFilterBtn.contains(e.target)
    ) {
        closeMethodFilterPopup();
        closeStatusFilterPopup();
        closeFiletypeFilterPopup();
    }
});



function loadProjectList() {
    fetch('/interceptor/projects')
        .then(r => r.json())
        .then(data => {
            const listContainer = document.getElementById('project-list-container');
            listContainer.innerHTML = '';
            if (data.projects && data.projects.length > 0) {
                data.projects.forEach(proj => {
                    const div = document.createElement('div');
                    div.className = 'project-item';
                    div.innerHTML = `
                        <div class="project-item-name">${escapeHtml(proj.name)}</div>
                        <div class="project-item-meta">
                            <span>${proj.created_at}</span>
                            <span style="opacity:0.5">${proj.id.substring(0, 8)}...</span>
                        </div>
                        <i class="fa-solid fa-trash delete-project-btn" onclick="deleteInterceptorProject('${proj.id}', event)" title="Delete Project"></i>
                    `;
                    div.ondblclick = () => loadExistingProject(proj.id);
                    listContainer.appendChild(div);
                });
            } else {
                listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#555;">No saved projects.</div>';
            }
        });
}

let projectToDelete = null;
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = () => {
        if (!projectToDelete) return;

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerText = "DELETING...";

        fetch('/interceptor/delete_project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectToDelete })
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    loadProjectList();
                    closeDeleteConfirm();
                } else {
                    alert("Failed to delete project: " + (data.message || "Unknown error"));
                    closeDeleteConfirm();
                }
            })
            .catch(err => {
                alert("Error deleting project: " + err);
                closeDeleteConfirm();
            });
    };
}

function deleteInterceptorProject(projectId, event) {
    if (event) event.stopPropagation();
    projectToDelete = projectId;
    deleteConfirmModal.style.display = 'flex';

    // Reset button state
    if (confirmDeleteBtn) {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerText = "DELETE";
    }
}

function closeDeleteConfirm() {
    deleteConfirmModal.style.display = 'none';
    projectToDelete = null;
}

function loadExistingProject(uuid) {
    const newUrl = `/interceptor/${uuid}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    fetch('/interceptor/project/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: uuid })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                currentProjectUUID = data.project_id;
                const activeLabel = document.getElementById('active-project-label');
                if (activeLabel) activeLabel.textContent = `ACTIVE: ${data.project_name}`;

                requestsBox.innerHTML = '';
                for (let member in flowStore) delete flowStore[member];

                // Reset filter checkboxes when loading new project
                document.querySelectorAll('.method-filter-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                document.querySelectorAll('.status-filter-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                document.querySelectorAll('.filetype-filter-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                closeMethodFilterPopup();
                closeStatusFilterPopup();
                closeFiletypeFilterPopup();

                if (data.history) {
                    data.history.forEach(flow => addRequestRow(flow));
                }
                projectModal.style.display = 'none';
            }
        });
}

createProjectBtn.onclick = () => {
    const name = projectNameInput.value.trim();
    if (!name) {
        projectError.textContent = "Please enter a project name.";
        projectError.style.display = 'block';
        return;
    }

    createProjectBtn.disabled = true;
    createProjectBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> CREATING...';

    fetch('/interceptor/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                currentProjectUUID = data.project_id;
                const newUrl = `/interceptor/${data.project_id}`;
                window.history.pushState({ path: newUrl }, '', newUrl);

                const activeLabel = document.getElementById('active-project-label');
                if (activeLabel) activeLabel.textContent = `ACTIVE: ${projectNameInput.value}`;

                projectModal.style.display = 'none';
            } else {
                projectError.textContent = "Error: " + data.message;
                projectError.style.display = 'block';
                createProjectBtn.disabled = false;
                createProjectBtn.innerHTML = '<i class="fa-solid fa-plus"></i> CREATE WORKSPACE';
            }
        })
        .catch(err => {
            projectError.textContent = "Connection Failed.";
            projectError.style.display = 'block';
            createProjectBtn.disabled = false;
            createProjectBtn.innerHTML = '<i class="fa-solid fa-plus"></i> CREATE WORKSPACE';
        });
};

function addRequestRow(data) {
    if (isBlacklisted(data.summary.host)) return;

    flowStore[data.id] = {
        ...data.full_data,
        type: data.type,
        summary: data.summary,
        analysis_data: null,
        recon_data: null
    };

    const summary = data.summary;
    const existing = document.getElementById('flow-' + data.id);
    if (existing) existing.remove();

    const entry = document.createElement('div');
    entry.id = 'flow-' + data.id;
    entry.className = 'request-entry';
    entry.setAttribute('data-status', summary.status || '-');
    entry.setAttribute('data-filetype', getFileTypeCategory(summary.content_type));

    function createCell(text, className) {
        const cell = document.createElement('span');
        cell.textContent = text;
        cell.className = className;
        return cell;
    }

    let methodClass = 'method-other';
    if (summary.method === 'GET') methodClass = 'method-GET';
    else if (summary.method === 'POST') methodClass = 'method-POST';
    else if (summary.method === 'TCP') methodClass = 'method-TCP';
    else if (summary.method === 'WS') methodClass = 'method-WS';

    let statusClass = '';
    if (summary.status >= 200 && summary.status < 300) statusClass = 'status-200';
    else if (summary.status >= 300 && summary.status < 400) statusClass = 'status-300';
    else if (summary.status >= 400) statusClass = 'status-400';

    entry.appendChild(createCell(summary.time, 'time'));
    entry.appendChild(createCell(summary.scheme, 'scheme'));
    entry.appendChild(createCell(summary.method, 'method ' + methodClass));
    entry.appendChild(createCell(summary.host, 'host'));
    entry.appendChild(createCell(summary.path, 'path'));
    entry.appendChild(createCell(summary.status || '-', 'status ' + statusClass));
    entry.appendChild(createCell(summary.content_type, 'type'));
    entry.appendChild(createCell(summary.size, 'size'));
    entry.appendChild(createCell(summary.time_taken, 'duration'));

    entry.onclick = () => showModal(data.id);
    requestsBox.prepend(entry);

    // Update filter options whenever new request is added
    updateMethodFilter();
    updateStatusFilter();
    updateFiletypeFilter();
}

socket.on('update_ui', (data) => {
    addRequestRow(data);
});

function showDesc(text) {
    descBox.textContent = text;
    descBox.classList.add('active');
}

function clearDesc() {
    descBox.textContent = defaultDesc;
    descBox.classList.remove('active');
}

startupBtn.onclick = () => {
    const url = targetInput.value.trim();
    if (!url) {
        startupStatus.textContent = "Please enter a valid URL.";
        startupStatus.style.display = 'block';
        return;
    }

    const mode = document.querySelector('input[name="crawl_mode"]:checked').value;

    startupBtn.textContent = "Launching Driver...";
    startupBtn.disabled = true;

    fetch('/start_crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: url, mode: mode, project_id: currentProjectUUID })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                startupModal.style.display = 'none';
            } else {
                startupStatus.textContent = "Error: " + data.message;
                startupStatus.style.display = 'block';
                startupBtn.textContent = "LAUNCH INTERCEPTOR";
                startupBtn.disabled = false;
            }
        })
        .catch(err => {
            startupStatus.textContent = "Request Failed.";
            startupStatus.style.display = 'block';
            startupBtn.disabled = false;
        });
};

let currentModalFlowId = null;

function isBlacklisted(host) {
    if (!host) return false;
    for (let rule of blacklistRules) {
        const regexString = "^" + rule.split("*").map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(".*") + "$";
        if (new RegExp(regexString, "i").test(host)) return true;
    }
    return false;
}

socket.on('connect', () => console.log('Connected'));

function performSafeRender(rawContent, summary) {
    if (!rawContent) return;

    let cleanHtml = rawContent;
    const tagMatch = cleanHtml.match(/<(?:!doctype|html|head|body|script|div)/i);

    if (tagMatch) {
        cleanHtml = cleanHtml.substring(tagMatch.index);
    } else {
        const headerSplit = cleanHtml.match(/\r?\n\r?\n/);
        if (headerSplit) {
            cleanHtml = cleanHtml.substring(headerSplit.index + headerSplit[0].length);
        }
    }

    const scheme = (summary && summary.scheme) ? summary.scheme : 'http';
    const host = (summary && summary.host) ? summary.host : 'localhost';
    const origin = `${scheme}://${host}`;

    cleanHtml = cleanHtml.replace(/(src|href)\s*=\s*(["'])\/(?!\/)/gi, `$1=$2${origin}/`);

    cleanHtml = cleanHtml.replace(/<script[^>]*type=["']module["'][^>]*>/gi, (match) => {
        return match.replace(/type=["']module["']/i, 'type="text/javascript" defer');
    });

    cleanHtml = cleanHtml.replace(/\s+(crossorigin|integrity|referrerpolicy)(=["'][^"']*["'])?/gi, '');

    const headInjection = `
        <base href="${origin}/" target="_blank">
        <meta name="referrer" content="no-referrer">
    `;

    if (cleanHtml.toLowerCase().includes('<head>')) {
        cleanHtml = cleanHtml.replace(/<head>/i, '<head>' + headInjection);
    } else {
        cleanHtml = headInjection + cleanHtml;
    }

    const shimContent = `
        <style>
            body { margin: 0; padding-top: 30px; background-color: #fff; color: #000; }
            #drana-status {
                position: fixed; top: 0; left: 0; width: 100%; height: 25px;
                background: #222; color: #00e5ff; font-family: monospace; font-size: 11px;
                display: flex; align-items: center; padding: 0 10px; z-index: 2147483647;
                border-bottom: 1px solid #444;
            }
            .shim-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 2147483646;
                display: flex; justify-content: center; align-items: flex-start;
                font-family: sans-serif; backdrop-filter: blur(2px);
            }
            .shim-box {
                background: #fff; width: 320px; margin-top: 60px;
                border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                overflow: hidden; border: 1px solid #aaa; animation: drop 0.2s ease;
            }
            .shim-content { padding: 20px; font-size: 14px; color: #333; line-height: 1.4; }
            .shim-actions { padding: 10px; text-align: right; background: #eee; border-top: 1px solid #ddd;}
            .shim-btn { background: #007bff; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer;}
            @keyframes drop { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>
        <script>
            (function() {
                try {
                    const bar = document.createElement('div');
                    bar.id = 'drana-status';
                    bar.innerText = "⚡ Drana-Infinity SANDBOX | TARGET: ${host}";
                    document.documentElement.appendChild(bar);

                    function showPopup(text) {
                        const div = document.createElement('div');
                        div.className = 'shim-overlay';
                        const safeText = String(text).replace(/</g, '&lt;');
                        div.innerHTML = \`
                            <div class="shim-box">
                                <div style="padding:10px 20px; font-weight:bold; border-bottom:1px solid #eee;">${host} says</div>
                                <div class="shim-content">\${safeText}</div>
                                <div class="shim-actions"><button class="shim-btn">OK</button></div>
                            </div>
                        \`;
                        document.body.appendChild(div);
                        div.querySelector('button').onclick = () => div.remove();
                    }

                    Object.defineProperty(window, 'alert', { value: (m) => showPopup(m) });
                    Object.defineProperty(window, 'confirm', { value: (m) => showPopup(m) });
                    Object.defineProperty(window, 'prompt', { value: (m) => showPopup(m) });
                    console.log("[DRANA] Hooks Active.");
                } catch(e) { console.error(e); }
            })();
        <\/script>
    `;

    const cacheBuster = ``;
    modalResponseRender.srcdoc = shimContent + cleanHtml + cacheBuster;
}

// socket.on('resend_response_update', (data) => {
//     const responseLine = data.status ? `HTTP/1.1 ${data.status} ${data.reason || ''}` : 'TCP RESPONSE';
//     const rawText = `${responseLine}\n${data.headers}\n\n${data.content}`;

//     modalResponseRaw.textContent = rawText;

//     if (flowStore[currentModalFlowId]) {
//         flowStore[currentModalFlowId].response_raw_text = rawText;
//         flowStore[currentModalFlowId].response_content = rawText; 
//         flowStore[currentModalFlowId].analysis_data = null; 
//         flowStore[currentModalFlowId].recon_data = null;
//         analysisContentArea.innerHTML = '<div class="analysis-placeholder"><i class="fa-solid fa-microchip"></i><p>Response changed. Click to re-analyze.</p></div>';
//         reconContentArea.innerHTML = '<div class="recon-placeholder"><i class="fa-solid fa-microchip"></i><p>Response changed. Click to re-analyze.</p></div>';
//     }

//     if (renderBtn.classList.contains('active')) {
//         const summary = flowStore[currentModalFlowId] ? flowStore[currentModalFlowId].summary : null;
//         performSafeRender(rawText, summary);
//     }

//     resendBtn.textContent = 'Response Updated!';
//     setTimeout(() => {
//         resendBtn.textContent = 'Resend Request';
//         resendBtn.disabled = false;
//     }, 1000);
// });

socket.on('resend_response_update', (data) => {

    // 🔐 Always unlock button FIRST
    resendBtn.textContent = 'Resend Request';
    resendBtn.disabled = false;

    // ❌ Handle replay failure
    if (data.error) {
        modalResponseRaw.textContent =
            `Replay Failed\n\n${data.message || 'Unknown error'}`;
        return;
    }

    // ✅ Ignore partial events (safety)
    if (!data.done) return;

    // ===== EXISTING LOGIC (unchanged) =====

    const responseLine = data.status
        ? `HTTP/1.1 ${data.status} ${data.reason || ''}`
        : 'TCP RESPONSE';

    const rawText = `${responseLine}\n${data.headers}\n\n${data.content}`;

    modalResponseRaw.textContent = rawText;

    if (flowStore[currentModalFlowId]) {
        flowStore[currentModalFlowId].response_raw_text = rawText;
        flowStore[currentModalFlowId].response_content = rawText;
        flowStore[currentModalFlowId].analysis_data = null;
        flowStore[currentModalFlowId].recon_data = null;

        analysisContentArea.innerHTML =
            '<div class="analysis-placeholder"><i class="fa-solid fa-microchip"></i><p>Response changed. Click to re-analyze.</p></div>';

        reconContentArea.innerHTML =
            '<div class="recon-placeholder"><i class="fa-solid fa-microchip"></i><p>Response changed. Click to re-analyze.</p></div>';
    }

    if (renderBtn.classList.contains('active')) {
        const summary = flowStore[currentModalFlowId]
            ? flowStore[currentModalFlowId].summary
            : null;
        performSafeRender(rawText, summary);
    }

    resendBtn.textContent = 'Response Updated!';
    setTimeout(() => {
        resendBtn.textContent = 'Resend Request';
    }, 800);
});


function showModal(flowId) {
    currentModalFlowId = flowId;
    const data = flowStore[flowId];
    if (!data) return;

    const reconTabBtn = document.querySelector('[data-tab="tab-recon"]');
    if (reconTabBtn) {
        const contentType = data.summary.content_type || '';
        if (contentType.toLowerCase().includes('javascript') || data.summary.path.endsWith('.js')) {
            reconTabBtn.textContent = 'JS Recon';
        } else {
            reconTabBtn.textContent = 'Recon';
        }
    }

    modalRequestRaw.textContent = data.request_raw_text;
    modalResponseRaw.textContent = data.response_raw_text;

    modal.style.display = 'block';
    switchTab(tabButtons[0]);
    showRawView();
}

modalCloseBtn.onclick = () => { modal.style.display = 'none'; }

function switchTab(clickedTab) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    clickedTab.classList.add('active');
    document.getElementById(clickedTab.dataset.tab).classList.add('active');

    resendBtn.style.display = (clickedTab.dataset.tab === 'tab-request') ? 'inline-block' : 'none';

    if (clickedTab.dataset.tab === 'tab-analysis') {
        initiateAnalysis(currentModalFlowId);
    }

    if (clickedTab.dataset.tab === 'tab-recon') {
        initiaterecon(currentModalFlowId);
    }
}
tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn)));

function initiateAnalysis(flowId) {
    const data = flowStore[flowId];
    if (!data) return;

    if (data.analysis_data) {
        renderAnalysis(data.analysis_data);
    } else {
        analysisContentArea.innerHTML = `
            <div class="analysis-loader">
                <i class="fa fa-circle-notch fa-spin"></i>
                <p>Analyzing Request & Response Patterns...</p>
                <p style="font-size: 11px; color: #555;">Running Heuristics...</p>
            </div>
        `;

        fetch('/req_analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: flowId })
        })
            .then(r => r.json())
            .then(resp => {
                data.analysis_data = resp; // Store it
                renderAnalysis(resp);
            })
            .catch(err => {
                analysisContentArea.innerHTML = `
                <div style="text-align: center; color: #f85149; padding-top: 50px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 30px; margin-bottom: 10px;"></i>
                    <p>Analysis Failed</p>
                    <p style="font-size: 11px;">${err.message}</p>
                </div>
            `;
            });
    }
}

function initiaterecon(flowId) {
    const data = flowStore[flowId];
    if (!data) return;

    if (data.recon_data) {
        if (fileType === 'javascript') {
            renderreconjs(data.recon_data);
        } else {
            renderrecon(data.recon_data);
        }
    } else {
        reconContentArea.innerHTML = `
            <div class="recon-loader">
                <i class="fa fa-circle-notch fa-spin"></i>
                <p>Analyzing...</p>
                <p style="font-size: 11px; color: #555;">Running Heuristics...</p>
            </div>
        `;

        fetch('/req_recon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: flowId,
                file_type: getFileTypeCategory(data.summary.content_type)
            })
        })
            .then(r => r.json())
            .then(resp => {
                data.recon_data = resp;
                const fileType = getFileTypeCategory(data.summary.content_type);
                if (fileType === 'javascript') {
                    renderreconjs(resp);
                } else {
                    renderrecon(resp);
                }
            })
            .catch(err => {
                reconContentArea.innerHTML = `
                <div style="text-align: center; color: #f85149; padding-top: 50px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 30px; margin-bottom: 10px;"></i>
                    <p>Recon Failed</p>
                    <p style="font-size: 11px;">${err.message}</p>
                </div>
            `;
            });
    }
}

function renderrecon(json) {
    let html = '';

    // Helper for HTML escaping
    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag]));
    };

    // Text-Only Styles (Simple borders and monospace font)
    const boxStyle = 'border: 1px solid #30363d; background: #0d1117; padding: 15px; margin-bottom: 20px; color: #c9d1d9; font-family: monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.5; text-align: left;';
    const headingStyle = 'color: #ffffff; font-size: 16px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #30363d; padding-bottom: 5px; text-align: left;';

    // 1. SUMMARY
    const quality = json.final_recon_summary?.attack_surface_quality || 'Unknown';
    const authStatus = json.auth_state?.authenticated ? 'Authenticated' : 'Guest/Unauthenticated';

    html += `<div style="${headingStyle}">RECONNAISSANCE SUMMARY</div>`;
    html += `<div style="${boxStyle}">`;
    html += `[+] Attack Surface : ${quality}\n`;
    html += `[+] Auth State     : ${authStatus}\n`;
    html += `[+] Error Verbosity: ${json.error_handling?.verbosity || 'Unknown'}`;
    html += `</div>`;

    // 2. PARAMETERS
    if (json.parameters && json.parameters.length > 0) {
        html += `<div style="${headingStyle}">PARAMETER ANALYSIS (${json.parameters.length})</div>`;
        html += `<div style="${boxStyle}">`;
        json.parameters.forEach((param, index) => {
            html += `${index + 1}. ${escapeHTML(param.name)} (${param.location})\n`;
            html += `   Reflected: ${param.reflected ? 'YES' : 'No'}\n`;
            html += `   Notes    : ${escapeHTML(param.notes)}\n\n`;
        });
        html += `</div>`;
    }

    // 3. IDOR / SENSITIVE DATA
    if ((json.idor_candidates && json.idor_candidates.length > 0) || (json.data_exposure && json.data_exposure.length > 0)) {
        html += `<div style="${headingStyle}">VULNERABILITY CANDIDATES</div>`;
        html += `<div style="${boxStyle}">`;

        if (json.idor_candidates.length > 0) {
            html += `[ IDOR CANDIDATES ]\n`;
            json.idor_candidates.forEach(i => html += `! ${escapeHTML(i.identifier)}: ${escapeHTML(i.notes)}\n`);
            html += `\n`;
        }

        if (json.data_exposure.length > 0) {
            html += `[ DATA EXPOSURE ]\n`;
            json.data_exposure.forEach(d => html += `! ${escapeHTML(d.field)}: ${escapeHTML(d.notes)}\n`);
        }
        html += `</div>`;
    }

    // 4. NOTES
    if (json.final_recon_summary?.overall_notes) {
        html += `<div style="${headingStyle}">HUNTER NOTES</div>`;
        html += `<div style="${boxStyle}">`;
        html += `${escapeHTML(json.final_recon_summary.overall_notes)}`;
        html += `</div>`;
    }

    // --- INJECT INTO DOM (Using your existing variable) ---
    // If reconContentArea is an ID in your HTML, this variable exists automatically.
    if (typeof reconContentArea !== 'undefined') {
        reconContentArea.innerHTML = html;
    } else {
        // Fallback in case the variable isn't found in this scope
        const el = document.getElementById('reconContentArea');
        if (el) el.innerHTML = html;
        else console.error("Still cannot find 'reconContentArea'. Ensure the ID exists in HTML.");
    }
}

function renderreconjs(json) {
    let html = '';

    const colors = {
        key: '#d2a8ff',
        string: '#a5d6ff',
        number: '#d29922',
        boolean: '#56d364',
        null: '#8b949e',
        critical: '#ff4444',
        border: '#30363d',
        bg: '#0d1117'
    };

    const boxStyle = `border: 1px solid ${colors.border}; background: ${colors.bg}; padding: 15px; margin-bottom: 20px; color: #c9d1d9; font-family: 'Cascadia Code', 'Fira Code', monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.6; text-align: left; border-radius: 6px; overflow-x: auto;`;
    const headingStyle = `color: #ffffff; font-size: 14px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; display: block; border-left: 4px solid ${colors.key}; padding-left: 10px;`;

    // Simple MD to HTML converter for the summary
    const renderMarkdown = (text) => {
        return text
            .replace(/^### (.*$)/gim, '<h3 style="color:#58a6ff; margin-top:0;">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 style="color:#58a6ff; margin-top:0;">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 style="color:#58a6ff; margin-top:0;">$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
            .replace(/\*(.*)\*/gim, '<i>$1</i>')
            .replace(/\n/g, '<br>');
    };

    const escapeHTML = (val) => {
        if (val === null || val === undefined) return '';
        return String(val).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
    };

    const formatValue = (val) => {
        if (val === null || val === undefined) return `<span style="color:${colors.null}">null</span>`;
        const strVal = String(val);
        if (/critical|high|vulnerability|exploit|risk/i.test(strVal)) {
            return `<span style="color:${colors.critical}; font-weight:bold;">${escapeHTML(strVal)}</span>`;
        }
        if (typeof val === 'boolean') return `<span style="color:${colors.boolean}">${val}</span>`;
        if (typeof val === 'number') return `<span style="color:${colors.number}">${val}</span>`;
        return `<span style="color:${colors.string}">${escapeHTML(strVal)}</span>`;
    };

    const renderNode = (data, indent = 0) => {
        let nodeHtml = '';
        const pad = '  '.repeat(indent);

        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    nodeHtml += `${pad}<span style="color:${colors.null}">[ Item #${index} ]</span>\n`;
                    nodeHtml += renderNode(item, indent + 1);
                    nodeHtml += `\n`;
                } else {
                    nodeHtml += `${pad}- ${formatValue(item)}\n`;
                }
            });
        } else if (typeof data === 'object' && data !== null) {
            for (const key in data) {
                const value = data[key];
                const keyDisplay = `<span style="color:${colors.key}">${escapeHTML(key)}</span>`;
                if (Array.isArray(value) && value.length === 0) continue;
                if (typeof value === 'object' && value !== null) {
                    nodeHtml += `${pad}${keyDisplay}:\n${renderNode(value, indent + 1)}`;
                } else {
                    nodeHtml += `${pad}${keyDisplay}: ${formatValue(value)}\n`;
                }
            }
        }
        return nodeHtml;
    };

    // Main execution
    for (const sectionKey in json) {
        const sectionData = json[sectionKey];
        const displayTitle = sectionKey.replace(/_/g, ' ');

        html += `<div style="${headingStyle}">${displayTitle}</div>`;

        // SPECIAL CASE: Summary Rendering
        if (sectionKey.toLowerCase() === 'summary') {
            const summaryHtml = renderMarkdown(sectionData);
            html += `<div style="${boxStyle}; font-family: sans-serif; font-size: 14px; background: #161b22;">${summaryHtml}</div>`;
        } else {
            // Standard JSON Recon Rendering
            html += `<div style="${boxStyle}">`;
            const content = renderNode(sectionData);
            html += content ? content : `<span style="color:${colors.null}">No data discovered.</span>`;
            html += `</div>`;
        }
    }

    if (typeof reconContentArea !== 'undefined') {
        reconContentArea.innerHTML = html;
    }
}


function showRawView() {
    modalResponseRaw.style.display = 'block';
    modalResponseRender.style.display = 'none';
    rawBtn.classList.add('active');
    renderBtn.classList.remove('active');
}

function showRenderView() {
    modalResponseRaw.style.display = 'none';
    modalResponseRender.style.display = 'block';
    rawBtn.classList.remove('active');
    renderBtn.classList.add('active');
}

rawBtn.onclick = showRawView;

renderBtn.onclick = () => {
    const data = flowStore[currentModalFlowId];

    const contentToRender = data.response_content || data.response_raw_text;

    if (!data || !contentToRender) {
        alert("No content to render.");
        return;
    }

    modalResponseRender.removeAttribute('srcdoc');
    modalResponseRender.src = '';

    showRenderView();
    performSafeRender(contentToRender, data.summary);
};

resendBtn.onclick = () => {
    const modifiedRequest = modalRequestRaw.textContent;
    const data = flowStore[currentModalFlowId];

    socket.emit('trigger_replay_in_engine', {
        flow_id: currentModalFlowId,
        new_request: modifiedRequest,
        type: data.type || 'http'
    });

    resendBtn.textContent = 'Sending...';
    resendBtn.disabled = true;

    setTimeout(() => {
        if (resendBtn.disabled) {
            resendBtn.textContent = 'Resend Request';
            resendBtn.disabled = false;
        }
    }, 12000);
};

const settingsToggle = document.getElementById('settings-toggle');
const settingsModal = document.getElementById('settings-modal');
const blacklistInput = document.getElementById('blacklist-input');

settingsToggle.onclick = () => {
    blacklistInput.value = blacklistRules.join('\n');
    settingsModal.style.display = 'flex';
}
window.closeSettings = () => { settingsModal.style.display = 'none'; }
window.saveSettings = () => {
    const text = blacklistInput.value;
    blacklistRules = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    localStorage.setItem('drana_blacklist', JSON.stringify(blacklistRules));
    settingsModal.style.display = 'none';
}

let isDragging = false;
let dragStartX, dragStartY, dragInitialLeft, dragInitialTop;
modalHeader.onmousedown = (e) => {
    if (e.target.id === 'modal-close-btn') return;
    isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY;
    dragInitialLeft = modal.offsetLeft; dragInitialTop = modal.offsetTop;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
};
function onDragMove(e) {
    if (!isDragging) return;
    modal.style.left = (dragInitialLeft + e.clientX - dragStartX) + 'px';
    modal.style.top = (dragInitialTop + e.clientY - dragStartY) + 'px';
}
function onDragUp() { isDragging = false; document.removeEventListener('mousemove', onDragMove); document.removeEventListener('mouseup', onDragUp); }

const resizerR = document.querySelector('.resizer-r');
const resizerB = document.querySelector('.resizer-b');
const resizerBR = document.querySelector('.resizer-br');
let isResizing = false;
let currentResizer = null;
let resizeStartX, resizeStartY, startWidth, startHeight;

function initResize(e) {
    e.preventDefault();
    isResizing = true;
    currentResizer = e.target;
    resizeStartX = e.clientX; resizeStartY = e.clientY;
    const styles = window.getComputedStyle(modal);
    startWidth = parseInt(styles.width, 10);
    startHeight = parseInt(styles.height, 10);
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => iframe.style.pointerEvents = 'none');
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeUp);
}

function onResizeMove(e) {
    if (!isResizing) return;
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    if (currentResizer.classList.contains('resizer-r') || currentResizer.classList.contains('resizer-br')) {
        modal.style.width = (startWidth + dx) + 'px';
    }
    if (currentResizer.classList.contains('resizer-b') || currentResizer.classList.contains('resizer-br')) {
        modal.style.height = (startHeight + dy) + 'px';
    }
}

function onResizeUp() {
    isResizing = false; currentResizer = null;
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => iframe.style.pointerEvents = 'auto');
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeUp);
}

if (resizerR) resizerR.addEventListener('mousedown', initResize);
if (resizerB) resizerB.addEventListener('mousedown', initResize);
if (resizerBR) resizerBR.addEventListener('mousedown', initResize);

const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;' };
function escapeHTML(str) { return String(str).replace(/[&<>"']/g, s => entityMap[s]); }
// --- SEARCH LOGIC ---
let currentMatchIndex = -1;
let currentMatches = [];

function getActiveElement() {
    const activeTab = document.querySelector('.tab-button.active').dataset.tab;
    if (activeTab === 'tab-request') return modalRequestRaw;
    if (activeTab === 'tab-response') return modalResponseRaw;
    return null;
}

function updateSearchUI() {
    const countLabel = document.getElementById('search-count-label');
    if (currentMatches.length === 0) {
        countLabel.textContent = "0 / 0";
    } else {
        countLabel.textContent = `${currentMatchIndex + 1} / ${currentMatches.length}`;
    }

    // Highlight active
    currentMatches.forEach((m, i) => {
        if (i === currentMatchIndex) {
            m.style.backgroundColor = '#ff9632'; // Active orange
            m.style.color = '#000';
            m.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            m.style.backgroundColor = '#f8e3a1'; // Default yellow
            m.style.color = '#000';
        }
    });
}

searchBtn.onclick = () => {
    const el = getActiveElement();
    if (!el) return;

    const term = searchInput.value;
    if (!term) return;

    // Reset current view
    el.textContent = el.textContent;
    currentMatchIndex = -1;
    currentMatches = [];

    // Perform Search
    try {
        const txt = el.textContent;
        const flags = searchCase.checked ? 'g' : 'gi';
        const safeTerm = searchRegex.checked ? term : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(safeTerm, flags);

        let resultHtml = "";
        let lastIndex = 0;
        let match;

        // Safeguard against infinite loops with zero-length matches
        while ((match = regex.exec(txt)) !== null) {
            // Text before match
            resultHtml += escapeHTML(txt.substring(lastIndex, match.index));
            // The match itself
            resultHtml += `<mark>${escapeHTML(match[0])}</mark>`;
            lastIndex = regex.lastIndex;

            if (match.index === regex.lastIndex) regex.lastIndex++;
        }
        // Remaining text
        resultHtml += escapeHTML(txt.substring(lastIndex));

        el.innerHTML = resultHtml;

        currentMatches = el.querySelectorAll('mark');
        if (currentMatches.length > 0) {
            currentMatchIndex = 0;
        }
        updateSearchUI();

    } catch (e) {
        console.error("Search error:", e);
        alert("Search error: " + e.message);
    }
};

const searchNextBtn = document.getElementById('search-next-btn');
const searchPrevBtn = document.getElementById('search-prev-btn');

if (searchNextBtn) searchNextBtn.onclick = () => {
    if (currentMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length;
    updateSearchUI();
};

if (searchPrevBtn) searchPrevBtn.onclick = () => {
    if (currentMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex - 1 + currentMatches.length) % currentMatches.length;
    updateSearchUI();
};

searchClearBtn.onclick = () => {
    const el = getActiveElement();
    if (!el) return;
    el.textContent = el.textContent; // Strips HTML tags
    searchInput.value = '';
    currentMatchIndex = -1;
    currentMatches = [];
    updateSearchUI();
};

socket.on('crawl_status', (data) => {
    if (data.status === 'complete') {
        startupModal.style.display = 'none';
        startupBtn.textContent = "LAUNCH INTERCEPTOR";
        startupBtn.disabled = false;
        completionModal.style.display = 'flex';
    }
});

window.closeCompletion = () => { completionModal.style.display = 'none'; };

const restartBtn = document.getElementById('restart-toggle');
restartBtn.onclick = () => {
    startupStatus.style.display = 'none';
    startupBtn.textContent = "LAUNCH INTERCEPTOR";
    startupBtn.disabled = false;
    startupModal.style.display = 'flex';
};

const startupCloseBtn = document.getElementById('startup-close-btn');
startupCloseBtn.onclick = () => { startupModal.style.display = 'none'; };