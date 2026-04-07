/* DRANA-INFINITY FRONTEND SCRIPT */

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
const confirmDeleteProjectBtn = document.getElementById('confirm-delete-btn');
const deleteProjectTitle = document.getElementById('delete-project-title');
const webSearchBtn = document.getElementById('web-search-btn');

const graphContainer = document.getElementById('graph-container'); 
const scanModal = document.getElementById('scan-setup-modal');
const startScanBtn = document.getElementById('start-scan-btn');
const closeScanModalBtn = document.getElementById('close-scan-modal-btn');
const cancelScanBtn = document.getElementById('cancel-scan-btn');

// Node Selection Popup
const nodeContentModal = document.getElementById('node-content-modal');
const nodeFilteredList = document.getElementById('node-filtered-list');
const closeNodeModalBtn = document.getElementById('close-node-modal-btn');
const nodeModalTitle = document.getElementById('node-modal-title');
const viewRawLogBtn = document.getElementById('view-raw-log-btn');

// Context Menu & New Modals References
const graphContextMenu = document.getElementById('graph-context-menu');
const ctxNewNodeBtn = document.getElementById('ctx-new-node');
const ctxRenameNodeBtn = document.getElementById('ctx-rename-node');
const ctxDeleteNodeBtn = document.getElementById('ctx-delete-node');

// Rename Node Modal
const renameNodeModal = document.getElementById('rename-node-modal');
const nodeRenameInput = document.getElementById('node-rename-input');
const closeRenameNodeBtn = document.getElementById('close-rename-node-btn');
const cancelRenameNodeBtn = document.getElementById('cancel-rename-node-btn');
const confirmRenameNodeBtn = document.getElementById('confirm-rename-node-btn');

// Manual Node Modal
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
let currentActiveProjectType = null; // Track project type globally
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

// Function to inject the Delete Node Modal HTML
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

function attachStaticListeners() {
  if (toggleBtn) toggleBtn.addEventListener('click', () => { sidebar.classList.add('hide'); floatToggle.style.display = 'block'; });
  if (floatToggle) floatToggle.addEventListener('click', () => { sidebar.classList.remove('hide'); floatToggle.style.display = 'none'; });
  if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  
  // Settings Logic
  if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
          const username = userInfoDisplay.textContent ? userInfoDisplay.textContent.replace('User: ', '').trim() : 'Guest';
          if(settingsUsername) settingsUsername.textContent = username;
          if(settingsModal) settingsModal.style.display = 'flex';
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
              const node = cy.$('#'+currentNodeId);
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

  // --- LISTENERS FOR GRAPH CONTEXT MENU & MODALS ---

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
      if(graphContextMenu) graphContextMenu.style.display = 'none';
      if(contextNodeId) {
          if(manualNodeLabelInput) manualNodeLabelInput.value = '';
          if(manualNodeContentInput) manualNodeContentInput.value = '';
          if(addManualNodeModal) addManualNodeModal.style.display = 'flex';
      }
  });

  if (ctxRenameNodeBtn) ctxRenameNodeBtn.addEventListener('click', () => {
      if(graphContextMenu) graphContextMenu.style.display = 'none';
      if(contextNodeId && cy) {
          const node = cy.$('#' + contextNodeId);
          if(nodeRenameInput) nodeRenameInput.value = node.data('header');
          if(renameNodeModal) renameNodeModal.style.display = 'flex';
      }
  });

  if (ctxDeleteNodeBtn) ctxDeleteNodeBtn.addEventListener('click', () => {
      if(graphContextMenu) graphContextMenu.style.display = 'none';
      if(contextNodeId) handleDeleteNode(contextNodeId);
  });

  if (closeRenameNodeBtn) closeRenameNodeBtn.addEventListener('click', () => { if(renameNodeModal) renameNodeModal.style.display = 'none'; });
  if (cancelRenameNodeBtn) cancelRenameNodeBtn.addEventListener('click', () => { if(renameNodeModal) renameNodeModal.style.display = 'none'; });
  if (confirmRenameNodeBtn) confirmRenameNodeBtn.addEventListener('click', handleRenameNode);

  if (closeManualNodeBtn) closeManualNodeBtn.addEventListener('click', () => { if(addManualNodeModal) addManualNodeModal.style.display = 'none'; });
  if (cancelManualNodeBtn) cancelManualNodeBtn.addEventListener('click', () => { if(addManualNodeModal) addManualNodeModal.style.display = 'none'; });
  if (confirmManualNodeBtn) confirmManualNodeBtn.addEventListener('click', handleCreateManualNode);

  const closeDeleteNodeBtn = document.getElementById('close-delete-node-btn');
  const cancelDeleteNodeBtn = document.getElementById('cancel-delete-node-btn');
  const confirmDeleteNodeBtn = document.getElementById('confirm-delete-node-btn');
  const deleteNodeModal = document.getElementById('delete-node-modal');

  if (closeDeleteNodeBtn) closeDeleteNodeBtn.addEventListener('click', () => { if(deleteNodeModal) deleteNodeModal.style.display = 'none'; });
  if (cancelDeleteNodeBtn) cancelDeleteNodeBtn.addEventListener('click', () => { if(deleteNodeModal) deleteNodeModal.style.display = 'none'; });
  if (confirmDeleteNodeBtn) confirmDeleteNodeBtn.addEventListener('click', confirmDeleteNode);
}

function updateUIForMode() {
  if (!headerTitle) return;
  headerTitle.textContent = 'Drana-Infinity';
  if(newChatBtn) newChatBtn.style.display = 'none';
  if(newProjectBtn) newProjectBtn.style.display = 'none';
  if(viewProjectsBtn) viewProjectsBtn.style.display = 'none';
  if(graphContainer) graphContainer.style.display = 'none';
  if(messagesContainer) messagesContainer.style.display = 'flex';
  if(document.getElementById('input-area')) document.getElementById('input-area').style.display = 'flex';

  if (currentPageMode === 'projects') {
      if (listTitleHeader) listTitleHeader.textContent = 'Projects';
      if (newProjectBtn) newProjectBtn.style.display = 'block';
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

function displayUserInfo(u) { if(userInfoDisplay) userInfoDisplay.textContent=u; if(settingsBtn) settingsBtn.style.display='block'; }
async function fetchModels() { try { const r=await fetch('/get_models'); if(r.ok) { const d=await r.json(); if(modelSelect) d.models.forEach(m=>{ let o=document.createElement('option'); o.value=m; o.textContent=m; modelSelect.appendChild(o); }); } } catch(e){} finally { loadSidebarData(); } }

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
            // Track project type and enable "Click Title to View Flow"
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
    if(chatList) chatList.innerHTML = '';
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
  if (type === 'web_app_testing') titleSpan.innerHTML = `<i class="fa fa-crosshairs" style="color:#0ff; margin-right:5px; font-size:10px;"></i> ${title}`;
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
    
    // [FIX] Switch to Chat Mode if we are currently in Graph Mode
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
  const body = JSON.stringify({ message: message, chat_id: activeChatId, model_name: modelSelect.value });
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
  if(sender === 'ai') msgRow.innerHTML = `<div class="message">${DOMPurify.sanitize(marked.parse(text))}</div>`; 
  else msgRow.innerHTML = `<div class="message">${text}</div>`; 
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
    if(titleElement) {
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
    if(titleElement) {
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

/* --- GRAPH LOGIC --- */

function switchToChatMode() {
    graphContainer.style.display = 'none';
    messagesContainer.style.display = 'flex';
    // [FIX] Ensure input area is visible when switching back to chat
    if(document.getElementById('input-area')) document.getElementById('input-area').style.display = 'flex';
}

function switchToGraphMode(projectTitle) {
    messagesContainer.style.display = 'none';
    if(document.getElementById('input-area')) document.getElementById('input-area').style.display = 'none';
    graphContainer.style.display = 'block';
    initGraph(projectTitle);
}

async function initGraph(projectTitle) {
    if (cy) cy.destroy();
    try { if (typeof cytoscapeDagre !== 'undefined') cytoscape.use(cytoscapeDagre); if (typeof cytoscapeNodeHtmlLabel !== 'undefined') cytoscapeNodeHtmlLabel(cytoscape); } catch(e) { }

    cy = cytoscape({
        container: graphContainer,
        boxSelectionEnabled: false,
        autounselectify: true,
        wheelSensitivity: 0.1, minZoom: 0.2, maxZoom: 2.5,
        style: [
            { selector: 'node', style: { 'width': '220px', 'height': '70px', 'shape': 'rectangle', 'background-opacity': 0, 'border-width': 0 } },
            { selector: 'edge', style: { 'width': 1.5, 'line-color': '#00e5ff', 'target-arrow-color': '#00e5ff', 'target-arrow-shape': 'triangle', 'curve-style': 'taxi', 'taxi-direction': 'rightward' } }
        ],
        layout: { name: 'dagre', rankDir: 'LR', rankSep: 150, nodeSep: 50 }
    });

    cy.nodeHtmlLabel([{
        query: 'node', valign: "center", halign: "center",
        tpl: function(data) {
            let css = 'cyber-node-wrapper';
            if(data.status === 'success') css += ' success-border';
            if(data.status === 'error') css += ' error-border';
            if(data.type === 'root') css += ' root-node-style';
            return `<div class="${css}"><div class="node-header">${data.header||'NODE'}</div><div class="node-content">${data.selectedLine||data.content||'[Pending]'}</div></div>`;
        }
    }]);

    // [FIX]: Always Add Root Node First
    cy.add({ 
        group: 'nodes', 
        data: { 
            id: 'root', 
            header: 'PROJECT', 
            content: projectTitle || 'ROOT', 
            type: 'root' 
        } 
    });

    try {
        const response = await fetch(`/get_graph_nodes?project_id=${currentActiveProjectId}`);
        if(response.ok) {
            const res = await response.json();
            if(res.nodes && res.nodes.length > 0) {
                const elements = [];
                res.nodes.forEach(n => {
                    // Skip if root, we already added it
                    if(n.node_id === 'root') return; 
                    
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
                            selectedLine: n.content,
                            parentId: n.parent_id, // [CRITICAL FIX] Ensure parentId is restored to internal data
                            filteredLines: parseOutputToLines(n.type, n.full_log || '')
                        }
                    });
                    if(n.parent_id) elements.push({ group: 'edges', data: { source: n.parent_id, target: n.node_id } });
                });
                cy.add(elements);
            }
        }
    } catch(e) { console.error("Error loading graph:", e); }

    // [FIX] Force Layout & Center after everything is added
    const layout = cy.layout({ name: 'dagre', rankDir: 'LR', rankSep: 150, nodeSep: 50 });
    layout.run();
    setTimeout(() => { cy.fit(); cy.center(); }, 500);

    const existingBtn = document.getElementById('add-node-btn');
    if(existingBtn) existingBtn.remove();
    const addBtn = document.createElement('button');
    addBtn.id = 'add-node-btn'; addBtn.innerHTML = '<i class="fa fa-plus"></i> ADD TARGET';
    addBtn.onclick = () => { if(scanModal) scanModal.style.display = 'flex'; };
    graphContainer.appendChild(addBtn);

    // Left Click - Open Details
    cy.on('tap', 'node', function(evt){
        const node = evt.target;
        if(node.id() === 'root') return;
        openNodeSelectionModal(node);
    });

    // [UPDATED] Right Click - Open Custom Context Menu
    cy.on('cxttap', 'node', function(evt){
        evt.preventDefault(); // prevent default browser menu
        evt.stopPropagation(); // keep event local
        
        const node = evt.target;
        contextNodeId = node.id(); 

        if(graphContextMenu) {
            // Reset display to ensure correct positioning calculation if needed
            graphContextMenu.style.display = 'block';
            
            // [FIX] Use FIXED positioning to ignore parent offsets and use raw clientX/Y
            graphContextMenu.style.position = 'fixed'; 
            graphContextMenu.style.left = evt.originalEvent.clientX + 'px';
            graphContextMenu.style.top = evt.originalEvent.clientY + 'px';
        }
    });

    // [UPDATED] Close menu on graph interactions (pan/zoom/tap background)
    cy.on('tap pan zoom', function(evt){
        if(graphContextMenu) graphContextMenu.style.display = 'none';
    });
}

async function saveNodeToDB(node) {
    const data = node.data();
    await fetch('/save_node', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            node_id: node.id(), 
            project_id: currentActiveProjectId, 
            parent_id: data.parentId, // [CRITICAL FIX] Now properly sends parentId
            label: data.header, 
            type: data.type, 
            content: data.selectedLine || data.content,
            full_log: data.fullLog, 
            command: data.command, 
            status: data.status
        })
    });
}

function openNodeSelectionModal(node) {
    currentNodeId = node.id();
    const data = node.data();
    if(nodeModalTitle) nodeModalTitle.innerHTML = `<i class="fa fa-list"></i> ${data.header}`;
    if(nodeFilteredList) {
        nodeFilteredList.innerHTML = '';
        const lines = data.filteredLines || [];
        if (lines.length === 0) nodeFilteredList.innerHTML = '<div style="padding:20px; color:#555;">No filtered results available.</div>';
        else {
            lines.forEach(line => {
                const div = document.createElement('div');
                div.className = 'selection-item';
                div.textContent = line;
                if (line === data.selectedLine) div.classList.add('active');
                div.addEventListener('dblclick', () => {
                    node.data('selectedLine', line); 
                    saveNodeToDB(node); 
                    nodeContentModal.style.display = 'none';
                });
                nodeFilteredList.appendChild(div);
            });
        }
    }
    nodeContentModal.style.display = 'flex';
}

function openRawLogFromModal() {
    nodeContentModal.style.display = 'none';
    if(currentNodeId && cy) {
        const node = cy.$('#'+currentNodeId);
        showTerminalOutput(node.data('command'));
        if(terminalOutput && node.data('fullLog')) terminalOutput.innerHTML = buildTerminalPrompt(node.data('command')) + DOMPurify.sanitize(node.data('fullLog'));
    }
}

function showTerminalOutput(cmd) { if(terminalModal) terminalModal.style.display='flex'; }
function buildTerminalPrompt(cmd) { return `> ${cmd}\n`; }

function handleStartScan() {
    const target = document.getElementById('scan-target-input').value.trim();
    if (!target) return alert("Please enter a target.");
    scanModal.style.display = 'none';
    document.getElementById('scan-target-input').value = '';
    
    // [FIX] Ensure we pass 'root' as parentId explicitly
    const targetId = 'target-' + Date.now();
    const targetNode = { group: 'nodes', data: { id: targetId, header: 'TARGET', content: target, type: 'target', filteredLines: [target], parentId: 'root' } };
    cy.add(targetNode); 
    cy.add({ group: 'edges', data: { source: 'root', target: targetId } });
    saveNodeToDB(cy.$('#'+targetId)); 

    const startTool = (suffix, label, cmdType, cmdStr) => {
        const nid = targetId + suffix;
        const n = { group: 'nodes', data: { id: nid, header: label, content: 'Pending...', type: cmdType, parentId: targetId } };
        cy.add(n); cy.add({ group: 'edges', data: { source: targetId, target: nid } });
        saveNodeToDB(cy.$('#'+nid));
        setTimeout(() => runNodeScan(nid, cmdStr, cmdType), 200);
    };

    if (document.getElementById('opt-ports').checked) startTool('_port', 'PORTS', 'Ports', `nmap -F ${target}`);
    if (document.getElementById('opt-subdomain').checked) startTool('_sub', 'SUBDOMAINS', 'Subdomains', `subfinder -d ${target} -silent`);
    if (document.getElementById('opt-tech').checked) startTool('_tech', 'TECHNOLOGY', 'Technology', `whatweb ${target} --color=never --no-errors`);
    if (document.getElementById('opt-waf').checked) startTool('_waf', 'WAF', 'WAF', `wafw00f ${target}`);

    cy.layout({ name: 'dagre', rankDir: 'LR', rankSep: 150 }).run();
}

async function runNodeScan(nodeId, command, scanType) {
    const node = cy.$(`#${nodeId}`);
    node.data('content', 'Scanning...');
    node.data('status', 'pending');
    node.data('command', command);
    let accumulatedLog = "";
    try {
        const response = await fetch('/execute_scan_stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: command }) });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulatedLog += decoder.decode(value, { stream: true });
            const lines = parseOutputToLines(scanType, accumulatedLog);
            node.data('filteredLines', lines);
            node.data('fullLog', accumulatedLog);
            if(lines.length > 0) { node.data('content', lines[lines.length - 1]); node.data('selectedLine', lines[lines.length - 1]); }
        }
        node.data('status', 'success');
        const finalLines = parseOutputToLines(scanType, accumulatedLog);
        if(finalLines.length === 0) node.data('content', 'No Results');
        saveNodeToDB(node);
    } catch (err) {
        node.data('status', 'error'); node.data('content', 'FAILED'); node.data('fullLog', accumulatedLog + '\nError: ' + err); saveNodeToDB(node);
    }
}

function parseOutputToLines(type, text) {
    if(!text) return [];
    const lines = text.split('\n');
    let clean = [];
    if (type === 'Ports') clean = lines.filter(l => l.includes('/tcp') && l.includes('open'));
    else if (type === 'Subdomains') clean = lines.filter(l => l.includes('.') && !l.includes('Enumerating') && !l.startsWith('['));
    else if (type === 'Technology') clean = lines.filter(l => l.startsWith('http') || l.includes('['));
    else clean = lines.filter(l => l.trim().length > 5 && !l.startsWith('['));
    return clean.map(l => l.trim().substring(0, 50)); 
}

// --- [NEW] HELPER FUNCTIONS FOR CONTEXT MENU ACTIONS ---

async function handleRenameNode() {
    if (!contextNodeId || !renameNodeModal) return;
    const newName = nodeRenameInput.value.trim();
    if (newName) {
        const node = cy.$('#' + contextNodeId);
        node.data('header', newName); // Update local Cytoscape data
        await saveNodeToDB(node); // Update Database
        renameNodeModal.style.display = 'none';
        
        // Refresh label in view (Cytoscape usually handles data binding automatically with nodeHtmlLabel, 
        // but explicit style updates sometimes help)
        node.style('label', newName); 
    }
}

async function handleDeleteNode(nodeId) {
    if(!nodeId) return;
    if(nodeId === 'root') { alert("Cannot delete Root node."); return; }
    
    // [UPDATED] Show Custom Popup instead of Alert
    const deleteNodeModal = document.getElementById('delete-node-modal');
    const deleteNodeName = document.getElementById('delete-node-name');
    
    if (deleteNodeModal && deleteNodeName && cy) {
        nodeToDeleteId = nodeId; // Set global ID to delete
        const node = cy.$('#' + nodeId);
        deleteNodeName.textContent = node.data('header') || 'Unknown Node';
        deleteNodeModal.style.display = 'flex';
    }
}

// [NEW] Actual Deletion Logic (called from Modal)
async function confirmDeleteNode() {
    if(!nodeToDeleteId) return;
    
    try {
        // 1. Identify all nodes to delete (Target + Descendants)
        const node = cy.$('#' + nodeToDeleteId);
        const descendants = node.successors('node');
        const batchToDelete = descendants.add(node);

        // 2. Delete from Database sequentially
        for(let i = 0; i < batchToDelete.length; i++) {
                const n = batchToDelete[i];
                await fetch('/delete_node', {
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ node_id: n.id(), project_id: currentActiveProjectId })
            });
        }

        // 3. Remove from Graph View
        cy.remove(batchToDelete);

        // 4. Close Modal
        const deleteNodeModal = document.getElementById('delete-node-modal');
        if (deleteNodeModal) deleteNodeModal.style.display = 'none';

    } catch(e) {
        console.error(e);
        alert("Error deleting nodes.");
    }
    
    nodeToDeleteId = null; // Reset
}

async function handleCreateManualNode() {
    if(!contextNodeId) return;
    
    const label = manualNodeLabelInput.value.trim();
    const content = manualNodeContentInput.value.trim();
    
    if(!label) { alert("Label is required."); return; }
    
    const newNodeId = 'manual-' + Date.now();
    const newNode = {
        group: 'nodes',
        data: {
            id: newNodeId,
            header: label,
            content: content || 'Manual Node',
            type: 'manual',
            parentId: contextNodeId,
            status: 'success', 
            selectedLine: content
        }
    };
    
    // Add to Cytoscape
    cy.add(newNode);
    cy.add({ group: 'edges', data: { source: contextNodeId, target: newNodeId } });
    
    // Run layout again to organize
    // [FIX] Added fit: false to prevent graph from resizing/resetting zoom
    const layout = cy.layout({ 
        name: 'dagre', 
        rankDir: 'LR', 
        rankSep: 150, 
        nodeSep: 50,
        fit: false 
    });
    layout.run();
    
    // Save to DB
    await saveNodeToDB(cy.$('#'+newNodeId));
    
    // Close modal
    if(addManualNodeModal) addManualNodeModal.style.display = 'none';
}