// rag.js – global RAG Studio (multi-collection, user-level)

document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("rag-root");
  if (!root) return;

  const loggedIn = root.dataset.loggedIn === "1";
  if (!loggedIn) return; // UI already shows "login required"

  // Elements
  const collListEl = document.getElementById("rag-collections-list");
  const collCountEl = document.getElementById("rag-collections-count");
  const newNameInput = document.getElementById("rag-collection-name");
  const newDescInput = document.getElementById("rag-collection-desc");
  const createBtn = document.getElementById("rag-create-collection");
  const createStatus = document.getElementById("rag-create-status");

  const activeNameEl = document.getElementById("rag-active-name");
  const activeDescEl = document.getElementById("rag-active-desc");
  const activeDocCountEl = document.getElementById("rag-active-doc-count");

  const fileInput = document.getElementById("rag-file-input");
  const uploadBtn = document.getElementById("rag-upload-btn");
  const uploadStatus = document.getElementById("rag-upload-status");
  const docsTbody = document.getElementById("rag-docs-tbody");

  const searchInput = document.getElementById("rag-search-input");
  const topKSelect = document.getElementById("rag-top-k");
  const searchBtn = document.getElementById("rag-search-btn");
  const searchStatus = document.getElementById("rag-search-status");
  const searchResults = document.getElementById("rag-search-results");

  let collections = [];
  let activeCollectionId = null;

  // -------- Helpers --------

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
  }

  function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("info", "error");
    if (type === "info") el.classList.add("info");
    if (type === "error") el.classList.add("error");
  }

  function formatSize(bytes) {
    if (bytes == null) return "";
    const b = Number(bytes);
    if (b < 1024) return b + " B";
    const kb = b / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    const mb = kb / 1024;
    return mb.toFixed(1) + " MB";
  }

  function formatDate(str) {
    if (!str) return "";
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleString();
  }

  function clearDocs() {
    if (docsTbody) docsTbody.innerHTML = "";
  }

  // -------- Collections --------

  async function loadCollections() {
    if (!collListEl) return;
    collListEl.innerHTML = "";
    clearDocs();
    activeCollectionId = null;
    activeNameEl.textContent = "None selected";
    activeDescEl.textContent = "";
    activeDocCountEl.textContent = "0 documents";

    try {
      const res = await fetch("/rag/api/collections");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus(createStatus, data.message || "Failed to load collections", "error");
        return;
      }
      collections = data.collections || [];
      if (collCountEl) {
        collCountEl.textContent =
          collections.length === 0
            ? "No collections yet"
            : `${collections.length} collection(s)`;
      }

      if (collections.length === 0) {
        collListEl.innerHTML =
          '<div class="rag-muted">No collections. Create one above to start indexing knowledge.</div>';
        return;
      }

      collections.forEach((c) => {
        const item = document.createElement("div");
        item.className = "rag-collection-item";
        item.dataset.id = c.id;

        const top = document.createElement("div");
        top.className = "rag-collection-top-row";

        const name = document.createElement("div");
        name.className = "rag-collection-name";
        name.innerHTML = `<i class="fa fa-database"></i> ${escapeHtml(c.display_name)}`;

        const pill = document.createElement("span");
        pill.className = "rag-pill";
        pill.textContent = `${c.doc_count} doc(s)`;

        top.appendChild(name);
        top.appendChild(pill);

        const meta = document.createElement("div");
        meta.className = "rag-collection-meta";
        meta.textContent = c.description || "";

        item.appendChild(top);
        item.appendChild(meta);

        item.addEventListener("click", () => {
          setActiveCollection(c.id);
        });

        collListEl.appendChild(item);
      });

      // auto-select first
      if (collections.length > 0) {
        setActiveCollection(collections[0].id, false);
      }
    } catch (e) {
      console.error(e);
      setStatus(createStatus, "Error loading collections", "error");
    }
  }

  function highlightActiveCollection() {
    document
      .querySelectorAll(".rag-collection-item")
      .forEach((el) => el.classList.remove("active"));
    if (activeCollectionId == null) return;
    const activeEl = document.querySelector(
      `.rag-collection-item[data-id="${activeCollectionId}"]`
    );
    if (activeEl) activeEl.classList.add("active");
  }

  async function setActiveCollection(id, reloadDocs = true) {
    activeCollectionId = id;
    highlightActiveCollection();

    const col = collections.find((c) => String(c.id) === String(id));
    if (col) {
      activeNameEl.textContent = col.display_name;
      activeDescEl.textContent = col.description || "";
      activeDocCountEl.textContent = `${col.doc_count} document(s)`;
    }
    if (reloadDocs) {
      await loadDocuments();
    }
  }

  async function createCollection() {
    const name = (newNameInput.value || "").trim();
    const desc = (newDescInput.value || "").trim();
    if (!name) {
      setStatus(createStatus, "Collection name is required", "error");
      return;
    }
    setStatus(createStatus, "Creating collection...", "info");
    try {
      const res = await fetch("/rag/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          description: desc,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus(
          createStatus,
          data.message || `Failed: HTTP ${res.status}`,
          "error"
        );
        return;
      }
      setStatus(createStatus, "Collection created.", "info");
      newNameInput.value = "";
      newDescInput.value = "";
      await loadCollections();
    } catch (e) {
      console.error(e);
      setStatus(createStatus, "Error creating collection", "error");
    }
  }

  // -------- Documents --------

  async function loadDocuments() {
    clearDocs();
    if (!activeCollectionId) return;
    try {
      const res = await fetch(`/rag/api/collections/${activeCollectionId}/documents`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus(uploadStatus, data.message || "Failed to load docs", "error");
        return;
      }
      const docs = data.documents || [];

      const col = collections.find(
        (c) => String(c.id) === String(activeCollectionId)
      );
      if (col) {
        col.doc_count = docs.length;
        activeDocCountEl.textContent = `${docs.length} document(s)`;
        const pill = document.querySelector(
          `.rag-collection-item[data-id="${activeCollectionId}"] .rag-pill`
        );
        if (pill) pill.textContent = `${docs.length} doc(s)`;
      }

      if (docs.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML =
          '<td colspan="4" class="rag-muted">No documents uploaded yet.</td>';
        docsTbody.appendChild(row);
        return;
      }

      docs.forEach((d) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${escapeHtml(d.filename)}</td>
          <td>${escapeHtml(d.filetype || "")}</td>
          <td>${formatSize(d.size_bytes)}</td>
          <td>${formatDate(d.created_at)}</td>
        `;
        docsTbody.appendChild(row);
      });
    } catch (e) {
      console.error(e);
      setStatus(uploadStatus, "Error loading documents", "error");
    }
  }

  async function uploadDocs() {
    if (!activeCollectionId) {
      setStatus(uploadStatus, "Select a collection first.", "error");
      return;
    }
    if (!fileInput.files || fileInput.files.length === 0) {
      setStatus(uploadStatus, "Choose file(s) to upload.", "error");
      return;
    }

    const fd = new FormData();
    for (let i = 0; i < fileInput.files.length; i++) {
      fd.append("file", fileInput.files[i]);
    }
    fd.append("collection_id", String(activeCollectionId));

    setStatus(uploadStatus, "Uploading & indexing...", "info");

    try {
      const res = await fetch("/rag/api/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus(uploadStatus, data.message || "Upload failed", "error");
        return;
      }
      setStatus(
        uploadStatus,
        `Uploaded: ${(data.files || []).join(", ")}`,
        "info"
      );
      fileInput.value = "";
      await loadDocuments();
    } catch (e) {
      console.error(e);
      setStatus(uploadStatus, "Error uploading documents", "error");
    }
  }

  // -------- Search --------

  async function runSearch() {
    const query = (searchInput.value || "").trim();
    const topK = Number(topKSelect.value || "5");

    searchResults.innerHTML = "";
    if (!query) {
      setStatus(searchStatus, "Type something to search.", "error");
      return;
    }

    setStatus(searchStatus, "Searching across your collections...", "info");

    try {
      const res = await fetch("/rag/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          top_k: topK,
          collection_ids: [], // all collections
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatus(searchStatus, data.message || "Search failed", "error");
        return;
      }

      const results = data.results || [];
      if (results.length === 0) {
        setStatus(searchStatus, "No matches found.", "info");
        searchResults.innerHTML =
          '<div class="rag-muted">No results. Upload more docs or change the query.</div>';
        return;
      }

      setStatus(searchStatus, `Got ${results.length} result(s).`, "info");
      renderSearchResults(results);
    } catch (e) {
      console.error(e);
      setStatus(searchStatus, "Error performing search", "error");
    }
  }

  function renderSearchResults(results) {
    searchResults.innerHTML = "";
    results.forEach((r) => {
      const item = document.createElement("div");
      item.className = "rag-search-item";

      const meta = document.createElement("div");
      meta.className = "rag-search-meta";

      const left = document.createElement("div");
      const colName = document.createElement("div");
      colName.className = "rag-search-collection-name";
      colName.textContent = r.collection_name;
      const fileName = document.createElement("div");
      fileName.className = "rag-search-file";
      fileName.textContent = r.file_name || "Unknown file";

      left.appendChild(colName);
      left.appendChild(fileName);

      const score = document.createElement("div");
      score.className = "rag-search-score";
      if (r.score !== null && r.score !== undefined) {
        score.textContent = `score: ${r.score.toFixed(4)}`;
      }

      meta.appendChild(left);
      meta.appendChild(score);

      const snippet = document.createElement("div");
      snippet.className = "rag-search-snippet";
      snippet.textContent = r.snippet || "";

      item.appendChild(meta);
      item.appendChild(snippet);
      searchResults.appendChild(item);
    });
  }

  // -------- Event bindings --------

  if (createBtn) createBtn.addEventListener("click", createCollection);
  if (uploadBtn) uploadBtn.addEventListener("click", uploadDocs);
  if (searchBtn) searchBtn.addEventListener("click", runSearch);

  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        runSearch();
      }
    });
  }

  // initial
  loadCollections();
});
