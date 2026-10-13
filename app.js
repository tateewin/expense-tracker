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

const APP_VERSION = "6";
const STORAGE_KEY = "moneylog.transactions.v1";
const RECURRING_KEY = "moneylog.recurring.v1";
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
  recurring: loadRecurring(),
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

function loadRecurring() {
  try {
    return JSON.parse(localStorage.getItem(RECURRING_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveRecurring() {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(state.recurring));
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

// A picker is a set of element ids plus a `sel` object holding
// {category, subcategory}; the main form and the recurring form each have one.
const MAIN_PICKER = { chips: "category-chips", subField: "subcategory-field", subChips: "subcategory-chips" };
const RC_PICKER = { chips: "rc-category-chips", subField: "rc-subcategory-field", subChips: "rc-subcategory-chips" };

function renderCategoryPicker(ids, sel) {
  const wrap = document.getElementById(ids.chips);
  wrap.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (sel.category === cat.id ? " active" : "");
    btn.textContent = cat.name;
    btn.addEventListener("click", () => {
      sel.category = cat.id;
      sel.subcategory = null;
      renderCategoryPicker(ids, sel);
      renderSubPicker(ids, sel);
    });
    wrap.appendChild(btn);
  });
}

function renderSubPicker(ids, sel) {
  const field = document.getElementById(ids.subField);
  const wrap = document.getElementById(ids.subChips);
  const cat = CATEGORIES.find((c) => c.id === sel.category);
  wrap.innerHTML = "";
  if (!cat || cat.subcategories.length === 0) {
    field.hidden = true;
    return;
  }
  field.hidden = false;
  cat.subcategories.forEach((sub) => {
    const span = document.createElement("span");
    span.className = sel.subcategory === sub ? "active" : "";
    span.textContent = sub;
    span.addEventListener("click", () => {
      sel.subcategory = sub;
      renderSubPicker(ids, sel);
    });
    wrap.appendChild(span);
  });
}

function renderCategoryChips() {
  renderCategoryPicker(MAIN_PICKER, state);
}

function renderSubcategoryChips() {
  renderSubPicker(MAIN_PICKER, state);
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
    syncTx(tx);
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
  document.getElementById("month-nav").hidden = view === "add" || view === "recurring";
  if (view === "history") renderHistory();
  if (view === "overview") renderOverview();
  if (view === "recurring") {
    closeRecurringForm();
    renderRecurring();
  }
}

function rerenderActiveView() {
  const active = document.querySelector(".nav-btn.active");
  const view = active ? active.dataset.view : "add";
  if (view === "history") renderHistory();
  if (view === "overview") renderOverview();
  if (view === "recurring") renderRecurring();
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
      const id = btn.dataset.id;
      state.transactions = state.transactions.filter((t) => t.id !== id);
      saveTransactions();
      renderHistory();
      syncDelete(id);
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

// Pending ops are {op: "upsert" | "delete", id}. Older builds stored bare ids,
// which were always upserts.
function getPending() {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY)) || [];
    return raw.map((p) => (typeof p === "string" ? { op: "upsert", id: p } : p));
  } catch (e) {
    return [];
  }
}

function setPending(ops) {
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(ops));
}

function queuePending(op, id) {
  const ops = getPending().filter((p) => p.id !== id);
  ops.push({ op, id });
  setPending(ops);
}

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.status !== "ok") throw new Error("sheets request failed");
  return data;
}

async function syncTx(tx) {
  const url = getSheetsUrl();
  if (!url) return;
  try {
    await postJson(url, tx);
  } catch (e) {
    queuePending("upsert", tx.id);
  }
  renderSyncStatus();
}

async function syncDelete(id) {
  const url = getSheetsUrl();
  if (!url) return;
  try {
    await postJson(url, { action: "delete", id });
  } catch (e) {
    queuePending("delete", id);
  }
  renderSyncStatus();
}

async function flushPending() {
  const url = getSheetsUrl();
  if (!url) return;
  const pending = getPending();
  if (pending.length === 0) return;
  const stillPending = [];
  for (const p of pending) {
    try {
      if (p.op === "delete") {
        await postJson(url, { action: "delete", id: p.id });
      } else {
        const tx = state.transactions.find((t) => t.id === p.id);
        if (!tx) continue;
        await postJson(url, tx);
      }
    } catch (e) {
      stillPending.push(p);
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
  document.getElementById("sheets-actions").hidden = !url;
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

async function runSheetsAction(btn, busyText, action) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = busyText;
  try {
    await action();
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

document.getElementById("resync-btn").addEventListener("click", (e) => {
  const n = state.transactions.length;
  const ok = confirm(
    `เขียนข้อมูลในชีตใหม่ทั้งหมดจากในเครื่อง (${n.toLocaleString("th-TH")} รายการ)?\n` +
      "ข้อมูลเดิมในชีตจะถูกสำรองเก็บไว้เป็นแท็บแยก"
  );
  if (!ok) return;
  runSheetsAction(e.currentTarget, "กำลังซิงก์...", async () => {
    try {
      await postJson(getSheetsUrl(), { action: "replaceAll", rows: state.transactions });
      setPending([]);
      renderSyncStatus();
      alert(`ซิงก์แล้ว ${n.toLocaleString("th-TH")} รายการ`);
    } catch (err) {
      alert("ซิงก์ไม่สำเร็จ ข้อมูลในชีตยังเหมือนเดิม ลองใหม่อีกครั้ง");
    }
  });
});

document.getElementById("restore-btn").addEventListener("click", (e) => {
  runSheetsAction(e.currentTarget, "กำลังกู้คืน...", async () => {
    try {
      const data = await postJson(getSheetsUrl(), { action: "list" });
      const have = new Set(state.transactions.map((t) => t.id));
      const added = data.rows.filter((r) => !have.has(r.id));
      state.transactions.push(...added);
      saveTransactions();
      renderCurrentMonthView();
      alert(added.length ? `กู้คืนแล้ว ${added.length.toLocaleString("th-TH")} รายการ` : "ข้อมูลในเครื่องครบอยู่แล้ว");
    } catch (err) {
      alert("กู้คืนไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  });
});

// ---- Spendee historical import ----

const SPENDEE_IMPORTED_KEY = "moneylog.spendeeImported";

function updateImportRow() {
  const row = document.getElementById("import-row");
  if (row) row.hidden = !!localStorage.getItem(SPENDEE_IMPORTED_KEY);
}

document.getElementById("import-spendee-btn").addEventListener("click", async () => {
  if (localStorage.getItem(SPENDEE_IMPORTED_KEY)) return;
  const btn = document.getElementById("import-spendee-btn");
  btn.disabled = true;
  btn.textContent = "กำลังนำเข้า...";
  try {
    const res = await fetch("data/spendee-import.json");
    const have = new Set(state.transactions.map((t) => t.id));
    const rows = (await res.json()).filter((r) => !have.has(r.id));
    state.transactions.push(...rows);
    saveTransactions();
    localStorage.setItem(SPENDEE_IMPORTED_KEY, "1");
    updateImportRow();
    renderCurrentMonthView();

    const url = getSheetsUrl();
    if (url && rows.length) {
      try {
        await postJson(url, { rows });
      } catch (e) {
        setPending([...getPending(), ...rows.map((r) => ({ op: "upsert", id: r.id }))]);
        renderSyncStatus();
        alert("นำเข้าข้อมูลในเครื่องสำเร็จ แต่ sync ไป Sheets ไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติตอนเปิดแอปครั้งถัดไป");
      }
    }
  } catch (e) {
    alert("นำเข้าไม่สำเร็จ ลองใหม่อีกครั้ง");
    btn.disabled = false;
    btn.textContent = "นำเข้า";
  }
});

// ---- recurring transactions ----
//
// An item is {id, name, amount, category, subcategory, cycle: "monthly"|"yearly",
// day, month (yearly only), mode: "auto"|"confirm", startDate, lastRun}.
// Occurrences on or after startDate and after lastRun are due. The app can't
// run while closed, so due occurrences are caught up whenever it's opened:
// "auto" items record straight away, "confirm" items wait in the due card for
// the real amount. Either way lastRun advances so nothing is recorded twice.

const rc = { editingId: null, category: "bills", subcategory: "Subscriptions", cycle: "monthly", mode: "auto" };

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function occurrenceAt(item, k) {
  const [sy, sm] = item.startDate.split("-").map(Number);
  let y, m;
  if (item.cycle === "yearly") {
    y = sy + k;
    m = item.month;
  } else {
    const t = sm - 1 + k;
    y = sy + Math.floor(t / 12);
    m = (t % 12) + 1;
  }
  const d = Math.min(item.day, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isPending(item, date) {
  return date >= item.startDate && (!item.lastRun || date > item.lastRun);
}

function dueDates(item, until) {
  const out = [];
  for (let k = 0; k < 600; k++) {
    const date = occurrenceAt(item, k);
    if (date > until) break;
    if (isPending(item, date)) out.push(date);
  }
  return out;
}

function nextDue(item) {
  for (let k = 0; k < 600; k++) {
    const date = occurrenceAt(item, k);
    if (isPending(item, date)) return date;
  }
  return null;
}

function makeRecurringTx(item, date, amount) {
  return {
    id: crypto.randomUUID(),
    type: "expense",
    date,
    amount,
    category: item.category,
    subcategory: item.subcategory,
    note: item.name,
    createdAt: new Date().toISOString(),
    recurringId: item.id,
  };
}

function recordRecurring(txs) {
  if (txs.length === 0) return;
  state.transactions.push(...txs);
  saveTransactions();
  txs.forEach(syncTx);
}

function processRecurring() {
  const today = todayStr();
  const added = [];
  state.recurring.forEach((item) => {
    if (item.mode !== "auto") return;
    dueDates(item, today).forEach((date) => {
      added.push(makeRecurringTx(item, date, item.amount));
      item.lastRun = date;
    });
  });
  if (added.length) {
    saveRecurring();
    recordRecurring(added);
    rerenderActiveView();
  }
  updateRecurringDot();
}

function dueConfirms() {
  const today = todayStr();
  return state.recurring
    .filter((item) => item.mode === "confirm")
    .map((item) => ({ item, dates: dueDates(item, today) }))
    .filter((d) => d.dates.length > 0);
}

function updateRecurringDot() {
  document.getElementById("recurring-dot").hidden = dueConfirms().length === 0;
}

function shortDateThai(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const sameYear = y === Number(todayStr().slice(0, 4));
  return `${d} ${THAI_MONTHS[m - 1]}` + (sameYear ? "" : ` ${y}`);
}

function cycleLabel(item) {
  return item.cycle === "yearly" ? `ทุก ${item.day} ${THAI_MONTHS[item.month - 1]}` : `ทุกวันที่ ${item.day}`;
}

function renderRecurring() {
  renderDueCard();

  let monthly = 0;
  state.recurring.forEach((item) => {
    monthly += item.cycle === "yearly" ? (item.amount || 0) / 12 : item.amount || 0;
  });
  document.getElementById("recurring-summary").innerHTML = `
    <div class="sum-row"><span>เฉลี่ยต่อเดือน</span><span class="expense">${fmt(monthly)}</span></div>
    <div class="sum-row net"><span>ต่อปี</span><span>${fmt(monthly * 12)}</span></div>
  `;
  document.getElementById("recurring-summary").hidden = state.recurring.length === 0;

  const list = document.getElementById("recurring-list");
  list.innerHTML = "";
  document.getElementById("recurring-empty").hidden = state.recurring.length > 0;

  const sorted = [...state.recurring].sort((a, b) => (nextDue(a) || "").localeCompare(nextDue(b) || ""));
  sorted.forEach((item) => {
    const row = document.createElement("div");
    row.className = "tx-row rc-row";

    const main = document.createElement("div");
    main.className = "tx-main";
    const name = document.createElement("span");
    name.className = "tx-cat";
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "tx-note";
    const next = nextDue(item);
    meta.textContent = cycleLabel(item) + (next ? ` · ครั้งถัดไป ${shortDateThai(next)}` : "");
    main.append(name, meta);

    const right = document.createElement("div");
    right.className = "rc-right";
    const amt = document.createElement("span");
    amt.className = "tx-amt expense";
    amt.textContent = item.amount ? fmt(item.amount) : "—";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.mode === "auto" ? "อัตโนมัติ" : "ยืนยันยอด";
    right.append(amt, badge);

    row.append(main, right);
    row.addEventListener("click", () => openRecurringForm(item));
    list.appendChild(row);
  });

  updateRecurringDot();
}

function renderDueCard() {
  const due = dueConfirms();
  const card = document.getElementById("due-card");
  const list = document.getElementById("due-list");
  card.hidden = due.length === 0;
  list.innerHTML = "";

  due.forEach(({ item, dates }) => {
    const date = dates[0];
    const row = document.createElement("div");
    row.className = "due-row";

    const head = document.createElement("div");
    head.className = "due-row-head";
    const name = document.createElement("span");
    name.textContent = item.name;
    const when = document.createElement("span");
    when.textContent = formatDateThai(date) + (dates.length > 1 ? ` (ค้างอีก ${dates.length - 1})` : "");
    head.append(name, when);

    const actions = document.createElement("div");
    actions.className = "due-row-actions";
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.step = "0.01";
    input.min = "0";
    input.placeholder = "ยอดจริง";
    if (item.amount) input.value = item.amount;
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "due-confirm";
    confirmBtn.textContent = "บันทึก";
    confirmBtn.addEventListener("click", () => {
      const amount = parseFloat(input.value);
      if (!(amount > 0)) {
        input.focus();
        return;
      }
      item.lastRun = date;
      saveRecurring();
      recordRecurring([makeRecurringTx(item, date, amount)]);
      showToast();
      renderRecurring();
    });
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "due-skip";
    skipBtn.textContent = "ข้าม";
    skipBtn.addEventListener("click", () => {
      item.lastRun = date;
      saveRecurring();
      renderRecurring();
    });
    actions.append(input, confirmBtn, skipBtn);

    row.append(head, actions);
    list.appendChild(row);
  });
}

// ---- recurring form ----

(function fillMonthSelect() {
  const sel = document.getElementById("rc-month");
  THAI_MONTHS_FULL.forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = String(i + 1);
    opt.textContent = name;
    sel.appendChild(opt);
  });
})();

function setSeg(id, value) {
  document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle("active", b.dataset.value === value));
}

function renderRcForm() {
  setSeg("rc-cycle", rc.cycle);
  setSeg("rc-mode", rc.mode);
  document.getElementById("rc-month-wrap").hidden = rc.cycle !== "yearly";
  document.getElementById("rc-mode-hint").textContent =
    rc.mode === "auto"
      ? "ถึงรอบแล้วบันทึกให้ทันทีด้วยยอดนี้"
      : "ถึงรอบแล้วจะขึ้นให้กรอกยอดจริงก่อนบันทึก ใส่ยอดประมาณไว้ได้";
  renderCategoryPicker(RC_PICKER, rc);
  renderSubPicker(RC_PICKER, rc);
}

document.getElementById("rc-cycle").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  rc.cycle = btn.dataset.value;
  renderRcForm();
});

document.getElementById("rc-mode").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  rc.mode = btn.dataset.value;
  renderRcForm();
});

function openRecurringForm(item) {
  const today = todayStr();
  rc.editingId = item ? item.id : null;
  rc.category = item ? item.category : "bills";
  rc.subcategory = item ? item.subcategory : "Subscriptions";
  rc.cycle = item ? item.cycle : "monthly";
  rc.mode = item ? item.mode : "auto";
  document.getElementById("rc-name").value = item ? item.name : "";
  document.getElementById("rc-amount").value = item && item.amount ? item.amount : "";
  document.getElementById("rc-day").value = item ? item.day : Number(today.slice(8, 10));
  document.getElementById("rc-month").value = String(item && item.month ? item.month : Number(today.slice(5, 7)));
  document.getElementById("rc-delete-btn").hidden = !item;
  renderRcForm();
  document.getElementById("recurring-main").hidden = true;
  document.getElementById("recurring-form").hidden = false;
  window.scrollTo(0, 0);
}

function closeRecurringForm() {
  rc.editingId = null;
  document.getElementById("recurring-form").hidden = true;
  document.getElementById("recurring-main").hidden = false;
}

document.getElementById("add-recurring-btn").addEventListener("click", () => openRecurringForm(null));

document.getElementById("rc-cancel-btn").addEventListener("click", () => {
  closeRecurringForm();
  renderRecurring();
});

document.getElementById("rc-delete-btn").addEventListener("click", () => {
  const item = state.recurring.find((i) => i.id === rc.editingId);
  if (!item) return;
  if (!confirm(`ลบ "${item.name}" ออกจากรายการประจำ?\nรายการที่บันทึกไปแล้วจะยังอยู่ในประวัติ`)) return;
  state.recurring = state.recurring.filter((i) => i.id !== item.id);
  saveRecurring();
  closeRecurringForm();
  renderRecurring();
});

document.getElementById("recurring-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("rc-name").value.trim();
  const amount = parseFloat(document.getElementById("rc-amount").value) || 0;
  const day = parseInt(document.getElementById("rc-day").value, 10);
  const month = parseInt(document.getElementById("rc-month").value, 10);

  if (!name) {
    alert("ใส่ชื่อรายการก่อนครับ");
    return;
  }
  if (rc.mode === "auto" && !(amount > 0)) {
    alert("รายการที่บันทึกอัตโนมัติต้องใส่จำนวนเงินครับ");
    return;
  }
  if (!(day >= 1 && day <= 31)) {
    alert("วันที่ตัดรอบต้องอยู่ระหว่าง 1–31 ครับ");
    return;
  }

  const fields = {
    name,
    amount,
    category: rc.category,
    subcategory: rc.subcategory,
    cycle: rc.cycle,
    day,
    month: rc.cycle === "yearly" ? month : null,
    mode: rc.mode,
  };
  const existing = state.recurring.find((i) => i.id === rc.editingId);
  if (existing) {
    Object.assign(existing, fields);
  } else {
    state.recurring.push({ id: crypto.randomUUID(), ...fields, startDate: todayStr(), lastRun: null });
  }
  saveRecurring();
  closeRecurringForm();
  processRecurring();
  renderRecurring();
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
  if (document.visibilityState === "visible") {
    checkForUpdate();
    processRecurring();
  }
});

// ---- init ----

document.getElementById("date").value = todayStr();
renderCategoryChips();
renderSubcategoryChips();
renderHistory();
updateImportRow();
processRecurring();
flushPending();
checkForUpdate();
