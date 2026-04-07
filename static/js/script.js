const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');
const floatToggle = document.getElementById('float-toggle');
const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const overlay = document.getElementById('processing-overlay');
const loginModal = document.getElementById('login-modal');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const userInfoDisplay = document.getElementById('user-info');
const modelSelect = document.getElementById('model-select');
const terminalModal = document.getElementById('terminal-modal');
const terminalOutput = document.getElementById('terminal-output');
const closeTerminalBtn = document.getElementById('close-terminal-btn');
const rerunBtn = document.getElementById('rerun-btn');
const copyOutputBtn = document.getElementById('copy-output-btn');
const saveOutputBtn = document.getElementById('save-output-btn');
const processingDots = document.getElementById('processing-dots');
const headerTitle = document.getElementById('header-title');
const listTitleHeader = document.getElementById('list-title');
const newChatBtn = document.getElementById('new-chat-btn');
const newProjectBtn = document.getElementById('new-project-btn');
const viewProjectsBtn = document.getElementById('view-projects-btn');
const viewChatsBtn = document.getElementById('view-chats-btn');
const toolsBtn = document.getElementById('tools-btn');
const ragBtn = document.getElementById('rag-btn');
const interceptorBtn = document.getElementById('interceptor-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const logoutBtn = document.getElementById('logout-btn');
const settingsUsername = document.getElementById('settings-username');
const renameModal = document.getElementById('rename-modal');
const closeRenameBtn = document.getElementById('close-rename-btn');
const cancelRenameBtn = document.getElementById('cancel-rename-btn');
const confirmRenameBtn = document.getElementById('confirm-rename-btn');
const renameInput = document.getElementById('rename-input');
const deleteModal = document.getElementById('delete-modal');
const closeDeleteBtn = document.getElementById('close-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteChatTitle = document.getElementById('delete-chat-title');
const newProjectModal = document.getElementById('new-project-modal');
const closeNewProjectBtn = document.getElementById('close-new-project-btn');
const cancelNewProjectBtn = document.getElementById('cancel-new-project-btn');
const confirmNewProjectBtn = document.getElementById('confirm-new-project-btn');
const newProjectNameInput = document.getElementById('new-project-name-input');
const newProjectTypeSelect = document.getElementById('new-project-type-select');
const renameProjectModal = document.getElementById('rename-project-modal');
const closeRenameProjectBtn = document.getElementById('close-rename-project-btn');
const cancelRenameProjectBtn = document.getElementById('cancel-rename-project-btn');
const confirmRenameProjectBtn = document.getElementById('confirm-rename-project-btn');
const renameProjectInput = document.getElementById('rename-project-input');
const deleteProjectModal = document.getElementById('delete-project-modal');
const closeDeleteProjectBtn = document.getElementById('close-delete-project-btn');
const cancelDeleteProjectBtn = document.getElementById('cancel-delete-project-btn');
const confirmDeleteProjectBtn = document.getElementById('confirm-delete-project-btn');
const deleteProjectTitle = document.getElementById('delete-project-title');
const webSearchBtn = document.getElementById('web-search-btn');
const graphContainer = document.getElementById('graph-container');
const scanModal = document.getElementById('scan-setup-modal');
const startScanBtn = document.getElementById('start-scan-btn');
const closeScanModalBtn = document.getElementById('close-scan-modal-btn');
const cancelScanBtn = document.getElementById('cancel-scan-btn');
const nodeContentModal = document.getElementById('node-content-modal');
const nodeFilteredList = document.getElementById('node-filtered-list');
const closeNodeModalBtn = document.getElementById('close-node-modal-btn');
const nodeModalTitle = document.getElementById('node-modal-title');
const viewRawLogBtn = document.getElementById('view-raw-log-btn');
const graphContextMenu = document.getElementById('graph-context-menu');
const ctxNewNodeBtn = document.getElementById('ctx-new-node');
const ctxRenameNodeBtn = document.getElementById('ctx-rename-node');
const ctxDeleteNodeBtn = document.getElementById('ctx-delete-node');
const renameNodeModal = document.getElementById('rename-node-modal');
const nodeRenameInput = document.getElementById('node-rename-input');
const closeRenameNodeBtn = document.getElementById('close-rename-node-btn');
const cancelRenameNodeBtn = document.getElementById('cancel-rename-node-btn');
const confirmRenameNodeBtn = document.getElementById('confirm-rename-node-btn');
const addManualNodeModal = document.getElementById('add-manual-node-modal');
const manualNodeLabelInput = document.getElementById('manual-node-label');
const manualNodeContentInput = document.getElementById('manual-node-content');
const closeManualNodeBtn = document.getElementById('close-manual-node-btn');
const cancelManualNodeBtn = document.getElementById('cancel-manual-node-btn');
const confirmManualNodeBtn = document.getElementById('confirm-manual-node-btn');

let activeChatId = null;
let isChatReady = false;
let currentCommand = "";
let currentAttachedFile = null;
let currentPageMode = 'chats';
let currentActiveProjectId = null;
let currentActiveProjectTitle = null;
let currentActiveProjectType = null;
let isWebSearchActive = false;
let cy = null;
let currentNodeId = null;
let contextNodeId = null;
let nodeToDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
    injectDeleteNodeModal();

    const contextDiv = document.getElementById('page-context');
    if (contextDiv) {
        currentPageMode = contextDiv.dataset.pageMode;
        currentActiveProjectId = contextDiv.dataset.activeProjectId === 'null' ? null : contextDiv.dataset.activeProjectId;
        currentActiveProjectTitle = contextDiv.dataset.activeProjectTitle === 'null' ? null : contextDiv.dataset.activeProjectTitle;
        updateUIForMode();
    }
    checkUserSession();
    attachStaticListeners();
});

function injectDeleteNodeModal() {
    if (document.getElementById('delete-node-modal')) return;
    const modalHTML = `
    <div id="delete-node-modal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
            <h4>Delete Node</h4>
            <button id="close-delete-node-btn" class="close-btn">&times;</button>
        </div>
        <p style="color: #ccc; text-align: center; margin-bottom: 20px;">Are you sure you want to delete this node? All child nodes will also be permanently deleted.</p>
        <p id="delete-node-name" style="color: #fff; font-weight: bold; background: #000; padding: 10px; border-radius: 5px; margin-bottom: 20px; word-break: break-all;"></p>
        <div class="modal-actions">
            <button id="cancel-delete-node-btn" class="modal-btn modal-btn-secondary">Cancel</button>
            <button id="confirm-delete-node-btn" class="modal-btn modal-btn-danger">Delete</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    // If text is an array/object, convert to string first
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showTargetContextMenu(x, y) {
    const menuId = 'target-context-menu';
    let menu = document.getElementById(menuId);

    if (menu) {
        menu.remove();
    }

    menu = document.createElement('div');
    menu.id = menuId;
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.backgroundColor = '#1a1a1a';
    menu.style.border = '1px solid #00e5ff';
    menu.style.borderRadius = '4px';
    menu.style.zIndex = '10000';
    menu.style.minWidth = '180px';
    menu.style.boxShadow = '0 0 10px rgba(0, 229, 255, 0.3)';

    const items = [
        { label: 'Create New Node', submenu: true },
        { label: 'Rename Target', action: 'rename' },
        { label: 'Delete Target', action: 'delete' }
    ];

    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.padding = '10px 15px';
        itemEl.style.cursor = 'pointer';
        itemEl.style.color = '#00e5ff';
        itemEl.style.fontSize = '13px';
        itemEl.style.userSelect = 'none';
        itemEl.style.position = 'relative';
        itemEl.style.display = 'flex';
        itemEl.style.justifyContent = 'space-between';
        itemEl.style.alignItems = 'center';
        itemEl.textContent = item.label;

        if (item.submenu) {
            itemEl.innerHTML = `${item.label} <span style="font-size: 10px; margin-left: 10px;">▶</span>`;
        }

        itemEl.addEventListener('mouseenter', () => {
            itemEl.style.backgroundColor = '#003333';
            if (item.submenu) {
                showSubmenu(itemEl, x, y);
            } else {
                // Hide submenu when hovering over other items
                const submenu = document.getElementById('target-submenu');
                if (submenu) submenu.remove();
            }
        });

        itemEl.addEventListener('mouseleave', () => {
            itemEl.style.backgroundColor = 'transparent';
        });

        itemEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.action === 'rename') {
                menu.remove();
                handleRenameTarget();
            } else if (item.action === 'delete') {
                menu.remove();
                handleDeleteTarget();
            }
        });

        menu.appendChild(itemEl);
    });

    document.body.appendChild(menu);

    document.addEventListener('click', function closeMenu(e) {
        const submenu = document.getElementById('target-submenu');
        if (menu && !menu.contains(e.target) && (!submenu || !submenu.contains(e.target))) {
            menu.remove();
            if (submenu) submenu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

function showSubmenu(parentItem, parentX, parentY) {
    let submenu = document.getElementById('target-submenu');
    if (submenu) {
        submenu.remove();
    }

    submenu = document.createElement('div');
    submenu.id = 'target-submenu';
    submenu.style.position = 'fixed';
    submenu.style.backgroundColor = '#1a1a1a';
    submenu.style.border = '1px solid #00e5ff';
    submenu.style.borderRadius = '4px';
    submenu.style.zIndex = '10001';
    submenu.style.minWidth = '170px';
    submenu.style.boxShadow = '0 0 10px rgba(0, 229, 255, 0.3)';

    const rect = parentItem.getBoundingClientRect();
    submenu.style.left = (rect.right + 5) + 'px';
    submenu.style.top = rect.top + 'px';

    // Get existing child node types for the target node
    const targetNode = cy.$('#' + contextNodeId);
    const childNodes = targetNode.successors('node');
    const existingTypes = new Set();
    childNodes.forEach(child => {
        const childType = child.data('type');
        if (childType) {
            existingTypes.add(childType);
        }
    });

    const options = [
        { label: 'WAF Detect', action: 'WAF', type: 'WAF' },
        { label: 'TECHNOLOGY Detect', action: 'TECHNOLOGY', type: 'WEBTECH' },
        { label: 'PORT Scan', action: 'PORT', type: 'PORTSCAN' },
        { label: 'SUBDOMAIN Enumerate', action: 'SUBDOMAIN', type: 'SUBDOMAIN' },
        { label: 'Get All URL', action: 'URL', type: 'GETURL' },
        { label: 'New empty node', action: 'empty', type: 'manual' }
    ];

    options.forEach(opt => {
        // Skip if this node type already exists as a child
        if (existingTypes.has(opt.type)) {
            return;
        }

        const optEl = document.createElement('div');
        optEl.style.padding = '10px 15px';
        optEl.style.cursor = 'pointer';
        optEl.style.color = '#00e5ff';
        optEl.style.fontSize = '13px';
        optEl.style.userSelect = 'none';
        optEl.textContent = opt.label;

        optEl.addEventListener('mouseenter', () => {
            optEl.style.backgroundColor = '#003333';
        });

        optEl.addEventListener('mouseleave', () => {
            optEl.style.backgroundColor = 'transparent';
        });

        optEl.addEventListener('click', (e) => {
            e.stopPropagation();
            handleTargetSubmenuAction(opt.action);
            document.getElementById('target-context-menu')?.remove();
            submenu.remove();
        });

        submenu.appendChild(optEl);
    });

    document.body.appendChild(submenu);
}

function handleTargetSubmenuAction(action) {
    if (!contextNodeId) return;

    const node = cy.$('#' + contextNodeId);
    const targetName = node.data('content');

    const toolMap = {
        'WAF': { label: 'WAF', cmdType: 'WAF', cmd: targetName },
        'TECHNOLOGY': { label: 'TECHNOLOGY', cmdType: 'WEBTECH', cmd: targetName },
        'PORT': { label: 'PORTS', cmdType: 'PORTSCAN', cmd: targetName },
        'SUBDOMAIN': { label: 'SUBDOMAINS', cmdType: 'SUBDOMAIN', cmd: targetName },
        'URL': { label: 'URLS', cmdType: 'GETURL', cmd: targetName }
    };

    if (action === 'empty') {
        if (manualNodeLabelInput) manualNodeLabelInput.value = '';
        if (manualNodeContentInput) manualNodeContentInput.value = '';
        if (addManualNodeModal) addManualNodeModal.style.display = 'flex';
    } else if (toolMap[action]) {
        const tool = toolMap[action];
        const nodeId = contextNodeId + '_' + tool.cmdType;
        const newNode = {
            group: 'nodes',
            data: {
                id: nodeId,
                header: tool.label,
                content: 'Pending...',
                type: tool.cmdType,
                parentId: contextNodeId
            }
        };

        cy.add(newNode);
        cy.add({ group: 'edges', data: { source: contextNodeId, target: nodeId } });
        saveNodeToDB(cy.$('#' + nodeId));

        cy.layout({ name: 'dagre', rankDir: 'LR', rankSep: 150, fit: false }).run();

        setTimeout(() => runNodeScan(nodeId, tool.cmd, tool.cmdType), 200);
    }
}

function handleRenameTarget() {
    if (!contextNodeId) return;
    const node = cy.$('#' + contextNodeId);
    if (nodeRenameInput) nodeRenameInput.value = node.data('content') || node.data('header');
    if (renameNodeModal) renameNodeModal.style.display = 'flex';
}

function handleDeleteTarget() {
    if (!contextNodeId) return;
    handleDeleteNode(contextNodeId);
}

function attachStaticListeners() {
    if (toggleBtn) toggleBtn.addEventListener('click', () => { sidebar.classList.add('hide'); floatToggle.style.display = 'block'; });
    if (floatToggle) floatToggle.addEventListener('click', () => { sidebar.classList.remove('hide'); floatToggle.style.display = 'none'; });
    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            const username = userInfoDisplay.textContent ? userInfoDisplay.textContent.replace('User: ', '').trim() : 'Guest';
            if (settingsUsername) settingsUsername.textContent = username;
            if (settingsModal) settingsModal.style.display = 'flex';
        });
    }
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');

    if (closeTerminalBtn) closeTerminalBtn.addEventListener('click', () => terminalModal.style.display = 'none');
    if (closeNodeModalBtn) closeNodeModalBtn.addEventListener('click', () => nodeContentModal.style.display = 'none');

    if (viewRawLogBtn) viewRawLogBtn.addEventListener('click', openRawLogFromModal);

    const terminalActions = document.querySelector('#terminal-modal .terminal-actions');
    if (terminalActions && !document.getElementById('view-filtered-btn')) {
        const btn = document.createElement('button');
        btn.id = 'view-filtered-btn';
        btn.innerHTML = '<i class="fa fa-list"></i> View Filtered';
        btn.style.marginLeft = '10px';
        btn.onclick = () => {
            terminalModal.style.display = 'none';
            if (currentNodeId && cy) {
                const node = cy.$('#' + currentNodeId);
                openNodeSelectionModal(node);
            }
        };
        terminalActions.insertBefore(btn, terminalActions.firstChild);
    }

    if (startScanBtn) startScanBtn.addEventListener('click', handleStartScan);
    if (closeScanModalBtn) closeScanModalBtn.addEventListener('click', () => scanModal.style.display = 'none');

    if (newChatBtn) newChatBtn.addEventListener('click', createNewChatHandler);
    if (newProjectBtn) newProjectBtn.addEventListener('click', () => newProjectModal.style.display = 'flex');

    if (attachBtn) attachBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    if (webSearchBtn) {
        webSearchBtn.addEventListener('click', () => {
            isWebSearchActive = !isWebSearchActive;
            webSearchBtn.classList.toggle('active', isWebSearchActive);
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
                chatInput.style.height = 'auto';
            }
        });
        chatInput.addEventListener('input', autoResizeInput);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            document.cookie = "user_hash=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            location.reload();
        });
    }

    if (ragBtn) ragBtn.addEventListener('click', () => window.open('/rag', '_blank'));
    if (interceptorBtn) interceptorBtn.addEventListener('click', () => window.open('/interceptor', '_blank'));
    if (toolsBtn) toolsBtn.addEventListener('click', () => window.open('/required_tools', '_blank'));
    if (viewProjectsBtn) viewProjectsBtn.addEventListener('click', () => window.location.href = '/projects');

    if (viewChatsBtn) viewChatsBtn.addEventListener('click', () => window.location.href = '/');

    if (rerunBtn) rerunBtn.addEventListener('click', handleRerun);
    if (copyOutputBtn) copyOutputBtn.addEventListener('click', handleCopyOutput);
    if (saveOutputBtn) saveOutputBtn.addEventListener('click', handleSaveOutput);

    if (closeRenameBtn) closeRenameBtn.addEventListener('click', () => { renameModal.style.display = 'none'; });
    if (cancelRenameBtn) cancelRenameBtn.addEventListener('click', () => { renameModal.style.display = 'none'; });
    if (confirmRenameBtn) {
        confirmRenameBtn.addEventListener('click', () => {
            const chatId = confirmRenameBtn.dataset.chatId;
            const newTitle = renameInput.value.trim();
            if (chatId && newTitle) {
                renameChat(chatId, newTitle);
                renameModal.style.display = 'none';
            }
        });
    }
    if (closeDeleteBtn) closeDeleteBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            const chatId = confirmDeleteBtn.dataset.chatId;
            if (chatId) {
                deleteChat(chatId);
                deleteModal.style.display = 'none';
            }
        });
    }

    if (closeNewProjectBtn) closeNewProjectBtn.addEventListener('click', () => { newProjectModal.style.display = 'none'; });
    if (cancelNewProjectBtn) cancelNewProjectBtn.addEventListener('click', () => { newProjectModal.style.display = 'none'; });
    if (confirmNewProjectBtn) confirmNewProjectBtn.addEventListener('click', createNewProject);

    if (closeRenameProjectBtn) closeRenameProjectBtn.addEventListener('click', () => { renameProjectModal.style.display = 'none'; });
    if (cancelRenameProjectBtn) cancelRenameProjectBtn.addEventListener('click', () => { renameProjectModal.style.display = 'none'; });
    if (confirmRenameProjectBtn) {
        confirmRenameProjectBtn.addEventListener('click', () => {
            const projectId = confirmRenameProjectBtn.dataset.projectId;
            const newTitle = renameProjectInput.value.trim();
            if (projectId && newTitle) {
                renameProject(projectId, newTitle);
                renameProjectModal.style.display = 'none';
            }
        });
    }
    if (closeDeleteProjectBtn) closeDeleteProjectBtn.addEventListener('click', () => { deleteProjectModal.style.display = 'none'; });
    if (cancelDeleteProjectBtn) cancelDeleteProjectBtn.addEventListener('click', () => { deleteProjectModal.style.display = 'none'; });
    if (confirmDeleteProjectBtn) {
        confirmDeleteProjectBtn.addEventListener('click', () => {
            const projectId = confirmDeleteProjectBtn.dataset.projectId;

            if (projectId) {
                deleteProject(projectId);
                deleteProjectModal.style.display = 'none';
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (graphContextMenu && graphContextMenu.style.display === 'block') {
            if (!graphContextMenu.contains(e.target)) {
                graphContextMenu.style.display = 'none';
            }
        }
    });

    window.addEventListener('resize', () => {
        if (graphContextMenu) graphContextMenu.style.display = 'none';
    });

    if (ctxNewNodeBtn) ctxNewNodeBtn.addEventListener('click', () => {
        if (graphContextMenu) graphContextMenu.style.display = 'none';
        if (contextNodeId) {
            if (manualNodeLabelInput) manualNodeLabelInput.value = '';
            if (manualNodeContentInput) manualNodeContentInput.value = '';
            if (addManualNodeModal) addManualNodeModal.style.display = 'flex';
        }
    });

    if (ctxRenameNodeBtn) ctxRenameNodeBtn.addEventListener('click', () => {
        if (graphContextMenu) graphContextMenu.style.display = 'none';
        if (contextNodeId && cy) {
            const node = cy.$('#' + contextNodeId);
            if (nodeRenameInput) nodeRenameInput.value = node.data('header');
            if (renameNodeModal) renameNodeModal.style.display = 'flex';
        }
    });

    if (ctxDeleteNodeBtn) ctxDeleteNodeBtn.addEventListener('click', () => {
        if (graphContextMenu) graphContextMenu.style.display = 'none';
        if (contextNodeId) handleDeleteNode(contextNodeId);
    });

    if (closeRenameNodeBtn) closeRenameNodeBtn.addEventListener('click', () => { if (renameNodeModal) renameNodeModal.style.display = 'none'; });
    if (cancelRenameNodeBtn) cancelRenameNodeBtn.addEventListener('click', () => { if (renameNodeModal) renameNodeModal.style.display = 'none'; });
    if (confirmRenameNodeBtn) confirmRenameNodeBtn.addEventListener('click', handleRenameNode);

    if (closeManualNodeBtn) closeManualNodeBtn.addEventListener('click', () => { if (addManualNodeModal) addManualNodeModal.style.display = 'none'; });
    if (cancelManualNodeBtn) cancelManualNodeBtn.addEventListener('click', () => { if (addManualNodeModal) addManualNodeModal.style.display = 'none'; });
    if (confirmManualNodeBtn) confirmManualNodeBtn.addEventListener('click', handleCreateManualNode);

    const closeDeleteNodeBtn = document.getElementById('close-delete-node-btn');
    const cancelDeleteNodeBtn = document.getElementById('cancel-delete-node-btn');
    const confirmDeleteNodeBtn = document.getElementById('confirm-delete-node-btn');
    const deleteNodeModal = document.getElementById('delete-node-modal');

    if (closeDeleteNodeBtn) closeDeleteNodeBtn.addEventListener('click', () => { if (deleteNodeModal) deleteNodeModal.style.display = 'none'; });
    if (cancelDeleteNodeBtn) cancelDeleteNodeBtn.addEventListener('click', () => { if (deleteNodeModal) deleteNodeModal.style.display = 'none'; });
    if (confirmDeleteNodeBtn) confirmDeleteNodeBtn.addEventListener('click', confirmDeleteNode);
}

function updateUIForMode() {
    if (!headerTitle) return;
    headerTitle.textContent = 'Drana-Infinity';

    if (newChatBtn) newChatBtn.style.display = 'none';
    if (newProjectBtn) newProjectBtn.style.display = 'none';
    if (viewProjectsBtn) viewProjectsBtn.style.display = 'none';
    if (viewChatsBtn) viewChatsBtn.style.display = 'none';

    if (graphContainer) graphContainer.style.display = 'none';
    if (messagesContainer) messagesContainer.style.display = 'flex';
    if (document.getElementById('input-area')) document.getElementById('input-area').style.display = 'flex';

    if (currentPageMode === 'projects') {
        if (listTitleHeader) listTitleHeader.textContent = 'Projects';
        if (newProjectBtn) newProjectBtn.style.display = 'block';
        if (viewChatsBtn) viewChatsBtn.style.display = 'block';
        messagesContainer.innerHTML = '<h2>Select a Project</h2>';
        if (document.getElementById('input-area')) document.getElementById('input-area').style.display = 'none';
    } else if (currentPageMode === 'project_detail') {
        if (listTitleHeader) listTitleHeader.textContent = currentActiveProjectTitle || 'Project';
        if (viewProjectsBtn) viewProjectsBtn.style.display = 'block';
        if (newChatBtn) newChatBtn.style.display = 'block';
        messagesContainer.innerHTML = '';
    } else {
        if (listTitleHeader) listTitleHeader.textContent = 'Chats';
        if (newChatBtn) newChatBtn.style.display = 'block';
        if (viewProjectsBtn) viewProjectsBtn.style.display = 'block';
        messagesContainer.innerHTML = '';
    }
}

async function checkUserSession() {
    try {
        const response = await fetch('/get_user_info');
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displayUserInfo(data.username);
                fetchModels();
            } else { if (loginModal) loginModal.style.display = 'flex'; }
        } else { if (loginModal) loginModal.style.display = 'flex'; }
    } catch (err) { if (loginModal) loginModal.style.display = 'flex'; }
}

async function handleLogin() {
    const username = usernameInput.value.trim();
    if (!username) return;
    const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    if (response.ok) {
        const data = await response.json();
        displayUserInfo(data.username);
        if (loginModal) loginModal.style.display = 'none';
        fetchModels();
    }
}

function displayUserInfo(u) { if (userInfoDisplay) userInfoDisplay.textContent = u; if (settingsBtn) settingsBtn.style.display = 'block'; }
async function fetchModels() { try { const r = await fetch('/get_models'); if (r.ok) { const d = await r.json(); if (modelSelect) d.models.forEach(m => { let o = document.createElement('option'); o.value = m; o.textContent = m; modelSelect.appendChild(o); }); } } catch (e) { } finally { loadSidebarData(); } }

async function loadSidebarData() {
    if (currentPageMode === 'projects') await loadProjects();
    else if (currentPageMode === 'project_detail') await identifyProjectModeAndLoad();
    else await loadChats(null);
}

async function identifyProjectModeAndLoad() {
    const response = await fetch('/get_projects');
    if (response.ok) {
        const data = await response.json();
        const currentProject = data.projects.find(p => p.project_id === currentActiveProjectId);
        if (currentProject) {
            currentActiveProjectType = currentProject.type;

            if (listTitleHeader) {
                listTitleHeader.style.cursor = 'pointer';
                listTitleHeader.title = "Click to view Project Flow";
                listTitleHeader.onclick = () => {
                    if (currentActiveProjectType === 'web_app_testing') {
                        switchToGraphMode(currentProject.title);
                    }
                };
            }

            await loadChats(currentActiveProjectId);
            if (currentProject.type === 'web_app_testing') switchToGraphMode(currentProject.title);
            else switchToChatMode();
        }
    }
}

async function loadProjects() {
    const response = await fetch('/get_projects');
    if (response.ok) {
        const data = await response.json();
        if (chatList) chatList.innerHTML = '';
        data.projects.forEach(proj => createProjectItem(proj.project_id, proj.title, proj.type));
    }
}

function createProjectItem(projectId, title, type) {
    const projItem = document.createElement('div');
    projItem.classList.add('chat-item');
    projItem.dataset.projectId = projectId;
    if (type) projItem.dataset.projectType = type;
    const titleSpan = document.createElement('span');
    titleSpan.classList.add('chat-item-title');
    titleSpan.textContent = title;
    if (type === 'web_app_testing') titleSpan.innerHTML = `<i class="fa fa-crosshairs" style="color:#0ff; margin-right:5px; font-size:10px;"></i> ${escapeHtml(title)}`;
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('chat-item-actions');
    actionsDiv.innerHTML = `<button class="rename-project-btn"><i class="fa fa-pen"></i></button><button class="delete-project-btn"><i class="fa fa-trash"></i></button>`;
    projItem.appendChild(titleSpan); projItem.appendChild(actionsDiv);
    if (chatList) chatList.prepend(projItem);

    projItem.querySelector('.rename-project-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        renameProjectInput.value = title;
        confirmRenameProjectBtn.dataset.projectId = projectId;
        renameProjectModal.style.display = 'flex';
    });

    projItem.querySelector('.delete-project-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteProjectTitle.textContent = title;
        confirmDeleteProjectBtn.dataset.projectId = projectId;
        deleteProjectModal.style.display = 'flex';
    });

    titleSpan.addEventListener('click', () => window.location.href = `/project/${projectId}`);
}

async function loadChats(projectId) {
    let url = '/get_chats'; if (projectId) url += `?project_id=${projectId}`;
    const response = await fetch(url);
    if (response.ok) {
        const data = await response.json();
        if (chatList) chatList.innerHTML = '';
        data.chats.forEach(chat => createChatItem(chat.chat_id, chat.title, chat.model_name));
    }
}

function createChatItem(chatId, title, modelName) {
    const chatItem = document.createElement('div');
    chatItem.classList.add('chat-item');
    chatItem.dataset.chatId = chatId;
    const titleSpan = document.createElement('span');
    titleSpan.classList.add('chat-item-title');
    titleSpan.textContent = title;
    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('chat-item-actions');
    actionsDiv.innerHTML = `<button class="rename-chat-btn"><i class="fa fa-pen"></i></button><button class="delete-chat-btn"><i class="fa fa-trash"></i></button>`;
    chatItem.appendChild(titleSpan); chatItem.appendChild(actionsDiv);
    if (chatList) chatList.prepend(chatItem);

    chatItem.querySelector('.rename-chat-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        renameInput.value = title;
        confirmRenameBtn.dataset.chatId = chatId;
        renameModal.style.display = 'flex';
    });

    chatItem.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChatTitle.textContent = title;
        confirmDeleteBtn.dataset.chatId = chatId;
        deleteModal.style.display = 'flex';
    });

    chatItem.addEventListener('click', () => { switchToChatMode(); setActiveChat(chatId); loadChatMessages(chatId); });
}

function setActiveChat(chatId) {
    document.querySelectorAll('.chat-item').forEach(c => c.classList.remove('active'));
    const newActiveItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (newActiveItem) newActiveItem.classList.add('active');
    activeChatId = chatId;
}

async function createNewChatHandler() {
    const modelName = modelSelect ? modelSelect.value : 'llama3';
    const response = await fetch('/create_new_chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_name: modelName, project_id: currentActiveProjectId }) });
    if (response.ok) {
        const data = await response.json();
        createChatItem(data.chat_id, data.title, data.model_name);

        switchToChatMode();

        setActiveChat(data.chat_id);
        messagesContainer.innerHTML = '';
        isChatReady = true;
    }
}

async function loadChatMessages(chatId) {
    messagesContainer.innerHTML = '';
    const response = await fetch('/get_chat_messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId }) });
    if (response.ok) {
        const data = await response.json();
        data.messages.forEach(msg => appendMessage(msg.text, msg.sender));
    }
}

async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    if (!activeChatId) await createNewChatHandler();
    appendMessage(message, 'user');
    chatInput.value = '';
    const aiMsg = appendMessage('', 'ai');
    const body = JSON.stringify({ message: message, chat_id: activeChatId, model_name: modelSelect.value, use_search: isWebSearchActive });
    const response = await fetch('/chat_stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
    if (!response.ok) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiText = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        aiMsg.innerHTML = DOMPurify.sanitize(marked.parse(aiText));
    }
}

function appendMessage(text, sender) {
    const msgRow = document.createElement('div');
    msgRow.classList.add('chat-row', sender);
    if (sender === 'ai') msgRow.innerHTML = `<div class="message">${DOMPurify.sanitize(marked.parse(text))}</div>`;
    else msgRow.innerHTML = `<div class="message">${escapeHtml(text)}</div>`;
    messagesContainer.append(msgRow);
    return msgRow.querySelector('.message');
}

function autoResizeInput() {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    let scrollHeight = chatInput.scrollHeight;
    let maxHeight = parseInt(window.getComputedStyle(chatInput).maxHeight);
    if (scrollHeight > maxHeight) {
        chatInput.style.height = maxHeight + 'px';
        chatInput.style.overflowY = 'auto';
    } else {
        chatInput.style.height = scrollHeight + 'px';
        chatInput.style.overflowY = 'hidden';
    }
}

async function createNewProject() {
    const projectName = newProjectNameInput.value.trim();
    const projectType = newProjectTypeSelect.value;

    if (!projectName) return;

    const response = await fetch('/create_new_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            project_name: projectName,
            project_type: projectType
        })
    });

    if (response.ok) {
        newProjectModal.style.display = 'none';
        newProjectNameInput.value = '';
        newProjectTypeSelect.value = '';
        loadSidebarData();
    } else {
        console.error('Failed to create new project.');
    }
}

async function renameProject(projectId, newTitle) {
    const response = await fetch('/rename_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, new_title: newTitle })
    });
    if (response.ok) {
        const titleElement = document.querySelector(`.chat-item[data-project-id="${projectId}"] .chat-item-title`);
        if (titleElement) {
            titleElement.textContent = newTitle;
        }

        if (currentPageMode === 'project_detail' && currentActiveProjectId === projectId) {
            listTitleHeader.textContent = newTitle;
            currentActiveProjectTitle = newTitle;
        }
    } else {
        console.error('Failed to rename project.');
    }
}

async function deleteProject(projectId) {
    const response = await fetch('/delete_project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
    });
    if (response.ok) {
        document.querySelector(`.chat-item[data-project-id="${projectId}"]`).remove();
    } else {
        console.error('Failed to delete project.');
    }
}

async function renameChat(chatId, newTitle) {
    const response = await fetch('/rename_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, new_title: newTitle })
    });
    if (response.ok) {
        const titleElement = document.querySelector(`.chat-item[data-chat-id="${chatId}"] .chat-item-title`);
        if (titleElement) {
            titleElement.textContent = newTitle;
        }
    } else {
        console.error('Failed to rename chat.');
    }
}

async function deleteChat(chatId) {
    const response = await fetch('/delete_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId })
    });
    if (response.ok) {
        document.querySelector(`.chat-item[data-chat-id="${chatId}"]`).remove();
        if (activeChatId === chatId) {
            if (messagesContainer) messagesContainer.innerHTML = '';
            activeChatId = null;
            isChatReady = true;
            const nextChat = chatList.querySelector('.chat-item');
            if (nextChat) {
                nextChat.click();
            }
        }
    } else {
        console.error('Failed to delete chat.');
    }
}

function handleRerun() {
    if (currentPageMode === 'project_detail' && graphContainer.style.display === 'block' && currentNodeId) {
        if (cy) {
            const node = cy.$('#' + currentNodeId);
            runNodeScan(node.id(), node.data('command'), node.data('type'));
            terminalModal.style.display = 'none';
        }
    } else if (currentCommand) {
        const newOutputId = `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        showTerminalOutput(newOutputId, currentCommand);
    }
}

function handleCopyOutput() {
    navigator.clipboard.writeText(terminalOutput.textContent).then(() => {
        copyOutputBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            copyOutputBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
    });
}

function handleSaveOutput() {
    const blob = new Blob([terminalOutput.textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'terminal-output.txt';
    a.click();
    URL.revokeObjectURL(a.href);
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (currentPageMode === 'projects' || graphContainer.style.display === 'block') {
        alert("Please enter a chat session to upload files.");
        return;
    }

    if (!activeChatId) {
        await createNewChatHandler();
        if (!activeChatId) {
            console.error("Please select or create a chat before uploading.");
            fileInput.value = '';
            return;
        }
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('chat_id', activeChatId);

    if (overlay) overlay.style.display = 'flex';
    try {
        const response = await fetch('/upload_file', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            currentAttachedFile = await response.json();
            showAttachedFile(currentAttachedFile.file_name);
        } else {
            console.error('File upload failed.');
            clearAttachedFile();
        }
    } catch (err) {
        console.error('Error uploading file:', err);
        clearAttachedFile();
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

function showAttachedFile(fileName) {
    const display = document.getElementById('attached-file-display');
    if (!display) return;
    const safeFileName = DOMPurify.sanitize(fileName);
    display.innerHTML = `
        <span class="file-attachment">
            <i class="fa fa-file"></i> ${safeFileName}
            <button id="remove-file-btn" title="Remove file">&times;</button>
        </span>`;

    document.getElementById('remove-file-btn').addEventListener('click', clearAttachedFile);
}

function clearAttachedFile() {
    currentAttachedFile = null;
    if (fileInput) fileInput.value = '';
    if (document.getElementById('attached-file-display')) document.getElementById('attached-file-display').innerHTML = '';
}

function switchToChatMode() {
    graphContainer.style.display = 'none';
    messagesContainer.style.display = 'flex';
    if (document.getElementById('input-area')) document.getElementById('input-area').style.display = 'flex';
}

function switchToGraphMode(projectTitle) {
    messagesContainer.style.display = 'none';
    if (document.getElementById('input-area')) document.getElementById('input-area').style.display = 'none';
    graphContainer.style.display = 'block';
    initGraph(projectTitle);
}

async function initGraph(projectTitle) {
    if (cy) cy.destroy();
    try { if (typeof cytoscapeDagre !== 'undefined') cytoscape.use(cytoscapeDagre); if (typeof cytoscapeNodeHtmlLabel !== 'undefined') cytoscapeNodeHtmlLabel(cytoscape); } catch (e) { }

    cy = cytoscape({
        container: graphContainer,
        boxSelectionEnabled: false,
        autounselectify: true,
        wheelSensitivity: 0.1, minZoom: 0.2, maxZoom: 2.5,
        style: [
            { selector: 'node', style: { 'width': '220px', 'height': '70px', 'shape': 'rectangle', 'background-opacity': 0, 'border-width': 0 } },
            { selector: 'edge', style: { 'width': 0.5, 'line-color': '#00e5ff', 'target-arrow-color': '#00e5ff', 'target-arrow-shape': 'triangle', 'curve-style': 'taxi', 'taxi-direction': 'rightward' } }
        ],
        layout: { name: 'dagre', rankDir: 'LR', rankSep: 150, nodeSep: 50 }
    });

    cy.nodeHtmlLabel([{
        query: 'node', valign: "center", halign: "center",
        tpl: function (data) {
            let css = 'cyber-node-wrapper';
            if (data.status === 'success') css += ' success-border';
            if (data.status === 'error') css += ' error-border';
            if (data.type === 'root') css += ' root-node-style';
            let displayContent = data.selectedLine || data.content || '[pending]';
            if (data.type === 'root' && !data.selectedLine) displayContent = data.header || '[pending]';
            return `<div class="${css}"><div class="node-header">${escapeHtml(data.header) || 'NODE'}</div><div class="node-content">${escapeHtml(displayContent)}</div></div>`;
        }
    }]);

    cy.add({
        group: 'nodes',
        data: {
            id: 'root',
            header: 'PROJECT',
            selectedLine: projectTitle || 'ROOT',
            type: 'root'
        }
    });

    try {
        const response = await fetch(`/get_graph_nodes?project_id=${currentActiveProjectId}`);
        if (response.ok) {
            const res = await response.json();
            if (res.nodes && res.nodes.length > 0) {
                const elements = [];
                res.nodes.forEach(n => {
                    if (n.node_id === 'root') return;

                    elements.push({
                        group: 'nodes',
                        data: {
                            id: n.node_id,
                            header: n.label,
                            type: n.type,
                            content: n.content,
                            fullLog: n.full_log,
                            command: n.command,
                            status: n.status,
                            multiline: n.multiline,
                            selectedLine: n.selectedLine,
                            parentId: n.parent_id
                        }
                    });
                    if (n.parent_id) elements.push({ group: 'edges', data: { source: n.parent_id, target: n.node_id } });
                });
                cy.add(elements);
            }
        }
    } catch (e) { console.error("Error loading graph:", e); }

    const layout = cy.layout({ name: 'dagre', rankDir: 'LR', rankSep: 150, nodeSep: 50 });
    layout.run();
    setTimeout(() => { cy.fit(); cy.center(); }, 500);

    const existingBtn = document.getElementById('add-node-btn');
    if (existingBtn) existingBtn.remove();
    const addBtn = document.createElement('button');
    addBtn.id = 'add-node-btn'; addBtn.innerHTML = '<i class="fa fa-plus"></i> ADD TARGET';
    addBtn.onclick = () => { if (scanModal) scanModal.style.display = 'flex'; };
    graphContainer.appendChild(addBtn);

    cy.on('tap', 'node', function (evt) {
        const node = evt.target;
        const nodeType = node.data('type');
        const nodeContent = node.data('content');

        // Don't open modal if node is scanning
        if (nodeContent === 'Scanning...') return;

        if (node.id() === 'root' || nodeType === 'target') return;
        openNodeSelectionModal(node);
    });

    cy.on('cxttap', 'node', function (evt) {
        const node = evt.target;
        const nodeType = node.data('type');
        const nodeContent = node.data('content');

        // Don't show context menu if node is scanning
        if (nodeContent === 'Scanning...') return;

        if (node.id() === 'root') return;

        evt.preventDefault();
        evt.stopPropagation();

        contextNodeId = node.id();

        if (nodeType === 'target') {
            showTargetContextMenu(evt.originalEvent.clientX, evt.originalEvent.clientY);
        } else {
            if (graphContextMenu) {
                graphContextMenu.style.display = 'block';
                graphContextMenu.style.position = 'fixed';
                graphContextMenu.style.left = evt.originalEvent.clientX + 'px';
                graphContextMenu.style.top = evt.originalEvent.clientY + 'px';
            }
        }
    });

    cy.on('tap pan zoom', function (evt) {
        if (graphContextMenu) graphContextMenu.style.display = 'none';
    });
}

async function saveNodeToDB(node) {
    const data = node.data();
    await fetch('/save_node', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            node_id: node.id(),
            project_id: currentActiveProjectId,
            parent_id: data.parentId,
            label: data.header,
            type: data.type,
            content: data.content,
            selectedLine: data.selectedLine || data.content,
            full_log: data.fullLog,
            command: data.command,
            status: data.status,
            multiline: data.multiline
        })
    });
}

async function nodedata_read(node) {
    const node_id = node.id();
    const response = await fetch('/node_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: node_id })
    });

    if (response.ok) {
        const data = await response.json();

        node.data('type', data.type);
        node.data('content', data.content);
        node.data('fullLog', data.fullLog);
        node.data('command', data.command);
        node.data('status', data.status);
        node.data('multiline', data.multiline);
        node.data('selectedLine', data.selectedLine);

    }
}

async function openNodeSelectionModal(node) {

    await nodedata_read(node);

    currentNodeId = node.id();
    const data = node.data();

    if (nodeModalTitle) nodeModalTitle.innerHTML = `<i class="fa fa-list"></i> ${escapeHtml(data.header)} ${escapeHtml(data.multiline)}`;

    if (nodeFilteredList) {
        nodeFilteredList.innerHTML = '';

        let rawContent = String(data.content || '');

        if (data.multiline !== "0") {
            let tempArray = [];
            if (rawContent.trim().startsWith('[') && rawContent.trim().endsWith(']')) {
                try {
                    tempArray = rawContent
                        .slice(1, -1)
                        .split(',')
                        .map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                } catch (e) {
                    tempArray = [rawContent];
                }
            } else {
                tempArray = [rawContent];
            }

            let finalLines = [];
            tempArray.forEach(item => {
                let normalized = item.replace(/\\n/g, '\n');
                let parts = normalized.split(/\r?\n/);
                finalLines.push(...parts);
            });

            finalLines = finalLines.map(l => l.trim()).filter(l => l !== '');

            if (finalLines.length === 0) {
                nodeFilteredList.innerHTML = '<div style="padding:20px; color:#555;">No filtered results available.</div>';
            } else {
                finalLines.forEach(line => {
                    const div = document.createElement('div');
                    div.className = 'selection-item';
                    div.textContent = line;

                    if (line === data.selectedLine) div.classList.add('active');

                    div.addEventListener('dblclick', () => {
                        node.data('selectedLine', line);
                        node.data('content', data.content)
                        saveNodeToDB(node);
                        nodeContentModal.style.display = 'none';
                    });
                    nodeFilteredList.appendChild(div);
                });
            }

        }

        else {
            const div = document.createElement('div');
            div.className = 'full-content-view';

            div.textContent = rawContent.replace(/\\n/g, '\n');

            div.style.padding = '15px';
            div.style.fontFamily = 'monospace';
            div.style.whiteSpace = 'pre-wrap';
            div.style.wordBreak = 'break-word';
            div.style.cursor = 'pointer';
            div.style.border = '1px solid #333';
            div.style.backgroundColor = '#1a1a1a';
            div.title = "Double-click to select this entire block";

            if (data.selectedLine === rawContent) {
                div.style.borderColor = '#00e5ff';
                div.style.backgroundColor = '#003333';
            }

            div.addEventListener('dblclick', () => {
                node.data('selectedLine', rawContent);
                node.data('content', data.content);
                saveNodeToDB(node);
                nodeContentModal.style.display = 'none';
            });

            nodeFilteredList.appendChild(div);
        }
    }

    // Remove existing interceptor button if any
    const existingIntBtn = document.getElementById('open-interceptor-btn');
    if (existingIntBtn) existingIntBtn.remove();

    if (data.header && data.header.includes('SUBDOMAINS')) {
        const interceptorBtn = document.createElement('button');
        interceptorBtn.id = 'open-interceptor-btn';
        interceptorBtn.className = 'modal-btn modal-btn-secondary';
        interceptorBtn.style.fontSize = '11px';
        interceptorBtn.style.marginRight = '10px';
        interceptorBtn.innerHTML = '<i class="fa-brands fa-squarespace"></i> Open in Interceptor';

        interceptorBtn.onclick = async () => {
            if (!data.parentId) return alert("No parent target found.");

            const parentNode = cy.$('#' + data.parentId);
            // Parent content is usually the target domain
            const targetName = parentNode.data('content');

            let subdomains = [];
            const rawContent = String(data.content || '');

            if (rawContent.trim().startsWith('[')) {
                try {
                    // Replace single quotes with double quotes for valid JSON
                    const jsonStr = rawContent.replace(/'/g, '"');
                    subdomains = JSON.parse(jsonStr);
                } catch (e) {
                    // Fallback regex
                    subdomains = rawContent.match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];
                    if (subdomains.length === 0) subdomains = rawContent.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
                }
            } else {
                subdomains = rawContent.split('\n').map(s => s.trim()).filter(s => s);
            }

            if (subdomains.length === 0) return alert("No subdomains found to intercept.");

            interceptorBtn.disabled = true;
            interceptorBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Starting...';

            try {
                const resp = await fetch('/start_subdomain_interception', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target_name: targetName, subdomains: subdomains, node_id: data.id })
                });
                const res = await resp.json();
                if (res.success) {
                    // alert(res.message);
                    window.open(`/interceptor/${res.project_id}`, '_blank');
                } else {
                    alert("Error: " + res.message);
                }
            } catch (e) {
                alert("Error: " + e.message);
            } finally {
                interceptorBtn.disabled = false;
                interceptorBtn.innerHTML = '<i class="fa-brands fa-squarespace"></i> Open in Interceptor';
            }
        };

        const actionsDiv = nodeContentModal.querySelector('.modal-actions');
        if (actionsDiv) {
            actionsDiv.insertBefore(interceptorBtn, actionsDiv.firstChild);
        }
    }

    nodeContentModal.style.display = 'flex';
}

function openRawLogFromModal() {
    nodeContentModal.style.display = 'none';
    if (currentNodeId && cy) {
        const node = cy.$('#' + currentNodeId);
        showTerminalOutput(node.data('command'));
        if (terminalOutput && node.data('fullLog')) terminalOutput.innerHTML = buildTerminalPrompt(node.data('command')) + DOMPurify.sanitize(node.data('fullLog'));
    }
}

function showTerminalOutput(cmd) { if (terminalModal) terminalModal.style.display = 'flex'; }
function buildTerminalPrompt(command) {
    const safeCommand = command.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const line1 =
        `<span class="t-light">┌──</span>` +
        `<span class="t-white">(</span>` +
        `<span class="t-bright"><b>IHA089</b></span>` +
        `<span class="t-white">)</span>` +
        `<span class="t-white">-</span>` +
        `<span class="t-white">[</span>` +
        `<span class="t-bright"><b>Drana-Infinity</b></span>` +
        `<span class="t-white">]</span>\n`;

    const line2 =
        `<span class="t-light">└─$ </span>` +
        `<span class="t-white"><b>${safeCommand}</b></span>\n\n`;

    return line1 + line2;
}

function handleStartScan() {
    const target = document.getElementById('scan-target-input').value.trim();
    if (!target) return alert("Please enter a target.");
    scanModal.style.display = 'none';
    document.getElementById('scan-target-input').value = '';

    const targetId = 'target-' + Date.now();
    const targetNode = { group: 'nodes', data: { id: targetId, header: 'TARGET', content: target, type: 'target', filteredLines: [target], parentId: 'root' } };
    cy.add(targetNode);
    cy.add({ group: 'edges', data: { source: 'root', target: targetId } });
    saveNodeToDB(cy.$('#' + targetId));

    const startTool = (suffix, label, cmdType, cmdStr) => {
        const nid = targetId + suffix;
        const n = { group: 'nodes', data: { id: nid, header: label, content: 'Pending...', type: cmdType, parentId: targetId } };
        cy.add(n); cy.add({ group: 'edges', data: { source: targetId, target: nid } });
        saveNodeToDB(cy.$('#' + nid));
        setTimeout(() => runNodeScan(nid, cmdStr, cmdType), 200);
    };

    if (document.getElementById('opt-ports').checked) startTool('_port', 'PORTS', 'PORTSCAN', `${target}`);
    if (document.getElementById('opt-subdomain').checked) startTool('_sub', 'SUBDOMAINS', 'SUBDOMAIN', `${target}`);
    if (document.getElementById('opt-tech').checked) startTool('_tech', 'TECHNOLOGY', 'WEBTECH', `${target}`);
    if (document.getElementById('opt-waf').checked) startTool('_waf', 'WAF', 'WAF', `${target}`);
    if (document.getElementById('opt-urls').checked) startTool('_urls', 'URLS', 'GETURL', `${target}`);


    cy.layout({ name: 'dagre', rankDir: 'LR', rankSep: 150, fit: false }).run();
}

async function runNodeScan(nodeId, command, scanType) {
    const node = cy.$(`#${nodeId}`);
    node.data('content', 'Scanning...');
    node.data('status', 'pending');
    node.data('command', command);

    try {
        const response = await fetch('/execute_scan_stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: command, scanType: scanType, model: modelSelect.value })
        });

        if (!response.ok) throw new Error("Network response was not ok");

        const result = await response.json();

        console.log("DEBUG: Result from Python:", result);
        console.log("DEBUG: Multiline value:", result.multiline, "Type:", typeof result.multiline);

        node.data('multiline', result.multiline);

        node.data('fullLog', result.fullLog);
        node.data('filteredLines', result.filteredLines);

        if (result.multiline) {
            node.data('content', result.filteredLines);
        } else {
            if (result.filteredLines) {
                node.data('content', result.filteredLines);
            }
            else {
                node.data('content', 'No Results');
            }
        }

        node.data('status', 'success');
        saveNodeToDB(node);

    } catch (err) {
        console.error(err);
        node.data('status', 'error');
        node.data('content', 'FAILED');
        node.data('fullLog', 'Error during execution:\n' + err);
        saveNodeToDB(node);
    }
}

function parseOutputToLines(type, text) {
    if (!text) return [];
    const lines = text.split('\n');
    let clean = [];
    if (type === 'Ports') clean = lines.filter(l => l.includes('/tcp') && l.includes('open'));
    else if (type === 'Subdomains') clean = lines.filter(l => l.includes('.') && !l.includes('Enumerating') && !l.startsWith('['));
    else if (type === 'Technology') clean = lines.filter(l => l.startsWith('http') || l.includes('['));
    else clean = lines.filter(l => l.trim().length > 5 && !l.startsWith('['));
    return clean.map(l => l.trim().substring(0, 50));
}

async function handleRenameNode() {
    if (!contextNodeId || !renameNodeModal) return;
    const newName = nodeRenameInput.value.trim();
    if (newName) {
        const node = cy.$('#' + contextNodeId);
        node.data('header', newName);
        await saveNodeToDB(node);
        renameNodeModal.style.display = 'none';

        node.style('label', newName);
    }
}

async function handleDeleteNode(nodeId) {
    if (!nodeId) return;
    if (nodeId === 'root') { alert("Cannot delete Root node."); return; }

    const deleteNodeModal = document.getElementById('delete-node-modal');
    const deleteNodeName = document.getElementById('delete-node-name');

    if (deleteNodeModal && deleteNodeName && cy) {
        nodeToDeleteId = nodeId;
        const node = cy.$('#' + nodeId);
        deleteNodeName.textContent = node.data('header') || 'Unknown Node';
        deleteNodeModal.style.display = 'flex';
    }
}

async function confirmDeleteNode() {
    if (!nodeToDeleteId) return;

    try {
        const node = cy.$('#' + nodeToDeleteId);
        const descendants = node.successors('node');
        const batchToDelete = descendants.add(node);

        for (let i = 0; i < batchToDelete.length; i++) {
            const n = batchToDelete[i];
            await fetch('/delete_node', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_id: n.id(), project_id: currentActiveProjectId })
            });
        }

        cy.remove(batchToDelete);

        const deleteNodeModal = document.getElementById('delete-node-modal');
        if (deleteNodeModal) deleteNodeModal.style.display = 'none';

    } catch (e) {
        console.error(e);
        alert("Error deleting nodes.");
    }

    nodeToDeleteId = null;
}

async function handleCreateManualNode() {
    if (!contextNodeId) return;

    const label = manualNodeLabelInput.value.trim();
    const content = manualNodeContentInput.value.trim();

    if (!label) { alert("Label is required."); return; }

    const newNodeId = 'manual-' + Date.now();
    const newNode = {
        group: 'nodes',
        data: {
            id: newNodeId,
            header: label,
            content: 'Generating Command...',
            type: 'manual',
            parentId: contextNodeId,
            status: 'pending',
            selectedLine: 'Generating Command...'
        }
    };

    cy.add(newNode);
    cy.add({ group: 'edges', data: { source: contextNodeId, target: newNodeId } });

    const layout = cy.layout({
        name: 'dagre',
        rankDir: 'LR',
        rankSep: 150,
        nodeSep: 50,
        fit: false
    });
    layout.run();

    await saveNodeToDB(cy.$('#' + newNodeId));

    if (addManualNodeModal) addManualNodeModal.style.display = 'none';

    setTimeout(() => runManualNodeAI(newNodeId, content, label, contextNodeId), 200);
}

async function runManualNodeAI(nodeId, userDescription, label, parentId) {
    const node = cy.$(`#${nodeId}`);
    
    // Get ALL ancestors for context
    let ancestors = [];
    let currentId = parentId;
    while (currentId && currentId !== 'root') {
        const pNode = cy.$(`#${currentId}`);
        if(pNode.length === 0) break;
        
        ancestors.unshift({ // Prepend so it goes root -> child
            id: currentId,
            header: pNode.data('header'),
            type: pNode.data('type'),
            content: pNode.data('selectedLine') || pNode.data('content'),
            command: pNode.data('command'),
            fullLog: pNode.data('fullLog')
        });
        currentId = pNode.data('parentId');
    }

    try {
        const response = await fetch('/execute_manual_node_ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                description: userDescription, 
                label: label, 
                ancestors: ancestors,
                projectId: currentActiveProjectId,
                model: modelSelect ? modelSelect.value : 'llama3'
            })
        });

        if (!response.ok) throw new Error("Network response was not ok");

        const result = await response.json();

        node.data('multiline', result.multiline);
        node.data('fullLog', result.fullLog);
        node.data('filteredLines', result.filteredLines);
        node.data('command', result.command);

        if (result.multiline) {
            node.data('content', result.filteredLines);
            node.data('selectedLine', result.filteredLines);
        } else {
            if (result.filteredLines) {
                node.data('content', result.filteredLines);
                node.data('selectedLine', result.filteredLines);
            } else {
                node.data('content', 'No Results');
                node.data('selectedLine', 'No Results');
            }
        }

        node.data('status', 'success');
        await saveNodeToDB(node);

    } catch (err) {
        console.error(err);
        node.data('status', 'error');
        node.data('content', 'FAILED');
        node.data('selectedLine', 'FAILED');
        node.data('fullLog', 'Error during execution:\n' + err);
        await saveNodeToDB(node);
    }
}