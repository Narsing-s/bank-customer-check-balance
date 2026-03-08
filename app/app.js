/******************************
 * Bank App - Frontend Logic  *
 * Demo only; uses localStorage
 ******************************/

// ---------- Utilities & Storage ----------
const STORAGE_KEYS = {
  ACCOUNTS: "bank_accounts_v1",   // Array of accounts
  LAST_ACCT: "bank_last_account", // Last generated account number
  SEEDED: "bank_seeded_v1",       // Seed flag
};

/**
 * Account shape:
 * {
 *   accountNumber: string,
 *   fullName: string,
 *   email: string,
 *   dob: "YYYY-MM-DD",
 *   mobile: string,
 *   address: string,
 *   aadhar: string,
 *   bank: string,
 *   type: "Savings"|"Current"|string,
 *   pin: string, // PLAIN for demo; never do this in prod
 *   balance: number,
 *   history: [ { id, type: 'DEPOSIT'|'WITHDRAW'|'CREATE'|'UPDATE'|'DELETE'|'BALANCE', amount, time, note } ]
 * }
 */

function readAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAccounts(list) {
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(list));
}

function nextAccountNumber() {
  const last = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_ACCT) || "1000000000", 10);
  const next = last + 1;
  localStorage.setItem(STORAGE_KEYS.LAST_ACCT, String(next));
  return String(next);
}

function findAccount(acctNo) {
  const accs = readAccounts();
  return accs.find(a => a.accountNumber === String(acctNo));
}

function updateAccountInStore(updated) {
  const accs = readAccounts();
  const i = accs.findIndex(a => a.accountNumber === updated.accountNumber);
  if (i >= 0) {
    accs[i] = updated;
    writeAccounts(accs);
    return true;
  }
  return false;
}

function deleteAccountFromStore(acctNo) {
  const accs = readAccounts();
  const next = accs.filter(a => a.accountNumber !== String(acctNo));
  const changed = next.length !== accs.length;
  if (changed) writeAccounts(next);
  return changed;
}

function addHistory(acc, entry) {
  acc.history.push({
    id: cryptoRandomId(),
    time: new Date().toISOString(),
    ...entry,
  });
}

function cryptoRandomId() {
  // Simple 12-char id
  return Math.random().toString(36).slice(2, 14);
}

function fmtINR(n) {
  // Simple Indian locale format (no currency sign)
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  } catch {
    return String(n);
  }
}

// ---------- Seed Demo Data ----------
(function seedOnce() {
  if (localStorage.getItem(STORAGE_KEYS.SEEDED)) return;

  const demo = {
    accountNumber: nextAccountNumber(),
    fullName: "Demo User",
    email: "demo@example.com",
    dob: "1990-01-01",
    mobile: "9876543210",
    address: "123 Demo Street, Vizag",
    aadhar: "1234 5678 9012",
    bank: "Demo Bank",
    type: "Savings",
    pin: "1234", // demo only
    balance: 25000,
    history: [],
  };
  addHistory(demo, { type: "CREATE", amount: 0, note: "Account created (seed)" });
  writeAccounts([demo]);
  localStorage.setItem(STORAGE_KEYS.SEEDED, "1");
})();

// ---------- Navigation ----------
function showPage(id) {
  const containers = document.querySelectorAll(".container");
  containers.forEach(c => (c.style.display = "none"));
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
  if (id === "menuPage") return;

  // Clear all <pre> results on page switch (optional)
  document.querySelectorAll("pre").forEach(p => (p.textContent = ""));
}

// Expose to window for inline HTML onclick
window.showPage = showPage;

// ---------- Input Type Enhancements ----------
(function enhanceInputs() {
  const byId = id => document.getElementById(id);
  // Set numberish and password types to improve UX; keep pattern validation in JS
  const setType = (id, type) => { const el = byId(id); if (el) el.setAttribute("type", type); };

  setType("cDob", "date");
  setType("cEmail", "email");
  setType("cMobile", "tel");
  setType("cAdhar", "text");

  setType("uMobile", "tel");

  setType("bPin", "password");
  setType("wPin", "password");

  setType("depAmount", "number");
  setType("wAmount", "number");
})();

// ---------- Validation Helpers ----------
function requireFields(obj, fields) {
  const missing = fields.filter(f => !obj[f] || String(obj[f]).trim() === "");
  return { ok: missing.length === 0, missing };
}

function ensureNumber(val, name, min = 0.01) {
  const num = Number(val);
  if (Number.isNaN(num)) return { ok: false, message: `${name} must be a number.` };
  if (num < min) return { ok: false, message: `${name} must be at least ${min}.` };
  return { ok: true, value: num };
}

function sanitize(str) {
  return String(str || "").trim();
}

// ---------- UI Actions ----------

// CREATE
window.createAccount = function createAccount() {
  const fullName = sanitize(document.getElementById("cFullName").value);
  const email = sanitize(document.getElementById("cEmail").value);
  const dob = sanitize(document.getElementById("cDob").value);
  const mobile = sanitize(document.getElementById("cMobile").value);
  const address = sanitize(document.getElementById("cAddress").value);
  const aadhar = sanitize(document.getElementById("cAdhar").value);
  const bank = sanitize(document.getElementById("cBank").value);

  const resEl = document.getElementById("createResult");

  const { ok, missing } = requireFields(
    { fullName, email, dob, mobile, address, aadhar, bank },
    ["fullName", "email", "dob", "mobile", "address", "aadhar", "bank"]
  );
  if (!ok) {
    resEl.textContent = `Missing fields: ${missing.join(", ")}`;
    return;
  }

  // Very light validations
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    resEl.textContent = "Invalid email address.";
    return;
  }
  if (!/^\d{10}$/.test(mobile)) {
    resEl.textContent = "Mobile must be a 10-digit number.";
    return;
  }
  if (!/^\d{4} \d{4} \d{4}$/.test(aadhar) && !/^\d{12}$/.test(aadhar)) {
    resEl.textContent = "Aadhar must be 12 digits (e.g., 1234 5678 9012).";
    return;
  }

  const accountNumber = nextAccountNumber();
  const pin = String(Math.floor(1000 + Math.random() * 9000)); // simple random 4-digit
  const account = {
    accountNumber,
    fullName,
    email,
    dob,
    mobile,
    address,
    aadhar,
    bank,
    type: "Savings",
    pin,
    balance: 0,
    history: [],
  };
  addHistory(account, { type: "CREATE", amount: 0, note: "Account created" });

  const all = readAccounts();
  all.push(account);
  writeAccounts(all);

  resEl.textContent = [
    "✅ Account created successfully.",
    `Account Number: ${accountNumber}`,
    `Temporary PIN: ${pin}  (demo only)`,
    `Name: ${fullName}`,
    `Bank: ${bank}`,
    `Type: ${account.type}`,
  ].join("\n");
};

// UPDATE
window.updateAccount = function updateAccount() {
  const accountNumber = sanitize(document.getElementById("uAccount").value);
  const fullName = sanitize(document.getElementById("uFullName").value);
  const address = sanitize(document.getElementById("uAddress").value);
  const mobile = sanitize(document.getElementById("uMobile").value);
  const resEl = document.getElementById("updateResult");

  if (!accountNumber) {
    resEl.textContent = "Please enter Account Number.";
    return;
  }
  const acc = findAccount(accountNumber);
  if (!acc) {
    resEl.textContent = "Account not found.";
    return;
  }

  if (mobile && !/^\d{10}$/.test(mobile)) {
    resEl.textContent = "Mobile must be a 10-digit number.";
    return;
  }

  if (fullName) acc.fullName = fullName;
  if (address) acc.address = address;
  if (mobile) acc.mobile = mobile;

  addHistory(acc, { type: "UPDATE", amount: 0, note: "Profile updated" });
  updateAccountInStore(acc);

  resEl.innerHTML = `✅ Updated successfully <span class="badge ok">OK</span>\n` +
    JSON.stringify({
      accountNumber: acc.accountNumber,
      fullName: acc.fullName,
      mobile: acc.mobile,
      address: acc.address
    }, null, 2);
};

// DELETE
window.deleteAccount = function deleteAccount() {
  const accountNumber = sanitize(document.getElementById("dAccount").value);
  const resEl = document.getElementById("deleteResult");

  if (!accountNumber) {
    resEl.textContent = "Please enter Account Number.";
    return;
  }
  const acc = findAccount(accountNumber);
  if (!acc) {
    resEl.textContent = "Account not found.";
    return;
  }
  if (acc.balance !== 0) {
    resEl.textContent = `Cannot delete: balance is ₹${fmtINR(acc.balance)}. Please withdraw or transfer first.`;
    return;
  }

  // Add a DELETE entry for audit (demo only; will be lost after deletion)
  addHistory(acc, { type: "DELETE", amount: 0, note: "Account deleted" });

  const ok = deleteAccountFromStore(accountNumber);
  resEl.textContent = ok ? "✅ Account deleted." : "Delete failed.";
};

// CHECK BALANCE
window.checkBalance = function checkBalance() {
  const accountNumber = sanitize(document.getElementById("bAccount").value);
  const pin = sanitize(document.getElementById("bPin").value);
  const bank = sanitize(document.getElementById("bBank").value);
  const type = sanitize(document.getElementById("bType").value);
  const resEl = document.getElementById("balanceResult");

  const { ok, missing } = requireFields({ accountNumber, pin }, ["accountNumber", "pin"]);
  if (!ok) {
    resEl.textContent = `Missing fields: ${missing.join(", ")}`;
    return;
  }

  const acc = findAccount(accountNumber);
  if (!acc) {
    resEl.textContent = "Account not found.";
    return;
  }
  if (pin !== acc.pin) {
    resEl.textContent = "Invalid PIN.";
    return;
  }
  // Optional match on bank/type if provided
  if (bank && bank.toLowerCase() !== acc.bank.toLowerCase()) {
    resEl.textContent = "Bank does not match this account.";
    return;
  }
  if (type && acc.type && type.toLowerCase() !== acc.type.toLowerCase()) {
    resEl.textContent = "Account type does not match.";
    return;
  }

  addHistory(acc, { type: "BALANCE", amount: 0, note: "Balance inquiry" });
  updateAccountInStore(acc);

  resEl.textContent = [
    "✅ Balance fetched.",
    `Account: ${acc.accountNumber}`,
    `Name: ${acc.fullName}`,
    `Bank: ${acc.bank}`,
    `Type: ${acc.type}`,
    `Balance: ₹${fmtINR(acc.balance)}`
  ].join("\n");
};

// DEPOSIT
window.deposit = function deposit() {
  const accountNumber = sanitize(document.getElementById("depAccount").value);
  const amountStr = sanitize(document.getElementById("depAmount").value);
  const resEl = document.getElementById("depositResult");

  if (!accountNumber) {
    resEl.textContent = "Please enter Account Number.";
    return;
  }
  const { ok, value, message } = ensureNumber(amountStr, "Amount", 0.01);
  if (!ok) {
    resEl.textContent = message;
    return;
  }

  const acc = findAccount(accountNumber);
  if (!acc) {
    resEl.textContent = "Account not found.";
    return;
  }

  acc.balance += value;
  addHistory(acc, { type: "DEPOSIT", amount: value, note: "Cash deposit" });
  updateAccountInStore(acc);

  resEl.textContent = `✅ Deposited ₹${fmtINR(value)}.\nNew Balance: ₹${fmtINR(acc.balance)}`;
};

// WITHDRAW
window.withdraw = function withdraw() {
  const accountNumber = sanitize(document.getElementById("wAccount").value);
  const pin = sanitize(document.getElementById("wPin").value);
  const amountStr = sanitize(document.getElementById("wAmount").value);
  const resEl = document.getElementById("withdrawResult");

  const { ok, missing } = requireFields({ accountNumber, pin, amountStr }, ["accountNumber", "pin", "amountStr"]);
  if (!ok) {
    resEl.textContent = `Missing fields: ${missing.join(", ")}`;
    return;
  }
  const amtCheck = ensureNumber(amountStr, "Amount", 0.01);
  if (!amtCheck.ok) {
    resEl.textContent = amtCheck.message;
    return;
  }
  const amount = amtCheck.value;

  const acc = findAccount(accountNumber);
  if (!acc) {
    resEl.textContent = "Account not found.";
    return;
  }
  if (pin !== acc.pin) {
    resEl.textContent = "Invalid PIN.";
    return;
  }
  if (acc.balance < amount) {
    resEl.textContent = `Insufficient funds. Available: ₹${fmtINR(acc.balance)}.`;
    return;
  }

  acc.balance -= amount;
  addHistory(acc, { type: "WITHDRAW", amount: amount, note: "ATM withdrawal" });
  updateAccountInStore(acc);

  resEl.textContent = `✅ Withdrawn ₹${fmtINR(amount)}.\nNew Balance: ₹${fmtINR(acc.balance)}`;
};

// HISTORY
window.history = function getHistory() {
  const accountNumber = sanitize(document.getElementById("hAccount").value);
  const resEl = document.getElementById("historyResult");

  if (!accountNumber) {
    resEl.textContent = "Please enter Account Number.";
    return;
  }
  const acc = findAccount(accountNumber);
  if (!acc) {
    resEl.textContent = "Account not found.";
    return;
  }

  const rows = acc.history
    .slice()
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .map(h => `${new Date(h.time).toLocaleString()}  |  ${h.type.padEnd(8)} |  ₹${fmtINR(h.amount || 0)}  |  ${h.note || ""}`);

  resEl.textContent = rows.length ? rows.join("\n") : "No transactions yet.";
};
