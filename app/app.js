/* Small helper UI for Mule GET /api/checkBalance
 * Query params: accountNum, atmPin, bank, type
 */
(function () {
  const $ = (id) => document.getElementById(id);

  // Persist base URL in localStorage
  const KEY = "bank_api_base_url";
  const defaultBase = "http://localhost:8081";
  const baseUrlInput = $("baseUrl");
  baseUrlInput.value = localStorage.getItem(KEY) || defaultBase;
  $("saveBaseUrl").addEventListener("click", () => {
    localStorage.setItem(KEY, baseUrlInput.value.trim() || defaultBase);
    toast("Saved API base URL.", true);
  });

  // Inputs
  const accountNumEl = $("accountNum");
  const atmPinEl = $("atmPin");
  const bankEl = $("bank");
  const typeEl = $("type");

  // Outputs
  const statusEl = $("status");
  const rawEl = $("raw");

  // Buttons
  $("checkBtn").addEventListener("click", onCheck);
  $("resetBtn").addEventListener("click", reset);
  $("copyCurlBtn").addEventListener("click", copyCurl);

  function toast(msg, ok = false) {
    statusEl.classList.remove("ok", "err");
    statusEl.classList.add(ok ? "ok" : "err");
    statusEl.textContent = msg;
  }

  function reset() {
    accountNumEl.value = "";
    atmPinEl.value = "";
    bankEl.value = "";
    typeEl.value = "";
    statusEl.classList.remove("ok", "err");
    statusEl.textContent = "";
    rawEl.textContent = "";
  }

  function buildUrl() {
    const base = (baseUrlInput.value || defaultBase).replace(/\/+$/, "");
    const qp = new URLSearchParams({
      accountNum: accountNumEl.value.trim(),
      atmPin: atmPinEl.value.trim(),
      bank: bankEl.value.trim(),
      // include 'type' only if provided
      ...(typeEl.value.trim() ? { type: typeEl.value.trim() } : {}),
    });
    // APIkit listener mounted under /api/*
    return `${base}/api/checkBalance?${qp.toString()}`;
  }

  async function onCheck() {
    const accountNum = accountNumEl.value.trim();
    const atmPin = atmPinEl.value.trim();
    const bank = bankEl.value.trim();

    if (!accountNum || !atmPin || !bank) {
      toast("Please fill Account Number, ATM PIN, and Bank.", false);
      return;
    }

    const url = buildUrl();
    statusEl.classList.remove("ok", "err");
    statusEl.textContent = "⏳ Contacting server...";
    rawEl.textContent = "";

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      const text = await res.text();
      let data = null;

      // Attempt to parse JSON safely
      try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

      // Compute a friendly status message
      let message = "";
      if (typeof data === "string") {
        // JSON string payload like "Maximum Attempts reached..."
        message = data;
      } else if (data && typeof data === "object") {
        // Object payload, e.g., { status: "Your total balance is ..." }
        message = data.status || data.message || JSON.stringify(data);
      } else {
        // Non-JSON (unlikely, but handle)
        message = text || `HTTP ${res.status}`;
      }

      const ok = res.ok;
      statusEl.classList.remove("ok", "err");
      statusEl.classList.add(ok ? "ok" : "err");
      statusEl.textContent = message;

      // Show raw output for debugging
      rawEl.textContent = pretty(text);

    } catch (err) {
      statusEl.classList.remove("ok");
      statusEl.classList.add("err");
      statusEl.textContent = `Network error: ${err.message}`;
    }
  }

  function pretty(txt) {
    if (!txt) return "";
    try { return JSON.stringify(JSON.parse(txt), null, 2); }
    catch { return txt; }
  }

  function copyCurl() {
    const url = buildUrl();
    const cmd = `curl -sS -X GET "${url}" -H "Accept: application/json"`;
    navigator.clipboard?.writeText(cmd).then(() => {
      toast("cURL command copied to clipboard.", true);
    }).catch(() => {
      toast("Unable to copy cURL (clipboard blocked).", false);
    });
  }
})();
