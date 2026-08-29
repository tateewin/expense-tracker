const CATEGORIES = [
  { id: "food", name: "Food", subcategories: ["Breakfast", "Lunch", "Dinner", "Coffee", "Alcohol", "Desserts"] },
  { id: "fixed", name: "Fixed Expenses", subcategories: ["Condo Installment", "Insurance"] },
  { id: "bills", name: "Bills", subcategories: ["Utilities", "Subscriptions"] },
  { id: "transportation", name: "Transportation", subcategories: [] },
  { id: "appearance", name: "Appearance", subcategories: [] },
  { id: "travel", name: "Travel", subcategories: [] },
  { id: "sports", name: "Sports", subcategories: [] },
  { id: "entertainment", name: "Entertainment", subcategories: [] },
  { id: "gifts", name: "Gifts", subcategories: [] },
  { id: "groceries", name: "Groceries", subcategories: [] },
  { id: "lottery", name: "Lottery", subcategories: [] },
  { id: "others", name: "Others", subcategories: [] },
];

const APP_VERSION = "3";
const STORAGE_KEY = "moneylog.transactions.v1";
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const state = {
  type: "expense",
  category: null,
  subcategory: null,
  editingId: null,
  historyMonth: todayStr().slice(0, 7),
  transactions: loadTransactions(),
};

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

function todayStr() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function fmt(n) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function formatDateThai(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${THAI_MONTHS[m - 1]} ${y}`;
}

function catName(id) {
  const c = CATEGORIES.find((c) => c.id === id);
  return c ? c.name : id;
}

// ---- form: category chips ----

function renderCategoryChips() {
  const wrap = document.getElementById("category-chips");
  wrap.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (state.category === cat.id ? " active" : "");
    btn.textContent = cat.name;
    btn.addEventListener("click", () => {
      state.category = cat.id;
      state.subcategory = null;
      renderCategoryChips();
      renderSubcategoryChips();
    });
    wrap.appendChild(btn);
  });
}

function renderSubcategoryChips() {
  const field = document.getElementById("subcategory-field");
  const wrap = document.getElementById("subcategory-chips");
  const cat = CATEGORIES.find((c) => c.id === state.category);
  wrap.innerHTML = "";
  if (!cat || cat.subcategories.length === 0) {
    field.hidden = true;
    return;
  }
  field.hidden = false;
  cat.subcategories.forEach((sub) => {
    const span = document.createElement("span");
    span.className = state.subcategory === sub ? "active" : "";
    span.textContent = sub;
    span.addEventListener("click", () => {
      state.subcategory = sub;
      renderSubcategoryChips();
    });
    wrap.appendChild(span);
  });
}

// ---- form: type toggle ----

document.getElementById("type-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  state.type = btn.dataset.type;
  document.querySelectorAll("#type-tabs .tab").forEach((b) => b.classList.toggle("active", b === btn));
  const isExpense = state.type === "expense";
  document.getElementById("category-field").hidden = !isExpense;
  if (!isExpense) {
    state.category = null;
    state.subcategory = null;
  }
  renderSubcategoryChips();
});

// ---- form: submit ----

document.getElementById("entry-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("date").value;
  const note = document.getElementById("note").value.trim();

  if (!amount || amount <= 0 || !date) return;
  if (state.type === "expense" && !state.category) {
    alert("เลือกหมวดก่อนครับ");
    return;
  }

  if (state.editingId) {
    const tx = state.transactions.find((t) => t.id === state.editingId);
    tx.type = state.type;
    tx.date = date;
    tx.amount = amount;
    tx.category = state.type === "expense" ? state.category : null;
    tx.subcategory = state.type === "expense" ? state.subcategory : null;
    tx.note = note;
    saveTransactions();
    endEdit();
    showToast();
    switchView("history");
    return;
  }

  const tx = {
    id: crypto.randomUUID(),
    type: state.type,
    date,
    amount,
    category: state.type === "expense" ? state.category : null,
    subcategory: state.type === "expense" ? state.subcategory : null,
    note,
    createdAt: new Date().toISOString(),
  };

  state.transactions.push(tx);
  saveTransactions();
  showToast();
  resetForm();
  renderHistory();
  syncTx(tx);
});

document.getElementById("cancel-edit-btn").addEventListener("click", () => {
  endEdit();
  switchView("history");
});

function resetForm() {
  document.getElementById("amount").value = "";
  document.getElementById("note").value = "";
  state.category = null;
  state.subcategory = null;
  renderCategoryChips();
  renderSubcategoryChips();
  document.getElementById("date").value = todayStr();
}

// ---- edit existing transaction ----

function startEdit(tx) {
  state.editingId = tx.id;
  state.type = tx.type;
  state.category = tx.category;
  state.subcategory = tx.subcategory;

  document.querySelectorAll("#type-tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.type === tx.type));
  document.getElementById("category-field").hidden = tx.type !== "expense";
  document.getElementById("amount").value = tx.amount;
  document.getElementById("date").value = tx.date;
  document.getElementById("note").value = tx.note || "";
  renderCategoryChips();
  renderSubcategoryChips();

  document.getElementById("save-btn").textContent = "บันทึกการแก้ไข";
  document.getElementById("cancel-edit-btn").hidden = false;

  switchView("add");
}

function endEdit() {
  state.editingId = null;
  document.getElementById("save-btn").textContent = "บันทึก";
  document.getElementById("cancel-edit-btn").hidden = true;
  resetForm();
}

function switchView(view) {
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${view}`));
  document.getElementById("month-nav").hidden = view === "add";
  if (view === "history") renderHistory();
  if (view === "overview") renderOverview();
}

function showToast() {
  const t = document.getElementById("toast");
  t.hidden = false;
  t.classList.add("show");
  setTimeout(() => {
    t.classList.remove("show");
    t.hidden = true;
  }, 1200);
}

// ---- history view ----

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function renderMonthLabel() {
  const [y, m] = state.historyMonth.split("-").map(Number);
  document.getElementById("month-label").textContent = `${THAI_MONTHS_FULL[m - 1]} ${y}`;
  document.getElementById("next-month-btn").disabled = state.historyMonth >= todayStr().slice(0, 7);
}

function renderCurrentMonthView() {
  const activeBtn = document.querySelector(".nav-btn.active");
  if (activeBtn && activeBtn.dataset.view === "overview") renderOverview();
  else renderHistory();
}

document.getElementById("prev-month-btn").addEventListener("click", () => {
  state.historyMonth = shiftMonth(state.historyMonth, -1);
  renderCurrentMonthView();
});

document.getElementById("next-month-btn").addEventListener("click", () => {
  state.historyMonth = shiftMonth(state.historyMonth, 1);
  renderCurrentMonthView();
});

function monthTxs(ym) {
  return state.transactions.filter((t) => t.date.slice(0, 7) === ym);
}

function monthTotals(ym) {
  let inc = 0,
    exp = 0;
  monthTxs(ym).forEach((t) => {
    if (t.type === "income") inc += t.amount;
    else exp += t.amount;
  });
  return { inc, exp };
}

function summaryHtml(inc, exp) {
  return `
    <div class="sum-row"><span>รายรับเดือนนี้</span><span class="income">+${fmt(inc)}</span></div>
    <div class="sum-row"><span>รายจ่ายเดือนนี้</span><span class="expense">-${fmt(exp)}</span></div>
    <div class="sum-row net"><span>คงเหลือ</span><span>${fmt(inc - exp)}</span></div>
  `;
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const summaryEl = document.getElementById("month-summary");
  const emptyEl = document.getElementById("empty-state");

  renderMonthLabel();

  const txs = monthTxs(state.historyMonth).sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );

  emptyEl.hidden = txs.length > 0;

  const { inc, exp } = monthTotals(state.historyMonth);
  summaryEl.innerHTML = summaryHtml(inc, exp);

  const groups = {};
  txs.forEach((t) => {
    (groups[t.date] = groups[t.date] || []).push(t);
  });

  list.innerHTML = "";
  Object.keys(groups).forEach((date) => {
    const dayTxs = groups[date];
    const dayTotal = dayTxs.reduce((s, t) => s + (t.type === "expense" ? -t.amount : t.amount), 0);

    const dayEl = document.createElement("div");
    dayEl.className = "day-group";
    dayEl.innerHTML = `<div class="day-head"><span>${formatDateThai(date)}</span><span>${fmt(dayTotal)}</span></div>`;

    const itemsEl = document.createElement("div");
    itemsEl.className = "day-items";
    dayTxs.forEach((t) => {
      const label = t.type === "income" ? "รายรับ" : [catName(t.category), t.subcategory].filter(Boolean).join(" · ");
      const row = document.createElement("div");
      row.className = "tx-row";
      row.dataset.id = t.id;
      row.innerHTML = `
        <div class="tx-main">
          <span class="tx-cat">${escapeHtml(label)}</span>
          ${t.note ? `<span class="tx-note">${escapeHtml(t.note)}</span>` : ""}
        </div>
        <span class="tx-amt ${t.type}">${t.type === "income" ? "+" : "-"}${fmt(t.amount)}</span>
        <button type="button" class="tx-del" data-id="${t.id}" aria-label="ลบรายการ">×</button>
      `;
      itemsEl.appendChild(row);
    });
    dayEl.appendChild(itemsEl);
    list.appendChild(dayEl);
  });

  list.querySelectorAll(".tx-del").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.transactions = state.transactions.filter((t) => t.id !== btn.dataset.id);
      saveTransactions();
      renderHistory();
    });
  });

  list.querySelectorAll(".tx-row").forEach((row) => {
    row.addEventListener("click", () => {
      const tx = state.transactions.find((t) => t.id === row.dataset.id);
      if (tx) startEdit(tx);
    });
  });

  renderSyncStatus();
}

// ---- overview: category breakdown + trend ----

function compactNum(n) {
  return Math.round(n).toLocaleString("th-TH");
}

function niceMax(value) {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}

function showChartTooltip(target, label, value) {
  const tip = document.getElementById("chart-tooltip");
  const rect = target.getBoundingClientRect();
  tip.textContent = "";
  tip.appendChild(document.createTextNode(label + ": "));
  const strong = document.createElement("strong");
  strong.textContent = `฿${fmt(value)}`;
  tip.appendChild(strong);
  tip.style.left = `${rect.left + rect.width / 2}px`;
  tip.style.top = `${rect.top - 8}px`;
  tip.hidden = false;
}

document.addEventListener("click", (e) => {
  const tip = document.getElementById("chart-tooltip");
  if (!tip.hidden && !e.target.closest(".trend-bar")) tip.hidden = true;
});

function renderOverview() {
  renderMonthLabel();
  const { inc, exp } = monthTotals(state.historyMonth);
  document.getElementById("overview-summary").innerHTML = summaryHtml(inc, exp);
  renderCategoryChart();
  renderTrendChart();
}

function renderCategoryChart() {
  const wrap = document.getElementById("cat-chart");
  const emptyEl = document.getElementById("cat-chart-empty");

  const totals = {};
  monthTxs(state.historyMonth).forEach((t) => {
    if (t.type !== "expense") return;
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const rows = Object.entries(totals)
    .map(([id, amount]) => ({ name: catName(id), amount }))
    .sort((a, b) => b.amount - a.amount);

  emptyEl.hidden = rows.length > 0;
  wrap.innerHTML = "";
  if (rows.length === 0) return;

  const max = rows[0].amount;
  rows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "hbar-row";
    const label = document.createElement("span");
    label.className = "hbar-label";
    label.textContent = row.name;
    const track = document.createElement("div");
    track.className = "hbar-track";
    const fill = document.createElement("div");
    fill.className = "hbar-fill";
    fill.style.width = `${(row.amount / max) * 100}%`;
    track.appendChild(fill);
    const value = document.createElement("span");
    value.className = "hbar-value";
    value.textContent = fmt(row.amount);
    el.append(label, track, value);
    wrap.appendChild(el);
  });
}

function renderTrendChart() {
  const plot = document.getElementById("trend-plot");
  plot.innerHTML = "";

  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(state.historyMonth, -i));
  const data = months.map((ym) => ({ ym, ...monthTotals(ym) }));
  const max = niceMax(Math.max(100, ...data.map((d) => Math.max(d.inc, d.exp))));

  [0, 0.5, 1].forEach((frac) => {
    const line = document.createElement("div");
    line.className = "trend-grid-line";
    line.style.bottom = `${frac * 100}%`;
    plot.appendChild(line);

    const label = document.createElement("span");
    label.className = "trend-grid-label";
    label.style.bottom = `${frac * 100}%`;
    label.textContent = frac === 0 ? "0" : compactNum(max * frac);
    plot.appendChild(label);
  });

  const groupsEl = document.createElement("div");
  groupsEl.className = "trend-groups";
  const lastYm = months[months.length - 1];

  data.forEach((d) => {
    const [, m] = d.ym.split("-").map(Number);
    const isLast = d.ym === lastYm;
    const group = document.createElement("div");
    group.className = "trend-group";

    const makeBar = (kind, value, seriesLabel) => {
      const bar = document.createElement("div");
      bar.className = `trend-bar ${kind}`;
      bar.style.height = `${(value / max) * 100}%`;
      bar.addEventListener("click", (e) => {
        e.stopPropagation();
        showChartTooltip(bar, `${seriesLabel} · ${THAI_MONTHS[m - 1]}`, value);
      });
      if (isLast && value > 0) {
        const lbl = document.createElement("span");
        lbl.className = "trend-bar-label";
        lbl.textContent = compactNum(value);
        bar.appendChild(lbl);
      }
      return bar;
    };

    group.appendChild(makeBar("income", d.inc, "รายรับ"));
    group.appendChild(makeBar("expense", d.exp, "รายจ่าย"));

    const monthLabel = document.createElement("span");
    monthLabel.className = "trend-month-label";
    monthLabel.textContent = THAI_MONTHS[m - 1];
    group.appendChild(monthLabel);

    groupsEl.appendChild(group);
  });

  plot.appendChild(groupsEl);
}

// ---- Google Sheets sync ----

const SHEETS_URL_KEY = "moneylog.sheetsUrl";
const PENDING_SYNC_KEY = "moneylog.pendingSync";

function getSheetsUrl() {
  return localStorage.getItem(SHEETS_URL_KEY) || "";
}

function setSheetsUrl(url) {
  localStorage.setItem(SHEETS_URL_KEY, url);
}

function getPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function setPending(ids) {
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(ids));
}

async function postTx(url, tx) {
  const res = await fetch(url, { method: "POST", body: JSON.stringify(tx) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.status !== "ok") throw new Error("sync failed");
}

async function syncTx(tx) {
  const url = getSheetsUrl();
  if (!url) return;
  try {
    await postTx(url, tx);
  } catch (e) {
    const pending = getPending();
    if (!pending.includes(tx.id)) {
      pending.push(tx.id);
      setPending(pending);
    }
  }
  renderSyncStatus();
}

async function flushPending() {
  const url = getSheetsUrl();
  if (!url) return;
  const pending = getPending();
  if (pending.length === 0) return;
  const stillPending = [];
  for (const id of pending) {
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) continue;
    try {
      await postTx(url, tx);
    } catch (e) {
      stillPending.push(id);
    }
  }
  setPending(stillPending);
  renderSyncStatus();
}

function renderSyncStatus() {
  const el = document.getElementById("sync-status");
  if (!el) return;
  const url = getSheetsUrl();
  const pending = getPending();
  if (!url) {
    el.textContent = "ยังไม่ได้เชื่อม Google Sheets";
  } else if (pending.length > 0) {
    el.textContent = `เชื่อมต่อแล้ว · ค้างซิงก์ ${pending.length} รายการ`;
  } else {
    el.textContent = "เชื่อมต่อ Google Sheets แล้ว";
  }
}

document.getElementById("sync-settings-btn").addEventListener("click", () => {
  const current = getSheetsUrl();
  const input = prompt("วาง Web App URL จาก Google Apps Script:", current);
  if (input === null) return;
  setSheetsUrl(input.trim());
  renderSyncStatus();
  if (input.trim()) flushPending();
});

// ---- bottom nav ----

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.view === "add" && state.editingId) endEdit();
    switchView(btn.dataset.view);
  });
});

// ---- update check ----

async function checkForUpdate() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    if (data.version && data.version !== APP_VERSION) {
      document.getElementById("update-banner").hidden = false;
    }
  } catch (e) {
    // offline or unreachable — ignore, nothing to report
  }
}

document.getElementById("update-reload-btn").addEventListener("click", () => {
  location.reload();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});

// ---- init ----

document.getElementById("date").value = todayStr();
renderCategoryChips();
renderSubcategoryChips();
renderHistory();
flushPending();
checkForUpdate();
