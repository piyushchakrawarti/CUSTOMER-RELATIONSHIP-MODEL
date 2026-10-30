const state = {
  section: 'dashboard',
  customers: [],
  products: [],
  sales: [],
  followups: [],
  dashboard: null,
  search: '',
  followupStatus: '',
  modalType: null,
  editingId: null,
  presetCustomerId: null,
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const sectionInfo = {
  dashboard: ['Dashboard', 'A clear view of your mobile shop'],
  customers: ['Customers', 'Customer profiles and purchase history'],
  inventory: ['Inventory', 'Phone models, pricing and stock'],
  sales: ['Sales', 'Customer purchases and sales register'],
  followups: ['Follow-ups', 'Calls, WhatsApp and post-purchase reminders'],
};

function money(value) {
  return currency.format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function fmtDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return value ? new Date(value).toLocaleDateString('en-IN', options) : '—';
}

function fmtDateTime(value) {
  return value
    ? new Date(value).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    })
    : '—';
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.classList.toggle('error', type === 'error');
  toast.querySelector('i').className = `fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`;
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    if (response.status === 401) {
      window.location.assign('/login');
      throw new Error('Your session expired. Please sign in again.');
    }
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = typeof body.detail === 'string'
        ? body.detail
        : body.detail?.map((error) => error.msg).join(' ') || message;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

async function loadData() {
  try {
    const search = state.search.trim();
    const customerUrl = `/api/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`;
    const productUrl = `/api/products${search ? `?search=${encodeURIComponent(search)}` : ''}`;
    const salesUrl = `/api/sales${search ? `?search=${encodeURIComponent(search)}` : ''}`;
    const followupParams = new URLSearchParams();
    if (search) followupParams.set('search', search);
    if (state.followupStatus) followupParams.set('status', state.followupStatus);
    const followupUrl = `/api/follow-ups${followupParams.size ? `?${followupParams}` : ''}`;
    const [dashboard, customers, products, sales, followups] = await Promise.all([
      apiFetch('/api/dashboard'),
      apiFetch(customerUrl),
      apiFetch(productUrl),
      apiFetch(salesUrl),
      apiFetch(followupUrl),
    ]);
    Object.assign(state, { dashboard, customers, products, sales, followups });
    renderCurrentSection();
    renderDashboard();
  } catch (error) {
    showToast(`Could not load CRM data: ${error.message}`, 'error');
  }
}

function renderCurrentSection() {
  switch (state.section) {
    case 'customers': renderCustomers(); break;
    case 'inventory': renderInventory(); break;
    case 'sales': renderSales(); break;
    case 'followups': renderFollowups(); break;
    default: break;
  }
}

function navigateTo(section) {
  if (!sectionInfo[section]) return;
  state.section = section;
  document.querySelectorAll('.section').forEach((item) => item.classList.toggle('active', item.id === `section-${section}`));
  document.querySelectorAll('.nav [data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
  document.getElementById('page-title').textContent = sectionInfo[section][0];
  document.getElementById('page-subtitle').textContent = sectionInfo[section][1];
  const addLabels = {
    dashboard: 'Add customer',
    customers: 'Add customer',
    inventory: 'Add phone',
    sales: 'Record sale',
    followups: 'Add follow-up',
  };
  document.getElementById('add-button-label').textContent = addLabels[section];
  state.search = '';
  document.getElementById('global-search').value = '';
  loadData();
}

function renderDashboard() {
  const data = state.dashboard;
  if (!data) return;
  document.getElementById('stat-customers').textContent = Number(data.total_customers).toLocaleString('en-IN');
  document.getElementById('stat-sales').textContent = Number(data.sales_this_month).toLocaleString('en-IN');
  document.getElementById('stat-revenue').textContent = money(data.revenue_this_month);
  document.getElementById('stat-stock').textContent = Number(data.inventory_units).toLocaleString('en-IN');
  document.getElementById('stat-stock-note').textContent = `${data.low_stock_items} model(s) need a stock check`;
  document.getElementById('pending-count').textContent = `${data.pending_follow_ups} pending`;

  const sales = document.getElementById('recent-sales');
  sales.innerHTML = data.recent_sales.length
    ? data.recent_sales.map((sale) => `<div class="sale-row">
        <div class="row-icon"><i class="fa-solid fa-mobile-screen-button"></i></div>
        <div class="row-main"><strong>${escapeHtml(sale.customer_name)} · ${escapeHtml(sale.product_name)}</strong><span>${escapeHtml(sale.payment_method)} · ${fmtDateTime(sale.sold_at)}</span></div>
        <div class="row-right"><strong>${money(sale.total)}</strong><span>${sale.quantity} unit(s)</span></div>
      </div>`).join('')
    : '<div class="empty"><i class="fa-solid fa-receipt"></i>No completed sales yet.</div>';

  const reminders = document.getElementById('upcoming-followups');
  reminders.innerHTML = data.upcoming_follow_ups.length
    ? data.upcoming_follow_ups.map((item) => {
      const overdue = new Date(item.due_at) < new Date();
      return `<div class="follow-row">
        <div class="row-icon" style="${overdue ? 'background:#fff0f2;color:#b85f70' : ''}"><i class="fa-solid ${item.activity_type === 'WhatsApp' ? 'fa-comment' : item.activity_type === 'Visit' ? 'fa-shop' : 'fa-phone'}"></i></div>
        <div class="row-main"><strong>${escapeHtml(item.subject)}</strong><span>${escapeHtml(item.customer_name)} · ${escapeHtml(item.activity_type)}</span></div>
        <div class="row-right"><span class="pill ${overdue ? 'warning' : ''}">${overdue ? 'Overdue' : fmtDate(item.due_at, { day: 'numeric', month: 'short' })}</span></div>
      </div>`;
    }).join('')
    : '<div class="empty"><i class="fa-solid fa-calendar-check"></i>No pending reminders.</div>';

  const alert = document.getElementById('stock-alert');
  alert.hidden = data.low_stock_items === 0;
  document.getElementById('stock-alert-text').textContent = `${data.low_stock_items} phone model(s) are low on stock.`;
}

function renderCustomers() {
  const table = document.getElementById('customers-table');
  document.getElementById('customers-empty').hidden = state.customers.length > 0;
  table.innerHTML = state.customers.map((customer) => `<tr>
    <td><div class="table-primary">${escapeHtml(customer.name)}</div><div class="table-secondary">Added ${fmtDate(customer.created_at)}</div></td>
    <td><div>${escapeHtml(customer.phone)}</div><div class="table-secondary">${escapeHtml(customer.email || 'No email')}</div></td>
    <td>${escapeHtml([customer.city, customer.state].filter(Boolean).join(', ') || '—')}</td>
    <td>${customer.preferred_brand ? `<span class="pill">${escapeHtml(customer.preferred_brand)}</span>` : '—'}</td>
    <td>${customer.sale_count}</td>
    <td class="table-primary">${money(customer.lifetime_value)}</td>
    <td><div class="table-actions"><button class="btn-small" data-edit-customer="${customer.id}">Edit</button><button class="btn-small" data-add-sale-customer="${customer.id}" title="Record a sale"><i class="fa-solid fa-receipt"></i></button><button class="btn-small" data-add-followup-customer="${customer.id}" title="Schedule follow-up"><i class="fa-solid fa-calendar-plus"></i></button></div></td>
  </tr>`).join('');
}

function renderInventory() {
  const table = document.getElementById('inventory-table');
  const rows = state.products.filter((product) => product.stock >= 0);
  document.getElementById('inventory-empty').hidden = rows.length > 0;
  table.innerHTML = rows.map((product) => `<tr>
    <td><div class="table-primary">${escapeHtml(product.brand)} ${escapeHtml(product.name)}</div><div class="table-secondary">${escapeHtml(product.category)} · ${escapeHtml(product.colour)}</div></td>
    <td>${escapeHtml(product.storage)}</td>
    <td class="table-primary">${money(product.price)}</td>
    <td><span class="${product.stock <= 5 ? 'low-stock' : ''}">${product.stock} unit(s)</span>${product.stock <= 5 ? '<div class="table-secondary">Restock soon</div>' : ''}</td>
    <td><div>${escapeHtml(product.display)}</div><div class="table-secondary">${escapeHtml(product.camera)}</div></td>
    <td><button class="btn-small" data-edit-product="${product.id}">Update stock / price</button></td>
  </tr>`).join('');
}

function renderSales() {
  const table = document.getElementById('sales-table');
  document.getElementById('sales-empty').hidden = state.sales.length > 0;
  table.innerHTML = state.sales.map((sale) => `<tr>
    <td><div class="table-primary">#TP-${String(sale.id).padStart(4, '0')}</div><div class="table-secondary">${escapeHtml(sale.status)}</div></td>
    <td><div class="table-primary">${escapeHtml(sale.customer_name)}</div><div class="table-secondary">${escapeHtml(sale.customer_phone)}</div></td>
    <td>${escapeHtml(sale.product_name)}</td><td>${sale.quantity}</td>
    <td class="table-primary">${money(sale.total)}</td><td><span class="pill">${escapeHtml(sale.payment_method)}</span></td>
    <td>${fmtDate(sale.sold_at)}</td>
  </tr>`).join('');
}

function renderFollowups() {
  const table = document.getElementById('followups-table');
  document.getElementById('followups-empty').hidden = state.followups.length > 0;
  table.innerHTML = state.followups.map((item) => {
    const overdue = item.status === 'Pending' && new Date(item.due_at) < new Date();
    return `<tr>
      <td><div class="${overdue ? 'low-stock' : ''}">${fmtDateTime(item.due_at)}</div>${overdue ? '<div class="table-secondary">Overdue</div>' : ''}</td>
      <td><div class="table-primary">${escapeHtml(item.customer_name)}</div><div class="table-secondary">${escapeHtml(item.customer_phone)}</div></td>
      <td><span class="pill">${escapeHtml(item.activity_type)}</span></td>
      <td><div class="table-primary">${escapeHtml(item.subject)}</div><div class="table-secondary">${escapeHtml(item.notes || '')}</div></td>
      <td><span class="pill ${item.status === 'Pending' && overdue ? 'warning' : item.status !== 'Pending' ? 'muted' : ''}">${escapeHtml(item.status)}</span></td>
      <td><div class="table-actions">${item.status === 'Pending' ? `<button class="btn-small" data-complete-followup="${item.id}">Complete</button>` : ''}<button class="btn-small" data-edit-followup="${item.id}">Edit</button></div></td>
    </tr>`;
  }).join('');
}

function formField(label, name, options = {}) {
  const { type = 'text', value = '', placeholder = '', required = false, min = '', max = '', step = '', full = false, choices = [], pattern = '', inputmode = '' } = options;
  const attrs = [
    `name="${name}"`,
    `id="field-${name}"`,
    `type="${type}"`,
    required ? 'required' : '',
    min !== '' ? `min="${min}"` : '',
    max !== '' ? `max="${max}"` : '',
    step ? `step="${step}"` : '',
    pattern ? `pattern="${pattern}"` : '',
    inputmode ? `inputmode="${inputmode}"` : '',
    placeholder ? `placeholder="${escapeHtml(placeholder)}"` : '',
  ].filter(Boolean).join(' ');
  let input;
  if (type === 'select') {
    input = `<select ${attrs}>${choices.map(([choiceValue, choiceLabel]) => `<option value="${escapeHtml(choiceValue)}" ${String(value) === String(choiceValue) ? 'selected' : ''}>${escapeHtml(choiceLabel)}</option>`).join('')}</select>`;
  } else if (type === 'textarea') {
    input = `<textarea ${attrs}>${escapeHtml(value)}</textarea>`;
  } else {
    input = `<input ${attrs} value="${escapeHtml(value)}" />`;
  }
  return `<div class="field ${full ? 'full' : ''}"><label for="field-${name}">${escapeHtml(label)}</label>${input}</div>`;
}

function customerChoices(selectedId) {
  return state.customers.map((customer) => [
    customer.id,
    `${customer.name} · ${customer.phone}`,
  ]).map(([id, label]) => [String(id), label, String(id) === String(selectedId)]);
}

function openModal(type, record = null, presetCustomerId = null) {
  if ((type === 'sale' || type === 'followup') && !state.customers.length) {
    showToast('Add a customer before recording a sale or follow-up.', 'error');
    navigateTo('customers');
    return;
  }
  if (type === 'sale' && !state.products.some((product) => product.stock > 0)) {
    showToast('Add phone models with available stock before recording a sale.', 'error');
    navigateTo('inventory');
    return;
  }
  state.modalType = type;
  state.editingId = record?.id || null;
  state.presetCustomerId = presetCustomerId || record?.customer_id || null;
  const titleMap = {
    customer: record ? 'Update customer' : 'Add customer',
    product: record ? 'Update phone inventory' : 'Add phone to inventory',
    sale: 'Record a phone sale',
    followup: 'Schedule a customer follow-up',
  };
  const subtitleMap = {
    customer: 'Save the contact and preferences for your shop.',
    product: 'Maintain the model, selling price and available stock.',
    sale: 'Choose a customer and phone. Stock will update when saved.',
    followup: 'Set a reminder for a customer conversation.',
  };
  document.getElementById('modal-title').textContent = titleMap[type];
  document.getElementById('modal-subtitle').textContent = subtitleMap[type];
  document.getElementById('modal-submit').textContent = record ? 'Save changes' : 'Save';
  document.getElementById('modal-fields').innerHTML = buildForm(type, record);
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function buildForm(type, record) {
  const data = record || {};
  if (type === 'customer') {
    return [
      formField('Customer name', 'name', { value: data.name || '', required: true, placeholder: 'Full name' }),
      formField('Mobile number', 'phone', { value: data.phone || '', required: true, placeholder: '10-digit Indian number', pattern: '(?:\\+91[\\s\\-]?)?[6-9][0-9\\s\\-]{9,13}', inputmode: 'tel' }),
      formField('Email', 'email', { type: 'email', value: data.email || '', placeholder: 'Optional' }),
      formField('Preferred brand', 'preferred_brand', { type: 'select', value: data.preferred_brand || '', choices: [['', 'Not specified'], ...[...new Set(state.products.map((product) => product.brand))].map((brand) => [brand, brand])] }),
      formField('City', 'city', { value: data.city || '', placeholder: 'e.g. Pune' }),
      formField('State', 'state', { value: data.state || '', placeholder: 'e.g. Maharashtra' }),
      formField('PIN code', 'pincode', { value: data.pincode || '', pattern: '[0-9]{6}', inputmode: 'numeric', placeholder: '6 digits' }),
      formField('Address', 'address', { type: 'textarea', value: data.address || '', full: true, placeholder: 'Optional delivery or visit address' }),
      formField('Customer notes', 'notes', { type: 'textarea', value: data.notes || '', full: true, placeholder: 'Preferences, exchange interest, service notes...' }),
    ].join('');
  }
  if (type === 'product') {
    return [
      formField('Brand', 'brand', { value: data.brand || '', required: true, placeholder: 'e.g. Samsung' }),
      formField('Model', 'name', { value: data.name || '', required: true, placeholder: 'e.g. Galaxy A56 5G' }),
      formField('Category', 'category', { type: 'select', value: data.category || 'Android', choices: [['Android', 'Android'], ['iPhone', 'iPhone'], ['Feature phone', 'Feature phone'], ['Accessory', 'Accessory']] }),
      formField('Selling price (₹)', 'price', { type: 'number', value: data.price ?? '', required: true, min: '1', step: '0.01', placeholder: '29999' }),
      formField('Stock quantity', 'stock', { type: 'number', value: data.stock ?? 0, required: true, min: '0', step: '1' }),
      formField('Storage / RAM', 'storage', { value: data.storage || '8 GB / 128 GB' }),
      formField('Colour', 'colour', { value: data.colour || 'Black' }),
      formField('Display', 'display', { value: data.display || '—' }),
      formField('Camera', 'camera', { value: data.camera || '—' }),
      formField('Battery', 'battery', { value: data.battery || '—' }),
    ].join('');
  }
  if (type === 'sale') {
    const customers = customerChoices(state.presetCustomerId);
    return [
      formField('Customer', 'customer_id', { type: 'select', value: state.presetCustomerId || customers[0]?.[0] || '', required: true, choices: customers.map(([id, label]) => [id, label]) }),
      formField('Phone model', 'product_id', { type: 'select', value: data.product_id || state.products.find((product) => product.stock > 0)?.id || '', required: true, choices: state.products.filter((product) => product.stock > 0).map((product) => [String(product.id), `${product.brand} ${product.name} · ${product.stock} in stock`]) }),
      formField('Quantity', 'quantity', { type: 'number', value: 1, required: true, min: '1', max: '100', step: '1' }),
      formField('Selling price per unit (₹)', 'unit_price', { type: 'number', value: '', min: '1', step: '0.01', placeholder: 'Leave blank to use list price' }),
      formField('Payment method', 'payment_method', { type: 'select', value: 'UPI', required: true, choices: [['Cash', 'Cash'], ['UPI', 'UPI'], ['Card', 'Card'], ['EMI', 'EMI'], ['Bank transfer', 'Bank transfer'], ['Other', 'Other']] }),
      formField('Sale date', 'sold_at', { type: 'date', value: new Date().toISOString().slice(0, 10), required: true }),
      formField('Notes', 'notes', { type: 'textarea', full: true, placeholder: 'Exchange, warranty, or invoice notes...' }),
    ].join('');
  }
  const customerList = customerChoices(state.presetCustomerId);
  return [
    formField('Customer', 'customer_id', { type: 'select', value: state.presetCustomerId || customerList[0]?.[0] || '', required: true, choices: customerList.map(([id, label]) => [id, label]) }),
    formField('Activity type', 'activity_type', { type: 'select', value: 'Call', required: true, choices: [['Call', 'Phone call'], ['WhatsApp', 'WhatsApp'], ['Visit', 'Store visit'], ['Email', 'Email'], ['Note', 'Note']] }),
    formField('Reminder date', 'due_at', { type: 'datetime-local', value: new Date(Date.now() + 86400000).toISOString().slice(0, 16), required: true }),
    formField('Subject', 'subject', { value: '', required: true, full: true, placeholder: 'e.g. Check in after purchase' }),
    formField('Notes', 'notes', { type: 'textarea', full: true, placeholder: 'What should you discuss?' }),
  ].join('');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.modalType = null;
  state.editingId = null;
}

function formPayload(form, type) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (type === 'customer') {
    data.phone = data.phone.trim();
    for (const field of ['email', 'address', 'city', 'state', 'pincode', 'preferred_brand', 'notes']) {
      if (!data[field]) data[field] = null;
    }
  } else if (type === 'product') {
    data.price = Number(data.price);
    data.stock = Number(data.stock);
    data.original_price = null;
    data.description = '';
    data.colour_hex = '#454545';
    data.rating = 4.5;
    data.review_count = 0;
    data.badge = null;
    data.featured = false;
  } else if (type === 'sale') {
    data.customer_id = Number(data.customer_id);
    data.product_id = Number(data.product_id);
    data.quantity = Number(data.quantity);
    if (data.unit_price) data.unit_price = Number(data.unit_price);
    else delete data.unit_price;
    data.sold_at = new Date(`${data.sold_at}T12:00:00`).toISOString();
    if (!data.notes) data.notes = null;
  } else {
    data.customer_id = Number(data.customer_id);
    data.due_at = new Date(data.due_at).toISOString();
    if (!data.notes) data.notes = null;
  }
  return data;
}

async function submitModal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submitButton = document.getElementById('modal-submit');
  submitButton.disabled = true;
  try {
    const type = state.modalType;
    const id = state.editingId;
    const endpoint = {
      customer: id ? `/api/customers/${id}` : '/api/customers',
      product: id ? `/api/products/${id}` : '/api/products',
      sale: '/api/sales',
      followup: '/api/follow-ups',
    }[type];
    await apiFetch(endpoint, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(formPayload(form, type)),
    });
    closeModal();
    await loadData();
    const successMessage = {
      customer: id ? 'Customer details updated.' : 'Customer added to your book.',
      product: id ? 'Phone inventory updated.' : 'Phone added to inventory.',
      sale: 'Sale recorded and stock updated.',
      followup: 'Customer follow-up scheduled.',
    };
    showToast(successMessage[type]);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

function customerById(id) {
  return state.customers.find((customer) => customer.id === Number(id));
}

function productById(id) {
  return state.products.find((product) => product.id === Number(id));
}

document.querySelectorAll('.nav [data-section]').forEach((button) => {
  button.addEventListener('click', () => navigateTo(button.dataset.section));
});

document.getElementById('add-button').addEventListener('click', () => {
  const modalType = state.section === 'inventory' ? 'product'
    : state.section === 'sales' ? 'sale'
      : state.section === 'followups' ? 'followup' : 'customer';
  openModal(modalType);
});

document.getElementById('logout-button').addEventListener('click', async () => {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  } catch (error) {
    showToast(`Could not sign out: ${error.message}`, 'error');
  }
});

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => openModal(button.dataset.action));
});

document.querySelectorAll('[data-go]').forEach((button) => {
  button.addEventListener('click', () => navigateTo(button.dataset.go));
});

document.getElementById('modal-form').addEventListener('submit', submitModal);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (event) => {
  if (event.target.id === 'modal-overlay') closeModal();
});

document.getElementById('customers-table').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-customer]');
  if (edit) return openModal('customer', customerById(edit.dataset.editCustomer));
  const sale = event.target.closest('[data-add-sale-customer]');
  if (sale) return openModal('sale', null, Number(sale.dataset.addSaleCustomer));
  const followup = event.target.closest('[data-add-followup-customer]');
  if (followup) return openModal('followup', null, Number(followup.dataset.addFollowupCustomer));
});

document.getElementById('inventory-table').addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-product]');
  if (button) openModal('product', productById(button.dataset.editProduct));
});

document.getElementById('followups-table').addEventListener('click', async (event) => {
  const complete = event.target.closest('[data-complete-followup]');
  if (complete) {
    complete.disabled = true;
    try {
      await apiFetch(`/api/follow-ups/${complete.dataset.completeFollowup}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Completed' }),
      });
      await loadData();
      showToast('Follow-up marked complete.');
    } catch (error) {
      showToast(error.message, 'error');
      complete.disabled = false;
    }
    return;
  }
  const edit = event.target.closest('[data-edit-followup]');
  if (edit) {
    const item = state.followups.find((followup) => followup.id === Number(edit.dataset.editFollowup));
    if (!item) return;
    openModal('followup', {
      ...item,
      due_at: new Date(item.due_at).toISOString().slice(0, 16),
    });
    document.getElementById('modal-title').textContent = 'Update follow-up';
    const statusChoices = [['Pending', 'Pending'], ['Completed', 'Completed'], ['Cancelled', 'Cancelled']];
    document.getElementById('modal-fields').insertAdjacentHTML(
      'beforeend',
      formField('Status', 'status', { type: 'select', value: item.status, choices: statusChoices }),
    );
    state.modalType = 'followup-edit';
    state.modalType = 'followup';
  }
});

document.getElementById('followup-filter').addEventListener('change', (event) => {
  state.followupStatus = event.target.value;
  loadData();
});

let searchTimer;
document.getElementById('global-search').addEventListener('input', (event) => {
  state.search = event.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadData, 220);
});

document.getElementById('search-wrap').addEventListener('click', () => {
  document.getElementById('search-wrap').classList.add('open');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

renderDashboard();
loadData();
