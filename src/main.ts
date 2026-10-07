import { fetchPrefixData, normalizeAsn } from './api';
import type { PrefixRecord, StatsSummary, FilterStatus, SortField, SortOrder, AdviceMessage } from './types';

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

// Custom Prefix Filter State
let customPrefixFilters: string[] = [];
let customPrefixRawText: string = '';

// DOM Elements
const asnForm = document.getElementById('asnForm') as HTMLFormElement;
const asnInput = document.getElementById('asnInput') as HTMLInputElement;
const btnQuery = document.getElementById('btnQuery') as HTMLButtonElement;
const currentAsnHeader = document.getElementById('currentAsnHeader') as HTMLElement;
const searchPrefixInput = document.getElementById('searchPrefixInput') as HTMLInputElement;
const filterChips = document.getElementById('filterChips') as HTMLElement;
const customFilterChipBadge = document.getElementById('customFilterChipBadge') as HTMLElement | null;
const customChipText = document.getElementById('customChipText') as HTMLElement | null;
const btnRemoveCustomChip = document.getElementById('btnRemoveCustomChip') as HTMLButtonElement | null;
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

// Header Prefix Filter & Modal Elements
const btnOpenPrefixFilter = document.getElementById('btnOpenPrefixFilter') as HTMLButtonElement;
const headerFilterBadge = document.getElementById('headerFilterBadge') as HTMLElement;
const prefixFilterModal = document.getElementById('prefixFilterModal') as HTMLElement;
const btnCloseFilterModal = document.getElementById('btnCloseFilterModal') as HTMLButtonElement;
const btnCancelFilterModal = document.getElementById('btnCancelFilterModal') as HTMLButtonElement;
const btnClearPrefixFilter = document.getElementById('btnClearPrefixFilter') as HTMLButtonElement;
const btnApplyPrefixFilter = document.getElementById('btnApplyPrefixFilter') as HTMLButtonElement;
const prefixTextarea = document.getElementById('prefixTextarea') as HTMLTextAreaElement;
const filterItemsCount = document.getElementById('filterItemsCount') as HTMLElement;
const filterStatusInfo = document.getElementById('filterStatusInfo') as HTMLElement;
const filterStatusText = document.getElementById('filterStatusText') as HTMLElement;

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

interface ShortAdvice {
  shortText: string;
  category: 'danger' | 'warning' | 'info' | 'success';
  fullText: string;
  thaiTooltip: string;
}

/**
 * Convert full verbose IRR Explorer advice message into a concise, easily understood badge label
 */
function getShortAdvice(msg: AdviceMessage): ShortAdvice {
  const text = (msg.text || '').trim();
  const rawCat = (msg.category || '').toLowerCase();
  const category: 'danger' | 'warning' | 'info' | 'success' =
    rawCat === 'danger' || rawCat === 'error' ? 'danger' :
    rawCat === 'warning' ? 'warning' :
    rawCat === 'success' ? 'success' : 'info';

  // 1. RPKI origin mismatch
  if (text.includes('RPKI origin does not match BGP origin')) {
    return {
      shortText: 'RPKI ≠ BGP',
      category: 'danger',
      fullText: text,
      thaiTooltip: 'RPKI origin ไม่ตรงกับ BGP origin (ASN ใน ROA ไม่ตรงกับที่ประกาศจริง)'
    };
  }

  // 2. Multiple IRR origins
  if (text.includes('Multiple route objects exist with different origins')) {
    return {
      shortText: 'Multi IRR Origins',
      category: 'warning',
      fullText: text,
      thaiTooltip: 'พบ Route Objects ใน IRR หลายแห่งที่ระบุ Origin ASN ต่างกัน'
    };
  }

  // 3. RPKI-invalid route objects found
  if (text.includes('RPKI-invalid route objects')) {
    return {
      shortText: 'RPKI Invalid IRR',
      category: 'danger',
      fullText: text,
      thaiTooltip: 'พบ Route Object ใน IRR ที่ขัดแย้งกับสถานะ RPKI (Invalid)'
    };
  }

  // 4. No route objects match DFZ origin
  if (text.includes('No route objects match DFZ origin')) {
    return {
      shortText: 'No IRR for DFZ',
      category: 'danger',
      fullText: text,
      thaiTooltip: 'ไม่มี Route Object ใน IRR ที่ตรงกับ Origin ASN บน DFZ'
    };
  }

  // 5. No route objects for some DFZ origins
  if (text.includes('No route objects for some DFZ origins')) {
    return {
      shortText: 'Partial IRR Match',
      category: 'warning',
      fullText: text,
      thaiTooltip: 'ไม่มี Route Object รองรับ Origin ASN บางตัวของ DFZ'
    };
  }

  // 6. Expected route object in ..., but BGP origin does not match
  if (text.includes('Expected route object in') && text.includes('BGP origin does not match')) {
    return {
      shortText: 'RIR ≠ BGP',
      category: 'danger',
      fullText: text,
      thaiTooltip: 'Route Object ใน RIR ประจำทวีปไม่ตรงกับ BGP Origin'
    };
  }

  // 7. Expected route object in ..., but only found in other IRRs
  if (text.includes('Expected route object in') && text.includes('only found in other IRRs')) {
    return {
      shortText: 'Non-Regional IRR',
      category: 'warning',
      fullText: text,
      thaiTooltip: 'ไม่พบใน RIR ประจำทวีป พบเฉพาะใน IRR ภายนอก'
    };
  }

  // 8. Expected route object in ... matches BGP origin, but non-matching objects exist in other IRRs
  if (text.includes('matches BGP origin, but non-matching objects exist in other IRRs')) {
    return {
      shortText: 'IRR Conflict',
      category: 'warning',
      fullText: text,
      thaiTooltip: 'มี Route Object ที่ขัดแย้งกันค้างอยู่ใน IRR อื่น'
    };
  }

  // 9. Route objects exist, but prefix not seen in DFZ
  if (text.includes('Route objects exist, but prefix not seen in DFZ')) {
    return {
      shortText: 'Not in DFZ',
      category: 'info',
      fullText: text,
      thaiTooltip: 'มี Route Object ใน IRR แต่ Prefix นี้ไม่ได้ประกาศบน BGP DFZ'
    };
  }

  // 10. RPKI ROA exists, but prefix not seen in DFZ
  if (text.includes('RPKI ROA exists, but prefix not seen in DFZ')) {
    return {
      shortText: 'ROA Not in DFZ',
      category: 'info',
      fullText: text,
      thaiTooltip: 'มี RPKI ROA แต่ Prefix นี้ไม่ได้ประกาศบน BGP DFZ'
    };
  }

  // 11. No (covering) RPKI ROA found for route objects
  if (text.includes('No (covering) RPKI ROA found')) {
    return {
      shortText: 'No ROA Found',
      category: 'info',
      fullText: text,
      thaiTooltip: 'ไม่พบ RPKI ROA สำหรับ Route Object ใน IRR'
    };
  }

  // 12. Overlaps with special use prefix
  if (text.includes('special use prefix')) {
    return {
      shortText: 'Special Use IP',
      category: 'danger',
      fullText: text,
      thaiTooltip: 'Prefix ทับซ้อนกับ IP พิเศษ (Special Use Space)'
    };
  }

  // 13. Everything looks good
  if (text.includes('Everything looks good')) {
    return {
      shortText: 'OK',
      category: 'success',
      fullText: text,
      thaiTooltip: 'การกำหนดค่าสมบูรณ์ ไม่พบข้อขัดแย้ง'
    };
  }

  // Fallback: concise 2-3 words
  const words = text.split(' ');
  const concise = words.length > 3 ? words.slice(0, 3).join(' ') + '…' : text;
  return {
    shortText: concise,
    category,
    fullText: text,
    thaiTooltip: text
  };
}

/**
 * Render concise Advice Badges HTML for table cells
 */
function renderAdviceBadges(messages?: AdviceMessage[]): string {
  if (!messages || messages.length === 0) {
    return `<span class="advice-badge ok" title="Everything looks good • ไม่พบข้อขัดแย้ง"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> OK</span>`;
  }

  const items = messages
    .filter(m => m.text && !m.text.includes('Everything looks good'))
    .map(getShortAdvice);

  if (items.length === 0) {
    return `<span class="advice-badge ok" title="Everything looks good • ไม่พบข้อขัดแย้ง"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> OK</span>`;
  }

  // Sort severity: danger (0) -> warning (1) -> info (2) -> success (3)
  const severityOrder: Record<string, number> = { danger: 0, warning: 1, info: 2, success: 3 };
  items.sort((a, b) => (severityOrder[a.category] ?? 9) - (severityOrder[b.category] ?? 9));

  return `<div class="advice-badges-cell">${items.map(item => {
    let iconSvg = '';
    if (item.category === 'danger') {
      iconSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else if (item.category === 'warning') {
      iconSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else if (item.category === 'info') {
      iconSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    } else {
      iconSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    }

    const titleAttr = `${item.fullText}\n(${item.thaiTooltip})`;
    return `<span class="advice-badge ${item.category}" title="${titleAttr.replace(/"/g, '&quot;')}">${iconSvg}<span>${item.shortText}</span></span>`;
  }).join('')}</div>`;
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
 * Parse raw user input into an array of trimmed prefixes
 * Supports newline (\n, \r), comma (,), semicolon (;), and spaces
 */
function parsePrefixInput(text: string): string[] {
  return text
    .split(/[\r\n,;]+/)
    .map(p => p.trim().replace(/['"`]/g, ''))
    .filter(p => p.length > 0);
}

/**
 * Convert standard IPv4 string into 32-bit unsigned integer
 */
function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

/**
 * Convert IPv6 string into 128-bit BigInt
 */
function ipv6ToBigInt(ip: string): bigint | null {
  try {
    let clean = ip.trim().toLowerCase();
    if (clean.includes(':::')) return null;

    if (clean.includes('::')) {
      const parts = clean.split('::');
      if (parts.length > 2) return null;
      const left = parts[0] ? parts[0].split(':') : [];
      const right = parts[1] ? parts[1].split(':') : [];
      const missing = 8 - (left.length + right.length);
      if (missing < 0) return null;
      const middle = new Array(missing).fill('0');
      const allParts = [...left, ...middle, ...right];
      clean = allParts.join(':');
    }

    const segments = clean.split(':');
    if (segments.length !== 8) return null;

    let result = 0n;
    for (const seg of segments) {
      if (!seg || seg.length > 4 || !/^[0-9a-f]+$/i.test(seg)) return null;
      const val = BigInt(parseInt(seg, 16));
      result = (result << 16n) | val;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Check if a single prefix record matches a filter query item
 * EXACT MATCH ONLY: Matches only the specified prefix itself.
 * Does NOT perform longer match (more specifics) or supernet match (less specifics).
 */
function matchesPrefixFilterItem(recordPrefix: string, filterItem: string): boolean {
  const normRecord = recordPrefix.trim().toLowerCase().replace(/\s*\/\s*/, '/');
  const normFilter = filterItem.trim().toLowerCase().replace(/\s*\/\s*/, '/');

  // 1. Direct normalized string match
  if (normRecord === normFilter) return true;

  // 2. IPv4 Exact CIDR match (Exact same network address AND exact same prefix length)
  if (!normRecord.includes(':') && !normFilter.includes(':') && normRecord.includes('/') && normFilter.includes('/')) {
    const [fIp, fMaskStr] = normFilter.split('/');
    const [rIp, rMaskStr] = normRecord.split('/');
    const fMask = parseInt(fMaskStr, 10);
    const rMask = parseInt(rMaskStr, 10);
    // Must be strictly equal prefix length (No longer match, No supernet match)
    if (!isNaN(fMask) && !isNaN(rMask) && fMask === rMask && fMask >= 0 && fMask <= 32) {
      const fNum = ipv4ToNumber(fIp);
      const rNum = ipv4ToNumber(rIp);
      if (fNum !== null && rNum !== null) {
        const mask = fMask === 0 ? 0 : (~0 << (32 - fMask)) >>> 0;
        return (fNum & mask) === (rNum & mask);
      }
    }
  }

  // 3. IPv6 Exact CIDR match (Exact same network address BigInt AND exact same prefix length)
  if (normRecord.includes(':') && normFilter.includes(':') && normRecord.includes('/') && normFilter.includes('/')) {
    const [fIp, fMaskStr] = normFilter.split('/');
    const [rIp, rMaskStr] = normRecord.split('/');
    const fMask = parseInt(fMaskStr, 10);
    const rMask = parseInt(rMaskStr, 10);
    // Must be strictly equal prefix length (No longer match, No supernet match)
    if (!isNaN(fMask) && !isNaN(rMask) && fMask === rMask && fMask >= 0 && fMask <= 128) {
      const fBig = ipv6ToBigInt(fIp);
      const rBig = ipv6ToBigInt(rIp);
      if (fBig !== null && rBig !== null) {
        const shift = BigInt(128 - fMask);
        return (fBig >> shift) === (rBig >> shift);
      }
    }
  }

  return false;
}

/**
 * Check if a record matches any item in customPrefixFilters
 */
function matchesCustomPrefixFilter(recordPrefix: string, filterList: string[]): boolean {
  if (filterList.length === 0) return true;
  return filterList.some(item => matchesPrefixFilterItem(recordPrefix, item));
}

/**
 * Update UI state indicators for Custom Prefix Filter
 */
function updateCustomPrefixUi() {
  const count = customPrefixFilters.length;
  if (count > 0) {
    btnOpenPrefixFilter.classList.add('active');
    headerFilterBadge.textContent = String(count);
    headerFilterBadge.style.display = 'inline-flex';

    if (customFilterChipBadge && customChipText) {
      customChipText.textContent = `Prefix Filter: ${count} rule${count > 1 ? 's' : ''}`;
      customFilterChipBadge.style.display = 'inline-flex';
    }
  } else {
    btnOpenPrefixFilter.classList.remove('active');
    headerFilterBadge.style.display = 'none';

    if (customFilterChipBadge) {
      customFilterChipBadge.style.display = 'none';
    }
  }
}

/**
 * Update prefix count label in modal textarea header
 */
function updateModalCountDisplay() {
  const currentList = parsePrefixInput(prefixTextarea.value);
  filterItemsCount.textContent = `${currentList.length} prefix${currentList.length === 1 ? '' : 'es'} entered`;
}

/**
 * Open Prefix Filter Modal
 */
function openPrefixFilterModal() {
  prefixTextarea.value = customPrefixRawText;
  updateModalCountDisplay();

  const count = customPrefixFilters.length;
  if (count > 0) {
    filterStatusInfo.classList.add('has-active');
    filterStatusText.textContent = `Currently active: ${count} prefix rule${count > 1 ? 's' : ''}`;
  } else {
    filterStatusInfo.classList.remove('has-active');
    filterStatusText.textContent = 'No prefix filter applied yet';
  }

  prefixFilterModal.classList.add('open');
  prefixFilterModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => prefixTextarea.focus(), 80);
}

/**
 * Close Prefix Filter Modal
 */
function closePrefixFilterModal() {
  prefixFilterModal.classList.remove('open');
  prefixFilterModal.setAttribute('aria-hidden', 'true');
}

/**
 * Apply Custom Prefix Filter from modal
 */
function applyCustomPrefixFilter() {
  const rawText = prefixTextarea.value;
  const parsed = parsePrefixInput(rawText);

  // Deduplicate case-insensitively
  const seen = new Set<string>();
  const uniqueList: string[] = [];
  for (const p of parsed) {
    const lower = p.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueList.push(p);
    }
  }

  customPrefixRawText = rawText;
  customPrefixFilters = uniqueList;
  updateCustomPrefixUi();
  closePrefixFilterModal();

  applyFilterAndSort();

  if (customPrefixFilters.length > 0) {
    if (allRecords.length > 0) {
      showToast(`Applied prefix filter: ${filteredRecords.length.toLocaleString()} of ${allRecords.length.toLocaleString()} prefixes matched`);
    } else {
      showToast(`Prefix filter set (${customPrefixFilters.length} prefixes). Ready for ASN scan.`);
    }
  } else {
    showToast('Prefix filter is empty (showing all prefixes)');
  }
}

/**
 * Clear Custom Prefix Filter
 */
function clearCustomPrefixFilter() {
  customPrefixFilters = [];
  customPrefixRawText = '';
  prefixTextarea.value = '';
  updateModalCountDisplay();
  updateCustomPrefixUi();
  applyFilterAndSort();
  showToast('Prefix filter cleared');
}

/**
 * Filter & Sort dataset (Supports Multi-Selection and Custom Prefix Filter)
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

  // 1. Filter Records
  filteredRecords = allRecords.filter(record => {
    // 0. Custom Prefix List Filter (multi-prefix matching)
    if (customPrefixFilters.length > 0) {
      if (!matchesCustomPrefixFilter(record.prefix, customPrefixFilters)) {
        return false;
      }
    }

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
    } else if (sortField === 'advice') {
      const getAdviceRank = (rec: PrefixRecord) => {
        if (!rec.messages || rec.messages.length === 0) return 0;
        const cats = rec.messages.map(m => (m.category || '').toLowerCase());
        if (cats.includes('danger') || cats.includes('error')) return 3;
        if (cats.includes('warning')) return 2;
        if (cats.includes('info')) return 1;
        return 0;
      };
      cmp = getAdviceRank(b) - getAdviceRank(a);
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
        <p class="state-desc">Try clearing or adjusting your search query or prefix filter list.</p>
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
  const filterDescParts: string[] = [];
  if (!(activeFilters.has('ALL') && activeFilters.size === 1)) {
    filterDescParts.push(`Status: ${activeLabels.join(', ')}`);
  }
  if (customPrefixFilters.length > 0) {
    filterDescParts.push(`Prefix Filter: ${customPrefixFilters.length} rule${customPrefixFilters.length > 1 ? 's' : ''}`);
  }
  const filterDesc = filterDescParts.length > 0 ? ` • ${filterDescParts.join(' • ')}` : '';

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
        <td>${renderAdviceBadges(row.messages)}</td>
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

  // Format Advice List for Modal
  const rawAdvice = record.messages || [];
  const adviceItems = rawAdvice.map(getShortAdvice);
  const adviceHtml = adviceItems.length > 0 ? `
    <div class="info-item" style="grid-column: span 2;">
      <div class="info-label" style="margin-bottom: 0.45rem;">Routing Advice & Findings (ข้อสังเกตและคำแนะนำ)</div>
      <div style="display: flex; flex-direction: column; gap: 0.45rem;">
        ${adviceItems.map(item => `
          <div style="display: flex; align-items: flex-start; gap: 0.55rem; background: rgba(0,0,0,0.35); padding: 0.5rem 0.75rem; border-radius: 8px; border-left: 3px solid ${item.category === 'danger' ? '#ff493a' : item.category === 'warning' ? '#ff9f0a' : item.category === 'success' ? '#30d168' : '#64748b'};">
            <span class="advice-badge ${item.category}" style="flex-shrink: 0; margin-top: 2px;">${item.shortText}</span>
            <div style="font-size: 0.8rem; line-height: 1.4;">
              <div style="color: var(--text-main); font-weight: 600;">${item.fullText}</div>
              <div style="color: var(--text-muted); font-size: 0.74rem; margin-top: 2px;">${item.thaiTooltip}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : `
    <div class="info-item" style="grid-column: span 2;">
      <div class="info-label">Routing Advice & Findings</div>
      <div style="font-size: 0.82rem; color: #30d168; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.25rem;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Everything looks good (การกำหนดค่า BGP, IRR และ RPKI ปกติสมบูรณ์)</span>
      </div>
    </div>
  `;

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
      ${adviceHtml}
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

  const headers = ['PREFIX', 'TYPEIP', 'APNIC', 'RPKI', 'ASN', 'ADVICE', 'RIR'];
  const csvRows = [headers.join(',')];

  for (const r of filteredRecords) {
    const adviceText = (r.messages || []).map(m => getShortAdvice(m).shortText).join('; ') || 'OK';
    csvRows.push([
      `"${r.prefix}"`,
      `"${r.typeIp}"`,
      `"${r.apnic}"`,
      `"${r.rpki}"`,
      `"${r.asn}"`,
      `"${adviceText}"`,
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
    ADVICE: (r.messages || []).map(m => getShortAdvice(m).shortText).join('; ') || 'OK',
    ADVICE_DETAILS: (r.messages || []).map(m => m.text),
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
    if (customPrefixFilters.length > 0) {
      showToast(`Loaded ${allRecords.length.toLocaleString()} prefixes for AS${clean} (${filteredRecords.length.toLocaleString()} matched prefix filter)`);
    } else {
      showToast(`Loaded ${allRecords.length.toLocaleString()} prefixes for AS${clean}`);
    }
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

  // Detail Modal Close
  btnCloseModal.addEventListener('click', closeDetailModal);
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });

  // Prefix Filter Modal Events
  btnOpenPrefixFilter.addEventListener('click', openPrefixFilterModal);
  btnCloseFilterModal.addEventListener('click', closePrefixFilterModal);
  btnCancelFilterModal.addEventListener('click', closePrefixFilterModal);
  btnClearPrefixFilter.addEventListener('click', clearCustomPrefixFilter);
  btnApplyPrefixFilter.addEventListener('click', applyCustomPrefixFilter);

  // Live count update while typing in textarea
  prefixTextarea.addEventListener('input', updateModalCountDisplay);

  // Clear or open modal from table filter chip
  if (btnRemoveCustomChip) {
    btnRemoveCustomChip.addEventListener('click', (e) => {
      e.stopPropagation();
      clearCustomPrefixFilter();
    });
  }
  if (customFilterChipBadge) {
    customFilterChipBadge.addEventListener('click', () => {
      openPrefixFilterModal();
    });
  }

  // Close prefix filter modal on background click
  prefixFilterModal.addEventListener('click', (e) => {
    if (e.target === prefixFilterModal) closePrefixFilterModal();
  });

  // Global Escape Key Listener for Modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (prefixFilterModal.classList.contains('open')) {
        closePrefixFilterModal();
      } else if (detailModal.classList.contains('open')) {
        closeDetailModal();
      }
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
