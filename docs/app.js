const ADMIN_USER = "admin";
const ADMIN_PASS = "61828100";
const STORAGE_KEY = "cus_admin_split_tables_v2";
const SESSION_KEY = "cus_admin_session";

let db = loadDb();
let charts = {};
let currentView = "dashboard";
let activeEntity = null;
let editingId = null;

const configs = {
  products: {
    title: "產品資料",
    storage: "products",
    tableId: "productsTable",
    filterId: "productsFilters",
    addText: "新增產品",
    searchFields: ["productCode", "productName", "category", "spec"],
    filters: [
      ["productCode", "產品編號"],
      ["productName", "產品名稱"],
      ["category", "類別"],
      ["spec", "規格"],
    ],
    columns: [
      ["productCode", "產品編號"],
      ["productName", "產品名稱"],
      ["category", "類別"],
      ["spec", "規格"],
      ["cost", "成本單價", "number"],
    ],
  },
  customers: {
    title: "客戶資料",
    storage: "customers",
    tableId: "customersTable",
    filterId: "customersFilters",
    addText: "新增客戶",
    searchFields: ["customerId", "customerName", "phone", "phone1", "phone2", "address"],
    filters: [
      ["customerName", "客戶姓名"],
      ["phone", "電話"],
      ["address", "地址"],
    ],
    columns: [
      ["customerId", "客戶代號"],
      ["customerName", "客戶姓名"],
      ["phone", "客戶電話"],
      ["phone1", "客戶電話1"],
      ["phone2", "客戶電話2"],
      ["address", "客戶地址"],
    ],
  },
  sales: {
    title: "銷售資料",
    storage: "sales",
    tableId: "salesTable",
    filterId: "salesFilters",
    addText: "新增銷售",
    searchFields: ["customerId", "customerName", "productCode", "page", "note"],
    filters: [
      ["customerName", "客戶姓名"],
      ["productCode", "產品編號/型號"],
      ["startDate", "起始日期", "date"],
      ["endDate", "結束日期", "date"],
    ],
    columns: [
      ["customerId", "客戶代號"],
      ["customerName", "客戶姓名"],
      ["purchaseDate", "購買日期", "date"],
      ["page", "頁次"],
      ["productCode", "商品型號"],
      ["quantity", "數量", "number"],
      ["amount", "金額", "money"],
      ["note", "備註"],
    ],
  },
};

const loginScreen = document.querySelector("#loginScreen");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const logoutBtn = document.querySelector("#logoutBtn");
const sidebar = document.querySelector(".sidebar");
const mobileMenu = document.querySelector("#mobileMenu");
const navLinks = [...document.querySelectorAll(".nav-link")];
const pageTitle = document.querySelector("#pageTitle");
const recordDialog = document.querySelector("#recordDialog");
const recordForm = document.querySelector("#recordForm");
const dynamicFields = document.querySelector("#dynamicFields");
const dialogTitle = document.querySelector("#dialogTitle");
const saveRecordBtn = document.querySelector("#saveRecordBtn");
const resetDataBtn = document.querySelector("#resetDataBtn");
const fileInput = document.querySelector("#fileInput");

const views = {
  dashboard: document.querySelector("#dashboardView"),
  products: document.querySelector("#productsView"),
  customers: document.querySelector("#customersView"),
  sales: document.querySelector("#salesView"),
  import: document.querySelector("#importView"),
};

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = document.querySelector("#loginUser").value.trim();
  const pass = document.querySelector("#loginPass").value;
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    sessionStorage.setItem(SESSION_KEY, "true");
    loginMessage.textContent = "";
    showApp();
    return;
  }
  loginMessage.textContent = "帳號或密碼錯誤。";
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  appShell.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

mobileMenu.addEventListener("click", () => sidebar.classList.toggle("open"));
navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setView(link.dataset.view);
    sidebar.classList.remove("open");
  });
});

saveRecordBtn.addEventListener("click", saveRecord);
resetDataBtn.addEventListener("click", () => {
  if (!confirm("確定還原為 Cus.xls 初始資料？目前瀏覽器中的修改會被覆蓋。")) return;
  db = cloneInitialData();
  saveDb();
  renderAll();
});
fileInput.addEventListener("change", handleFileUpload);

function showApp() {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  buildEntityViews();
  setView(currentView);
}

function setView(viewName) {
  currentView = viewName;
  Object.entries(views).forEach(([name, view]) => view.classList.toggle("hidden", name !== viewName));
  navLinks.forEach((link) => link.classList.toggle("active", link.dataset.view === viewName));
  pageTitle.textContent =
    viewName === "dashboard" ? "總覽報表" : viewName === "import" ? "匯入資料" : configs[viewName].title;
  renderAll();
}

function loadDb() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.products && saved?.customers && saved?.sales) return saved;
  } catch {
    // Use bundled initial data below.
  }
  return cloneInitialData();
}

function cloneInitialData() {
  const source = window.CUS_INITIAL_DATA || { products: [], customers: [], sales: [] };
  return JSON.parse(JSON.stringify({
    products: source.products || [],
    customers: source.customers || [],
    sales: source.sales || [],
  }));
}

function saveDb() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function buildEntityViews() {
  Object.keys(configs).forEach((entity) => {
    const config = configs[entity];
    const container = document.querySelector(`#${config.filterId}`);
    if (container.dataset.ready) return;
    container.dataset.ready = "true";
    container.innerHTML = `
      <div class="filter-title">
        <p>${entity.toUpperCase()}</p>
        <h3>${config.title}</h3>
      </div>
      <div class="filters">
        ${config.filters
          .map(
            ([field, label, type = "text"]) => `
              <label>
                ${label}
                <input data-filter="${field}" data-entity="${entity}" type="${type}" placeholder="模糊查詢 ${label}" />
              </label>
            `,
          )
          .join("")}
      </div>
      <div class="toolbar">
        <span id="${entity}Count">0 筆資料</span>
        <div>
          <button class="btn subtle" data-clear="${entity}" type="button">清除查詢</button>
          <button class="btn primary" data-add="${entity}" type="button">${config.addText}</button>
        </div>
      </div>
    `;
    container.addEventListener("input", () => renderEntity(entity));
    container.addEventListener("click", (event) => {
      const clear = event.target.closest("[data-clear]");
      const add = event.target.closest("[data-add]");
      if (clear) {
        container.querySelectorAll("[data-filter]").forEach((input) => (input.value = ""));
        renderEntity(entity);
      }
      if (add) openDialog(entity);
    });
  });
}

function renderAll() {
  renderKpis();
  renderCharts();
  Object.keys(configs).forEach(renderEntity);
  document.querySelector("#loadedProducts").textContent = `${db.products.length} 產品`;
  document.querySelector("#loadedCustomers").textContent = `${db.customers.length} 客戶`;
  document.querySelector("#loadedSales").textContent = `${db.sales.length} 銷售`;
}

function renderEntity(entity) {
  const config = configs[entity];
  const rows = getFiltered(entity);
  document.querySelector(`#${entity}Count`).textContent = `${rows.length} 筆資料`;
  const table = document.querySelector(`#${config.tableId}`);
  table.innerHTML = `
    <thead>
      <tr>
        ${config.columns.map(([, label]) => `<th>${label}</th>`).join("")}
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${
        rows.length
          ? rows.map((row) => renderRow(entity, row)).join("")
          : `<tr><td class="empty" colspan="${config.columns.length + 1}">目前沒有符合條件的資料。</td></tr>`
      }
    </tbody>
  `;
  table.onclick = (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const row = db[config.storage].find((item) => item.id === button.dataset.id);
    if (!row) return;
    if (button.dataset.action === "edit") openDialog(entity, row);
    if (button.dataset.action === "delete") deleteRecord(entity, row);
  };
}

function renderRow(entity, row) {
  const config = configs[entity];
  return `
    <tr>
      ${config.columns
        .map(([field, label, type]) => `<td data-label="${label}">${escapeHtml(formatValue(row[field], type))}</td>`)
        .join("")}
      <td data-label="操作">
        <button class="table-action" data-action="edit" data-id="${row.id}" type="button">修改</button>
        <button class="table-action danger" data-action="delete" data-id="${row.id}" type="button">刪除</button>
      </td>
    </tr>
  `;
}

function getFiltered(entity) {
  const config = configs[entity];
  const inputs = [...document.querySelectorAll(`[data-entity="${entity}"]`)];
  return db[config.storage].filter((row) => {
    return inputs.every((input) => {
      const key = input.dataset.filter;
      const value = input.value.trim();
      if (!value) return true;
      if (entity === "sales" && key === "startDate") return normalize(row.purchaseDate) >= value;
      if (entity === "sales" && key === "endDate") return normalize(row.purchaseDate) <= value;
      return normalize(row[key]).toLowerCase().includes(value.toLowerCase());
    });
  });
}

function openDialog(entity, row = null) {
  activeEntity = entity;
  editingId = row?.id || null;
  const config = configs[entity];
  dialogTitle.textContent = row ? `修改${config.title}` : config.addText;
  dynamicFields.innerHTML = config.columns
    .map(([field, label, type]) => {
      const inputType = type === "date" ? "date" : type === "number" || type === "money" ? "number" : "text";
      const step = type === "money" ? " step=\"1\"" : "";
      return `
        <label>
          ${label}
          <input name="${field}" type="${inputType}"${step} value="${escapeHtml(row?.[field] ?? "")}" />
        </label>
      `;
    })
    .join("");
  recordDialog.showModal();
}

function saveRecord() {
  if (!activeEntity) return;
  const config = configs[activeEntity];
  const values = Object.fromEntries([...dynamicFields.querySelectorAll("input")].map((input) => [input.name, input.value]));
  config.columns.forEach(([field, , type]) => {
    if (type === "number" || type === "money") values[field] = Number(values[field] || 0);
  });
  const item = { id: editingId || `${activeEntity}-${crypto.randomUUID()}`, ...values };
  db[config.storage] = editingId
    ? db[config.storage].map((row) => (row.id === editingId ? item : row))
    : [item, ...db[config.storage]];
  saveDb();
  recordDialog.close();
  renderAll();
}

function deleteRecord(entity, row) {
  const config = configs[entity];
  const label = row.customerName || row.productName || row.productCode || row.id;
  if (!confirm(`確定刪除「${label}」這筆資料？`)) return;
  db[config.storage] = db[config.storage].filter((item) => item.id !== row.id);
  saveDb();
  renderAll();
}

function renderKpis() {
  document.querySelector("#kpiProducts").textContent = db.products.length.toLocaleString();
  document.querySelector("#kpiCustomers").textContent = db.customers.length.toLocaleString();
  document.querySelector("#kpiSales").textContent = db.sales.length.toLocaleString();
  document.querySelector("#kpiRevenue").textContent = formatMoney(sum(db.sales, "amount"));
}

function renderCharts() {
  if (!window.Chart) return;
  const monthly = groupByMonth(db.sales);
  const seasons = groupBySeason(db.sales);
  const products = topProducts(db.sales, 8);
  drawChart("trendChart", "bar", monthly.labels, monthly.values, "銷售金額");
  drawChart("seasonChart", "doughnut", seasons.labels, seasons.values, "季節銷售金額");
  drawChart("productChart", "bar", products.labels, products.values, "產品銷售金額", true);
}

function drawChart(id, type, labels, values, label, horizontal = false) {
  const ctx = document.querySelector(`#${id}`);
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          backgroundColor: ["#f06434", "#245caa", "#2d7b5f", "#f5b642", "#8b5cf6", "#14b8a6", "#ef4444", "#64748b"],
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      plugins: { legend: { display: type === "doughnut" } },
      scales: type === "doughnut" ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function groupByMonth(rows) {
  const bucket = {};
  rows.forEach((row) => {
    const key = normalize(row.purchaseDate).slice(0, 7) || "未填日期";
    bucket[key] = (bucket[key] || 0) + Number(row.amount || 0);
  });
  const labels = Object.keys(bucket).sort();
  return { labels, values: labels.map((key) => bucket[key]) };
}

function groupBySeason(rows) {
  const labels = ["春季 3-5月", "夏季 6-8月", "秋季 9-11月", "冬季 12-2月"];
  const values = [0, 0, 0, 0];
  rows.forEach((row) => {
    const month = Number(normalize(row.purchaseDate).slice(5, 7));
    const index = month >= 3 && month <= 5 ? 0 : month >= 6 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : 3;
    values[index] += Number(row.amount || 0);
  });
  return { labels, values };
}

function topProducts(rows, limit) {
  const bucket = {};
  rows.forEach((row) => {
    const key = row.productCode || "未填產品";
    bucket[key] = (bucket[key] || 0) + Number(row.amount || 0);
  });
  const sorted = Object.entries(bucket)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  return { labels: sorted.map((item) => item.label), values: sorted.map((item) => item.value) };
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  importWorkbook(buffer, file.name);
}

function importWorkbook(buffer, fileName) {
  if (!window.XLSX) return;
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetRows = (name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "", raw: false });
  db = {
    products: sheetRows("商品").map(normalizeProduct).filter((row) => row.productCode || row.productName),
    customers: sheetRows("客戶").map(normalizeCustomer).filter((row) => row.customerId || row.customerName),
    sales: sheetRows("銷貨縮表").map(normalizeSale).filter((row) => row.customerId || row.customerName || row.productCode),
  };
  saveDb();
  renderAll();
  alert(`已從 ${fileName} 匯入：產品 ${db.products.length}、客戶 ${db.customers.length}、銷售 ${db.sales.length}`);
}

function normalizeProduct(row, index) {
  return {
    id: `p-${index}-${crypto.randomUUID()}`,
    productCode: normalize(row["商品編號"]),
    productName: normalize(row["商品名稱"]),
    category: normalize(row["類別"]),
    spec: normalize(row["規格"]),
    cost: parseMoney(row["成本單價"]),
  };
}

function normalizeCustomer(row, index) {
  return {
    id: `c-${index}-${crypto.randomUUID()}`,
    customerId: normalize(row["客戶代號"]),
    customerName: normalize(row["客戶姓名"]),
    phone: normalize(row["客戶電話"]),
    phone1: normalize(row["客戶電話1"]),
    phone2: normalize(row["客戶電話2"]),
    address: normalize(row["客戶地址"]),
  };
}

function normalizeSale(row, index) {
  return {
    id: `s-${index}-${crypto.randomUUID()}`,
    customerId: normalize(row["客戶代號"]),
    customerName: normalize(row["客戶姓名"]),
    purchaseDate: normalizeDate(row["購買日期"]),
    page: normalize(row["頁次"]),
    productCode: normalize(row["商品型號"]),
    quantity: Number(normalize(row["數量"]).replaceAll(",", "")) || 0,
    amount: parseMoney(row["金額"]),
    note: normalize(row["備註"]),
  };
}

function normalizeDate(value) {
  const text = normalize(value).replaceAll("/", "-");
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
}

function parseMoney(value) {
  return Number(normalize(value).replace(/[$,，\s]/g, "")) || 0;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function formatValue(value, type) {
  if (type === "money") return formatMoney(value);
  if (type === "number") return Number(value || 0).toLocaleString();
  return value ?? "";
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function normalize(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return normalize(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

if (sessionStorage.getItem(SESSION_KEY) === "true") showApp();
