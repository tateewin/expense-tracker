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

const STORAGE_KEY = "moneylog.transactions.v1";
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const state = {
  type: "expense",
  category: null,
  subcategory: null,
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

function renderHistory() {
  const list = document.getElementById("history-list");
  const summaryEl = document.getElementById("month-summary");
  const emptyEl = document.getElementById("empty-state");

  const txs = [...state.transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );

  emptyEl.hidden = txs.length > 0;

  const ym = todayStr().slice(0, 7);
  let inc = 0,
    exp = 0;
  txs.forEach((t) => {
    if (t.date.slice(0, 7) === ym) {
      if (t.type === "income") inc += t.amount;
      else exp += t.amount;
    }
  });
  summaryEl.innerHTML = `
    <div class="sum-row"><span>รายรับเดือนนี้</span><span class="income">+${fmt(inc)}</span></div>
    <div class="sum-row"><span>รายจ่ายเดือนนี้</span><span class="expense">-${fmt(exp)}</span></div>
    <div class="sum-row net"><span>คงเหลือ</span><span>${fmt(inc - exp)}</span></div>
  `;

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
    btn.addEventListener("click", () => {
      state.transactions = state.transactions.filter((t) => t.id !== btn.dataset.id);
      saveTransactions();
      renderHistory();
    });
  });
}

// ---- bottom nav ----

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== `view-${btn.dataset.view}`));
    if (btn.dataset.view === "history") renderHistory();
  });
});

// ---- init ----

document.getElementById("date").value = todayStr();
renderCategoryChips();
renderSubcategoryChips();
renderHistory();
