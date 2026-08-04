(function(){
  const STORAGE_INDEX_KEY = 'outline_index';
  const STORAGE_FOLDERS_KEY = 'outline_folders';
  const STORAGE_COLLAPSED_KEY = 'outline_collapsed_folders';
  let index = [];        
  let folders = [];
  let collapsedFolders = [];
  let currentId = null;
  let mode = 'empty';    
  let currentDoc = null; 

  const mainArea = document.getElementById('mainArea');
  const docList = document.getElementById('docList');
  const darkBtn = document.getElementById('darkModeBtn');
  const newDocBtn = document.getElementById('newDocBtn');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const exportToast = document.getElementById('exportToast');
  const toastMsg = document.getElementById('toastMsg');

  function openSidebar(){ document.body.classList.add('sidebar-open'); }
  function closeSidebar(){ document.body.classList.remove('sidebar-open'); }
  function isMobile(){ return window.innerWidth <= 760; }
  hamburgerBtn.addEventListener('click', function(){
    document.body.classList.toggle('sidebar-open');
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  function showToast(msg) {
    toastMsg.textContent = msg;
    exportToast.style.display = 'flex';
  }
  function hideToast() {
    exportToast.style.display = 'none';
  }

  function storageGet(key){
    try{ return localStorage.getItem(key); }catch(e){ return null; }
  }
  function storageSet(key, value){
    try{ localStorage.setItem(key, value); return true; }catch(e){ return false; }
  }
  function storageDelete(key){
    try{ localStorage.removeItem(key); }catch(e){ }
  }

  function loadIndex(){
    const raw = storageGet(STORAGE_INDEX_KEY);
    try{ index = raw ? JSON.parse(raw) : []; }catch(e){ index = []; }
  }
  function saveIndex(){
    storageSet(STORAGE_INDEX_KEY, JSON.stringify(index));
  }
  function loadFolders(){
    const raw = storageGet(STORAGE_FOLDERS_KEY);
    try{ folders = raw ? JSON.parse(raw) : []; }catch(e){ folders = []; }
    const rawCollapsed = storageGet(STORAGE_COLLAPSED_KEY);
    try{ collapsedFolders = rawCollapsed ? JSON.parse(rawCollapsed) : []; }catch(e){ collapsedFolders = []; }
  }
  function saveFolders(){
    storageSet(STORAGE_FOLDERS_KEY, JSON.stringify(folders));
  }
  function saveCollapsedState(){
    storageSet(STORAGE_COLLAPSED_KEY, JSON.stringify(collapsedFolders));
  }
  function genFolderId(){
    return 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  }
  function loadDoc(id){
    const raw = storageGet('doc:' + id);
    if(!raw) return null;
    try{ return JSON.parse(raw); }catch(e){ return null; }
  }
  function saveDoc(id, title, rawText){
    return storageSet('doc:' + id, JSON.stringify({ title: title, raw: rawText }));
  }
  function deleteDoc(id){
    storageDelete('doc:' + id);
  }

  function genId(){
    return 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  }

  function folderName(folderId){
    if(!folderId) return 'Uncategorized';
    const f = folders.find(function(x){ return x.id === folderId; });
    return f ? f.name : 'Uncategorized';
  }

  function buildDocItem(doc){
    const item = document.createElement('div');
    item.className = 'doc-item' + (doc.id === currentId ? ' active' : '');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'doc-name';
    nameSpan.textContent = doc.title;
    item.appendChild(nameSpan);

    const moveSpan = document.createElement('span');
    moveSpan.className = 'move-folder-x';
    moveSpan.textContent = '📁';
    moveSpan.title = 'Move to folder';
    moveSpan.addEventListener('click', function(e){
      e.stopPropagation();
      handleMoveToFolder(doc);
    });
    item.appendChild(moveSpan);

    const delSpan = document.createElement('span');
    delSpan.className = 'del-x';
    delSpan.textContent = '✕';
    delSpan.title = 'Delete';
    delSpan.addEventListener('click', function(e){
      e.stopPropagation();
      handleDelete(doc.id, doc.title);
    });
    item.appendChild(delSpan);

    item.addEventListener('click', function(){
      openDoc(doc.id);
      if(isMobile()) closeSidebar();
    });
    return item;
  }

  function handleMoveToFolder(doc){
    const options = ['0. No folder (Uncategorized)'].concat(
      folders.map(function(f, i){ return (i + 1) + '. ' + f.name; })
    );
    const choice = prompt('Move "' + doc.title + '" to which folder?\n' + options.join('\n') + '\n\nEnter the number:');
    if(choice === null) return;
    const num = parseInt(choice.trim(), 10);
    if(isNaN(num) || num < 0 || num > folders.length) { alert('Invalid choice.'); return; }
    doc.folder = num === 0 ? null : folders[num - 1].id;
    saveIndex();
    renderSidebar();
  }

  function renderSidebar(){
    docList.innerHTML = '';
    if(index.length === 0){
      docList.innerHTML = '<div class="empty-hint">No outlines yet. Click "+ New Outline" to add your first one.</div>';
      return;
    }

    // Group docs: one group per folder (in folder order), then an Uncategorized group last.
    const grouped = folders.map(function(f){
      return { id: f.id, name: f.name, docs: index.filter(function(d){ return d.folder === f.id; }) };
    });
    const uncategorized = index.filter(function(d){ return !d.folder || !folders.some(function(f){ return f.id === d.folder; }); });
    grouped.push({ id: null, name: 'Uncategorized', docs: uncategorized });

    grouped.forEach(function(group){
      if(group.docs.length === 0 && group.id !== null) {
        // still show empty real folders so user can find them to rename/delete/drop docs into later
      }
      if(group.docs.length === 0 && group.id === null) return; // hide empty uncategorized bucket

      const groupEl = document.createElement('div');
      const isCollapsed = collapsedFolders.indexOf(group.id || 'uncategorized') !== -1;
      groupEl.className = 'folder-group' + (isCollapsed ? ' collapsed' : '');

      const header = document.createElement('div');
      header.className = 'folder-header';
      header.innerHTML = '<span class="folder-caret">&#9656;</span>' +
        '<span class="folder-name">' + escapeHtml(group.name) + '</span>' +
        '<span class="folder-count">' + group.docs.length + '</span>';
      header.addEventListener('click', function(){
        const key = group.id || 'uncategorized';
        const idx = collapsedFolders.indexOf(key);
        if(idx === -1) collapsedFolders.push(key); else collapsedFolders.splice(idx, 1);
        saveCollapsedState();
        groupEl.classList.toggle('collapsed');
      });

      if(group.id !== null){
        const renameX = document.createElement('span');
        renameX.className = 'folder-menu-x rename-folder-x';
        renameX.textContent = '✏️';
        renameX.title = 'Rename folder';
        renameX.addEventListener('click', function(e){
          e.stopPropagation();
          handleRenameFolder(group.id, group.name);
        });
        header.appendChild(renameX);

        const deleteX = document.createElement('span');
        deleteX.className = 'folder-menu-x delete-folder-x';
        deleteX.textContent = '🗑️';
        deleteX.title = 'Delete folder permanently';
        deleteX.addEventListener('click', function(e){
          e.stopPropagation();
          handleDeleteFolder(group.id, group.name);
        });
        header.appendChild(deleteX);
      }

      const docsWrap = document.createElement('div');
      docsWrap.className = 'folder-docs';
      group.docs.forEach(function(doc){ docsWrap.appendChild(buildDocItem(doc)); });

      groupEl.appendChild(header);
      groupEl.appendChild(docsWrap);
      docList.appendChild(groupEl);
    });
  }

  function handleRenameFolder(folderId, currentName){
    const newName = prompt('Rename folder:', currentName);
    if(newName === null || !newName.trim()) return;
    const f = folders.find(function(x){ return x.id === folderId; });
    if(f) f.name = newName.trim();
    saveFolders();
    renderSidebar();
  }

  function handleDeleteFolder(folderId, currentName){
    if(!confirm('Permanently delete folder "' + currentName + '"?\n\nThe folder itself will be removed. Outlines inside it will NOT be deleted — they will move to Uncategorized.')) return;
    folders = folders.filter(function(f){ return f.id !== folderId; });
    index.forEach(function(d){ if(d.folder === folderId) d.folder = null; });
    saveFolders();
    saveIndex();
    renderSidebar();
  }

  function createFolderPrompt(){
    const name = prompt('New folder name (e.g. Accounts, Law, Economics):');
    if(!name || !name.trim()) return null;
    const f = { id: genFolderId(), name: name.trim() };
    folders.push(f);
    saveFolders();
    return f;
  }

  function handleDelete(id, title){
    if(!confirm('Delete "' + title + '"? This cannot be undone.')) return;
    deleteDoc(id);
    index = index.filter(function(d){ return d.id !== id; });
    saveIndex();
    if(currentId === id){
      currentId = null;
      mode = 'empty';
    }
    renderSidebar();
    renderMain();
  }

  function renderMain(){
    if(mode === 'empty'){
      mainArea.innerHTML =
        '<div class="empty-state">' +
        '<div style="font-size:2rem;">📄</div>' +
        '<p>Select an outline from the left, or create a new one.</p>' +
        '<button class="btn primary" id="emptyNewBtn">+ New Outline</button>' +
        '</div>';
      document.getElementById('emptyNewBtn').addEventListener('click', showEditor);
      return;
    }
    if(mode === 'edit'){
      renderEditor();
      return;
    }
    if(mode === 'view'){
      renderViewer();
      return;
    }
  }

  let editingDraft = { id: null, title: '', raw: '', folder: null };

  function showEditor(existingId, existingTitle, existingRaw, existingFolder){
    editingDraft = {
      id: existingId || null,
      title: existingTitle || '',
      raw: existingRaw || '',
      folder: existingFolder || null
    };
    mode = 'edit';
    renderMain();
  }

  function renderEditor(){
    const folderOptionsHtml = '<option value="">No folder (Uncategorized)</option>' +
      folders.map(function(f){
        return '<option value="' + escapeAttr(f.id) + '"' + (editingDraft.folder === f.id ? ' selected' : '') + '>' + escapeHtml(f.name) + '</option>';
      }).join('') +
      '<option value="__new__">+ Create New Folder...</option>';
    const folderFieldHtml =
      '<label class="field-label">Folder / Subject</label>' +
      '<select id="folderSelect" class="folder-select-field">' + folderOptionsHtml + '</select>';

    mainArea.innerHTML =
      '<div class="editor-card">' +
        '<label class="field-label">Outline Title</label>' +
        '<input type="text" id="nameInput" placeholder="e.g. Unit 10: Contract of Indemnity and Guarantee" value="' + escapeAttr(editingDraft.title) + '">' +
        folderFieldHtml +
        '<div class="format-guide">' +
          '<strong>Paste format:</strong> use <code>## </code> for a main heading (level 1), then <code>-</code> bullets indented by 2 spaces per level.' +
        '</div>' +
        
        '<div class="smart-tools-wrapper">' +
          '<button class="btn tool-btn" id="fixSpacingBtn">✨ Auto-Fix Outline Spacing</button>' +
          '<button class="btn tool-btn" id="addSpacesBtn">➕ Add +2 Spaces Global</button>' +
        '</div>' +
        
        '<label class="field-label">Raw Notes</label>' +
        '<textarea id="rawInput" placeholder="Paste your structured notes here...">' + escapeHtml(editingDraft.raw) + '</textarea>' +
        '<div class="editor-actions">' +
          '<button class="btn primary" id="buildBtn">Build &amp; Save</button>' +
          '<button class="btn" id="cancelEditBtn">Cancel</button>' +
        '</div>' +
      '</div>';

    document.getElementById('buildBtn').addEventListener('click', handleBuildSave);
    document.getElementById('cancelEditBtn').addEventListener('click', function(){
      if(editingDraft.id){ openDoc(editingDraft.id); }else{ mode = 'empty'; renderMain(); }
    });

    document.getElementById('folderSelect').addEventListener('change', function(){
      // Preserve whatever the user has typed so far before we re-render the form.
      editingDraft.title = document.getElementById('nameInput').value;
      editingDraft.raw = document.getElementById('rawInput').value;

      if(this.value === '__new__'){
        const newFolder = createFolderPrompt();
        editingDraft.folder = newFolder ? newFolder.id : null;
      } else {
        editingDraft.folder = this.value || null;
      }
      renderEditor();
    });

    document.getElementById('fixSpacingBtn').addEventListener('click', runAutoSpacingFix);
    document.getElementById('addSpacesBtn').addEventListener('click', runAddGlobalSpaces);
  }

  function runAutoSpacingFix(){
    const textarea = document.getElementById('rawInput');
    if(!textarea.value.trim()) return;
    const processed = textarea.value.split('\n').map(function(line) {
      let trimmed = line.trim();
      if (!trimmed) return line;
      if (isTableRowLine(trimmed)) return trimmed; // leave markdown table rows untouched
      if (/^#{1,6}/.test(trimmed)) return trimmed; 
      if (/^-\s*\d+\./.test(trimmed)) return "  " + trimmed.replace(/^-\s*/, '- ');
      if (/^-\s*/.test(trimmed)) return "    " + trimmed.replace(/^-\s*/, '- ');
      return "    " + trimmed;
    });
    textarea.value = processed.join('\n');
    alert('Spaces fixed!');
  }

  function runAddGlobalSpaces(){
    const textarea = document.getElementById('rawInput');
    if(!textarea.value.trim()) return;
    textarea.value = textarea.value.split('\n').map(function(line){
      const trimmed = line.trim();
      if (trimmed === '' || isTableRowLine(trimmed)) return line; // don't shift table rows
      return "  " + line;
    }).join('\n');
  }

  function handleBuildSave(){
    const title = document.getElementById('nameInput').value.trim();
    const raw = document.getElementById('rawInput').value;
    const folderSelectEl = document.getElementById('folderSelect');
    let folderVal = folderSelectEl ? folderSelectEl.value : '';
    if(folderVal === '__new__') folderVal = ''; // safety net, shouldn't normally happen
    folderVal = folderVal || null;
    if(!title || !raw.trim()){ alert('Fields cannot be empty.'); return; }

    const id = editingDraft.id || genId();
    saveDoc(id, title, raw);
    const existing = index.find(function(d){ return d.id === id; });
    if(existing){
      existing.title = title;
      existing.folder = folderVal;
    } else {
      index.push({ id: id, title: title, folder: folderVal });
    }
    saveIndex();
    renderSidebar();
    openDoc(id);
  }

  function openDoc(id){
    currentId = id; mode = 'view';
    const doc = loadDoc(id);
    if(!doc) return;
    currentDoc = doc; 
    renderSidebar();
    renderMain();
    if(isMobile()) closeSidebar();
  }

  function renderMathInElement(el) {
    if (typeof katex === 'undefined') return;
    let html = el.innerHTML;
    html = html.replace(/\$\$\s*(.+?)\s*\$\$/g, function(match, formula) {
      try {
        return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch(e) { return match; }
    });
    html = html.replace(/\$\s*(.+?)\s*\$/g, function(match, formula) {
      try {
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch(e) { return match; }
    });
    el.innerHTML = html;
  }

  // Matches by text AND occurrence-count (1st "Yes", 2nd "Yes", etc.) so editing a
  // leaf with duplicate text elsewhere in the doc updates the correct line only.
  // Table rows are skipped since they don't correspond to individual leaf/header elements.
  function updateRawTextOnEdit(originalText, updatedText, occurrence) {
    if (!currentDoc || !currentDoc.raw) return;
    const targetOccurrence = occurrence || 1;
    let lines = currentDoc.raw.split('\n');
    let matchCounter = 0;
    let li = 0;
    while(li < lines.length){
      const line = lines[li];
      if(line.trim() === ''){ li++; continue; }
      if(isTableRowLine(line) && li + 1 < lines.length && isTableSeparatorLine(lines[li+1])){
        li += 2;
        while(li < lines.length && isTableRowLine(lines[li])) li++;
        continue;
      }
      let lineValue = line.replace(/^#{1,6}\s*/, '').replace(/^-\s*/, '').trim();
      if (lineValue === originalText.trim()) {
        matchCounter++;
        if(matchCounter === targetOccurrence){
          lines[li] = lines[li].replace(originalText.trim(), updatedText.trim());
          break;
        }
      }
      li++;
    }
    currentDoc.raw = lines.join('\n');
    saveDoc(currentId, currentDoc.title, currentDoc.raw);
  }

  // Full re-render of the outline area (fresh HTML, keys, highlights, math, listeners).
  // Shared by initial doc-open and by AI features that mutate currentDoc.raw in place.
  function rerenderOutlineRoot(){
    const outlineRoot = document.getElementById('outlineRoot');
    outlineRoot.innerHTML = buildOutlineHTML(currentDoc.raw);
    assignContentKeys(outlineRoot);

    let activeHighlights = storageGet('highlights:' + currentId);
    if(activeHighlights) {
      try {
        let hMap = JSON.parse(activeHighlights);
        outlineRoot.querySelectorAll('.leaf:not(.table-leaf), .node-header').forEach((el) => {
          const key = el.getAttribute('data-hl-key');
          if(key && hMap[key]) {
            let container = el.querySelector('.node-title') || el;
            container.innerHTML = hMap[key];
          }
        });
      } catch(e){}
    }

    outlineRoot.querySelectorAll('.node-title, .leaf:not(.table-leaf)').forEach(el => {
      renderMathInElement(el);
    });
    initializeInteractionEngine(outlineRoot);
    return outlineRoot;
  }
  // instead of relying on raw DOM position. This keeps saved highlights (and inline-edit
  // targeting) correct even after lines are added/removed/reordered elsewhere in the doc.
  function assignContentKeys(root){
    const seen = {};
    root.querySelectorAll('.leaf:not(.table-leaf), .node-header').forEach(function(el){
      const textTitleNode = el.querySelector('.node-title') || el;
      const rawText = nodeToMarkdownText(textTitleNode).trim();
      seen[rawText] = (seen[rawText] || 0) + 1;
      el.setAttribute('data-hl-key', rawText + '#' + seen[rawText]);
    });
  }

  function renderViewer(){
    mainArea.innerHTML =
      '<div class="view-header">' +
        '<div class="search-wrap">' +
          '<span class="search-icon">&#128269;</span>' +
          '<input type="text" id="searchInput" placeholder="Search headings and points...">' +
        '</div>' +
        '<button class="btn" id="expandAllBtn">Expand All</button>' +
        '<button class="btn" id="collapseAllBtn">Collapse All</button>' +
        
        '<!-- Multi-Format Export Dropdown Wrapper -->' +
        '<div class="export-dropdown-container">' +
          '<button class="btn tool-btn">📥 Export ▾</button>' +
          '<div class="export-menu-list">' +
            '<div class="export-menu-item" id="exportMiniBtn">1. Export Mini Tool</div>' +
            '<div class="export-menu-item" id="exportPdfBtn">2. Export PDF</div>' +
            '<div class="export-menu-item" id="exportJpgBtn">3. Export JPG</div>' +
            '<div class="export-menu-item" id="exportPngBtn">4. Export PNG</div>' +
          '</div>' +
        '</div>' +

        '<button class="btn" id="editDocBtn">Edit</button>' +
        '<button class="btn danger" id="deleteDocBtn">Delete</button>' +
        '<div id="resultCount"></div>' +
      '</div>' +
      '<div id="exportTargetArea">' +
        '<h1 class="unit-title">' + escapeHtml(currentDoc.title) + '</h1>' +
        '<div id="outlineRoot"></div>' +
      '</div>' +
      '<div class="no-results" id="noResults">No matches found in this outline.</div>';

    const outlineRoot = rerenderOutlineRoot();

    document.getElementById('editDocBtn').addEventListener('click', function(){
      const idxEntry = index.find(function(d){ return d.id === currentId; });
      showEditor(currentId, currentDoc.title, currentDoc.raw, idxEntry ? idxEntry.folder : null);
    });
    document.getElementById('deleteDocBtn').addEventListener('click', function(){
      handleDelete(currentId, currentDoc.title);
    });
    document.getElementById('expandAllBtn').addEventListener('click', function(){
      outlineRoot.querySelectorAll('.node').forEach(function(n){ n.classList.add('open'); });
    });
    document.getElementById('collapseAllBtn').addEventListener('click', function(){
      outlineRoot.querySelectorAll('.node').forEach(function(n){ n.classList.remove('open'); });
    });
    
    document.getElementById('exportMiniBtn').addEventListener('click', generateMiniPlaygroundFile);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdfFormat);
    document.getElementById('exportJpgBtn').addEventListener('click', () => exportToImageFormat('jpeg'));
    document.getElementById('exportPngBtn').addEventListener('click', () => exportToImageFormat('png'));

    outlineRoot.addEventListener('click', function(e){
      const targetBtn = e.target.closest('.spec-btn');
      if(targetBtn) {
        e.stopPropagation();
        const parentNodeBlock = targetBtn.closest('.node');
        if(!parentNodeBlock) return;
        if(targetBtn.getAttribute('data-action') === 'expand') {
          parentNodeBlock.classList.add('open');
          parentNodeBlock.querySelectorAll('.node').forEach(n => n.classList.add('open'));
        } else {
          parentNodeBlock.querySelectorAll('.node').forEach(n => n.classList.remove('open'));
          parentNodeBlock.classList.remove('open');
        }
        return;
      }

      if(e.target.closest('.control-group-buttons') || e.target.closest('.inline-editor-input')) return;
      const header = e.target.closest('.node-header');
      if(!header) return;

      const searchInput = document.getElementById('searchInput');
      if(searchInput && searchInput.value.trim() !== "" && (header.querySelector('mark.search-hl') || e.target.closest('mark.search-hl'))) {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event('input'));
        return;
      }
      header.parentElement.classList.toggle('open');
    });

    outlineRoot.addEventListener('click', function(e){
      const leaf = e.target.closest('.leaf');
      if(!leaf || e.target.closest('.control-group-buttons') || e.target.closest('.inline-editor-input')) return;
      const searchInput = document.getElementById('searchInput');
      if(searchInput && searchInput.value.trim() !== "" && (leaf.querySelector('mark.search-hl') || e.target.closest('mark.search-hl'))) {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event('input'));
      }
    });

    setupSearch(outlineRoot);
  }

  function exportToPdfFormat() {
    const targetElement = document.getElementById('exportTargetArea');
    const documentName = currentDoc.title.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_document.pdf';
    
    showToast("Generating PDF in background... Please wait.");
    
    setTimeout(() => {
      const clonedArea = targetElement.cloneNode(true);
      clonedArea.style.width = "100%";
      clonedArea.style.maxWidth = "800px";
      clonedArea.style.padding = "20px";
      clonedArea.style.backgroundColor = "#ffffff";
      clonedArea.style.color = "#1c1c1a";
      
      clonedArea.querySelectorAll('.node').forEach(n => n.classList.add('open'));
      clonedArea.querySelectorAll('.control-group-buttons, .specific-actions-group').forEach(el => el.remove());
      clonedArea.querySelectorAll('*').forEach(el => {
        el.style.transition = "none";
        el.style.animation = "none";
      });

      const options = {
        margin: [15, 15, 15, 15],
        filename: documentName,
        image: { type: 'jpeg', quality: 0.98 },
        html2pdf: { scale: 2, useCORS: true, logging: false },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(options).from(clonedArea).save().then(() => {
        hideToast();
      }).catch(() => {
        hideToast();
        alert("Export failed. Please try again.");
      });
    }, 100);
  }

  function exportToImageFormat(imageType) {
    const targetElement = document.getElementById('exportTargetArea');
    const fileExt = imageType === 'jpeg' ? 'jpg' : 'png';
    const filename = currentDoc.title.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_preview.' + fileExt;
    
    showToast(`Generating ${imageType.toUpperCase()} in background... Please wait.`);

    setTimeout(() => {
      const scratchContainer = document.createElement('div');
      scratchContainer.style.position = 'absolute';
      scratchContainer.style.left = '-9999px';
      scratchContainer.style.top = '-9999px';
      scratchContainer.style.width = '850px';
      
      const clonedArea = targetElement.cloneNode(true);
      clonedArea.style.background = getComputedStyle(document.body).getPropertyValue('--bg-alt');
      clonedArea.style.padding = '30px';
      clonedArea.style.color = getComputedStyle(document.body).getPropertyValue('--text');
      
      clonedArea.querySelectorAll('.node').forEach(n => n.classList.add('open'));
      clonedArea.querySelectorAll('.control-group-buttons, .specific-actions-group').forEach(el => el.remove());
      
      scratchContainer.appendChild(clonedArea);
      document.body.appendChild(scratchContainer);

      html2canvas(clonedArea, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false
      }).then(canvas => {
        const imgDataUrl = canvas.toDataURL('image/' + imageType);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = imgDataUrl;
        downloadAnchor.download = filename;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        
        document.body.removeChild(downloadAnchor);
        document.body.removeChild(scratchContainer);
        hideToast();
      }).catch(() => {
        document.body.removeChild(scratchContainer);
        hideToast();
        alert("Image export failed.");
      });
    }, 100);
  }

  function saveCurrentHighlightsState() {
    if(!currentId) return;
    let hMap = {};
    document.getElementById('outlineRoot').querySelectorAll('.leaf:not(.table-leaf), .node-header').forEach((el) => {
      const key = el.getAttribute('data-hl-key');
      let container = el.querySelector('.node-title') || el;
      if(key && container.querySelector('.user-highlight')) {
        hMap[key] = container.innerHTML;
      }
    });
    storageSet('highlights:' + currentId, JSON.stringify(hMap));
  }

  let currentSelectionRange = null;

  function initializeInteractionEngine(rootElement) {
    rootElement.addEventListener('mouseup', function(e){
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      const popper = document.getElementById('highlightToolbar');
      if (selectedText.length > 0 && rootElement.contains(selection.anchorNode)) {
        currentSelectionRange = selection.getRangeAt(0);
        popper.style.left = e.pageX + 'px';
        popper.style.top = (e.pageY - 40) + 'px';
        popper.style.display = 'flex';
      }
    });

    rootElement.querySelectorAll('.edit-trigger-btn').forEach(btn => {
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        const headerOrLeaf = btn.closest('.node-header') || btn.closest('.leaf');
        const textTitleNode = headerOrLeaf.querySelector('.node-title') || headerOrLeaf;
        const key = headerOrLeaf.getAttribute('data-hl-key');
        const hashIdx = key ? key.lastIndexOf('#') : -1;
        const occurrence = hashIdx > -1 ? (parseInt(key.slice(hashIdx + 1), 10) || 1) : 1;

        let originalCleanText = nodeToMarkdownText(textTitleNode).trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-editor-input';
        input.value = originalCleanText;
        function commitInlineEdit() {
          if(input.parentNode) {
            let newVal = input.value;
            updateRawTextOnEdit(originalCleanText, newVal, occurrence);
            if(textTitleNode.classList.contains('node-title')) {
              textTitleNode.innerHTML = renderInlineText(newVal);
              textTitleNode.style.display = '';
            } else {
              Array.from(headerOrLeaf.childNodes).forEach(n => {
                if(n.nodeType === Node.TEXT_NODE) n.remove();
                else if(n.nodeType === Node.ELEMENT_NODE && (n.tagName === 'STRONG' || n.classList.contains('user-highlight'))) n.remove();
              });
              const frag = document.createElement('template');
              frag.innerHTML = renderInlineText(newVal);
              headerOrLeaf.insertBefore(frag.content, headerOrLeaf.firstChild);
            }
            input.remove();
            headerOrLeaf.querySelectorAll('.control-group-buttons').forEach(b => b.style.display = '');
            renderMathInElement(textTitleNode);
            assignContentKeys(rootElement);
            saveCurrentHighlightsState();
          }
        }
        if(textTitleNode.classList.contains('node-title')) {
          textTitleNode.style.display = 'none';
        } else {
          Array.from(headerOrLeaf.childNodes).forEach(n => { if(n.nodeType === Node.TEXT_NODE) n.textContent = ''; });
        }
        headerOrLeaf.querySelectorAll('.control-group-buttons').forEach(b => b.style.display = 'none');
        headerOrLeaf.insertBefore(input, headerOrLeaf.querySelector('.control-group-buttons'));
        input.focus();
        input.addEventListener('blur', commitInlineEdit);
        input.addEventListener('keydown', function(evt){ if(evt.key === 'Enter') commitInlineEdit(); });
      });
    });
  }

  const globalPopper = document.getElementById('highlightToolbar');
  
  document.addEventListener('mousedown', function(e){
    if (!e.target.closest('#highlightToolbar')) {
      globalPopper.style.display = 'none';
    }
  });

  globalPopper.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', function(e){
      e.stopPropagation();
      if(!currentSelectionRange) return;
      const color = dot.getAttribute('data-color');
      const mark = document.createElement('span');
      mark.className = 'user-highlight';
      mark.style.backgroundColor = color;
      try {
        currentSelectionRange.surroundContents(mark);
        saveCurrentHighlightsState();
      } catch(err) {
        alert("Please select text within a single line boundary.");
      }
      window.getSelection().removeAllRanges();
      globalPopper.style.display = 'none';
    });
  });

  globalPopper.querySelector('.clear-hl-btn').addEventListener('click', function(e){
    e.stopPropagation();
    const selection = window.getSelection();
    if(selection.anchorNode) {
      const parentHighlight = selection.anchorNode.parentElement.closest('.user-highlight');
      if(parentHighlight) {
        parentHighlight.replaceWith(document.createTextNode(parentHighlight.textContent));
        saveCurrentHighlightsState();
      }
    }
    globalPopper.style.display = 'none';
  });

  function generateMiniPlaygroundFile() {
    const rawOutlinedHTMLContent = document.getElementById('outlineRoot').innerHTML;
    const activeDocTitle = currentDoc.title;
    const cleanIdString = currentId ? currentId.replace(/[^a-z0-9]/gi, '_') : 'mini_sheet';

    const compiledMiniTemplate = '<!DOCTYPE html>\n' +
'<html lang="en" data-theme="light">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>Mini Playground Sheet - ' + escapeHtml(activeDocTitle) + '</title>\n' +
'<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">\n' +
'<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"><\/script>\n' +
'<style>\n' +
'  :root{\n' +
'    --bg:#f7f7f5; --bg-alt:#ffffff; --text:#1c1c1a; --text-muted:#6b6b66;\n' +
'    --border:#e3e2dd; --accent:#3d5c46; --accent-soft:#e9f0ea;\n' +
'    --example-bg:#fdf6e3; --example-border:#eeddab; --mark-bg:#ffe28a;\n' +
'    --font-serif: Georgia, \'Times New Roman\', serif;\n' +
'    --font-sans: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;\n' +
'  }\n' +
'  [data-theme="dark"]{\n' +
'    --bg:#121212; --bg-alt:#1a1a1a; --text:#e7e7e4; --text-muted:#9c9c96;\n' +
'    --border:#2c2c2a; --accent:#8fc19f; --accent-soft:#1c2620;\n' +
'    --example-bg:#26220f; --example-border:#4a3f19; --mark-bg:#6b5719;\n' +
'  }\n' +
'  *{ box-sizing:border-box; }\n' +
'  body{ background:var(--bg); color:var(--text); font-family:var(--font-sans); padding: 30px 20px; line-height:1.55; overflow-y: auto; }\n' +
'  .playground-card { max-width: 850px; margin: 0 auto; background: var(--bg-alt); padding: 25px; border-radius: 12px; border: 1px solid var(--border); }\n' +
'  .view-header{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:20px; padding-bottom: 15px; border-bottom: 1px solid var(--border); }\n' +
'  .search-wrap{ position:relative; flex:1 1 200px; }\n' +
'  #searchInput{ width:100%; padding:9px 14px 9px 32px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text); font-size:.88rem; outline:none; }\n' +
'  .search-icon{ position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:.8rem; color:var(--text-muted); }\n' +
'  .btn{ border:1px solid var(--border); background:var(--bg); color:var(--text); padding:8px 13px; border-radius:8px; font-size:.85rem; cursor:pointer; font-weight: 600; }\n' +
'  .btn:hover{ border-color:var(--accent); background:var(--accent-soft); }\n' +
'  .unit-title{ font-family:var(--font-serif); font-size:1.6rem; font-weight:700; text-align:center; color: var(--accent); margin:0 0 25px; }\n' +
'  .node{ margin-bottom:2px; transition: opacity 0.2s ease; }\n' +
'  .node-header{ display:flex; align-items:center; gap:8px; cursor:pointer; padding:8px 10px; border-radius:6px; user-select:none; position:relative; }\n' +
'  .node-header:hover{ background:var(--accent-soft); }\n' +
'  .toggle-icon{ display:inline-block; width:14px; flex-shrink:0; color:var(--accent); transition:transform .15s ease; font-size:.75rem; }\n' +
'  .node.open > .node-header > .toggle-icon { transform:rotate(90deg); }\n' +
'  .node-children{ margin-left:22px; padding-left:10px; border-left:1px solid var(--border); display:none; }\n' +
'  .node.open > .node-children{ display:block; }\n' +
'  .leaf{ position:relative; padding:6px 10px 6px 20px; font-size:.92rem; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap:4px; flex-wrap: wrap; transition: opacity 0.2s ease; }\n' +
'  .leaf:hover { background: var(--accent-soft); }\n' +
'  .leaf::before{ content:"•"; position:absolute; left:6px; color:var(--text-muted); top:8px; }\n' +
'  .leaf.table-leaf{ display:block; padding:8px 10px 8px 20px; cursor:default; flex-wrap:unset; }\n' +
'  .leaf.table-leaf::before{ top:14px; }\n' +
'  .table-scroll{ overflow-x:auto; max-width:100%; }\n' +
'  table.md-table{ border-collapse:collapse; margin:2px 0; font-size:.85rem; min-width:100%; }\n' +
'  table.md-table th, table.md-table td{ border:1px solid var(--border); padding:6px 10px; text-align:left; vertical-align:top; }\n' +
'  table.md-table th{ background:var(--accent-soft); color:var(--accent); font-weight:700; white-space:nowrap; }\n' +
'  table.md-table tr:nth-child(even) td{ background:rgba(0,0,0,0.015); }\n' +
'  .control-group-buttons { display:none; margin-left:auto; gap:4px; align-items:center; }\n' +
'  .node-header:hover .control-group-buttons, .leaf:hover .control-group-buttons { display:flex; }\n' +
'  .edit-trigger-btn { border: none; background: transparent; cursor: pointer; font-size: 0.85rem; }\n' +
'  .inline-editor-input { font-size:inherit; font-family:inherit; width:80%; padding:2px 6px; border:1px solid var(--accent); border-radius:4px; background:var(--bg); color:var(--text); }\n' +
'  #highlightToolbar { position: absolute; z-index: 1000; display: none; background: #fff; border: 1px solid #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.15); padding: 4px; border-radius: 6px; gap: 4px; }\n' +
'  .color-dot { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.2); cursor: pointer; }\n' +
'  .clear-hl-btn { font-size: 0.75rem; border: 1px solid #ccc; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; cursor: pointer; }\n' +
'  .user-highlight { font-weight: bold; border-radius: 2px; padding: 0 2px; color: #000 !important; }\n' +
'  mark.search-hl{ background:var(--mark-bg) !important; color:inherit !important; padding:0 2px; border-radius:4px; font-weight: bold; box-shadow: 0 0 4px rgba(0,0,0,0.2); }\n' +
'  .search-non-match { opacity: 0.35; }\n' +
'  .search-match-focus { scroll-margin-top: 120px; }\n' +
'  .specific-actions-group { display: none; margin-left: 12px; gap: 4px; align-items: center; }\n' +
'  .node[data-level="1"] > .node-header:hover .specific-actions-group { display: flex; }\n' +
'  .spec-btn { border: 1px solid var(--border); background: var(--bg-alt); color: var(--text-muted); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; cursor: pointer; }\n' +
'  .spec-btn:hover { border-color: var(--accent); color: var(--accent); }\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div id="highlightToolbar">\n' +
'  <div class="color-dot" style="background:#ffe28a;" data-color="#ffe28a"></div>\n' +
'  <div class="color-dot" style="background:#ffb3ba;" data-color="#ffb3ba"></div>\n' +
'  <div class="color-dot" style="background:#baffc9;" data-color="#baffc9"></div>\n' +
'  <div class="color-dot" style="background:#bae1ff;" data-color="#bae1ff"></div>\n' +
'  <button class="clear-hl-btn">✕ Clear</button>\n' +
'</div>\n' +
'<div class="playground-card">\n' +
'  <div class="view-header">\n' +
'    <div class="search-wrap">\n' +
'      <span class="search-icon">🔍</span>\n' +
'      <input type="text" id="searchInput" placeholder="Search points...">\n' +
'    </div>\n' +
'    <button class="btn" id="expandAllBtn">Expand All</button>\n' +
'    <button class="btn" id="collapseAllBtn">Collapse All</button>\n' +
'    <button class="btn" id="miniDarkBtn">🌙 Dark Mode</button>\n' +
'  </div>\n' +
'  <h1 class="unit-title">' + escapeHtml(activeDocTitle) + '</h1>\n' +
'  <div id="outlineRoot">' + rawOutlinedHTMLContent + '</div>\n' +
'</div>\n' +
'<script>\n' +
'  const root = document.getElementById("outlineRoot");\n' +
'  const MINI_STORAGE_KEY = "mini_hl_cache_' + cleanIdString + '";\n' +
'  function saveMiniState() {\n' +
'    let hMap = {};\n' +
'    root.querySelectorAll(".leaf, .node-header").forEach((el, idx) => {\n' +
'      let container = el.querySelector(".node-title") || el;\n' +
'      hMap[idx] = container.innerHTML;\n' +
'    });\n' +
'    localStorage.setItem(MINI_STORAGE_KEY, JSON.stringify(hMap));\n' +
'  }\n' +
'  root.addEventListener("click", function(e){\n' +
'    const targetBtn = e.target.closest(".spec-btn");\n' +
'    if(targetBtn) {\n' +
'      e.stopPropagation();\n' +
'      const parentNodeBlock = targetBtn.closest(".node");\n' +
'      if(!parentNodeBlock) return;\n' +
'      if(targetBtn.getAttribute("data-action") === "expand") {\n' +
'        parentNodeBlock.classList.add("open");\n' +
'        parentNodeBlock.querySelectorAll(".node").forEach(n => n.classList.add("open"));\n' +
'      } else {\n' +
'        parentNodeBlock.querySelectorAll(".node").forEach(n => n.classList.remove("open"));\n' +
'        parentNodeBlock.classList.remove("open");\n' +
'      }\n' +
'      return;\n' +
'    }\n' +
'    if(e.target.closest(".control-group-buttons") || e.target.closest(".inline-editor-input")) return;\n' +
'    const header = e.target.closest(".node-header");\n' +
'    if(!header) return;\n' +
'    const searchInput = document.getElementById("searchInput");\n' +
'    if(searchInput && searchInput.value.trim() !== "" && (header.querySelector("mark.search-hl") || e.target.closest("mark.search-hl"))) {\n' +
'      searchInput.value = "";\n' +
'      searchInput.dispatchEvent(new Event("input"));\n' +
'      return;\n' +
'    }\n' +
'    header.parentElement.classList.toggle("open");\n' +
'  });\n' +
'  root.addEventListener("click", function(e){\n' +
'    const leaf = e.target.closest(".leaf");\n' +
'    if(!leaf || e.target.closest(".control-group-buttons") || e.target.closest(".inline-editor-input")) return;\n' +
'    const searchInput = document.getElementById("searchInput");\n' +
'    if(searchInput && searchInput.value.trim() !== "" && (leaf.querySelector("mark.search-hl") || e.target.closest("mark.search-hl"))) {\n' +
'      searchInput.value = "";\n' +
'      searchInput.dispatchEvent(new Event("input"));\n' +
'    }\n' +
'  });\n' +
'  document.getElementById("expandAllBtn").addEventListener("click", function(){\n' +
'    root.querySelectorAll(".node").forEach(n => n.classList.add("open"));\n' +
'  });\n' +
'  document.getElementById("collapseAllBtn").addEventListener("click", function(){\n' +
'    root.querySelectorAll(".node").forEach(n => n.classList.remove("open"));\n' +
'  });\n' +
'  document.getElementById("miniDarkBtn").addEventListener("click", function(){\n' +
'    const html = document.documentElement;\n' +
'    const isDark = html.getAttribute("data-theme") === "dark";\n' +
'    html.setAttribute("data-theme", isDark ? "light" : "dark");\n' +
'  });\n' +
'  const popper = document.getElementById("highlightToolbar");\n' +
'  let currentSelectionRange = null;\n' +
'  document.addEventListener("mouseup", function(e){\n' +
'    const selection = window.getSelection();\n' +
'    if (selection.toString().trim().length > 0 && root.contains(selection.anchorNode)) {\n' +
'      currentSelectionRange = selection.getRangeAt(0);\n' +
'      popper.style.left = e.pageX + "px";\n' +
'      popper.style.top = (e.pageY - 40) + "px";\n' +
'      popper.style.display = "flex";\n' +
'    } else if (!e.target.closest("#highlightToolbar")) {\n' +
'      popper.style.display = "none";\n' +
'    }\n' +
'  });\n' +
'  popper.querySelectorAll(".color-dot").forEach(dot => {\n' +
'    dot.addEventListener("click", function(e){\n' +
'      e.stopPropagation();\n' +
'      if(!currentSelectionRange) return;\n' +
'      const mark = document.createElement("span");\n' +
'      mark.className = "user-highlight";\n' +
'      mark.style.backgroundColor = dot.getAttribute("data-color");\n' +
'      try { currentSelectionRange.surroundContents(mark); saveMiniState(); } catch(err){}\n' +
'      window.getSelection().removeAllRanges();\n' +
'      popper.style.display = "none";\n' +
'    });\n' +
'  });\n' +
'  popper.querySelector(".clear-hl-btn").addEventListener("click", function(e){\n' +
'    e.stopPropagation();\n' +
'    const selection = window.getSelection();\n' +
'    if(selection.anchorNode) {\n' +
'      const parentHighlight = selection.anchorNode.parentElement.closest(".user-highlight");\n' +
'      if(parentHighlight) { parentHighlight.replaceWith(document.createTextNode(parentHighlight.textContent)); saveMiniState(); }\n' +
'    }\n' +
'    popper.style.display = "none";\n' +
'  });\n' +
'  const searchInput = document.getElementById("searchInput");\n' +
'  searchInput.addEventListener("input", function(){\n' +
'    const q = searchInput.value.trim().toLowerCase();\n' +
'    root.querySelectorAll("mark.search-hl").forEach(m => {\n' +
'      m.replaceWith(document.createTextNode(m.textContent));\n' +
'    });\n' +
'    root.normalize();\n' +
'    root.querySelectorAll(".node, .leaf").forEach(el => {\n' +
'      el.classList.remove("search-non-match", "search-match-focus");\n' +
'    });\n' +
'    if(!q){\n' +
'      return;\n' +
'    }\n' +
'    root.querySelectorAll(".node, .leaf").forEach(el => el.classList.add("search-non-match"));\n' +
'    let elementsToFocus = [];\n' +
'    root.querySelectorAll(".leaf, .node-header").forEach(el => {\n' +
'      const textTitleNode = el.querySelector(".node-title") || el;\n' +
'      let textToScan = "";\n' +
'      Array.from(textTitleNode.childNodes).forEach(child => {\n' +
'        if(child.nodeType === Node.TEXT_NODE || child.classList?.contains("user-highlight")) {\n' +
'          textToScan += child.textContent;\n' +
'        }\n' +
'      });\n' +
'      const matchIndex = textToScan.toLowerCase().indexOf(q);\n' +
'      if(matchIndex !== -1){\n' +
'        if(el.classList.contains("leaf")) {\n' +
'          el.classList.remove("search-non-match");\n' +
'          elementsToFocus.push(el);\n' +
'        } else {\n' +
'          const containerNode = el.closest(".node");\n' +
'          containerNode.classList.remove("search-non-match");\n' +
'          containerNode.classList.add("open");\n' +
'          containerNode.querySelectorAll(".leaf").forEach(l => l.classList.remove("search-non-match"));\n' +
'          containerNode.querySelectorAll(".node").forEach(n => n.classList.remove("search-non-match"));\n' +
'          elementsToFocus.push(el);\n' +
'        }\n' +
'        Array.from(textTitleNode.childNodes).forEach(child => {\n' +
'          if (child.nodeType === Node.TEXT_NODE) {\n' +
'            const rawVal = child.textContent;\n' +
'            const idx = rawVal.toLowerCase().indexOf(q);\n' +
'            if (idx !== -1) {\n' +
'              const before = rawVal.slice(0, idx);\n' +
'              const match = rawVal.slice(idx, idx + q.length);\n' +
'              const after = rawVal.slice(idx + q.length);\n' +
'              const frag = document.createDocumentFragment();\n' +
'              if (before) frag.appendChild(document.createTextNode(before));\n' +
'              const mBtn = document.createElement("mark");\n' +
'              mBtn.className = "search-hl";\n' +
'              mBtn.textContent = match;\n' +
'              frag.appendChild(mBtn);\n' +
'              if (after) frag.appendChild(document.createTextNode(after));\n' +
'              child.replaceWith(frag);\n' +
'            }\n' +
'          }\n' +
'        });\n' +
'        let parentNode = el.parentElement.closest(".node");\n' +
'        while(parentNode){\n' +
'          parentNode.classList.remove("search-non-match");\n' +
'          parentNode.classList.add("open");\n' +
'          parentNode = parentNode.parentElement.closest(".node");\n' +
'        }\n' +
'      }\n' +
'    });\n' +
'    if(elementsToFocus.length > 0) {\n' +
'      elementsToFocus[0].classList.add("search-match-focus");\n' +
'      elementsToFocus[0].scrollIntoView({ behavior: "smooth", block: "start" });\n' +
'    }\n' +
'  });\n' +
'  function reAttachInteractions() {\n' +
'    root.querySelectorAll(".edit-trigger-btn").forEach(btn => {\n' +
'      btn.addEventListener("click", function(e){\n' +
'        const headerOrLeaf = btn.closest(".node-header") || btn.closest(".leaf");\n' +
'        const textTitleNode = headerOrLeaf.querySelector(".node-title") || headerOrLeaf;\n' +
'        let originalCleanText = "";\n' +
'        Array.from(textTitleNode.childNodes).forEach(node => {\n' +
'          if (node.nodeType === Node.TEXT_NODE || node.classList?.contains("user-highlight")) {\n' +
'            originalCleanText += node.textContent;\n' +
'          }\n' +
'        });\n' +
'        const input = document.createElement("input");\n' +
'        input.className = "inline-editor-input";\n' +
'        input.value = originalCleanText.trim();\n' +
'        function save() {\n' +
'          if(input.parentNode) {\n' +
'            if(textTitleNode.classList.contains("node-title")) {\n' +
'              textTitleNode.textContent = input.value;\n' +
'              textTitleNode.style.display = "";\n' +
'            } else {\n' +
'              headerOrLeaf.childNodes.forEach(n => { if(n.nodeType === Node.TEXT_NODE) n.remove(); });\n' +
'              headerOrLeaf.insertBefore(document.createTextNode(input.value), headerOrLeaf.firstChild);\n' +
'            }\n' +
'            input.remove();\n' +
'            headerOrLeaf.querySelectorAll(".control-group-buttons").forEach(b => b.style.display="");\n' +
'            let html = textTitleNode.innerHTML;\n' +
'            html = html.replace(/\\$\\$(.+?)\\$\\$/g, (m, f) => katex.renderToString(f.trim(), { displayMode: true, throwOnError: false }));\n' +
'            html = html.replace(/\\$(.+?)\\$/g, (m, f) => katex.renderToString(f.trim(), { displayMode: false, throwOnError: false }));\n' +
'            textTitleNode.innerHTML = html;\n' +
'            saveMiniState();\n' +
'          }\n' +
'        }\n' +
'        if(textTitleNode.classList.contains("node-title")) {\n' +
'          textTitleNode.style.display = "none";\n' +
'        } else {\n' +
'          Array.from(headerOrLeaf.childNodes).forEach(n => { if(n.nodeType === Node.TEXT_NODE) n.textContent = ""; });\n' +
'        }\n' +
'        headerOrLeaf.querySelectorAll(".control-group-buttons").forEach(b => b.style.display="none");\n' +
'        headerOrLeaf.insertBefore(input, headerOrLeaf.querySelector(".control-group-buttons"));\n' +
'        input.focus();\n' +
'        input.addEventListener("blur", save);\n' +
'        input.addEventListener("keydown", (evt) => { if(evt.key === "Enter") save(); });\n' +
'      });\n' +
'    });\n' +
'  }\n' +
'  window.addEventListener("DOMContentLoaded", () => {\n' +
'    let miniCache = localStorage.getItem(MINI_STORAGE_KEY);\n' +
'    if(miniCache) {\n' +
'      try {\n' +
'        let hMap = JSON.parse(miniCache);\n' +
'        root.querySelectorAll(".leaf, .node-header").forEach((el, idx) => {\n' +
'          if(hMap[idx]) {\n' +
'            let container = el.querySelector(".node-title") || el;\n' +
'            container.innerHTML = hMap[idx];\n' +
'          }\n' +
'        });\n' +
'      } catch(e){}\n' +
'    }\n' +
'    if(typeof katex !== "undefined") {\n' +
'      root.querySelectorAll(".node-title, .leaf:not(.table-leaf)").forEach(el => {\n' +
'        let html = el.innerHTML;\n' +
'        html = html.replace(/\\$\\$(.+?)\\$\\$/g, (m, f) => katex.renderToString(f.trim(), { displayMode: true, throwOnError: false }));\n' +
'        html = html.replace(/\\$(.+?)\\$/g, (m, f) => katex.renderToString(f.trim(), { displayMode: false, throwOnError: false }));\n' +
'        el.innerHTML = html;\n' +
'      });\n' +
'    }\n' +
'    reAttachInteractions();\n' +
'  });\n' +
'<\/script>\n' +
'</body>\n' +
'</html>\n';

    const blob = new Blob([compiledMiniTemplate], { type: 'text/html' });
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = URL.createObjectURL(blob);
    downloadAnchor.download = activeDocTitle.toLowerCase().replace(/[^a-z0-9]/gi, '_') + '_mini_playground.html';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  }

  function escapeHtml(str){
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escapeAttr(str){
    return escapeHtml(str).replace(/"/g,'&quot;');
  }

  // Renders **bold** markdown as <strong>, safely, after HTML-escaping the raw text.
  function renderInlineText(str){
    const escaped = escapeHtml(str);
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // Walks a rendered node's children and reconstructs the equivalent raw markdown
  // string (re-wrapping <strong> in ** and including user-highlight span text),
  // so edits/search can be matched back against the original raw text reliably.
  function nodeToMarkdownText(containerNode){
    let out = '';
    Array.from(containerNode.childNodes).forEach(function(child){
      if(child.nodeType === Node.TEXT_NODE){
        out += child.textContent;
      } else if(child.nodeType === Node.ELEMENT_NODE){
        if(child.tagName === 'STRONG'){
          out += '**' + nodeToMarkdownText(child) + '**';
        } else if(child.classList && child.classList.contains('user-highlight')){
          out += nodeToMarkdownText(child);
        }
      }
    });
    return out;
  }

  function classifyLeaf(text){
    if(/^(illustration|example)\b/i.test(text.trim()) || /\bheld\s*:/i.test(text)){ return 'leaf example'; }
    if(/^case\s*law\b/i.test(text.trim())){ return 'leaf caselaw'; }
    return 'leaf';
  }

  function isTableRowLine(line){
    const t = line.trim();
    return t.length > 1 && t.charAt(0) === '|' && t.charAt(t.length - 1) === '|';
  }
  function isTableSeparatorLine(line){
    if(!isTableRowLine(line)) return false;
    const cells = line.trim().slice(1, -1).split('|');
    return cells.length > 0 && cells.every(function(c){ return /^:?-{1,}:?$/.test(c.trim()); });
  }
  function parseTableRowCells(line){
    return line.trim().slice(1, -1).split('|').map(function(c){ return c.trim(); });
  }
  function tableRowsToHTML(rows){
    let out = '<div class="table-scroll"><table class="md-table"><thead><tr>';
    rows[0].forEach(function(c){ out += '<th>' + renderInlineText(c) + '</th>'; });
    out += '</tr></thead><tbody>';
    for(let r = 1; r < rows.length; r++){
      out += '<tr>';
      rows[r].forEach(function(c){ out += '<td>' + renderInlineText(c) + '</td>'; });
      out += '</tr>';
    }
    out += '</tbody></table></div>';
    return out;
  }

  function buildOutlineHTML(rawText){
    const lines = rawText.split('\n').filter(function(l){ return l.trim() !== ''; });
    const parsed = [];
    let li = 0;
    while(li < lines.length){
      const line = lines[li];

      // Markdown table: a "|...|" header row immediately followed by a "|---|---|" separator row.
      if(isTableRowLine(line) && li + 1 < lines.length && isTableSeparatorLine(lines[li+1])){
        const leadingSpaces = line.match(/^(\s*)/)[1].replace(/\t/g,'  ').length;
        let level = Math.floor(leadingSpaces / 2) + 1;
        if(level < 2) level = 2;
        const rows = [parseTableRowCells(line)];
        li += 2; // skip header row + separator row
        while(li < lines.length && isTableRowLine(lines[li])){
          rows.push(parseTableRowCells(lines[li]));
          li++;
        }
        parsed.push({ level: level, isTable: true, tableHTML: tableRowsToHTML(rows) });
        continue;
      }

      const leadingSpaces = line.match(/^(\s*)/)[1].replace(/\t/g,'  ').length;
      const trimmed = line.trim();
      let level, text;
      if(/^#{1,6}\s*/.test(trimmed)){
        text = trimmed.replace(/^#{1,6}\s*/, '');
        level = 1;
      }else if(/^-\s*/.test(trimmed)){
        text = trimmed.replace(/^-\s*/, '');
        level = Math.floor(leadingSpaces / 2) + 1;
        if(level < 2) level = 2;
      }else{
        text = trimmed;
        level = 2;
      }
      if(text) parsed.push({ level: level, text: text });
      li++;
    }

    if(parsed.length === 0) return '<div class="empty-state">Nothing to display. Check your formatting.</div>';

    for(let i = 0; i < parsed.length; i++){
      let hasChildren = false;
      if(!parsed[i].isTable && i + 1 < parsed.length && parsed[i+1].level > parsed[i].level) hasChildren = true;
      parsed[i].hasChildren = parsed[i].isTable ? false : (hasChildren || parsed[i].level === 1);
    }

    let html = '';
    const stack = []; 
    const utilityActionButtonsHtml = '<div class="control-group-buttons">' +
      '<button class="edit-trigger-btn" title="Edit Point">📝</button>' +
    '</div>';
    
    // Inject (E) and (C) specific inline action buttons logic on core level 1 headers
    const specificBlockLevelTriggersHtml = '<div class="specific-actions-group"><button class="spec-btn" data-action="expand">➕ Exp</button><button class="spec-btn" data-action="collapse">➖ Col</button></div>';

    parsed.forEach(function(item, idx){
      while(stack.length && stack[stack.length-1] >= item.level){
        html += '</div></div>'; 
        stack.pop();
      }
      if(item.isTable){
        html += '<div class="leaf table-leaf">' + item.tableHTML + '</div>';
        return;
      }
      if(item.hasChildren){
        html += '<div class="node" data-level="' + item.level + '">' +
                   '<div class="node-header"><span class="toggle-icon">&#9656;</span><span class="node-title">' + renderInlineText(item.text) + '</span>' + specificBlockLevelTriggersHtml + utilityActionButtonsHtml + '</div>' +
                   '<div class="node-children">';
        stack.push(item.level);
      }else{
        html += '<div class="' + classifyLeaf(item.text) + '">' + renderInlineText(item.text) + utilityActionButtonsHtml + '</div>';
      }
    });
    while(stack.length){
      html += '</div></div>';
      stack.pop();
    }
    return html;
  }

  // --- Real-time Highlighter Injector Engine inside Main Viewer ---
  function setupSearch(root){
    const searchInput = document.getElementById('searchInput');
    const resultCount = document.getElementById('resultCount');
    const noResults = document.getElementById('noResults');
    const allNodes = Array.from(root.querySelectorAll('.node'));

    function clearHighlights(){
      root.querySelectorAll('mark.search-hl').forEach(function(m){
        m.replaceWith(document.createTextNode(m.textContent));
      });
      root.normalize();
    }
    function resetSearchPreservingState(){
      root.querySelectorAll('.node, .leaf').forEach(function(el){
        el.classList.remove("search-non-match", "search-match-focus");
      });
      noResults.style.display = 'none';
      resultCount.textContent = '';
    }
    function handleSearch(){
      const q = searchInput.value.trim().toLowerCase();
      clearHighlights();
      if(!q){ resetSearchPreservingState(); return; }

      root.querySelectorAll('.node, .leaf').forEach(function(el) {
        el.classList.add("search-non-match");
        el.classList.remove("search-match-focus");
      });

      let matchCount = 0;
      let elementsToFocus = [];

      // Fix: Ensured safe loop execution context parsing inside deep nodes hierarchy
      function revealAncestors(el){
        let anc = el.closest('.node');
        while(anc){
          anc.classList.remove("search-non-match");
          anc.classList.add('open');
          const parentContainer = anc.parentElement;
          anc = parentContainer ? parentContainer.closest('.node') : null;
        }
      }

      root.querySelectorAll('.leaf, .node-header').forEach(function(el){
        const textTitleNode = el.querySelector('.node-title') || el;
        
        let textToScan = '';
        Array.from(textTitleNode.childNodes).forEach(child => {
          if(child.nodeType === Node.TEXT_NODE || child.classList?.contains('user-highlight')) {
            textToScan += child.textContent;
          }
        });
        
        if(textToScan.toLowerCase().includes(q)){
          matchCount++;
          if(el.classList.contains('leaf')) {
            el.classList.remove("search-non-match");
            elementsToFocus.push(el);
          } else {
            const containerNode = el.closest('.node');
            containerNode.classList.remove("search-non-match");
            containerNode.classList.add('open');
            containerNode.querySelectorAll('.leaf').forEach(l => l.classList.remove("search-non-match"));
            containerNode.querySelectorAll('.node').forEach(n => n.classList.remove("search-non-match"));
            elementsToFocus.push(el);
          }
          
          // Inject Highlights live
          Array.from(textTitleNode.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
              const rawVal = child.textContent;
              const idx = rawVal.toLowerCase().indexOf(q);
              if (idx !== -1) {
                const before = rawVal.slice(0, idx);
                const match = rawVal.slice(idx, idx + q.length);
                const after = rawVal.slice(idx + q.length);
                
                const frag = document.createDocumentFragment();
                if (before) frag.appendChild(document.createTextNode(before));
                const markEl = document.createElement('mark');
                markEl.className = 'search-hl';
                markEl.textContent = match;
                frag.appendChild(markEl);
                if (after) frag.appendChild(document.createTextNode(after));
                
                child.replaceWith(frag);
              }
            }
          });

          revealAncestors(el);
        }
      });
      
      if(elementsToFocus.length > 0) {
        elementsToFocus[0].classList.add("search-match-focus");
        
        // Dynamic Force Open Trigger Logic to ensure absolute layout expansion
        let parentNode = elementsToFocus[0].closest('.node');
        while(parentNode){
          parentNode.classList.add('open');
          parentNode = parentNode.parentElement.closest('.node');
        }

        // Exact frame target calculation context trigger 
        setTimeout(() => {
          const mainContainer = document.getElementById('mainArea');
          if(mainContainer) {
            const containerTop = mainContainer.getBoundingClientRect().top;
            const elemTop = elementsToFocus[0].getBoundingClientRect().top;
            const scrollTarget = elemTop - containerTop + mainContainer.scrollTop - 80;
            
            mainContainer.scrollTo({
              top: scrollTarget >= 0 ? scrollTarget : 0,
              behavior: "smooth"
            });
          }
        }, 50);
      }

      noResults.style.display = matchCount === 0 ? 'block' : 'none';
      resultCount.textContent = matchCount ? (matchCount + ' match' + (matchCount === 1 ? '' : 'es') + ' found') : '';
    }
    searchInput.addEventListener('input', handleSearch);
  }

  darkBtn.addEventListener('click', function(){
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    darkBtn.innerHTML = isDark ? '&#127769; Dark Mode' : '&#9728;&#65039; Light Mode';
  });

  newDocBtn.addEventListener('click', function(){ showEditor(); });

  function init(){
    mainArea.innerHTML = '<div class="empty-state">Loading…</div>';
    loadIndex();
    loadFolders();
    renderSidebar();
    if(index.length > 0){ openDoc(index[0].id); }else{ mode = 'empty'; renderMain(); }
  }
  init();
})();
