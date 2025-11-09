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
const sidebarLinks = document.getElementById('sidebar-links');
const newBtn = document.getElementById('new-chat-btn'); 

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

let activeChatId = null;
let isChatReady = false;
let currentCommand = "";
let currentAttachedFile = null; 
let currentPageMode = 'chats'; 
let currentActiveProjectId = null;
let currentActiveProjectTitle = null; 


document.addEventListener('DOMContentLoaded', () => {
  const contextDiv = document.getElementById('page-context');
  currentPageMode = contextDiv.dataset.pageMode;
  currentActiveProjectId = contextDiv.dataset.activeProjectId;
  currentActiveProjectTitle = contextDiv.dataset.activeProjectTitle; 
  
  if (currentActiveProjectId === 'null') {
    currentActiveProjectId = null;
  }
  if (currentActiveProjectTitle === 'null') { 
    currentActiveProjectTitle = null;
  }

  updateUIForMode();
  checkUserSession();
  attachStaticListeners();
});

function attachStaticListeners() {
  toggleBtn.addEventListener('click', () => { sidebar.classList.add('hide'); floatToggle.style.display = 'block'; });
  floatToggle.addEventListener('click', () => { sidebar.classList.remove('hide'); floatToggle.style.display = 'none'; });
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileUpload); 
  sendBtn.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keydown', e => { 
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); 
      handleSendMessage();
      chatInput.style.height = 'auto'; 
    }
  });

  loginBtn.addEventListener('click', handleLogin);
  chatInput.addEventListener('input', autoResizeInput);

  settingsBtn.addEventListener('click', () => {
      const username = userInfoDisplay.textContent.replace('User: ', '').trim();
      settingsUsername.textContent = username || 'Guest';
      settingsModal.style.display = 'flex';
  });
  closeSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
  logoutBtn.addEventListener('click', () => {
      document.cookie = "user_hash=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      location.reload();
  });

  closeTerminalBtn.addEventListener('click', () => { terminalModal.style.display = 'none'; });
  rerunBtn.addEventListener('click', handleRerun);
  copyOutputBtn.addEventListener('click', handleCopyOutput);
  saveOutputBtn.addEventListener('click', handleSaveOutput);

  closeRenameBtn.addEventListener('click', () => { renameModal.style.display = 'none'; });
  cancelRenameBtn.addEventListener('click', () => { renameModal.style.display = 'none'; });
  confirmRenameBtn.addEventListener('click', () => {
      const chatId = confirmRenameBtn.dataset.chatId;
      const newTitle = renameInput.value.trim();
      if (chatId && newTitle) {
          renameChat(chatId, newTitle);
          renameModal.style.display = 'none';
      }
  });
  closeDeleteBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
  cancelDeleteBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
  confirmDeleteBtn.addEventListener('click', () => {
      const chatId = confirmDeleteBtn.dataset.chatId;
      if (chatId) {
          deleteChat(chatId);
          deleteModal.style.display = 'none';
      }
  });
  
  closeNewProjectBtn.addEventListener('click', () => { newProjectModal.style.display = 'none'; });
  cancelNewProjectBtn.addEventListener('click', () => { newProjectModal.style.display = 'none'; });
  confirmNewProjectBtn.addEventListener('click', createNewProject);

  closeRenameProjectBtn.addEventListener('click', () => { renameProjectModal.style.display = 'none'; });
  cancelRenameProjectBtn.addEventListener('click', () => { renameProjectModal.style.display = 'none'; });
  confirmRenameProjectBtn.addEventListener('click', () => {
      const projectId = confirmRenameProjectBtn.dataset.projectId;
      const newTitle = renameProjectInput.value.trim();
      if (projectId && newTitle) {
          renameProject(projectId, newTitle);
          renameProjectModal.style.display = 'none';
      }
  });

  closeDeleteProjectBtn.addEventListener('click', () => { deleteProjectModal.style.display = 'none'; });
  cancelDeleteProjectBtn.addEventListener('click', () => { deleteProjectModal.style.display = 'none'; });
  confirmDeleteProjectBtn.addEventListener('click', () => {
      const projectId = confirmDeleteProjectBtn.dataset.projectId;
      if (projectId) {
          deleteProject(projectId);
          deleteProjectModal.style.display = 'none';
      }
  });
}

function updateUIForMode() {
  newBtn.removeEventListener('click', createNewChatHandler);
  newBtn.removeEventListener('click', () => { newProjectModal.style.display = 'flex'; });

  headerTitle.textContent = 'Drana-Infinity';

  if (currentPageMode === 'projects') {
      listTitleHeader.textContent = 'Projects';
      sidebarLinks.innerHTML = `<a href="/"><i class="fa fa-comments"></i> Chats</a>`;
      newBtn.innerHTML = '<i class="fa fa-plus"></i> New Project';
      newBtn.addEventListener('click', () => { newProjectModal.style.display = 'flex'; });
      messagesContainer.innerHTML = `<div class="welcome-message"><h2>Select a project from the sidebar to view its chats, or create a new one.</h2></div>`;
      document.getElementById('input-area').style.display = 'none';
      
  } else if (currentPageMode === 'project_detail') {
      listTitleHeader.textContent = currentActiveProjectTitle || 'Project';
      sidebarLinks.innerHTML = `<a href="/projects"><i class="fa fa-folder"></i> All Projects</a>`;
      newBtn.innerHTML = '<i class="fa fa-plus"></i> New Chat';
      newBtn.addEventListener('click', createNewChatHandler);
      messagesContainer.innerHTML = '';
      document.getElementById('input-area').style.display = 'flex';
      
  } else { 
      listTitleHeader.textContent = 'Chats';
      sidebarLinks.innerHTML = `<a href="/projects"><i class="fa fa-folder"></i> Projects</a>`;
      newBtn.innerHTML = '<i class="fa fa-plus"></i> New Chat';
      newBtn.addEventListener('click', createNewChatHandler);
      messagesContainer.innerHTML = '';
      document.getElementById('input-area').style.display = 'flex';
  }
}

function autoResizeInput() {
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

async function checkUserSession() {
  try {
    const response = await fetch('/get_user_info');
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        displayUserInfo(data.username);
        fetchModels(); 
      } else {
        loginModal.style.display = 'flex';
      }
    } else {
      loginModal.style.display = 'flex';
    }
  } catch (err) {
    console.error('Error checking user session:', err);
    loginModal.style.display = 'flex';
  }
}

async function handleLogin() {
  const username = usernameInput.value.trim();
  if (!username) return;

  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });

  if (response.ok) {
    const data = await response.json();
    displayUserInfo(data.username);
    loginModal.style.display = 'none';
    fetchModels(); 
  } else {
    console.error('Login failed.');
  }
}

function displayUserInfo(username) {
  userInfoDisplay.textContent = `User: ${username}`;
  settingsBtn.style.display = 'block';
}

async function fetchModels() {
  try {
    const response = await fetch('/get_models');
    if (response.ok) {
      const data = await response.json();
      modelSelect.innerHTML = '';
      data.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });

      if (data.models.length > 0) {
        modelSelect.value = data.models[0]; 
      }

    } else {
      console.error('Failed to fetch models.');
    }
  } catch (err) {
    console.error('Error fetching models:', err);
  } finally {
    loadSidebarData();
  }
}

async function loadSidebarData() {
  chatList.innerHTML = ''; 
  
  if (currentPageMode === 'projects') {
    await loadProjects();
  } else if (currentPageMode === 'project_detail') {
    await loadChats(currentActiveProjectId);
  } else { 
    await loadChats(null); 
  }
}

async function loadProjects() {
  const response = await fetch('/get_projects');
  if (response.ok) {
    const data = await response.json();
    data.projects.forEach(proj => createProjectItem(proj.project_id, proj.title));
  } else {
    console.error('Failed to load projects.');
  }
}

async function loadChats(projectId) {
  let url = '/get_chats';
  if (projectId) {
      url += `?project_id=${projectId}`;
  }

  const response = await fetch(url);
  
  if (response.ok) {
    const data = await response.json();
    chatList.innerHTML = '';
    data.chats.forEach(chat => createChatItem(chat.chat_id, chat.title, chat.model_name));
    
    if (currentPageMode !== 'projects') {
      const currentActiveChatExists = data.chats.some(chat => chat.chat_id === activeChatId);
      
      if (activeChatId && currentActiveChatExists) {
        setActiveChat(activeChatId);
        loadChatMessages(activeChatId);
        isChatReady = true;
      } else if (data.chats.length > 0) {
        const latestChat = data.chats[0];
        setActiveChat(latestChat.chat_id);
        if (latestChat.model_name) {
            modelSelect.value = latestChat.model_name;
        }
        loadChatMessages(latestChat.chat_id);
        isChatReady = true;
      } else {
        messagesContainer.innerHTML = '';
        activeChatId = null;
        isChatReady = true; 
      }
    }
  } else {
    console.error('Failed to load chats.');
  }
}

async function loadChatMessages(chatId) {
  messagesContainer.innerHTML = '';
  
  const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
  if (chatItem && chatItem.dataset.modelName) {
      modelSelect.value = chatItem.dataset.modelName;
  }

  const response = await fetch('/get_chat_messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId })
  });

  if (response.ok) {
    const data = await response.json();
    data.messages.forEach(msg => {
        const fileInfo = (msg.file_path && msg.file_name) 
            ? { file_path: msg.file_path, file_name: msg.file_name } 
            : null;
        appendMessage(msg.text, msg.sender, true, fileInfo);
    });
    addTerminalAndCopyButtons();
  } else {
    console.error('Failed to load chat messages.');
  }
}

function createProjectItem(projectId, title) {
  const projItem = document.createElement('div');
  projItem.classList.add('chat-item'); 
  projItem.dataset.projectId = projectId;

  const titleSpan = document.createElement('span');
  titleSpan.classList.add('chat-item-title');
  titleSpan.textContent = title; 

  const actionsDiv = document.createElement('div');
  actionsDiv.classList.add('chat-item-actions');
  actionsDiv.innerHTML = `
    <button class="rename-project-btn"><i class="fa fa-pen"></i></button>
    <button class="delete-project-btn"><i class="fa fa-trash"></i></button>
  `;

  projItem.appendChild(titleSpan);
  projItem.appendChild(actionsDiv);
  
  chatList.prepend(projItem); 

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

  titleSpan.addEventListener('click', () => {
    window.location.href = `/project/${projectId}`;
  });
}

function createChatItem(chatId, title, modelName) {
  const chatItem = document.createElement('div');
  chatItem.classList.add('chat-item');
  chatItem.dataset.chatId = chatId;
  if(modelName) {
    chatItem.dataset.modelName = modelName; 
  }

  const titleSpan = document.createElement('span');
  titleSpan.classList.add('chat-item-title');
  titleSpan.textContent = title; 

  const actionsDiv = document.createElement('div');
  actionsDiv.classList.add('chat-item-actions');
  actionsDiv.innerHTML = `
    <button class="rename-chat-btn"><i class="fa fa-pen"></i></button>
    <button class="delete-chat-btn"><i class="fa fa-trash"></i></button>
  `;

  chatItem.appendChild(titleSpan);
  chatItem.appendChild(actionsDiv);
  
  chatList.prepend(chatItem); 

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

  chatItem.addEventListener('click', () => {
    setActiveChat(chatId);
    loadChatMessages(chatId);
  });
}

function setActiveChat(chatId) {
  document.querySelectorAll('.chat-item').forEach(c => c.classList.remove('active'));
  const newActiveItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
  if (newActiveItem) {
    newActiveItem.classList.add('active');
  }
  activeChatId = chatId;
  clearAttachedFile();
}

async function createNewProject() {
  const projectName = newProjectNameInput.value.trim();
  if (!projectName) return;

  const response = await fetch('/create_new_project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_name: projectName })
  });
  
  if (response.ok) {
    newProjectModal.style.display = 'none';
    newProjectNameInput.value = '';
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

async function createNewChatHandler() {
  const modelName = modelSelect.value;
  if (!modelName) {
    console.error("Please select a model first.");
    return;
  }
  
  const response = await fetch('/create_new_chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      model_name: modelName,
      project_id: currentActiveProjectId 
    })
  });
  
  if (response.ok) {
    const data = await response.json();
    createChatItem(data.chat_id, data.title, data.model_name); 
    setActiveChat(data.chat_id); 
    messagesContainer.innerHTML = ''; 
    isChatReady = true;
  } else {
    console.error('Failed to create new chat.');
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
      messagesContainer.innerHTML = '';
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

async function handleSendMessage() {
  const message = chatInput.value.trim();
  const modelName = modelSelect.value;
  
  if (!message && !currentAttachedFile) return;

  if (!isChatReady) {
    console.error("Please wait for the chat session to be ready.");
    return;
  }
  
  let isNewChat = false; 
  if (!activeChatId) {
    isNewChat = true; 
    await createNewChatHandler();
    if (!activeChatId) {
      console.error("Failed to create new chat. Cannot send message.");
      return;
    }
  }

  const fileInfo = currentAttachedFile; 

  appendMessage(message, 'user', false, fileInfo);
  chatInput.value = '';
  chatInput.style.height = 'auto'; 
  clearAttachedFile(); 

  const aiMsg = appendMessage('', 'ai');
  let aiText = '';

  overlay.style.display = 'flex';

  try {
    const body = JSON.stringify({ 
        message: message, 
        chat_id: activeChatId, 
        model_name: modelName,
        file_path: fileInfo ? fileInfo.file_path : null,
        file_name: fileInfo ? fileInfo.file_name : null
    });

    const response = await fetch('/chat_stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}. Response: ${errorData}`);
    }

    overlay.style.display = 'none';

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      aiText += decoder.decode(value, { stream: true });
      
      let textToRender = aiText;
      if (textToRender.startsWith('Response:')) {
          textToRender = textToRender.substring(9).trimStart();
      }

      const safeStreamHtml = DOMPurify.sanitize(marked.parse(textToRender));
      aiMsg.innerHTML = safeStreamHtml;
      
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    let finalText = aiText;
    if (finalText.startsWith('Response:')) {
        finalText = finalText.substring(9).trimStart();
    }
    const finalSafeHtml = DOMPurify.sanitize(marked.parse(finalText));
    aiMsg.innerHTML = finalSafeHtml;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(aiMsg.innerHTML, 'text/html');
    doc.querySelectorAll('pre:not([data-output-id])').forEach(pre => {
        const outputId = `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        pre.dataset.outputId = outputId;
    });
    aiMsg.innerHTML = doc.body.innerHTML;
    
    addTerminalAndCopyButtons();
    
    if (isNewChat) {
        const newTitle = message.substring(0, 25) + (message.length > 25 ? "..." : "");
        const activeChatItemTitle = document.querySelector(`.chat-item[data-chat-id="${activeChatId}"] .chat-item-title`);
        if (activeChatItemTitle) {
            activeChatItemTitle.textContent = newTitle;
        }
        const activeChatItem = document.querySelector(`.chat-item[data-chat-id="${activeChatId}"]`);
         if (activeChatItem) {
             activeChatItem.dataset.modelName = modelName;
         }
    }
    

  } catch (err) {
    console.error('Error during chat stream:', err);
    aiMsg.innerHTML = 'Error: Could not connect to the Ollama model. Please check your server and network connection.';
    overlay.style.display = 'none';
  }
}

function appendMessage(text, sender, isFromDB = false, fileInfo = null) {
  const msgRow = document.createElement('div');
  msgRow.classList.add('chat-row', sender);

  let fileHtml = '';
  if (fileInfo && fileInfo.file_path && fileInfo.file_name) {
    const safeFileName = DOMPurify.sanitize(fileInfo.file_name);
    fileHtml = `
      <div class="file-attachment-msg">
        <i class="fa fa-file"></i>
        <a href="${fileInfo.file_path}" target="_blank" rel="noopener noreferrer">${safeFileName}</a>
      </div>`;
  }

  if(sender === 'ai'){
    let textToRender = text;
    if (textToRender.startsWith('Response:')) {
        textToRender = textToRender.substring(9).trimStart();
    }
    let htmlContent = marked.parse(textToRender);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    doc.querySelectorAll('pre').forEach(pre => {
        if (!pre.dataset.outputId) {
            const outputId = `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            pre.dataset.outputId = outputId;
        }
    });

    htmlContent = doc.body.innerHTML;

    const safeHtml = DOMPurify.sanitize(htmlContent);

    msgRow.innerHTML = `
      <img src="/static/images/logo.png" class="avatar">
      <div class="message">${safeHtml}${fileHtml}</div> 
    `; 

  } else {
    msgRow.innerHTML = ''; 
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.textContent = text; 
    msgRow.appendChild(msgDiv); 
    
    if (fileHtml) {
        msgDiv.insertAdjacentHTML('beforeend', fileHtml);
    }
  }

  messagesContainer.append(msgRow);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return msgRow.querySelector('.message');
}

function addTerminalAndCopyButtons() {
    const codeBlocks = messagesContainer.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
        if (pre.querySelector('.copy-btn') || pre.querySelector('.terminal-btn')) {
            return;
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.top = '5px';
        buttonContainer.style.right = '5px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';

        const codeEl = pre.querySelector('code');
        if (!codeEl) return; 

        const command = codeEl.textContent.trim();
        const outputId = pre.dataset.outputId;

        if (command && outputId) {
            const terminalBtn = document.createElement('button');
            terminalBtn.classList.add('terminal-btn');
            terminalBtn.innerHTML = '<i class="fa fa-terminal"></i>';
            terminalBtn.title = "Show Terminal";
            terminalBtn.addEventListener('click', () => {
                showTerminalOutput(outputId, command);
            });
            buttonContainer.appendChild(terminalBtn);
        }

        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-btn');
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = "Copy Code";
        copyBtn.addEventListener('click', () => {
            const code = pre.querySelector('code').textContent;
            navigator.clipboard.writeText(code).then(() => {
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
        buttonContainer.appendChild(copyBtn);

        pre.appendChild(buttonContainer);
    });
}

async function showTerminalOutput(outputId, command) {
    terminalModal.style.display = 'flex';
    const prompt = buildTerminalPrompt(command); 
    currentCommand = command;
    
    terminalOutput.innerHTML = prompt + 'Loading output...'; 
    
    processingDots.style.display = 'inline';
    rerunBtn.disabled = true;

    try {
        const response = await fetch('/get_command_output', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ output_id: outputId })
        });
        
        if (response.ok) {
            const data = await response.json();
            terminalOutput.innerHTML = prompt + DOMPurify.sanitize(data.output);
            currentCommand = data.command;
            rerunBtn.dataset.outputId = outputId;
        } else if (response.status === 404) {
            const execResponse = await fetch('/execute_stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, chat_id: activeChatId, output_id: outputId })
            });

            if (!execResponse.ok) {
                const errorData = await execResponse.text();
                terminalOutput.innerHTML = prompt + DOMPurify.sanitize(`Error: ${errorData}`);
                return;
            }
            
            const reader = execResponse.body.getReader();
            const decoder = new TextDecoder();
            let output = '';
            
            terminalOutput.innerHTML = prompt; 
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                output += decoder.decode(value, { stream: true });
                terminalOutput.innerHTML = prompt + DOMPurify.sanitize(output);
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
            }
            currentCommand = command;
            rerunBtn.dataset.outputId = outputId;

        } else {
            terminalOutput.innerHTML = prompt + "Error: Could not load command output.";
        }
    } catch (err) {
        console.error('Error in terminal logic:', err);
        terminalOutput.innerHTML = prompt + DOMPurify.sanitize(`Error: An unexpected error occurred. Details: ${err.message}`);
    } finally {
        rerunBtn.disabled = false;
        processingDots.style.display = 'none';
    }
}

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

function handleRerun() {
  if (currentCommand) {
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

    if (currentPageMode === 'projects') {
      console.error("Cannot upload files here.");
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

    overlay.style.display = 'flex';
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
        overlay.style.display = 'none';
    }
}

function showAttachedFile(fileName) {
    const display = document.getElementById('attached-file-display');
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
    fileInput.value = ''; 
    document.getElementById('attached-file-display').innerHTML = '';
}
