/* ============ UTIL ============ */
function escapeHTML(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function showToast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', Boolean(isError));
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* Kategori jasa: ketersediaan boolean (Tersedia/Tidak), bukan jumlah stok */
const SERVICE_CATS = ['Jasa Bengkel', 'Kunci Serep'];
function isService(kategori) {
  return SERVICE_CATS.includes(kategori);
}

function availabilityLabel(item) {
  if (isService(item.kategori)) return item.stok > 0 ? 'Tersedia' : 'Tidak Tersedia';
  return item.stok > 0 ? `Stok ${item.stok}` : 'Habis';
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

function getCategorySVG(kategori) {
  const map = {
    'Jasa Bengkel': `
      <svg width="76" height="76" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="32" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <path d="M49 27a10 10 0 0 0-13 13L22 54a3.5 3.5 0 0 0 5 5l14-14a10 10 0 0 0 13-13l-6 6-4-4 5-7z" fill="#e11d2a" stroke="#991b1b" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>`,
    'Bahan Bakar': `
      <svg width="76" height="76" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="32" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <rect x="25" y="24" width="22" height="32" rx="4" fill="#e11d2a"/>
        <rect x="29" y="29" width="14" height="9" rx="2" fill="#ffffff"/>
        <path d="M47 32h4a4 4 0 0 1 4 4v12a3 3 0 0 0 6 0V31l-5-5" stroke="#1f242d" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`,
    'Kunci Serep': `
      <svg width="76" height="76" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="32" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <circle cx="30" cy="40" r="8" fill="#1f242d" stroke="#111827" stroke-width="2"/>
        <circle cx="28" cy="40" r="2.5" fill="#ffffff"/>
        <path d="M38 40h22M50 40v7M57 40v8" stroke="#e11d2a" stroke-width="3" stroke-linecap="round"/>
      </svg>`,
    'Suku Cadang & Oli': `
      <svg width="76" height="76" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="32" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <path d="M40 22c-9 12-14 19-14 26a14 14 0 0 0 28 0c0-7-5-14-14-26z" fill="#1f242d"/>
        <path d="M35 48a5 5 0 0 0 5 5" stroke="#e11d2a" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`
  };
  return map[kategori] || map['Jasa Bengkel'];
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============ STATE ============ */
const state = {
  user: null,
  kategori: [],
  catalog: [],
  myItems: [],
  currentView: 'catalog',
};

const views = {
  catalog: 'viewCatalog',
  bengkel: 'viewBengkel',
  admin: 'viewAdmin',
};

const $ = (id) => document.getElementById(id);

/* ============ NAV & VIEWS ============ */
function currentRole() {
  return state.user ? state.user.role : 'guest';
}

function renderNav() {
  const role = currentRole();
  const pills = [];

  pills.push({ id: 'catalog', label: 'Katalog' });
  if (role === 'bengkel') pills.push({ id: 'bengkel', label: 'Dashboard Mitra' });
  if (role === 'admin') pills.push({ id: 'admin', label: 'Panel Admin' });

  const nav = $('navPills');
  nav.innerHTML = pills
    .map(
      (p) =>
        `<button type="button" class="nav-btn ${state.currentView === p.id ? 'active' : ''}" data-view="${p.id}">${p.label}</button>`
    )
    .join('');
  nav.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  const chip = $('userChip');
  if (state.user) {
    chip.innerHTML = `
      <span class="uc-name">${escapeHTML(state.user.nama.split(' ')[0])}</span>
      <span class="uc-role">${escapeHTML(state.user.role)}</span>
      <button type="button" id="btnLogout">Keluar</button>`;
    $('btnLogout').addEventListener('click', doLogout);
  } else {
    chip.innerHTML = `<button type="button" id="btnGoLogin">Masuk / Daftar</button>`;
    $('btnGoLogin').addEventListener('click', () => showAuth());
  }
}

function switchView(view) {
  state.currentView = view;
  Object.entries(views).forEach(([key, id]) => {
    $(id).classList.toggle('hidden', key !== view);
  });
  if (view === 'catalog') loadCatalog();
  if (view === 'bengkel') loadBengkelDashboard();
  if (view === 'admin') loadAdminPanel();
  renderNav();
  window.scrollTo(0, 0);
}

/* ============ AUTH ============ */
function showAuth() {
  $('authScreen').classList.remove('hidden');
}

function hideAuth() {
  $('authScreen').classList.add('hidden');
}

function showApp() {
  hideAuth();
  $('appScreen').classList.remove('hidden');
  const start = currentRole() === 'admin' ? 'admin' : currentRole() === 'bengkel' ? 'bengkel' : 'catalog';
  switchView(start);
}

async function doLogout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  state.user = null;
  state.currentView = 'catalog';
  switchView('catalog');
  showToast('Anda telah keluar.');
}

$('tabLogin').addEventListener('click', () => {
  $('tabLogin').classList.add('active');
  $('tabRegister').classList.remove('active');
  $('loginForm').classList.remove('hidden');
  $('registerForm').classList.add('hidden');
});

$('tabRegister').addEventListener('click', () => {
  $('tabRegister').classList.add('active');
  $('tabLogin').classList.remove('active');
  $('registerForm').classList.remove('hidden');
  $('loginForm').classList.add('hidden');
});

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { email: $('loginEmail').value.trim(), password: $('loginPassword').value },
    });
    state.user = data.user;
    showApp();
    showToast('Selamat datang, ' + data.user.nama.split(' ')[0] + '!');
  } catch (err) {
    showToast(err.message, true);
  }
});

$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: {
        nama_akun: $('regNamaAkun').value.trim(),
        nama_bengkel: $('regNamaBengkel').value.trim(),
        email: $('regEmail').value.trim(),
        password: $('regPassword').value,
        nomor_wa: $('regWa').value,
        alamat: $('regAlamat').value.trim(),
      },
    });
    showToast(data.message || 'Pendaftaran berhasil! Tunggu persetujuan admin.');
    hideAuth();
    $('registerForm').reset();
  } catch (err) {
    showToast(err.message, true);
  }
});

/* ============ KATALOG (PENGUNA / PUBLIK) ============ */
async function loadCatalog() {
  try {
    const q = $('searchInput').value.trim();
    const kategori = $('categoryFilter').value;
    const sort = $('sortSelect').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (kategori && kategori !== 'ALL') params.set('kategori', kategori);
    if (sort) params.set('sort', sort);

    const data = await api('/api/items?' + params.toString());
    state.catalog = data.items;
    if (data.kategori) {
      state.kategori = data.kategori;
      const sel = $('categoryFilter');
      const current = sel.value;
      sel.innerHTML =
        '<option value="ALL">Semua kategori</option>' +
        data.kategori.map((k) => `<option value="${escapeHTML(k)}">${escapeHTML(k)}</option>`).join('');
      sel.value = current && [...sel.options].some((o) => o.value === current) ? current : 'ALL';
    }
    renderCatalog();
  } catch (err) {
    showToast(err.message, true);
  }
}

function buildWhatsAppUrl(item) {
  const riderName = $('riderName').value.trim() || 'Pengendara';
  const riderLocation = $('riderLocation').value.trim() || 'Belum diisi (akan kirim shareloc)';
  const phone = (item ? item.nomor_wa : sosPhone()) || '6281234567890';

  const serviceText = item
    ? `*Layanan/Produk:* ${item.nama} (${formatRupiah(item.harga)})\n*Mitra:* ${item.nama_bengkel}`
    : `*Layanan/Produk:* BANTUAN DARURAT CEPAT (SOS)`;

  const text = [
    `Halo Mitra *BENGKELIN!*, saya butuh bantuan kendaraan:`,
    ``,
    serviceText,
    `*Pemesan/Kendaraan:* ${riderName}`,
    `*Patokan Lokasi:* ${riderLocation}`,
    ``,
    `Mohon konfirmasi ketersediaan & estimasi tiba. Terima kasih!`,
  ].join('\n');

  return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
}

function sosPhone() {
  const first = state.catalog.find((i) => i.unggulan) || state.catalog[0];
  return first ? first.nomor_wa : '';
}

function renderCatalog() {
  const grid = $('catalogGrid');
  if (!state.catalog.length) {
    grid.innerHTML = `<div class="panel-box" style="grid-column:1/-1; text-align:center; color:var(--text-muted);">Layanan atau produk tidak ditemukan. Coba kata kunci lain.</div>`;
    return;
  }

  grid.innerHTML = state.catalog
    .map((item) => {
      const isOut = item.stok <= 0;
      const media = item.image_url
        ? `<img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.nama)}" />`
        : getCategorySVG(item.kategori);

      return `
        <article class="product-card">
          <div class="card-media">
            ${media}
            ${item.unggulan ? '<span class="badge-featured">Unggulan !</span>' : ''}
          </div>
          <div class="card-content">
            <span class="badge-cat">${escapeHTML(item.kategori)}</span>
            <h3 class="card-title">${escapeHTML(item.nama)}</h3>
            <p class="card-desc">${escapeHTML(item.deskripsi)}</p>
            <div class="card-shop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              ${escapeHTML(item.nama_bengkel)}
            </div>
            <div class="card-price-row">
              <span class="card-price">${formatRupiah(item.harga)}</span>
              <span class="stock-pill ${isOut ? 'empty' : ''}">
                ${availabilityLabel(item)}
              </span>
            </div>
            <button
              type="button"
              class="btn btn-wa"
              ${isOut ? 'disabled' : ''}
              data-order="${item.id}"
            >
              ${isOut ? 'Slot / Stok Habis' : 'Pesan via WhatsApp'}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = state.catalog.find((i) => String(i.id) === btn.dataset.order);
      if (!item || item.stok <= 0) return;
      window.open(buildWhatsAppUrl(item), '_blank', 'noopener,noreferrer');
    });
  });
}

$('searchInput').addEventListener('input', loadCatalog);
$('categoryFilter').addEventListener('change', loadCatalog);
$('sortSelect').addEventListener('change', loadCatalog);

$('btnQuickSOS').addEventListener('click', () => {
  const url = buildWhatsAppUrl(null);
  if (!url) return showToast('Belum ada mitra bengkel aktif.', true);
  window.open(url, '_blank', 'noopener,noreferrer');
});

/* ============ DASHBOARD BENGKEL ============ */
let uploadedImageDataUrl = '';

async function loadBengkelDashboard() {
  try {
    const [meData, itemData] = await Promise.all([
      api('/api/auth/me'),
      api('/api/my-items'),
    ]);
    if (meData.user) {
      state.user = { ...state.user, ...meData.user };
      renderBengkelBanner(meData.user.status);
      $('pfNamaBengkel').value = meData.user.namaBengkel || '';
      $('pfAlamat').value = meData.user.alamat || '';
      $('pfWa').value = meData.user.nomorWa || '';
      $('pfEmail').value = meData.user.email || '';
    }
    state.myItems = itemData.items;
    if (itemData.kategori) state.kategori = itemData.kategori;
    fillKategoriSelect($('itemCategory'));
    toggleStokField();
    renderBengkelStats();
    renderBengkelTable();
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderBengkelBanner(status) {
  const banner = $('bengkelStatusBanner');
  if (status === 'active') {
    banner.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden', 'error');
  if (status === 'pending') {
    banner.textContent = 'Pendaftaran bengkel Anda masih MENUNGGU PERSETUJUAN admin. Katalog Anda belum tampil di halaman publik.';
  } else {
    banner.classList.add('error');
    banner.textContent = 'Pendaftaran bengkel Anda DITOLAK oleh admin. Hubungi admin untuk informasi lebih lanjut.';
  }
}

function renderBengkelStats() {
  const items = state.myItems;
  const totalStock = items.reduce((acc, i) => acc + Number(i.stok || 0), 0);
  const totalCats = new Set(items.map((i) => i.kategori)).size;
  const totalFeatured = items.filter((i) => i.unggulan).length;

  $('bengkelStatsGrid').innerHTML = `
    <div class="stat-card"><span>Total Layanan / Produk</span><strong>${items.length}</strong></div>
    <div class="stat-card"><span>Total Stok & Slot Siaga</span><strong>${totalStock}</strong></div>
    <div class="stat-card"><span>Kategori Aktif</span><strong>${totalCats}</strong></div>
    <div class="stat-card"><span>Layanan Unggulan</span><strong>${totalFeatured}</strong></div>
  `;
}

function renderBengkelTable() {
  const tbody = $('bengkelTableBody');
  if (!state.myItems.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Belum ada layanan. Tambahkan layanan pertama Anda.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.myItems
    .map((item) => {
      const thumb = item.image_url
        ? `<img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.nama)}" />`
        : `<span style="font-size:0.75rem; font-weight:700; color:var(--primary);">SVG</span>`;
      return `
        <tr>
          <td>
            <div class="item-cell">
              <div class="table-thumb">${thumb}</div>
              <strong>${escapeHTML(item.nama)}</strong>
            </div>
          </td>
          <td>${escapeHTML(item.kategori)}</td>
          <td>${formatRupiah(item.harga)}</td>
          <td><span class="stock-pill ${item.stok <= 0 ? 'empty' : ''}">${availabilityLabel(item)}</span></td>
          <td>${item.unggulan ? 'Ya' : 'Tidak'}</td>
          <td>
            <div class="action-btns">
              <button type="button" class="btn btn-outline btn-sm" data-edit="${item.id}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-del="${item.id}">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => startEditItem(b.dataset.edit))
  );
  tbody.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteItem(b.dataset.del))
  );
}

// Simpan Informasi Bengkel (nama, alamat, WA, email, password opsional)
$('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await api('/api/auth/bengkel-profile', {
      method: 'PUT',
      body: {
        nama_bengkel: $('pfNamaBengkel').value.trim(),
        alamat: $('pfAlamat').value.trim(),
        nomor_wa: $('pfWa').value,
        email: $('pfEmail').value.trim(),
        password: $('pfPassword').value,
      },
    });
    $('pfWa').value = data.nomor_wa;
    $('pfEmail').value = data.email;
    $('pfPassword').value = '';
    state.user = {
      ...state.user,
      nomorWa: data.nomor_wa,
      email: data.email,
      namaBengkel: $('pfNamaBengkel').value.trim(),
    };
    showToast(
      data.password_changed
        ? 'Informasi bengkel & password berhasil diperbarui.'
        : 'Informasi bengkel berhasil diperbarui.'
    );
  } catch (err) {
    showToast(err.message, true);
  }
});

// Toggle field ketersediaan: kategori jasa -> checkbox Tersedia, produk -> input stok
function toggleStokField() {
  const isSvc = isService($('itemCategory').value);
  $('fieldStok').classList.toggle('hidden', isSvc);
  $('fieldTersedia').classList.toggle('hidden', !isSvc);
  $('itemStock').required = !isSvc;
  if (isSvc) $('itemStock').value = $('itemTersedia').checked ? '1' : '0';
}

$('itemCategory').addEventListener('change', toggleStokField);
$('itemTersedia').addEventListener('change', () => {
  if (isService($('itemCategory').value)) $('itemStock').value = $('itemTersedia').checked ? '1' : '0';
});

// Upload gambar
$('itemImageFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    uploadedImageDataUrl = await compressImage(file);
    showImagePreview(uploadedImageDataUrl);
    showToast('Gambar berhasil dimuat.');
  } catch {
    showToast('Gagal memuat gambar.', true);
  }
});

function showImagePreview(src) {
  const wrap = $('imagePreviewContainer');
  const img = $('imagePreview');
  if (src) {
    img.src = src;
    wrap.classList.remove('hidden');
  } else {
    img.src = '';
    wrap.classList.add('hidden');
  }
}

$('btnClearImage').addEventListener('click', () => {
  uploadedImageDataUrl = '';
  $('itemImageFile').value = '';
  showImagePreview('');
});

function fillKategoriSelect(selectEl) {
  selectEl.innerHTML = state.kategori
    .map((k) => `<option value="${escapeHTML(k)}">${escapeHTML(k)}</option>`)
    .join('');
}

// Submit tambah/edit layanan
$('itemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('itemId').value;
  const kategori = $('itemCategory').value;
  const stok = isService(kategori) ? ($('itemTersedia').checked ? 1 : 0) : Math.max(0, Math.floor(Number($('itemStock').value) || 0));

  const payload = {
    nama: $('itemName').value.trim(),
    kategori,
    harga: Math.max(0, Number($('itemPrice').value) || 0),
    stok,
    deskripsi: $('itemDesc').value.trim(),
    image_url: uploadedImageDataUrl,
    unggulan: $('itemFeatured').checked,
  };

  try {
    await api(id ? `/api/items/${id}` : '/api/items', {
      method: id ? 'PUT' : 'POST',
      body: payload,
    });
    showToast(id ? 'Layanan berhasil diperbarui.' : 'Layanan baru berhasil ditambahkan.');
    resetItemForm();
    await loadBengkelDashboard();
  } catch (err) {
    showToast(err.message, true);
  }
});

function startEditItem(id) {
  const item = state.myItems.find((i) => String(i.id) === String(id));
  if (!item) return;
  $('formHeading').textContent = 'Edit Layanan / Produk';
  $('itemId').value = item.id;
  $('itemName').value = item.nama;
  $('itemCategory').value = item.kategori;
  $('itemPrice').value = item.harga;
  $('itemDesc').value = item.deskripsi;
  $('itemFeatured').checked = Boolean(item.unggulan);

  if (isService(item.kategori)) {
    $('itemTersedia').checked = item.stok > 0;
    $('itemStock').value = item.stok > 0 ? '1' : '0';
  } else {
    $('itemStock').value = item.stok;
  }
  toggleStokField();

  uploadedImageDataUrl = item.image_url || '';
  showImagePreview(uploadedImageDataUrl);
  $('btnCancelEdit').classList.remove('hidden');
  $('itemForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetItemForm() {
  $('itemForm').reset();
  $('itemId').value = '';
  $('formHeading').textContent = 'Tambah Layanan / Produk';
  $('btnCancelEdit').classList.add('hidden');
  uploadedImageDataUrl = '';
  showImagePreview('');
  toggleStokField();
}

$('btnCancelEdit').addEventListener('click', resetItemForm);

async function deleteItem(id) {
  if (!confirm('Hapus layanan ini dari katalog?')) return;
  try {
    await api(`/api/items/${id}`, { method: 'DELETE' });
    showToast('Layanan berhasil dihapus.');
    if ($('itemId').value === String(id)) resetItemForm();
    await loadBengkelDashboard();
  } catch (err) {
    showToast(err.message, true);
  }
}

/* ============ PANEL ADMIN ============ */
async function loadAdminPanel() {
  try {
    const [bk, st] = await Promise.all([
      api('/api/admin/bengkel'),
      api('/api/admin/stats'),
    ]);
    $('adminStatsGrid').innerHTML = `
      <div class="stat-card"><span>Mitra Bengkel Aktif</span><strong>${st.stats.total_bengkel}</strong></div>
      <div class="stat-card"><span>Menunggu Persetujuan</span><strong>${st.stats.total_pending}</strong></div>
      <div class="stat-card"><span>Total Layanan Katalog</span><strong>${st.stats.total_layanan}</strong></div>
      <div class="stat-card"><span>Total Stok & Slot</span><strong>${st.stats.total_stok}</strong></div>
    `;
    renderAdminBengkelTable(bk.bengkel);
  } catch (err) {
    showToast(err.message, true);
  }
}

const STATUS_LABEL = {
  pending: 'Menunggu',
  active: 'Mitra Aktif',
  rejected: 'Ditolak',
};

function renderAdminBengkelTable(list) {
  const tbody = $('adminTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Belum ada mitra bengkel.</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map(
      (b) => `
      <tr>
        <td>
          <strong>${escapeHTML(b.nama_bengkel)}</strong><br />
          <span class="shop-sub">${escapeHTML(b.alamat || '—')}</span>
        </td>
        <td>
          ${escapeHTML(b.nama_akun)}<br />
          <span class="shop-sub">${escapeHTML(b.email)}</span>
        </td>
        <td>${escapeHTML(b.nomor_wa)}</td>
        <td>${b.total_layanan} item<br /><span class="shop-sub">stok ${b.total_stok}</span></td>
        <td><span class="status-pill ${escapeHTML(b.status)}">${STATUS_LABEL[b.status] || escapeHTML(b.status)}</span></td>
        <td>
          <div class="action-btns">
            ${b.status !== 'active' ? `<button type="button" class="btn btn-ok btn-sm" data-status="${b.id}" data-val="active">Setujui</button>` : ''}
            ${b.status !== 'rejected' ? `<button type="button" class="btn btn-outline btn-sm" data-status="${b.id}" data-val="rejected">Tolak</button>` : ''}
            <button type="button" class="btn btn-danger btn-sm" data-delbengkel="${b.id}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-status]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/admin/bengkel/${btn.dataset.status}/status`, {
          method: 'PUT',
          body: { status: btn.dataset.val },
        });
        showToast(btn.dataset.val === 'active' ? 'Bengkel disetujui sebagai mitra.' : 'Bengkel ditolak.');
        loadAdminPanel();
      } catch (err) {
        showToast(err.message, true);
      }
    })
  );

  tbody.querySelectorAll('[data-delbengkel]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus bengkel ini beserta akun dan seluruh katalognya?')) return;
      try {
        await api(`/api/admin/bengkel/${btn.dataset.delbengkel}`, { method: 'DELETE' });
        showToast('Bengkel berhasil dihapus.');
        loadAdminPanel();
      } catch (err) {
        showToast(err.message, true);
      }
    })
  );
}

$('bengkelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/bengkel', {
      method: 'POST',
      body: {
        nama_akun: $('bkNamaAkun').value.trim(),
        email: $('bkEmail').value.trim(),
        password: $('bkPassword').value,
        nama_bengkel: $('bkNamaBengkel').value.trim(),
        nomor_wa: $('bkWa').value,
        alamat: $('bkAlamat').value.trim(),
      },
    });
    showToast('Mitra bengkel baru berhasil ditambahkan.');
    $('bengkelForm').reset();
    loadAdminPanel();
  } catch (err) {
    showToast(err.message, true);
  }
});

$('btnCancelBengkel').addEventListener('click', () => {
  $('bengkelForm').reset();
});

$('brandHome').addEventListener('click', (e) => {
  e.preventDefault();
  switchView('catalog');
});

/* ============ INIT ============ */
/* Katalog publik langsung tampil tanpa login; login hanya untuk admin & mitra bengkel */
(async function init() {
  try {
    const data = await api('/api/auth/me');
    if (data.user) state.user = data.user;
  } catch {}
  showApp();
})();
