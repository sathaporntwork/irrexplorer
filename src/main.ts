import { fetchPrefixData, normalizeAsn } from './api';
import type { PrefixRecord, StatsSummary, FilterStatus, SortField, SortOrder } from './types';

// App State
let currentAsn = '';
let allRecords: PrefixRecord[] = [];
let filteredRecords: PrefixRecord[] = [];
let currentStats: StatsSummary = {
  totalPrefixes: 0,
  totalV4: 0,
  totalV6: 0,
  rpkiValid: 0,
  rpkiNotFound: 0,
  rpkiInvalid: 0,
  apnicValid: 0,
  apnicNotFound: 0,
};

let filterText = '';
let activeFilters: Set<FilterStatus> = new Set(['ALL']);
let sortField: SortField = 'prefix';
let sortOrder: SortOrder = 'asc';
let currentPage = 1;
const PAGE_SIZE = 50;

// DOM Elements
const asnForm = document.getElementById('asnForm') as HTMLFormElement;
const asnInput = document.getElementById('asnInput') as HTMLInputElement;
const btnQuery = document.getElementById('btnQuery') as HTMLButtonElement;
const currentAsnHeader = document.getElementById('currentAsnHeader') as HTMLElement;
const searchPrefixInput = document.getElementById('searchPrefixInput') as HTMLInputElement;
const filterChips = document.getElementById('filterChips') as HTMLElement;
const tableBody = document.getElementById('tableBody') as HTMLElement;
const stateContainer = document.getElementById('stateContainer') as HTMLElement;
const tableFooter = document.getElementById('tableFooter') as HTMLElement;
const showingInfo = document.getElementById('showingInfo') as HTMLElement;
const btnPrevPage = document.getElementById('btnPrevPage') as HTMLButtonElement;
const btnNextPage = document.getElementById('btnNextPage') as HTMLButtonElement;
const pageIndicator = document.getElementById('pageIndicator') as HTMLElement;
const btnExportCsv = document.getElementById('btnExportCsv') as HTMLButtonElement;
const btnExportJson = document.getElementById('btnExportJson') as HTMLButtonElement;
const detailModal = document.getElementById('detailModal') as HTMLElement;
const modalPrefixTitle = document.getElementById('modalPrefixTitle') as HTMLElement;
const modalBody = document.getElementById('modalBody') as HTMLElement;
const btnCloseModal = document.getElementById('btnCloseModal') as HTMLButtonElement;
const toastContainer = document.getElementById('toastContainer') as HTMLElement;
const loadingOverlay = document.getElementById('loadingOverlay') as HTMLElement | null;
const loadingDesc = document.getElementById('loadingDesc') as HTMLElement | null;

// Metric Elements
const valTotalPrefixes = document.getElementById('valTotalPrefixes') as HTMLElement;
const valIpBreakdown = document.getElementById('valIpBreakdown') as HTMLElement;
const valRpkiValid = document.getElementById('valRpkiValid') as HTMLElement;
const valRpkiValidPct = document.getElementById('valRpkiValidPct') as HTMLElement;
const barRpkiValid = document.getElementById('barRpkiValid') as HTMLElement;
const valRpkiNotFound = document.getElementById('valRpkiNotFound') as HTMLElement;
const valRpkiNotFoundPct = document.getElementById('valRpkiNotFoundPct') as HTMLElement;
const barRpkiNotFound = document.getElementById('barRpkiNotFound') as HTMLElement;
const valRpkiInvalid = document.getElementById('valRpkiInvalid') as HTMLElement;
const valRpkiInvalidPct = document.getElementById('valRpkiInvalidPct') as HTMLElement;
const barRpkiInvalid = document.getElementById('barRpkiInvalid') as HTMLElement;

/**
 * Show a toast notification
 */
function showToast(message: string, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(label);
  } catch {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast(label);
  }
}

/**
 * Render Status Badge
 */
function getStatusBadgeHtml(status: string): string {
  const s = status.toUpperCase();
  if (s === 'VALID') {
    return `<span class="status-badge valid">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
      VALID
    </span>`;
  } else if (s === 'NOT_FOUND') {
    return `<span class="status-badge notfound">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
      NOT FOUND
    </span>`;
  } else if (s === 'INVALID') {
    return `<span class="status-badge invalid">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
      INVALID
    </span>`;
  }
  return `<span class="status-badge notfound">${status}</span>`;
}

/**
 * Render summary statistics in metric cards
 */
function updateMetricsDisplay(stats: StatsSummary) {
  valTotalPrefixes.textContent = stats.totalPrefixes.toLocaleString();
  valIpBreakdown.textContent = `IPv4: ${stats.totalV4.toLocaleString()} | IPv6: ${stats.totalV6.toLocaleString()}`;

  valRpkiValid.textContent = stats.rpkiValid.toLocaleString();
  const validPct = stats.totalPrefixes > 0 ? ((stats.rpkiValid / stats.totalPrefixes) * 100).toFixed(1) : '0.0';
  valRpkiValidPct.textContent = `${validPct}% of total`;
  barRpkiValid.style.width = `${validPct}%`;

  valRpkiNotFound.textContent = stats.rpkiNotFound.toLocaleString();
  const notFoundPct = stats.totalPrefixes > 0 ? ((stats.rpkiNotFound / stats.totalPrefixes) * 100).toFixed(1) : '0.0';
  valRpkiNotFoundPct.textContent = `${notFoundPct}% of total`;
  barRpkiNotFound.style.width = `${notFoundPct}%`;

  valRpkiInvalid.textContent = stats.rpkiInvalid.toLocaleString();
  const invalidPct = stats.totalPrefixes > 0 ? ((stats.rpkiInvalid / stats.totalPrefixes) * 100).toFixed(1) : '0.0';
  valRpkiInvalidPct.textContent = `${invalidPct}% of total`;
  barRpkiInvalid.style.width = `${invalidPct}%`;
}

/**
 * Human-readable label for a filter tag
 */
function getFilterLabel(filter: FilterStatus): string {
  switch (filter) {
    case 'V4': return 'IPv4';
    case 'V6': return 'IPv6';
    case 'RPKI_VALID': return 'RPKI Valid';
    case 'RPKI_NOT_FOUND': return 'RPKI Not Found';
    case 'RPKI_INVALID': return 'RPKI Invalid';
    case 'APNIC_VALID': return 'APNIC Valid';
    case 'APNIC_NOT_FOUND': return 'APNIC Not Found';
    default: return 'All';
  }
}

/**
 * Filter & Sort dataset (Supports Multi-Selection)
 */
function applyFilterAndSort() {
  const query = filterText.toLowerCase().trim();

  // Categorize active filters into dimensions
  const ipFilters = new Set<FilterStatus>();
  const rpkiFilters = new Set<FilterStatus>();
  const apnicFilters = new Set<FilterStatus>();

  for (const f of activeFilters) {
    if (f === 'V4' || f === 'V6') ipFilters.add(f);
    if (f === 'RPKI_VALID' || f === 'RPKI_NOT_FOUND' || f === 'RPKI_INVALID') rpkiFilters.add(f);
    if (f === 'APNIC_VALID' || f === 'APNIC_NOT_FOUND') apnicFilters.add(f);
  }

  // 1. Text Search & Filter Categories
  filteredRecords = allRecords.filter(record => {
    // Search match in prefix or ASN
    const matchesQuery = !query ||
      record.prefix.toLowerCase().includes(query) ||
      record.asn.toLowerCase().includes(query);

    if (!matchesQuery) return false;

    // If 'ALL' is selected alone, allow all records through
    if (activeFilters.has('ALL') && activeFilters.size === 1) {
      return true;
    }

    // Dimension 1: IP Version (OR within dimension)
    if (ipFilters.size > 0) {
      const matchV4 = ipFilters.has('V4') && record.typeIp === 'v4';
      const matchV6 = ipFilters.has('V6') && record.typeIp === 'v6';
      if (!matchV4 && !matchV6) return false;
    }

    // Dimension 2: RPKI Status (OR within dimension)
    if (rpkiFilters.size > 0) {
      const matchValid = rpkiFilters.has('RPKI_VALID') && record.rpki === 'VALID';
      const matchNotFound = rpkiFilters.has('RPKI_NOT_FOUND') && record.rpki === 'NOT_FOUND';
      const matchInvalid = rpkiFilters.has('RPKI_INVALID') && record.rpki === 'INVALID';
      if (!matchValid && !matchNotFound && !matchInvalid) return false;
    }

    // Dimension 3: APNIC Status (OR within dimension)
    if (apnicFilters.size > 0) {
      const matchApnicValid = apnicFilters.has('APNIC_VALID') && record.apnic === 'VALID';
      const matchApnicNotFound = apnicFilters.has('APNIC_NOT_FOUND') && record.apnic === 'NOT_FOUND';
      if (!matchApnicValid && !matchApnicNotFound) return false;
    }

    return true;
  });

  // 2. Sorting
  filteredRecords.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'prefix') {
      const typeA = a.typeIp === 'v4' ? 0 : 1;
      const typeB = b.typeIp === 'v4' ? 0 : 1;
      if (typeA !== typeB) {
        cmp = typeA - typeB;
      } else {
        cmp = a.prefix.localeCompare(b.prefix, undefined, { numeric: true });
      }
    } else if (sortField === 'typeIp') {
      cmp = a.typeIp.localeCompare(b.typeIp);
    } else if (sortField === 'apnic') {
      cmp = a.apnic.localeCompare(b.apnic);
    } else if (sortField === 'rpki') {
      cmp = a.rpki.localeCompare(b.rpki);
    } else if (sortField === 'asn') {
      cmp = a.asn.localeCompare(b.asn, undefined, { numeric: true });
    }

    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // Reset to first page
  currentPage = 1;
  renderTable();
}

/**
 * Render rows for current page
 */
function renderTable() {
  const total = filteredRecords.length;

  if (total === 0) {
    tableBody.innerHTML = '';
    stateContainer.style.display = 'block';
    stateContainer.innerHTML = `
      <div class="state-box">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 class="state-title">No matching prefix records</h3>
        <p class="state-desc">Try clearing or adjusting your search query or filter tags.</p>
      </div>
    `;
    tableFooter.style.display = 'none';
    return;
  }

  stateContainer.style.display = 'none';
  tableFooter.style.display = 'flex';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, total);
  const pageItems = filteredRecords.slice(startIndex, endIndex);

  // Update footer info with active filter summary
  const activeLabels = Array.from(activeFilters).map(getFilterLabel);
  const filterDesc = activeFilters.has('ALL') && activeFilters.size === 1
    ? ''
    : ` • Active: ${activeLabels.join(', ')}`;

  showingInfo.textContent = `Showing ${startIndex + 1}–${endIndex} of ${total.toLocaleString()} prefixes (Filtered from ${allRecords.length.toLocaleString()})${filterDesc}`;
  pageIndicator.textContent = `Page ${currentPage} / ${totalPages}`;
  btnPrevPage.disabled = currentPage <= 1;
  btnNextPage.disabled = currentPage >= totalPages;

  // Build rows
  tableBody.innerHTML = pageItems.map((row, index) => {
    const globalIdx = startIndex + index;
    return `
      <tr>
        <td>
          <div class="prefix-cell">
            <span>${row.prefix}</span>
            <button type="button" class="btn-copy" data-copy="${row.prefix}" title="Copy prefix">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </td>
        <td>
          <span class="ip-badge ${row.typeIp}">IP${row.typeIp}</span>
        </td>
        <td>${getStatusBadgeHtml(row.apnic)}</td>
        <td>${getStatusBadgeHtml(row.rpki)}</td>
        <td><span class="asn-cell">${row.asn}</span></td>
        <td style="text-align: right;">
          <button type="button" class="btn-detail" data-idx="${globalIdx}">
            Inspect
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Open Detail Modal for prefix inspection
 */
function openDetailModal(record: PrefixRecord) {
  modalPrefixTitle.textContent = `${record.prefix} (${record.typeIp.toUpperCase()})`;

  const matched = record.matchedRoute;
  const rpslText = matched?.rpslText || (record.rawItem?.rpkiRoutes?.[0]?.rpslText) || 'No RPSL route object data available for this prefix.';
  const rir = record.rir || 'Unknown';
  const sources = record.allIrrSources?.length ? record.allIrrSources.join(', ') : 'None';

  modalBody.innerHTML = `
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Prefix</div>
        <div class="info-val font-mono">${record.prefix}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Origin ASN</div>
        <div class="info-val font-mono">${record.asn}</div>
      </div>
      <div class="info-item">
        <div class="info-label">APNIC IRR Status</div>
        <div class="info-val">${getStatusBadgeHtml(record.apnic)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">RPKI Status</div>
        <div class="info-val">${getStatusBadgeHtml(record.rpki)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Allocated RIR</div>
        <div class="info-val">${rir}</div>
      </div>
      <div class="info-item">
        <div class="info-label">IRR Database Sources</div>
        <div class="info-val">${sources}</div>
      </div>
    </div>

    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span class="info-label">RPSL Route Object Record</span>
        <button type="button" class="btn-secondary" id="btnCopyRpsl" style="padding: 0.25rem 0.55rem; font-size: 0.72rem;">
          Copy RPSL
        </button>
      </div>
      <pre class="rpsl-box" id="modalRpslText">${rpslText}</pre>
    </div>
  `;

  const btnCopyRpsl = document.getElementById('btnCopyRpsl');
  if (btnCopyRpsl) {
    btnCopyRpsl.addEventListener('click', () => {
      copyToClipboard(rpslText, 'RPSL text copied to clipboard');
    });
  }

  detailModal.classList.add('open');
  detailModal.setAttribute('aria-hidden', 'false');
}

function closeDetailModal() {
  detailModal.classList.remove('open');
  detailModal.setAttribute('aria-hidden', 'true');
}

/**
 * Export data as CSV file
 */
function exportToCsv() {
  if (!filteredRecords.length) {
    showToast('No records to export');
    return;
  }

  const headers = ['PREFIX', 'TYPEIP', 'APNIC', 'RPKI', 'ASN', 'RIR'];
  const csvRows = [headers.join(',')];

  for (const r of filteredRecords) {
    csvRows.push([
      `"${r.prefix}"`,
      `"${r.typeIp}"`,
      `"${r.apnic}"`,
      `"${r.rpki}"`,
      `"${r.asn}"`,
      `"${r.rir || ''}"`
    ].join(','));
  }

  const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rpki_irr_AS${currentAsn}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${filteredRecords.length.toLocaleString()} rows to CSV`);
}

/**
 * Export data as JSON file
 */
function exportToJson() {
  if (!filteredRecords.length) {
    showToast('No records to export');
    return;
  }

  const exportData = filteredRecords.map(r => ({
    PREFIX: r.prefix,
    TYPEIP: r.typeIp,
    APNIC: r.apnic,
    RPKI: r.rpki,
    ASN: r.asn,
    RIR: r.rir || null,
  }));

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rpki_irr_AS${currentAsn}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported JSON data for AS${currentAsn}`);
}

/**
 * Fetch and load ASN data
 */
async function loadAsn(asn: string) {
  const clean = normalizeAsn(asn);
  if (!clean) return;

  currentAsn = clean;
  asnInput.value = clean;
  currentAsnHeader.textContent = `Autonomous System: AS${clean}`;

  // Update browser URL query param without reload
  const url = new URL(window.location.href);
  url.searchParams.set('asn', clean);
  window.history.replaceState({}, '', url.toString());


  // Show iridescent liquid glass loading overlay
  if (loadingOverlay) {
    if (loadingDesc) {
      loadingDesc.textContent = `Fetching direct origin and overlapping prefixes for AS${clean}...`;
    }
    loadingOverlay.classList.add('active');
    loadingOverlay.setAttribute('aria-hidden', 'false');
  }

  // Loading state
  btnQuery.disabled = true;
  btnExportCsv.disabled = true;
  btnExportJson.disabled = true;
  tableBody.innerHTML = '';
  tableFooter.style.display = 'none';
  stateContainer.style.display = 'block';
  stateContainer.innerHTML = `
    <div class="state-box">
      <div class="spinner"></div>
      <h3 class="state-title">Querying NLNOG IRR Explorer...</h3>
      <p class="state-desc">Fetching direct origin and overlapping prefixes for AS${clean}</p>
    </div>
  `;

  try {
    // Run fetch and guarantee smooth perception of the iridescent glass orb animation
    const [result] = await Promise.all([
      fetchPrefixData(clean),
      new Promise((resolve) => setTimeout(resolve, 650)),
    ]);
    allRecords = result.records;
    currentStats = result.stats;

    updateMetricsDisplay(currentStats);
    applyFilterAndSort();
    showToast(`Loaded ${allRecords.length.toLocaleString()} prefixes for AS${clean}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    stateContainer.style.display = 'block';
    stateContainer.innerHTML = `
      <div class="state-box">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3 class="state-title" style="color: #fb7185;">Failed to load data</h3>
        <p class="state-desc">${message}</p>
        <button type="button" class="btn-primary" id="btnRetry" style="margin-top: 0.75rem;">
          Retry Query
        </button>
      </div>
    `;
    const btnRetry = document.getElementById('btnRetry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => loadAsn(clean));
    }
  } finally {
    // Hide liquid glass loading overlay
    if (loadingOverlay) {
      loadingOverlay.classList.remove('active');
      loadingOverlay.setAttribute('aria-hidden', 'true');
    }
    btnQuery.disabled = false;
    btnExportCsv.disabled = false;
    btnExportJson.disabled = false;
  }
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
  // Query Form Submit
  asnForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loadAsn(asnInput.value);
  });


  // Search Prefix with Debounce
  let debounceTimeout: number | undefined;
  searchPrefixInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = window.setTimeout(() => {
      filterText = (e.target as HTMLInputElement).value;
      applyFilterAndSort();
    }, 150);
  });

  // Update active classes on filter chip elements
  function updateFilterChipsUi() {
    filterChips.querySelectorAll<HTMLElement>('.filter-chip').forEach(chip => {
      const filter = chip.getAttribute('data-filter') as FilterStatus;
      if (activeFilters.has(filter)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // Filter Segmented Chips (Normal click: single select | Ctrl/Cmd/Shift click: multi-select)
  filterChips.addEventListener('click', (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.filter-chip') as HTMLElement | null;
    if (!target) return;

    const clickedFilter = (target.getAttribute('data-filter') as FilterStatus) || 'ALL';
    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;

    if (isMultiSelect) {
      if (clickedFilter === 'ALL') {
        // Clicking ALL clears other filters
        activeFilters.clear();
        activeFilters.add('ALL');
      } else {
        // Remove ALL since specific filters are being toggled
        activeFilters.delete('ALL');

        // Toggle clicked filter
        if (activeFilters.has(clickedFilter)) {
          activeFilters.delete(clickedFilter);
        } else {
          activeFilters.add(clickedFilter);
        }

        // If no filter remains selected, revert to ALL
        if (activeFilters.size === 0) {
          activeFilters.add('ALL');
        }
      }
    } else {
      // Normal click: single select behavior
      if (clickedFilter === 'ALL') {
        activeFilters.clear();
        activeFilters.add('ALL');
      } else {
        // If clicking the only active filter, toggle off back to ALL
        if (activeFilters.size === 1 && activeFilters.has(clickedFilter)) {
          activeFilters.clear();
          activeFilters.add('ALL');
        } else {
          activeFilters.clear();
          activeFilters.add(clickedFilter);
        }
      }
    }

    updateFilterChipsUi();
    applyFilterAndSort();
  });

  // Table Sorting
  document.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort') as SortField;
      if (sortField === field) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        sortField = field;
        sortOrder = 'asc';
      }

      // Update header indicators
      document.querySelectorAll<HTMLTableCellElement>('th[data-sort]').forEach(header => {
        header.classList.remove('sorted');
        const icon = header.querySelector('.sort-icon');
        if (icon) icon.textContent = '↕';
      });

      th.classList.add('sorted');
      const curIcon = th.querySelector('.sort-icon');
      if (curIcon) {
        curIcon.textContent = sortOrder === 'asc' ? '↑' : '↓';
      }

      applyFilterAndSort();
    });
  });

  // Delegate Table Clicks (Copy Prefix, Detail modal)
  tableBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Copy Prefix Button
    const copyBtn = target.closest<HTMLButtonElement>('.btn-copy');
    if (copyBtn) {
      const text = copyBtn.getAttribute('data-copy');
      if (text) copyToClipboard(text, `Copied ${text}`);
      return;
    }

    // Inspect / Detail Button
    const detailBtn = target.closest<HTMLButtonElement>('.btn-detail');
    if (detailBtn) {
      const idx = parseInt(detailBtn.getAttribute('data-idx') || '0', 10);
      const record = filteredRecords[idx];
      if (record) openDetailModal(record);
      return;
    }
  });

  // Pagination
  btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  });

  btnNextPage.addEventListener('click', () => {
    const maxPage = Math.ceil(filteredRecords.length / PAGE_SIZE);
    if (currentPage < maxPage) {
      currentPage++;
      renderTable();
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  });

  // Export buttons
  btnExportCsv.addEventListener('click', exportToCsv);
  btnExportJson.addEventListener('click', exportToJson);

  // Modal Close
  btnCloseModal.addEventListener('click', closeDetailModal);
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailModal.classList.contains('open')) {
      closeDetailModal();
    }
  });
}

/**
 * Update live clock display in yyyy-mm-dd hh:ii:ss format
 */
function updateLiveClock() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const clockEl = document.getElementById('clockText');
  if (clockEl) {
    clockEl.textContent = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * Show initial empty prompt before any ASN is queried
 */
function showInitialState() {
  currentAsnHeader.textContent = 'Enter an Autonomous System Number to explore';
  btnExportCsv.disabled = true;
  btnExportJson.disabled = true;
  tableBody.innerHTML = '';
  tableFooter.style.display = 'none';
  stateContainer.style.display = 'block';
  stateContainer.innerHTML = `
    <div class="state-box">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-primary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.85;">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <path d="M11 8v6"></path>
        <path d="M8 11h6"></path>
      </svg>
      <h3 class="state-title">Ready to Explore</h3>
      <p class="state-desc">Please enter an Autonomous System Number (ASN) in the input box above and click <strong>Query ASN</strong> to fetch IRR prefix records and RPKI status.</p>
    </div>
  `;
}

/**
 * Initialize Application
 */
function init() {
  setupEventListeners();

  // Start live clock
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // If ASN parameter is present in URL, prefill the input without auto-fetching
  const params = new URLSearchParams(window.location.search);
  const paramAsn = params.get('asn');
  if (paramAsn) {
    asnInput.value = normalizeAsn(paramAsn);
  }

  showInitialState();
}

// Start
init();
