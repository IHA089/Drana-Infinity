document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("report-root");
    if (!root) return;

    const flowId = root.dataset.flowId;

    const editor = document.getElementById("report-editor");
    const preview = document.getElementById("report-preview");
    const statusEl = document.getElementById("status-text");
    const loadingOverlay = document.getElementById("loading-overlay");
    const tabBtns = document.querySelectorAll(".tab-btn");
    const btnCopy = document.getElementById("btn-copy");
    const btnPdf = document.getElementById("btn-pdf");

    async function generateReport() {
        if (!flowId) {
            statusEl.textContent = "ERROR: NO FLOW ID";
            return;
        }

        loadingOverlay.classList.remove("hidden");
        statusEl.textContent = "PROCESSING FLOW DATA...";
        statusEl.style.color = "var(--color-cyan)";

        try {
            const response = await fetch(`/report/${flowId}/generate`);
            
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const data = await response.json();
            
            if (data.success) {
                editor.value = data.content;
                loadingOverlay.classList.add("hidden");
                statusEl.textContent = "REPORT GENERATED";
                statusEl.style.color = "#fff";
                renderMarkdown();
            } else {
                throw new Error(data.message || "Unknown server error");
            }

        } catch (err) {
            console.error(err);
            loadingOverlay.classList.add("hidden");
            statusEl.textContent = "GENERATION FAILED";
            statusEl.style.color = "var(--color-purple)";
            editor.value = `[SYSTEM ERROR]\nCould not analyze Flow ${flowId}.\nDetails: ${err.message}`;
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".report-content-layer").forEach(l => l.classList.remove("active"));
            
            btn.classList.add("active");
            const targetId = btn.dataset.target;
            document.getElementById(targetId).classList.add("active");
            
            if (targetId === "render-mode") renderMarkdown();
        });
    });

    function renderMarkdown() {
        const rawText = editor.value;
        preview.innerHTML = marked.parse(rawText);
    }

    btnCopy.addEventListener("click", () => {
        navigator.clipboard.writeText(editor.value).then(() => {
            const originalHTML = btnCopy.innerHTML;
            btnCopy.innerHTML = `<i class="fa fa-check"></i> COPIED`;
            setTimeout(() => btnCopy.innerHTML = originalHTML, 2000);
        });
    });

    btnPdf.addEventListener("click", () => {
        renderMarkdown();
        const element = document.getElementById('report-preview');
        const opt = {
            margin: 15,
            filename: `Drana_Flow_${flowId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const prevBg = element.style.background;
        const prevCol = element.style.color;
        
        element.style.background = "#ffffff";
        element.style.color = "#000000";
        const headers = element.querySelectorAll('h1, h2, h3, strong');
        headers.forEach(h => h.style.color = "#000000");

        statusEl.textContent = "RENDERING PDF...";

        html2pdf().set(opt).from(element).save().then(() => {
            element.style.background = prevBg;
            element.style.color = prevCol;
            headers.forEach(h => h.style.color = ""); 
            statusEl.textContent = "REPORT GENERATED";
        });
    });

    generateReport();
});