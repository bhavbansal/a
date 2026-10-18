/**
 * Agrawal Client, Vendor & Invoice Management System
 * Minimalist, Vanilla JavaScript with Supabase Cloud Sync & LocalStorage Support.
 * Strictly conforms to DESIGN.md (Awesomic Zinc Editorial).
 */

// ================= STORAGE KEYS =================
const KEYS = {
  SETTINGS: 'agrawal_settings_data',
  CLIENTS: 'agrawal_clients_data',
  VENDORS: 'agrawal_vendors_data',
  CLIENT_INVOICES: 'agrawal_client_invoices_data',
  VENDOR_INVOICES: 'agrawal_vendor_invoices_data',
  CLIENT_PAYMENTS: 'agrawal_client_payments_data',
  VENDOR_PAYMENTS: 'agrawal_vendor_payments_data',
  SUPABASE_CONFIG: 'agrawal_supabase_config'
};

// ================= DEFAULT INITIAL DATA =================
const DEFAULT_SETTINGS = {
  id: 1,
  company_name: 'Agrawal Stationery & Printers',
  tagline: 'शासकीय आर्डर सप्लायर्स',
  full_address: 'कन्हैया हजारी का बाड़ा माधवगंज, विदिशा (म.प्र.) 464001',
  mobile_number: '94065 50160',
  gstin: '23AHUPA8808P1ZQ',
  header_logo_url: '',
  predefined_units: 'Nos, Pcs, Box, Kg, Pkt, Bundle, Set, Roll, Mtr',
  default_gst_rate: 18,
  payment_modes: 'Cash, UPI, Bank Transfer, Cheque, RTGS/NEFT',
  bank_name: 'BANK OF BARODA',
  account_no: '31370500002933',
  ifsc_branch: 'VIDISHA & BARB0VIDISH'
};

// Initial state holders
let appState = {
  settings: { ...DEFAULT_SETTINGS },
  clients: [],
  vendors: [],
  clientInvoices: [],
  vendorInvoices: [],
  clientPayments: [],
  vendorPayments: []
};

let supabaseClient = null;
let currentLedgerEntity = null; // { type: 'client'|'vendor', id: string }
let currentBuilderEntityType = 'client';
let clientInvoiceFilter = 'all';
let vendorInvoiceFilter = 'all';

// ================= 1. INDIAN CURRENCY NUMBER TO WORDS =================
function numberToWordsIndian(num) {
  const n = parseFloat(num);
  if (isNaN(n) || n <= 0) return 'Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const twoDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensMultiple = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 10) return singleDigits[n];
    if (n >= 10 && n < 20) return twoDigits[n - 10];
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return tensMultiple[tens] + (ones > 0 ? ' ' + singleDigits[ones] : '');
  }

  function convertThreeDigits(n) {
    let str = '';
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    if (hundred > 0) {
      str += singleDigits[hundred] + ' Hundred';
      if (rest > 0) str += ' and ';
    }
    if (rest > 0) {
      str += convertTwoDigits(rest);
    }
    return str;
  }

  const integerPart = Math.floor(n);
  const decimalPart = Math.round((n - integerPart) * 100);

  let result = '';
  let temp = integerPart;

  const crore = Math.floor(temp / 10000000);
  temp %= 10000000;
  const lakh = Math.floor(temp / 100000);
  temp %= 100000;
  const thousand = Math.floor(temp / 1000);
  temp %= 1000;
  const hundredAndRest = temp;

  if (crore > 0) result += convertTwoDigits(crore) + ' Crore ';
  if (lakh > 0) result += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) result += convertTwoDigits(thousand) + ' Thousand ';
  if (hundredAndRest > 0) result += convertThreeDigits(hundredAndRest) + ' ';

  result = result.trim() + ' Rupees';

  if (decimalPart > 0) {
    result += ' and ' + convertTwoDigits(decimalPart) + ' Paise';
  }

  return result + ' Only';
}

// ================= 2. TOAST NOTIFICATIONS =================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// ================= 3. SUPABASE INITIALIZATION & SYNC =================
function initSupabase(url, key) {
  const statusBadge = document.getElementById('nav-cloud-status');
  const modalStatus = document.getElementById('supabase-status');

  if (!url || !key) {
    supabaseClient = null;
    if (statusBadge) {
      statusBadge.classList.remove('connected');
      statusBadge.querySelector('.status-label').textContent = 'Local Storage';
    }
    if (modalStatus) {
      modalStatus.textContent = 'Local Only';
      modalStatus.className = 'status-indicator';
    }
    return null;
  }

  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(url.trim(), key.trim());
      if (statusBadge) {
        statusBadge.classList.add('connected');
        statusBadge.querySelector('.status-label').textContent = 'Cloud Connected';
      }
      if (modalStatus) {
        modalStatus.textContent = 'Connected';
        modalStatus.className = 'status-indicator connected';
      }
      return supabaseClient;
    }
  } catch (err) {
    console.error('Supabase connection error:', err);
  }
  return null;
}

// Synchronize all data from Supabase if connected
async function syncFromCloud() {
  if (!supabaseClient) return;

  try {
    // 1. Settings
    const { data: setRes } = await supabaseClient.from('company_settings').select('*').eq('id', 1).single();
    if (setRes) {
      appState.settings = { ...appState.settings, ...setRes };
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(appState.settings));
      applySettingsToUI();
    }

    // 2. Clients
    const { data: clRes } = await supabaseClient.from('clients').select('*').order('created_at', { ascending: false });
    if (clRes) {
      appState.clients = clRes;
      localStorage.setItem(KEYS.CLIENTS, JSON.stringify(clRes));
      renderClients();
    }

    // 3. Vendors
    const { data: vnRes } = await supabaseClient.from('vendors').select('*').order('created_at', { ascending: false });
    if (vnRes) {
      appState.vendors = vnRes;
      localStorage.setItem(KEYS.VENDORS, JSON.stringify(vnRes));
      renderVendors();
    }

    // 4. Client Invoices
    const { data: cinvRes } = await supabaseClient.from('client_invoices').select('*').order('created_at', { ascending: false });
    if (cinvRes) {
      appState.clientInvoices = cinvRes;
      localStorage.setItem(KEYS.CLIENT_INVOICES, JSON.stringify(cinvRes));
      renderClientInvoices();
    }

    // 5. Vendor Invoices
    const { data: vinvRes } = await supabaseClient.from('vendor_invoices').select('*').order('created_at', { ascending: false });
    if (vinvRes) {
      appState.vendorInvoices = vinvRes;
      localStorage.setItem(KEYS.VENDOR_INVOICES, JSON.stringify(vinvRes));
      renderVendorInvoices();
    }

    // 6. Client Payments
    const { data: cpayRes } = await supabaseClient.from('client_payments').select('*').order('created_at', { ascending: false });
    if (cpayRes) {
      appState.clientPayments = cpayRes;
      localStorage.setItem(KEYS.CLIENT_PAYMENTS, JSON.stringify(cpayRes));
    }

    // 7. Vendor Payments
    const { data: vpayRes } = await supabaseClient.from('vendor_payments').select('*').order('created_at', { ascending: false });
    if (vpayRes) {
      appState.vendorPayments = vpayRes;
      localStorage.setItem(KEYS.VENDOR_PAYMENTS, JSON.stringify(vpayRes));
    }

    updateMainDashboard();
  } catch (err) {
    console.warn('Background cloud sync notice:', err.message);
  }
}

// ================= 4. LOCAL DATA LOAD =================
function loadLocalData() {
  // Settings
  const savedSettings = localStorage.getItem(KEYS.SETTINGS);
  if (savedSettings) {
    try { appState.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }; } catch (e) {}
  }

  // Clients
  const savedClients = localStorage.getItem(KEYS.CLIENTS);
  if (savedClients) {
    try { appState.clients = JSON.parse(savedClients); } catch (e) {}
  } else {
    // Seed initial demo client for first-time beginner view
    appState.clients = [
      {
        id: 'cl_' + Date.now(),
        name: 'District Education Office (DEO)',
        keyword: 'deo',
        contact_person: 'Shri Manoj Agrawal',
        mobile: '98260 44123',
        email: 'deo.vidisha@mp.gov.in',
        gstin: '23MPED00001Z9',
        billing_address: 'Collectorate Campus, Vidisha (M.P.)',
        notes: 'Annual stationery tender orders',
        is_archived: false,
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(appState.clients));
  }

  // Vendors
  const savedVendors = localStorage.getItem(KEYS.VENDORS);
  if (savedVendors) {
    try { appState.vendors = JSON.parse(savedVendors); } catch (e) {}
  } else {
    // Seed initial demo vendor for first-time beginner view
    appState.vendors = [
      {
        id: 'vn_' + Date.now(),
        name: 'Orient Paper & Mills Suppliers',
        keyword: 'orient',
        contact_person: 'Mr. Pradeep Sharma',
        mobile: '94250 88234',
        email: 'sales@orientmills.in',
        gstin: '23OPMS1234F1Z8',
        billing_address: 'Industrial Area, Govindpura, Bhopal (M.P.)',
        notes: 'Wholesale ledger and paper ream supplier',
        is_archived: false,
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(KEYS.VENDORS, JSON.stringify(appState.vendors));
  }

  // Client Invoices
  const savedClientInvoices = localStorage.getItem(KEYS.CLIENT_INVOICES);
  if (savedClientInvoices) {
    try { appState.clientInvoices = JSON.parse(savedClientInvoices); } catch (e) {}
  }

  // Vendor Invoices
  const savedVendorInvoices = localStorage.getItem(KEYS.VENDOR_INVOICES);
  if (savedVendorInvoices) {
    try { appState.vendorInvoices = JSON.parse(savedVendorInvoices); } catch (e) {}
  }

  // Client Payments
  const savedClientPayments = localStorage.getItem(KEYS.CLIENT_PAYMENTS);
  if (savedClientPayments) {
    try { appState.clientPayments = JSON.parse(savedClientPayments); } catch (e) {}
  }

  // Vendor Payments
  const savedVendorPayments = localStorage.getItem(KEYS.VENDOR_PAYMENTS);
  if (savedVendorPayments) {
    try { appState.vendorPayments = JSON.parse(savedVendorPayments); } catch (e) {}
  }

  // Supabase Config
  const savedSb = localStorage.getItem(KEYS.SUPABASE_CONFIG);
  if (savedSb) {
    try {
      const cfg = JSON.parse(savedSb);
      if (cfg.url && cfg.key) {
        document.getElementById('supabase-url').value = cfg.url;
        document.getElementById('supabase-key').value = cfg.key;
        initSupabase(cfg.url, cfg.key);
      }
    } catch (e) {}
  }
}

// ================= 5. MASTER SETTINGS LOGIC =================
function applySettingsToUI() {
  const s = appState.settings;

  // Top Navbar
  document.getElementById('nav-brand-name').textContent = s.company_name || 'My Company';
  document.getElementById('nav-brand-tagline').textContent = s.tagline || '';

  // Main Home Badge Panel
  document.getElementById('summary-company').textContent = s.company_name || '-';
  document.getElementById('summary-gstin').textContent = s.gstin || '-';
  document.getElementById('summary-contact').textContent = s.mobile_number || '-';
  document.getElementById('summary-bank').textContent = s.bank_name || '-';

  // Fill Settings Modal Form Inputs
  document.getElementById('company-name').value = s.company_name || '';
  document.getElementById('company-tagline').value = s.tagline || '';
  document.getElementById('company-gstin').value = s.gstin || '';
  document.getElementById('company-mobile').value = s.mobile_number || '';
  document.getElementById('company-address').value = s.full_address || '';
  document.getElementById('setting-default-gst').value = s.default_gst_rate || 18;
  document.getElementById('setting-units').value = s.predefined_units || '';
  document.getElementById('setting-payment-modes').value = s.payment_modes || '';
  document.getElementById('setting-bank-name').value = s.bank_name || '';
  document.getElementById('setting-account-no').value = s.account_no || '';
  document.getElementById('setting-ifsc').value = s.ifsc_branch || '';

  // Header Image / Logo Preview
  const logoPreviewBox = document.getElementById('logo-preview-box');
  const logoPreviewImg = document.getElementById('logo-preview-img');
  const removeLogoBtn = document.getElementById('btn-remove-logo');

  if (s.header_logo_url) {
    logoPreviewImg.src = s.header_logo_url;
    logoPreviewBox.style.display = 'block';
    removeLogoBtn.style.display = 'inline-block';
  } else {
    logoPreviewImg.src = '';
    logoPreviewBox.style.display = 'none';
    removeLogoBtn.style.display = 'none';
  }

  // Update Paper Invoice Header Elements
  const paperTextHeader = document.getElementById('paper-text-header');
  const paperImageHeader = document.getElementById('paper-image-header');
  const paperHeaderImg = document.getElementById('paper-header-img');

  if (s.header_logo_url) {
    paperTextHeader.style.display = 'none';
    paperImageHeader.style.display = 'block';
    paperHeaderImg.src = s.header_logo_url;
  } else {
    paperTextHeader.style.display = 'block';
    paperImageHeader.style.display = 'none';
    document.getElementById('paper-tagline').textContent = s.tagline || '';
    document.getElementById('paper-gstin').textContent = s.gstin || '';
    document.getElementById('paper-company-name').textContent = s.company_name || '';
    document.getElementById('paper-address').textContent = s.full_address || '';
    document.getElementById('paper-mobile').textContent = s.mobile_number || '';
  }

  // Paper Bank details
  document.getElementById('paper-bank-name').textContent = s.bank_name || '';
  document.getElementById('paper-account-no').textContent = s.account_no || '';
  document.getElementById('paper-ifsc').textContent = s.ifsc_branch || '';
  document.getElementById('paper-sign-company').textContent = (s.company_name || '').toUpperCase();
}

// Logo image file upload handler (converts to base64 for portable zero-server persistence)
function handleLogoUpload(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      appState.settings.header_logo_url = e.target.result;
      document.getElementById('logo-preview-img').src = e.target.result;
      document.getElementById('logo-preview-box').style.display = 'block';
      document.getElementById('btn-remove-logo').style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  }
}

function removeLogoImage() {
  appState.settings.header_logo_url = '';
  document.getElementById('company-header-logo-input').value = '';
  document.getElementById('logo-preview-img').src = '';
  document.getElementById('logo-preview-box').style.display = 'none';
  document.getElementById('btn-remove-logo').style.display = 'none';
}

// Settings Modal Controls
const settingsModal = document.getElementById('settings-modal');
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

function openSettingsModal() {
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
  applySettingsToUI();
}

function closeSettingsModal() {
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
}

if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsModal);
if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettingsModal);

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const statusMsg = document.getElementById('save-status-msg');
  statusMsg.className = 'status-message';
  statusMsg.textContent = 'Saving settings...';
  statusMsg.style.display = 'block';

  const updatedSettings = {
    ...appState.settings,
    id: 1,
    company_name: document.getElementById('company-name').value.trim(),
    tagline: document.getElementById('company-tagline').value.trim(),
    gstin: document.getElementById('company-gstin').value.trim(),
    mobile_number: document.getElementById('company-mobile').value.trim(),
    full_address: document.getElementById('company-address').value.trim(),
    default_gst_rate: parseFloat(document.getElementById('setting-default-gst').value) || 18,
    predefined_units: document.getElementById('setting-units').value.trim(),
    payment_modes: document.getElementById('setting-payment-modes').value.trim(),
    bank_name: document.getElementById('setting-bank-name').value.trim(),
    account_no: document.getElementById('setting-account-no').value.trim(),
    ifsc_branch: document.getElementById('setting-ifsc').value.trim(),
    updated_at: new Date().toISOString()
  };

  appState.settings = updatedSettings;
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(updatedSettings));
  applySettingsToUI();

  // Supabase Credentials
  const sbUrl = document.getElementById('supabase-url').value.trim();
  const sbKey = document.getElementById('supabase-key').value.trim();

  if (sbUrl && sbKey) {
    localStorage.setItem(KEYS.SUPABASE_CONFIG, JSON.stringify({ url: sbUrl, key: sbKey }));
    const client = initSupabase(sbUrl, sbKey);
    if (client) {
      try {
        const { error } = await client.from('company_settings').upsert(updatedSettings, { onConflict: 'id' });
        if (error) {
          statusMsg.className = 'status-message error';
          statusMsg.textContent = `Saved locally. Supabase: ${error.message}`;
          return;
        }
      } catch (err) {
        statusMsg.className = 'status-message error';
        statusMsg.textContent = `Saved locally. Supabase error: ${err.message}`;
        return;
      }
    }
  } else {
    localStorage.removeItem(KEYS.SUPABASE_CONFIG);
    initSupabase('', '');
  }

  statusMsg.className = 'status-message success';
  statusMsg.textContent = '✓ Master settings updated successfully!';
  showToast('Global settings saved successfully!', 'success');

  setTimeout(() => {
    closeSettingsModal();
    statusMsg.style.display = 'none';
  }, 900);
});

// ================= 6. NAVIGATION & TAB SWITCHING =================
const navTabs = document.querySelectorAll('.bottom-dock .nav-tab');
const pageViews = document.querySelectorAll('.page-view');
const subViews = document.querySelectorAll('.sub-view');

function switchTab(pageId) {
  // Hide any open sub-views
  subViews.forEach(v => v.classList.remove('active'));

  // Switch active page
  pageViews.forEach(page => {
    if (page.id === pageId) {
      page.classList.add('active');
    } else {
      page.classList.remove('active');
    }
  });

  // Switch dock tab highlighting
  navTabs.forEach(tab => {
    if (tab.getAttribute('data-page') === pageId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Refresh relevant tables on tab switch
  if (pageId === 'page-main-home') updateMainDashboard();
  if (pageId === 'page-client-management') renderClients();
  if (pageId === 'page-vendor-management') renderVendors();
  if (pageId === 'page-client-dashboard') renderClientInvoices();
  if (pageId === 'page-vendor-dashboard') renderVendorInvoices();
}

navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetPageId = tab.getAttribute('data-page');
    switchTab(targetPageId);
  });
});

// Close backdrop on outside click
[settingsModal, document.getElementById('client-modal'), document.getElementById('vendor-modal'), document.getElementById('payment-modal'), document.getElementById('status-modal')].forEach(modal => {
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });
});

// ================= 7. CLIENT MANAGEMENT =================
function renderClients(filterQuery = '') {
  const tbody = document.getElementById('clients-tbody');
  const countBadge = document.getElementById('client-count-badge');
  if (!tbody) return;

  const q = filterQuery.toLowerCase().trim();
  const filtered = appState.clients.filter(c => {
    if (c.is_archived) return false;
    if (!q) return true;
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.keyword && c.keyword.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  });

  countBadge.textContent = `${filtered.length} Client${filtered.length === 1 ? '' : 's'} Registered`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 32px 0;">No clients found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const stats = calculatePartyBalance('client', c.id);
    const balanceColor = stats.outstanding > 0 ? 'text-accent font-bold' : 'text-success font-bold';

    return `
      <tr>
        <td><span class="code-badge">${c.keyword || '-'}</span></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.contact_person || '-'}</td>
        <td>${c.mobile || '-'}</td>
        <td><small>${c.gstin || '-'}</small></td>
        <td class="text-right ${balanceColor}">₹${stats.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-center">
          <div class="action-btns-wrap">
            <button class="btn btn-secondary btn-sm" onclick="openLedger('client', '${c.id}')" title="Open Dedicated Ledger">Ledger</button>
            <button class="btn btn-ghost btn-sm" onclick="openClientModal('${c.id}')" title="Edit Client">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="archiveParty('client', '${c.id}')" title="Archive Client">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterClients() {
  const query = document.getElementById('client-search-input').value;
  renderClients(query);
}

// Client Modal Controls
function openClientModal(clientId = null) {
  const modal = document.getElementById('client-modal');
  const title = document.getElementById('client-modal-title');
  const idInput = document.getElementById('client-form-id');

  if (clientId) {
    const client = appState.clients.find(c => c.id === clientId);
    if (!client) return;
    title.textContent = 'Edit Client Profile';
    idInput.value = client.id;
    document.getElementById('client-name').value = client.name || '';
    document.getElementById('client-keyword').value = client.keyword || '';
    document.getElementById('client-contact').value = client.contact_person || '';
    document.getElementById('client-mobile').value = client.mobile || '';
    document.getElementById('client-email').value = client.email || '';
    document.getElementById('client-gstin').value = client.gstin || '';
    document.getElementById('client-address').value = client.billing_address || '';
    document.getElementById('client-notes').value = client.notes || '';
  } else {
    title.textContent = 'Add New Client';
    idInput.value = '';
    document.getElementById('client-form').reset();
  }

  modal.classList.add('open');
}

function closeClientModal() {
  document.getElementById('client-modal').classList.remove('open');
}

async function saveClientForm(e) {
  e.preventDefault();
  const idInput = document.getElementById('client-form-id').value;
  const isEdit = !!idInput;
  const clientId = isEdit ? idInput : 'cl_' + Date.now();

  const clientData = {
    id: clientId,
    name: document.getElementById('client-name').value.trim(),
    keyword: document.getElementById('client-keyword').value.trim().toLowerCase(),
    contact_person: document.getElementById('client-contact').value.trim(),
    mobile: document.getElementById('client-mobile').value.trim(),
    email: document.getElementById('client-email').value.trim(),
    gstin: document.getElementById('client-gstin').value.trim(),
    billing_address: document.getElementById('client-address').value.trim(),
    notes: document.getElementById('client-notes').value.trim(),
    is_archived: false,
    created_at: isEdit ? (appState.clients.find(c => c.id === clientId)?.created_at || new Date().toISOString()) : new Date().toISOString()
  };

  if (isEdit) {
    appState.clients = appState.clients.map(c => c.id === clientId ? clientData : c);
  } else {
    appState.clients.unshift(clientData);
  }

  localStorage.setItem(KEYS.CLIENTS, JSON.stringify(appState.clients));
  renderClients();
  closeClientModal();
  showToast(`Client "${clientData.name}" saved successfully!`, 'success');

  // Supabase sync
  if (supabaseClient) {
    try {
      await supabaseClient.from('clients').upsert(clientData, { onConflict: 'id' });
    } catch (err) {
      console.warn('Cloud sync error for client:', err.message);
    }
  }
}

// ================= 8. VENDOR MANAGEMENT =================
function renderVendors(filterQuery = '') {
  const tbody = document.getElementById('vendors-tbody');
  const countBadge = document.getElementById('vendor-count-badge');
  if (!tbody) return;

  const q = filterQuery.toLowerCase().trim();
  const filtered = appState.vendors.filter(v => {
    if (v.is_archived) return false;
    if (!q) return true;
    return (
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.keyword && v.keyword.toLowerCase().includes(q)) ||
      (v.mobile && v.mobile.includes(q)) ||
      (v.gstin && v.gstin.toLowerCase().includes(q))
    );
  });

  countBadge.textContent = `${filtered.length} Vendor${filtered.length === 1 ? '' : 's'} Registered`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 32px 0;">No vendors found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(v => {
    const stats = calculatePartyBalance('vendor', v.id);
    const balanceColor = stats.outstanding > 0 ? 'text-accent font-bold' : 'text-success font-bold';

    return `
      <tr>
        <td><span class="code-badge">${v.keyword || '-'}</span></td>
        <td><strong>${v.name}</strong></td>
        <td>${v.contact_person || '-'}</td>
        <td>${v.mobile || '-'}</td>
        <td><small>${v.gstin || '-'}</small></td>
        <td class="text-right ${balanceColor}">₹${stats.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="text-center">
          <div class="action-btns-wrap">
            <button class="btn btn-secondary btn-sm" onclick="openLedger('vendor', '${v.id}')" title="Open Dedicated Ledger">Ledger</button>
            <button class="btn btn-ghost btn-sm" onclick="openVendorModal('${v.id}')" title="Edit Vendor">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-ghost btn-sm text-danger" onclick="archiveParty('vendor', '${v.id}')" title="Archive Vendor">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterVendors() {
  const query = document.getElementById('vendor-search-input').value;
  renderVendors(query);
}

// Vendor Modal Controls
function openVendorModal(vendorId = null) {
  const modal = document.getElementById('vendor-modal');
  const title = document.getElementById('vendor-modal-title');
  const idInput = document.getElementById('vendor-form-id');

  if (vendorId) {
    const vendor = appState.vendors.find(v => v.id === vendorId);
    if (!vendor) return;
    title.textContent = 'Edit Vendor Profile';
    idInput.value = vendor.id;
    document.getElementById('vendor-name').value = vendor.name || '';
    document.getElementById('vendor-keyword').value = vendor.keyword || '';
    document.getElementById('vendor-contact').value = vendor.contact_person || '';
    document.getElementById('vendor-mobile').value = vendor.mobile || '';
    document.getElementById('vendor-email').value = vendor.email || '';
    document.getElementById('vendor-gstin').value = vendor.gstin || '';
    document.getElementById('vendor-address').value = vendor.billing_address || '';
    document.getElementById('vendor-notes').value = vendor.notes || '';
  } else {
    title.textContent = 'Add New Vendor';
    idInput.value = '';
    document.getElementById('vendor-form').reset();
  }

  modal.classList.add('open');
}

function closeVendorModal() {
  document.getElementById('vendor-modal').classList.remove('open');
}

async function saveVendorForm(e) {
  e.preventDefault();
  const idInput = document.getElementById('vendor-form-id').value;
  const isEdit = !!idInput;
  const vendorId = isEdit ? idInput : 'vn_' + Date.now();

  const vendorData = {
    id: vendorId,
    name: document.getElementById('vendor-name').value.trim(),
    keyword: document.getElementById('vendor-keyword').value.trim().toLowerCase(),
    contact_person: document.getElementById('vendor-contact').value.trim(),
    mobile: document.getElementById('vendor-mobile').value.trim(),
    email: document.getElementById('vendor-email').value.trim(),
    gstin: document.getElementById('vendor-gstin').value.trim(),
    billing_address: document.getElementById('vendor-address').value.trim(),
    notes: document.getElementById('vendor-notes').value.trim(),
    is_archived: false,
    created_at: isEdit ? (appState.vendors.find(v => v.id === vendorId)?.created_at || new Date().toISOString()) : new Date().toISOString()
  };

  if (isEdit) {
    appState.vendors = appState.vendors.map(v => v.id === vendorId ? vendorData : v);
  } else {
    appState.vendors.unshift(vendorData);
  }

  localStorage.setItem(KEYS.VENDORS, JSON.stringify(appState.vendors));
  renderVendors();
  closeVendorModal();
  showToast(`Vendor "${vendorData.name}" saved successfully!`, 'success');

  // Supabase sync
  if (supabaseClient) {
    try {
      await supabaseClient.from('vendors').upsert(vendorData, { onConflict: 'id' });
    } catch (err) {
      console.warn('Cloud sync error for vendor:', err.message);
    }
  }
}

// Archive helper
async function archiveParty(type, id) {
  const isClient = type === 'client';
  const list = isClient ? appState.clients : appState.vendors;
  const item = list.find(x => x.id === id);
  if (!item) return;

  if (!confirm(`Are you sure you want to archive ${isClient ? 'client' : 'vendor'} "${item.name}"?`)) return;

  item.is_archived = true;
  localStorage.setItem(isClient ? KEYS.CLIENTS : KEYS.VENDORS, JSON.stringify(list));

  if (isClient) renderClients();
  else renderVendors();

  showToast(`${isClient ? 'Client' : 'Vendor'} archived.`, 'info');

  if (supabaseClient) {
    try {
      await supabaseClient.from(isClient ? 'clients' : 'vendors').update({ is_archived: true }).eq('id', id);
    } catch (e) {}
  }
}

// ================= 9. BALANCE & LEDGER CALCULATION =================
function calculatePartyBalance(type, partyId) {
  const isClient = type === 'client';
  const invoices = (isClient ? appState.clientInvoices : appState.vendorInvoices).filter(inv => {
    return isClient ? (inv.client_id === partyId) : (inv.vendor_id === partyId);
  });

  const payments = (isClient ? appState.clientPayments : appState.vendorPayments).filter(p => {
    return isClient ? (p.client_id === partyId) : (p.vendor_id === partyId);
  });

  const totalBilled = invoices.reduce((sum, inv) => sum + (parseFloat(inv.grand_total) || 0), 0);
  const totalPaid = payments.reduce((sum, pay) => sum + (parseFloat(pay.amount) || 0), 0);
  const outstanding = totalBilled - totalPaid;

  return {
    totalBilled,
    totalPaid,
    outstanding,
    invoicesCount: invoices.length,
    paymentsCount: payments.length,
    lastInvoiceDate: invoices.length > 0 ? invoices[0].invoice_date : '-',
    lastPaymentDate: payments.length > 0 ? payments[0].payment_date : '-'
  };
}

// Open Dedicated Ledger
function openLedger(type, partyId) {
  currentLedgerEntity = { type, id: partyId };
  const isClient = type === 'client';
  const party = (isClient ? appState.clients : appState.vendors).find(p => p.id === partyId);
  if (!party) return;

  // Set Header & Badges
  document.getElementById('ledger-entity-type-badge').textContent = isClient ? 'Client Ledger' : 'Vendor Ledger';
  document.getElementById('ledger-title-name').textContent = party.name;
  document.getElementById('ledger-metric-label-billed').textContent = isClient ? 'Total Invoiced Sales' : 'Total Purchases';
  document.getElementById('ledger-metric-label-paid').textContent = isClient ? 'Total Collections (Received)' : 'Total Paid Out';

  // Compute stats
  const stats = calculatePartyBalance(type, partyId);
  document.getElementById('ledger-total-billed').textContent = '₹' + stats.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('ledger-total-paid').textContent = '₹' + stats.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('ledger-outstanding-balance').textContent = '₹' + stats.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const standingBadge = document.getElementById('ledger-standing-badge');
  if (stats.outstanding <= 0) {
    standingBadge.textContent = 'Cleared (Nil)';
    standingBadge.className = 'kpi-value text-success';
  } else {
    standingBadge.textContent = 'Active Balance';
    standingBadge.className = 'kpi-value text-accent';
  }

  // Profile Details
  document.getElementById('ledger-info-keyword').textContent = party.keyword || '-';
  document.getElementById('ledger-info-contact').textContent = party.contact_person || '-';
  document.getElementById('ledger-info-mobile').textContent = party.mobile || '-';
  document.getElementById('ledger-info-email').textContent = party.email || '-';
  document.getElementById('ledger-info-gstin').textContent = party.gstin || '-';
  document.getElementById('ledger-info-address').textContent = party.billing_address || '-';
  document.getElementById('ledger-info-notes').textContent = party.notes || '-';

  // Activity Stats
  document.getElementById('ledger-stat-invoices').textContent = stats.invoicesCount;
  document.getElementById('ledger-stat-last-inv').textContent = stats.lastInvoiceDate;
  document.getElementById('ledger-stat-payments').textContent = stats.paymentsCount;
  document.getElementById('ledger-stat-last-pay').textContent = stats.lastPaymentDate;

  // Build Statement of Accounts (Chronological transactions)
  renderLedgerStatement(type, partyId);

  // Show Sub-View
  pageViews.forEach(p => p.classList.remove('active'));
  document.getElementById('view-ledger').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeLedgerView() {
  document.getElementById('view-ledger').classList.remove('active');
  if (currentLedgerEntity && currentLedgerEntity.type === 'vendor') {
    switchTab('page-vendor-management');
  } else {
    switchTab('page-client-management');
  }
}

function editCurrentLedgerParty() {
  if (!currentLedgerEntity) return;
  if (currentLedgerEntity.type === 'client') {
    openClientModal(currentLedgerEntity.id);
  } else {
    openVendorModal(currentLedgerEntity.id);
  }
}

function renderLedgerStatement(type, partyId) {
  const tbody = document.getElementById('ledger-statement-tbody');
  const isClient = type === 'client';

  const invoices = (isClient ? appState.clientInvoices : appState.vendorInvoices).filter(inv => {
    return isClient ? (inv.client_id === partyId) : (inv.vendor_id === partyId);
  });

  const payments = (isClient ? appState.clientPayments : appState.vendorPayments).filter(p => {
    return isClient ? (p.client_id === partyId) : (p.vendor_id === partyId);
  });

  // Merge into unified chronological stream
  const transactions = [];

  invoices.forEach(inv => {
    transactions.push({
      date: inv.invoice_date || inv.created_at.split('T')[0],
      ref: `Inv #${inv.invoice_no}`,
      type: 'Invoice (Bill)',
      debit: parseFloat(inv.grand_total) || 0,
      credit: 0,
      mode: inv.payment_status || 'unpaid',
      isInvoice: true,
      rawObj: inv
    });
  });

  payments.forEach(pay => {
    transactions.push({
      date: pay.payment_date,
      ref: pay.reference_no ? `Pay (${pay.reference_no})` : 'Payment Entry',
      type: 'Payment (Credit)',
      debit: 0,
      credit: parseFloat(pay.amount) || 0,
      mode: pay.payment_mode || 'Cash',
      isInvoice: false,
      rawObj: pay
    });
  });

  // Sort ascending by date for accurate running balance
  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 28px 0;">No statement records found for this party.</td></tr>`;
    return;
  }

  let runningBalance = 0;
  tbody.innerHTML = transactions.map(t => {
    runningBalance += (t.debit - t.credit);

    const debitStr = t.debit > 0 ? `₹${t.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
    const creditStr = t.credit > 0 ? `<span class="text-success">₹${t.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>` : '-';
    const balanceColor = runningBalance > 0 ? 'text-accent font-bold' : 'text-success font-bold';

    return `
      <tr>
        <td>${t.date}</td>
        <td><strong>${t.ref}</strong></td>
        <td><span class="category-pill" style="margin:0; font-size:10px;">${t.type}</span></td>
        <td class="text-right">${debitStr}</td>
        <td class="text-right">${creditStr}</td>
        <td class="text-right ${balanceColor}">₹${runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td><small class="text-muted">${t.mode}</small></td>
      </tr>
    `;
  }).join('');
}

// Payment Recording Modal
function openPaymentModal() {
  if (!currentLedgerEntity) return;
  const isClient = currentLedgerEntity.type === 'client';
  const party = (isClient ? appState.clients : appState.vendors).find(p => p.id === currentLedgerEntity.id);
  if (!party) return;

  const modal = document.getElementById('payment-modal');
  document.getElementById('payment-party-id').value = party.id;
  document.getElementById('payment-entity-type').value = currentLedgerEntity.type;
  document.getElementById('payment-modal-subtitle').textContent = `For: ${party.name}`;
  document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('payment-amount').value = '';
  document.getElementById('payment-ref').value = '';
  document.getElementById('payment-notes').value = '';

  modal.classList.add('open');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('open');
}

async function savePaymentForm(e) {
  e.preventDefault();
  const partyId = document.getElementById('payment-party-id').value;
  const entityType = document.getElementById('payment-entity-type').value;
  const isClient = entityType === 'client';
  const amount = parseFloat(document.getElementById('payment-amount').value) || 0;

  if (amount <= 0) {
    alert('Please enter a valid payment amount.');
    return;
  }

  const paymentData = {
    id: 'pay_' + Date.now(),
    [isClient ? 'client_id' : 'vendor_id']: partyId,
    payment_date: document.getElementById('payment-date').value,
    amount: amount,
    payment_mode: document.getElementById('payment-mode').value,
    reference_no: document.getElementById('payment-ref').value.trim(),
    notes: document.getElementById('payment-notes').value.trim(),
    created_at: new Date().toISOString()
  };

  if (isClient) {
    appState.clientPayments.unshift(paymentData);
    localStorage.setItem(KEYS.CLIENT_PAYMENTS, JSON.stringify(appState.clientPayments));
  } else {
    appState.vendorPayments.unshift(paymentData);
    localStorage.setItem(KEYS.VENDOR_PAYMENTS, JSON.stringify(appState.vendorPayments));
  }

  closePaymentModal();
  showToast(`Recorded payment of ₹${amount.toLocaleString('en-IN')} successfully!`, 'success');

  // Refresh current ledger
  openLedger(entityType, partyId);
  updateMainDashboard();

  if (supabaseClient) {
    try {
      await supabaseClient.from(isClient ? 'client_payments' : 'vendor_payments').insert(paymentData);
    } catch (e) {
      console.warn('Payment cloud sync notice:', e.message);
    }
  }
}

// ================= 10. SKEUOMORPHIC PAPER INVOICE BUILDER =================
function openInvoiceBuilder(entityType = 'client', invoiceId = null) {
  currentBuilderEntityType = entityType;
  const isClient = entityType === 'client';

  // Apply master settings to paper header and footer
  applySettingsToUI();

  // Reset or load invoice
  const builderView = document.getElementById('view-invoice-builder');
  const itemsTbody = document.getElementById('builder-items-tbody');
  itemsTbody.innerHTML = '';

  document.getElementById('builder-entity-type').value = entityType;
  document.getElementById('builder-invoice-id').value = invoiceId || '';

  if (invoiceId) {
    // Edit or view existing invoice
    const invList = isClient ? appState.clientInvoices : appState.vendorInvoices;
    const inv = invList.find(x => x.id === invoiceId);
    if (inv) {
      document.getElementById('builder-invoice-no').value = inv.invoice_no;
      document.getElementById('builder-invoice-date').value = inv.invoice_date;
      document.getElementById('builder-order-no').value = inv.order_no || '';
      document.getElementById('builder-order-date').value = inv.order_date || '';
      document.getElementById('builder-due-date').value = inv.due_date || '';
      document.getElementById('builder-party-id').value = inv.client_id || inv.vendor_id || '';
      document.getElementById('builder-party-name').value = inv.party_name || '';
      document.getElementById('builder-party-mobile').value = inv.party_mobile || '';
      document.getElementById('builder-party-gst').value = inv.party_gstin || '';

      if (Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach((item, idx) => addInvoiceItemRow(item, idx + 1));
      } else {
        addInvoiceItemRow({}, 1);
      }
    }
  } else {
    // New Invoice
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('builder-invoice-date').value = today;
    document.getElementById('builder-order-date').value = today;
    document.getElementById('builder-due-date').value = today;

    // Generate next invoice number
    const invList = isClient ? appState.clientInvoices : appState.vendorInvoices;
    const nextNum = 1001 + invList.length;
    document.getElementById('builder-invoice-no').value = nextNum.toString();
    document.getElementById('builder-order-no').value = '';
    document.getElementById('builder-party-id').value = '';
    document.getElementById('builder-party-name').value = '';
    document.getElementById('builder-party-mobile').value = '';
    document.getElementById('builder-party-gst').value = '';
    document.getElementById('builder-party-search').value = '';

    // Add 4 empty initial tactile rows
    for (let i = 1; i <= 4; i++) {
      addInvoiceItemRow({}, i);
    }
  }

  recalcInvoiceTotals();

  // Show builder subview
  pageViews.forEach(p => p.classList.remove('active'));
  document.getElementById('view-ledger').classList.remove('active');
  builderView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeInvoiceBuilder() {
  document.getElementById('view-invoice-builder').classList.remove('active');
  if (currentBuilderEntityType === 'vendor') {
    switchTab('page-vendor-dashboard');
  } else {
    switchTab('page-client-dashboard');
  }
}

// Autocomplete Party Search in Invoice Builder
function searchPartiesForBuilder() {
  const query = document.getElementById('builder-party-search').value.toLowerCase().trim();
  const dropdown = document.getElementById('builder-party-dropdown');
  const isClient = currentBuilderEntityType === 'client';
  const list = isClient ? appState.clients : appState.vendors;

  if (!query) {
    dropdown.innerHTML = '';
    dropdown.classList.remove('open');
    return;
  }

  const matches = list.filter(p => {
    if (p.is_archived) return false;
    return (
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.keyword && p.keyword.toLowerCase().includes(query)) ||
      (p.mobile && p.mobile.includes(query))
    );
  });

  if (matches.length === 0) {
    dropdown.innerHTML = `<div class="dropdown-item text-muted">No ${isClient ? 'clients' : 'vendors'} found.</div>`;
    dropdown.classList.add('open');
    return;
  }

  dropdown.innerHTML = matches.map(p => `
    <div class="dropdown-item" onclick="selectPartyForBuilder('${p.id}')">
      <div><strong>${p.name}</strong> <span class="d-keyword">(${p.keyword})</span></div>
      <div class="text-muted" style="font-size:11px;">${p.billing_address || 'No address'} | Mob: ${p.mobile || '-'}</div>
    </div>
  `).join('');
  dropdown.classList.add('open');
}

function selectPartyForBuilder(partyId) {
  const isClient = currentBuilderEntityType === 'client';
  const party = (isClient ? appState.clients : appState.vendors).find(p => p.id === partyId);
  if (!party) return;

  document.getElementById('builder-party-id').value = party.id;
  document.getElementById('builder-party-name').value = `${party.name}\n${party.billing_address || ''}`.trim();
  document.getElementById('builder-party-mobile').value = party.mobile || '';
  document.getElementById('builder-party-gst').value = party.gstin || '';
  document.getElementById('builder-party-search').value = party.name;
  document.getElementById('builder-party-dropdown').classList.remove('open');
  showToast(`Autofilled details for "${party.name}"`, 'info');
}

function clearBuilderParty() {
  document.getElementById('builder-party-id').value = '';
  document.getElementById('builder-party-name').value = '';
  document.getElementById('builder-party-mobile').value = '';
  document.getElementById('builder-party-gst').value = '';
  document.getElementById('builder-party-search').value = '';
  document.getElementById('builder-party-dropdown').classList.remove('open');
}

// Close party dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.party-autocomplete-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dropdown = document.getElementById('builder-party-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  }
});

// Item Rows in Paper Invoice Table
function addInvoiceItemRow(data = {}, rowNum = null) {
  const tbody = document.getElementById('builder-items-tbody');
  const count = tbody.children.length + 1;
  const sr = rowNum || count;

  // Predefined units from settings
  const unitsList = (appState.settings.predefined_units || 'Nos, Pcs, Box, Kg')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

  const defaultGSTRate = appState.settings.default_gst_rate || 18;
  const currentUnit = data.unit || unitsList[0] || 'Nos';
  const currentGSTRate = data.gst_rate !== undefined ? data.gst_rate : defaultGSTRate;

  const unitOptions = unitsList.map(u => `<option value="${u}" ${u === currentUnit ? 'selected' : ''}>${u}</option>`).join('');

  const tr = document.createElement('tr');
  tr.className = 'item-row';
  tr.innerHTML = `
    <td class="text-center font-bold row-sr">${sr}</td>
    <td>
      <input type="text" class="paper-input row-name" placeholder="Item name..." value="${data.item_name || ''}">
    </td>
    <td>
      <select class="paper-input row-unit">
        ${unitOptions}
      </select>
    </td>
    <td>
      <input type="number" step="any" class="paper-input text-center row-qty" placeholder="0" value="${data.qty || ''}" oninput="updateRowCalculations(this)">
    </td>
    <td>
      <input type="number" step="0.01" class="paper-input text-right row-rate" placeholder="0.00" value="${data.rate || ''}" oninput="updateRowCalculations(this)">
    </td>
    <td class="text-right font-bold row-amount">${parseFloat(data.amount || 0).toFixed(2)}</td>
    <td class="no-print">
      <input type="number" step="any" class="paper-input text-center row-gst-rate" value="${currentGSTRate}" oninput="updateRowCalculations(this)">
    </td>
    <td class="text-right row-cgst">${parseFloat(data.cgst || 0).toFixed(2)}</td>
    <td class="text-right row-sgst">${parseFloat(data.sgst || 0).toFixed(2)}</td>
    <td class="text-right font-bold row-total">${parseFloat(data.total || 0).toFixed(2)}</td>
    <td class="no-print act-col">
      <button type="button" class="btn-remove-row" onclick="removeInvoiceItemRow(this)" title="Remove Row">&times;</button>
    </td>
  `;

  tbody.appendChild(tr);
}

function removeInvoiceItemRow(btn) {
  const row = btn.closest('tr');
  const tbody = document.getElementById('builder-items-tbody');
  if (tbody.children.length <= 1) {
    alert('Invoice must have at least one item row.');
    return;
  }
  row.remove();

  // Re-number rows
  const rows = tbody.querySelectorAll('.item-row');
  rows.forEach((r, idx) => {
    r.querySelector('.row-sr').textContent = idx + 1;
  });

  recalcInvoiceTotals();
}

function updateRowCalculations(input) {
  const row = input.closest('tr');
  const qty = parseFloat(row.querySelector('.row-qty').value) || 0;
  const rate = parseFloat(row.querySelector('.row-rate').value) || 0;
  const gstRate = parseFloat(row.querySelector('.row-gst-rate').value) || 0;

  const amount = qty * rate;
  const cgstRate = gstRate / 2;
  const sgstRate = gstRate / 2;
  const cgstAmount = (amount * cgstRate) / 100;
  const sgstAmount = (amount * sgstRate) / 100;
  const totalValue = amount + cgstAmount + sgstAmount;

  row.querySelector('.row-amount').textContent = amount.toFixed(2);
  row.querySelector('.row-cgst').textContent = cgstAmount.toFixed(2);
  row.querySelector('.row-sgst').textContent = sgstAmount.toFixed(2);
  row.querySelector('.row-total').textContent = totalValue.toFixed(2);

  recalcInvoiceTotals();
}

function recalcInvoiceTotals() {
  const rows = document.querySelectorAll('#builder-items-tbody .item-row');
  let totQty = 0;
  let totAmount = 0;
  let totCGST = 0;
  let totSGST = 0;
  let totGrand = 0;

  rows.forEach(r => {
    const qty = parseFloat(r.querySelector('.row-qty').value) || 0;
    const amount = parseFloat(r.querySelector('.row-amount').textContent) || 0;
    const cgst = parseFloat(r.querySelector('.row-cgst').textContent) || 0;
    const sgst = parseFloat(r.querySelector('.row-sgst').textContent) || 0;
    const total = parseFloat(r.querySelector('.row-total').textContent) || 0;

    totQty += qty;
    totAmount += amount;
    totCGST += cgst;
    totSGST += sgst;
    totGrand += total;
  });

  // Round grand total to nearest rupee
  const roundedGrand = Math.round(totGrand);

  document.getElementById('calc-tot-qty').textContent = totQty;
  document.getElementById('calc-tot-amount').textContent = totAmount.toFixed(2);
  document.getElementById('calc-tot-cgst').textContent = totCGST.toFixed(2);
  document.getElementById('calc-tot-sgst').textContent = totSGST.toFixed(2);
  document.getElementById('calc-tot-grand').textContent = roundedGrand.toFixed(2);

  // Footer summary
  document.getElementById('paper-tax-cgst').textContent = totCGST.toFixed(2);
  document.getElementById('paper-tax-sgst').textContent = totSGST.toFixed(2);
  document.getElementById('paper-tax-grand').textContent = '₹' + roundedGrand.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Amount in words
  document.getElementById('paper-amount-words').textContent = numberToWordsIndian(roundedGrand);
}

// Save Current Invoice
async function saveCurrentInvoice() {
  const isClient = currentBuilderEntityType === 'client';
  const partyName = document.getElementById('builder-party-name').value.trim();
  const invoiceNo = document.getElementById('builder-invoice-no').value.trim();
  const invoiceDate = document.getElementById('builder-invoice-date').value;

  if (!partyName) {
    alert('Please enter or select a Party Name.');
    document.getElementById('builder-party-name').focus();
    return;
  }

  if (!invoiceNo) {
    alert('Please enter an Invoice Number.');
    document.getElementById('builder-invoice-no').focus();
    return;
  }

  // Duplicate invoice number check (case-insensitive)
  const existingId = document.getElementById('builder-invoice-id').value;
  const listToCheck = isClient ? appState.clientInvoices : appState.vendorInvoices;
  const isDuplicate = listToCheck.some(inv => {
    // If editing existing invoice, ignore itself
    if (existingId && inv.id === existingId) return false;
    return inv.invoice_no && inv.invoice_no.trim().toLowerCase() === invoiceNo.toLowerCase();
  });

  if (isDuplicate) {
    alert(`⚠️ Invoice #${invoiceNo} already exists in ${isClient ? 'Client' : 'Vendor'} records!\nPlease enter a unique invoice number.`);
    document.getElementById('builder-invoice-no').focus();
    document.getElementById('builder-invoice-no').select();
    return;
  }

  // Collect item rows
  const itemRows = document.querySelectorAll('#builder-items-tbody .item-row');
  const items = [];
  let totalQty = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;

  itemRows.forEach(r => {
    const name = r.querySelector('.row-name').value.trim();
    const qty = parseFloat(r.querySelector('.row-qty').value) || 0;
    const rate = parseFloat(r.querySelector('.row-rate').value) || 0;
    const unit = r.querySelector('.row-unit').value;
    const gstRate = parseFloat(r.querySelector('.row-gst-rate').value) || 0;

    if (name || qty > 0) {
      const amount = qty * rate;
      const cgst = (amount * (gstRate / 2)) / 100;
      const sgst = (amount * (gstRate / 2)) / 100;
      const total = amount + cgst + sgst;

      totalQty += qty;
      taxableAmount += amount;
      cgstAmount += cgst;
      sgstAmount += sgst;

      items.push({
        item_name: name || 'General Item',
        unit,
        qty,
        rate,
        amount,
        gst_rate: gstRate,
        cgst,
        sgst,
        total
      });
    }
  });

  const grandTotal = Math.round(taxableAmount + cgstAmount + sgstAmount);
  const invoiceId = existingId || (isClient ? 'cinv_' : 'vinv_') + Date.now();

  const invoiceData = {
    id: invoiceId,
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    order_no: document.getElementById('builder-order-no').value.trim(),
    order_date: document.getElementById('builder-order-date').value || null,
    due_date: document.getElementById('builder-due-date').value || null,
    [isClient ? 'client_id' : 'vendor_id']: document.getElementById('builder-party-id').value || null,
    party_name: partyName,
    party_mobile: document.getElementById('builder-party-mobile').value.trim(),
    party_gstin: document.getElementById('builder-party-gst').value.trim(),
    items: items,
    total_qty: totalQty,
    taxable_amount: taxableAmount,
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    grand_total: grandTotal,
    amount_in_words: numberToWordsIndian(grandTotal),
    payment_status: 'unpaid',
    paid_amount: 0,
    created_at: new Date().toISOString()
  };

  if (isClient) {
    if (existingId) {
      appState.clientInvoices = appState.clientInvoices.map(x => x.id === existingId ? { ...x, ...invoiceData } : x);
    } else {
      appState.clientInvoices.unshift(invoiceData);
    }
    localStorage.setItem(KEYS.CLIENT_INVOICES, JSON.stringify(appState.clientInvoices));
    renderClientInvoices();
  } else {
    if (existingId) {
      appState.vendorInvoices = appState.vendorInvoices.map(x => x.id === existingId ? { ...x, ...invoiceData } : x);
    } else {
      appState.vendorInvoices.unshift(invoiceData);
    }
    localStorage.setItem(KEYS.VENDOR_INVOICES, JSON.stringify(appState.vendorInvoices));
    renderVendorInvoices();
  }

  showToast(`✓ Invoice #${invoiceNo} saved successfully!`, 'success');
  closeInvoiceBuilder();
  updateMainDashboard();

  // Supabase Sync
  if (supabaseClient) {
    try {
      await supabaseClient.from(isClient ? 'client_invoices' : 'vendor_invoices').upsert(invoiceData, { onConflict: 'id' });
    } catch (err) {
      console.warn('Invoice cloud sync notice:', err.message);
    }
  }
}

function printInvoice() {
  window.print();
}

// ================= 11. INVOICE DASHBOARDS & TABLES =================
function renderClientInvoices() {
  const tbody = document.getElementById('client-invoices-tbody');
  const searchVal = (document.getElementById('client-invoice-search')?.value || '').toLowerCase().trim();

  // Aggregate Metrics
  const totalSales = appState.clientInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0);
  const totalPaid = appState.clientPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const totalDue = Math.max(0, totalSales - totalPaid);

  document.getElementById('client-dash-total-sales').textContent = '₹' + totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('client-dash-total-paid').textContent = '₹' + totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('client-dash-total-due').textContent = '₹' + totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('client-dash-total-invoices').textContent = appState.clientInvoices.length;

  // Filter
  const filtered = appState.clientInvoices.filter(inv => {
    if (clientInvoiceFilter !== 'all' && inv.payment_status !== clientInvoiceFilter) return false;
    if (!searchVal) return true;
    return (
      inv.invoice_no.toLowerCase().includes(searchVal) ||
      inv.party_name.toLowerCase().includes(searchVal) ||
      (inv.order_no && inv.order_no.toLowerCase().includes(searchVal))
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 32px 0;">No client invoices found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const grand = parseFloat(inv.grand_total) || 0;
    const taxable = parseFloat(inv.taxable_amount) || 0;
    const statusClass = inv.payment_status || 'unpaid';

    return `
      <tr>
        <td><strong>#${inv.invoice_no}</strong></td>
        <td>${inv.invoice_date}</td>
        <td><small>${inv.order_no || '-'}</small></td>
        <td><strong>${inv.party_name.split('\n')[0]}</strong></td>
        <td class="text-right">₹${taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right font-bold">₹${grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-center"><span class="status-tag ${statusClass}">${statusClass.replace('_', ' ')}</span></td>
        <td class="text-center">
          <div class="action-btns-wrap">
            <button class="btn btn-ghost btn-sm" onclick="openInvoiceBuilder('client', '${inv.id}')" title="Edit Invoice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="openStatusModal('client', '${inv.id}')" title="Payment Status Tracker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="openInvoiceBuilder('client', '${inv.id}'); setTimeout(printInvoice, 300);" title="Print Invoice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterClientInvoices() {
  renderClientInvoices();
}

function setClientInvoiceFilter(status) {
  clientInvoiceFilter = status;
  document.querySelectorAll('#client-invoice-status-filters .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-status') === status);
  });
  renderClientInvoices();
}

// Vendor Invoices
function renderVendorInvoices() {
  const tbody = document.getElementById('vendor-invoices-tbody');
  const searchVal = (document.getElementById('vendor-invoice-search')?.value || '').toLowerCase().trim();

  // Aggregate Metrics
  const totalPurchases = appState.vendorInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0);
  const totalPaid = appState.vendorPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const totalDue = Math.max(0, totalPurchases - totalPaid);

  document.getElementById('vendor-dash-total-purchases').textContent = '₹' + totalPurchases.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('vendor-dash-total-paid').textContent = '₹' + totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('vendor-dash-total-due').textContent = '₹' + totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('vendor-dash-total-invoices').textContent = appState.vendorInvoices.length;

  const filtered = appState.vendorInvoices.filter(inv => {
    if (vendorInvoiceFilter !== 'all' && inv.payment_status !== vendorInvoiceFilter) return false;
    if (!searchVal) return true;
    return (
      inv.invoice_no.toLowerCase().includes(searchVal) ||
      inv.party_name.toLowerCase().includes(searchVal) ||
      (inv.order_no && inv.order_no.toLowerCase().includes(searchVal))
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 32px 0;">No vendor invoices found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const grand = parseFloat(inv.grand_total) || 0;
    const taxable = parseFloat(inv.taxable_amount) || 0;
    const statusClass = inv.payment_status || 'unpaid';

    return `
      <tr>
        <td><strong>#${inv.invoice_no}</strong></td>
        <td>${inv.invoice_date}</td>
        <td><small>${inv.order_no || '-'}</small></td>
        <td><strong>${inv.party_name.split('\n')[0]}</strong></td>
        <td class="text-right">₹${taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-right font-bold">₹${grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td class="text-center"><span class="status-tag ${statusClass}">${statusClass.replace('_', ' ')}</span></td>
        <td class="text-center">
          <div class="action-btns-wrap">
            <button class="btn btn-ghost btn-sm" onclick="openInvoiceBuilder('vendor', '${inv.id}')" title="Edit Invoice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="openStatusModal('vendor', '${inv.id}')" title="Payment Status Tracker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="openInvoiceBuilder('vendor', '${inv.id}'); setTimeout(printInvoice, 300);" title="Print Invoice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterVendorInvoices() {
  renderVendorInvoices();
}

function setVendorInvoiceFilter(status) {
  vendorInvoiceFilter = status;
  document.querySelectorAll('#vendor-invoice-status-filters .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-status') === status);
  });
  renderVendorInvoices();
}

// Payment Status Modal (for tracking/updating invoice status)
function openStatusModal(entityType, invoiceId) {
  const isClient = entityType === 'client';
  const list = isClient ? appState.clientInvoices : appState.vendorInvoices;
  const inv = list.find(x => x.id === invoiceId);
  if (!inv) return;

  const modal = document.getElementById('status-modal');
  document.getElementById('status-invoice-id').value = invoiceId;
  document.getElementById('status-entity-type').value = entityType;
  document.getElementById('status-modal-subtitle').textContent = `Invoice #${inv.invoice_no} — ${inv.party_name.split('\n')[0]}`;
  document.getElementById('status-invoice-grand').value = '₹' + (parseFloat(inv.grand_total) || 0).toLocaleString('en-IN');
  document.getElementById('status-select').value = inv.payment_status || 'unpaid';
  document.getElementById('status-paid-amount').value = inv.paid_amount || 0;

  handleStatusChange(inv.payment_status || 'unpaid');
  modal.classList.add('open');
}

function closeStatusModal() {
  document.getElementById('status-modal').classList.remove('open');
}

function handleStatusChange(status) {
  const wrap = document.getElementById('status-paid-amount-wrap');
  if (status === 'unpaid') {
    wrap.style.display = 'none';
  } else {
    wrap.style.display = 'block';
  }
}

async function saveStatusForm(e) {
  e.preventDefault();
  const id = document.getElementById('status-invoice-id').value;
  const entityType = document.getElementById('status-entity-type').value;
  const isClient = entityType === 'client';
  const status = document.getElementById('status-select').value;
  const paidAmount = parseFloat(document.getElementById('status-paid-amount').value) || 0;

  const list = isClient ? appState.clientInvoices : appState.vendorInvoices;
  const inv = list.find(x => x.id === id);
  if (inv) {
    inv.payment_status = status;
    inv.paid_amount = status === 'paid' ? inv.grand_total : paidAmount;

    localStorage.setItem(isClient ? KEYS.CLIENT_INVOICES : KEYS.VENDOR_INVOICES, JSON.stringify(list));

    if (isClient) renderClientInvoices();
    else renderVendorInvoices();

    closeStatusModal();
    showToast(`Payment status updated to ${status}.`, 'info');
    updateMainDashboard();

    if (supabaseClient) {
      try {
        await supabaseClient.from(isClient ? 'client_invoices' : 'vendor_invoices')
          .update({ payment_status: inv.payment_status, paid_amount: inv.paid_amount })
          .eq('id', id);
      } catch (err) {}
    }
  }
}

// ================= 12. EXECUTIVE MAIN DASHBOARD =================
function updateMainDashboard() {
  const clientRevenue = appState.clientInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0);
  const clientPaid = appState.clientPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const clientPending = Math.max(0, clientRevenue - clientPaid);

  const vendorExpense = appState.vendorInvoices.reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0);
  const vendorPaid = appState.vendorPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const vendorPending = Math.max(0, vendorExpense - vendorPaid);

  // KPIs
  document.getElementById('kpi-client-revenue').textContent = '₹' + clientRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('kpi-client-count').textContent = `${appState.clientInvoices.length} Invoices Issued`;

  document.getElementById('kpi-vendor-expense').textContent = '₹' + vendorExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('kpi-vendor-count').textContent = `${appState.vendorInvoices.length} Bills Processed`;

  document.getElementById('kpi-client-pending').textContent = '₹' + clientPending.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  document.getElementById('kpi-vendor-pending').textContent = '₹' + vendorPending.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Recent Invoices Tables
  const clientTbody = document.getElementById('tbody-home-client-invoices');
  const recentClients = appState.clientInvoices.slice(0, 5);
  if (recentClients.length === 0) {
    clientTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No client invoices yet.</td></tr>`;
  } else {
    clientTbody.innerHTML = recentClients.map(inv => `
      <tr>
        <td><strong>#${inv.invoice_no}</strong></td>
        <td>${inv.party_name.split('\n')[0]}</td>
        <td>₹${parseFloat(inv.grand_total).toLocaleString('en-IN')}</td>
        <td><span class="status-tag ${inv.payment_status || 'unpaid'}">${(inv.payment_status || 'unpaid').replace('_', ' ')}</span></td>
      </tr>
    `).join('');
  }

  const vendorTbody = document.getElementById('tbody-home-vendor-invoices');
  const recentVendors = appState.vendorInvoices.slice(0, 5);
  if (recentVendors.length === 0) {
    vendorTbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No vendor invoices yet.</td></tr>`;
  } else {
    vendorTbody.innerHTML = recentVendors.map(inv => `
      <tr>
        <td><strong>#${inv.invoice_no}</strong></td>
        <td>${inv.party_name.split('\n')[0]}</td>
        <td>₹${parseFloat(inv.grand_total).toLocaleString('en-IN')}</td>
        <td><span class="status-tag ${inv.payment_status || 'unpaid'}">${(inv.payment_status || 'unpaid').replace('_', ' ')}</span></td>
      </tr>
    `).join('');
  }
}

// ================= 13. INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  loadLocalData();
  applySettingsToUI();
  updateMainDashboard();
  renderClients();
  renderVendors();
  renderClientInvoices();
  renderVendorInvoices();

  // Try background cloud sync if Supabase is connected
  syncFromCloud();
});
