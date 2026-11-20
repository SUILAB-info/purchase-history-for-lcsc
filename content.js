// 購入履歴チェッカー for LCSC（非公式）
// 商品ページ (https://www.lcsc.com/product-detail/...C12345.html) を開いたとき、
// ログイン中アカウントの注文履歴からその部品の購入日・数量を探して表示する。
(() => {
  "use strict";

  const API = "https://wmsc.lcsc.com/wmsc";
  const BOX_ID = "lcsc-owned-box";
  const CACHE_KEY = "orderDetailCache"; // { [orderUuid]: { status, lines: {品番: {qty, price}} } }

  let currentCode = null;
  let runSeq = 0;

  // URL から LCSC 品番 (C + 数字) を取り出す
  function getProductCode() {
    const m = location.pathname.match(/\/product-detail\/(?:.*[_\/-])?(C\d+)\.html/i);
    return m ? m[1].toUpperCase() : null;
  }

  async function apiGet(path) {
    const res = await fetch(API + path, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== 200) {
      const err = new Error(json.msg || `code ${json.code}`);
      // 未ログイン時は {code: 302, result: ".../login/redirect/route?action=login"} が返る
      err.needLogin = json.code === 302 || json.code === 401 ||
        (typeof json.result === "string" && /login/i.test(json.result));
      throw err;
    }
    return json.result;
  }

  // 品番で注文を検索（部分一致なので、後で明細を見て完全一致を確認する）
  async function findOrders(code) {
    const orders = [];
    for (let page = 1; page <= 20; page++) {
      const q = new URLSearchParams({
        queryType: "all", createStartTime: "", createEndTime: "", productMpn: "",
        keyword: "", productKeyword: code, webOrderStatus: "",
        currentPage: String(page), pageSize: "100", sortType: "timeDesc",
      });
      const r = await apiGet(`/order/page?${q}`);
      orders.push(...(r.dataList || []));
      if (page >= (r.totalPage || 1)) break;
    }
    return orders;
  }

  async function loadCache() {
    try {
      return (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
    } catch {
      return {};
    }
  }

  async function saveCache(cache) {
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: cache });
    } catch { /* 保存できなくても表示はできる */ }
  }

  // 注文明細を取得（ステータスが変わっていなければキャッシュを使う）
  async function getOrderLines(order, cache) {
    const hit = cache[order.uuid];
    if (hit && hit.status === order.webOrderStatus) return hit.lines;
    const d = await apiGet(`/order/detail?orderUuId=${encodeURIComponent(order.uuid)}`);
    const lines = {};
    for (const p of d.orderProductVOList || []) {
      const c = (p.productCode || "").toUpperCase();
      if (!c) continue;
      const prev = lines[c];
      lines[c] = {
        qty: (prev ? prev.qty : 0) + (Number(p.purchaseQuantity) || 0),
        price: p.realPrice ?? p.unitPrice ?? null,
      };
    }
    cache[order.uuid] = { status: order.webOrderStatus, lines };
    return lines;
  }

  // 合計に含めない注文の理由を返す（含める注文は null）
  //   cancelled: キャンセル・期限切れなど
  //   unpaid:    未払いで、まだ発送もされていない
  function excludeReason(o) {
    const st = `${o.webOrderStatus || ""} ${o.orderStatus || ""}`;
    if (/cancel|expire|close|invalid/i.test(st)) return "cancelled";
    const paid = String(o.paymentStatus || "").toLowerCase() === "paid";
    // 掛け払いなどで未払いのまま発送・完了している注文は購入済みとして数える
    const shipped = /deliver|complete|ship|receipt/i.test(st);
    if (!paid && !shipped) return "unpaid";
    return null;
  }

  async function fetchHistory(code) {
    const orders = await findOrders(code);
    const cache = await loadCache();
    const rows = [];
    for (const o of orders) {
      const lines = await getOrderLines(o, cache);
      const line = lines[code];
      if (!line) continue;
      rows.push({
        date: (o.createTime || "").slice(0, 10),
        qty: line.qty,
        price: line.price,
        currency: o.currencySymbol || "$",
        orderCode: o.orderCode,
        uuid: o.uuid,
        status: o.webOrderStatus || o.orderStatus || "",
        excluded: excludeReason(o),
      });
    }
    await saveCache(cache);
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    return rows;
  }

  // ---- 表示 ----

  // 表示文言はブラウザの言語に合わせて _locales/<言語>/messages.json から取る
  function t(key, ...subs) {
    return chrome.i18n.getMessage(key, subs.map(String)) || key;
  }

  function fmt(n) {
    return Number(n).toLocaleString(chrome.i18n.getUILanguage());
  }

  // LCSC の注文状態 → 文言キー（未登録の状態は LCSC の表記をそのまま出す）
  const STATUS_KEY = {
    Delivered: "statusDelivered", Complete: "statusComplete", Shipped: "statusShipped",
    Processing: "statusProcessing", "Pending Payment": "statusPendingPayment",
    Cancelled: "statusCancelled", Expired: "statusExpired",
  };

  function statusLabel(r) {
    if (r.excluded === "unpaid") return t("statusUnpaid");
    return STATUS_KEY[r.status] ? t(STATUS_KEY[r.status]) : r.status;
  }

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else e.setAttribute(k, v);
    }
    for (const c of children) e.append(c);
    return e;
  }

  // 右カラム（在庫・価格欄）の先頭に置く。見つからなければタイトルの下、最後は画面右上に固定
  function placeBox(box) {
    const old = document.getElementById(BOX_ID);
    if (old) old.remove();

    const section = [...document.querySelectorAll("section")].find((s) =>
      /Add to Cart/i.test(s.textContent)
    );
    const h1 = document.querySelector("h1");
    if (section && h1) {
      // section と h1 の共通祖先の直下にある、section 側の子 = 右カラム
      let col = section;
      while (col.parentElement && !col.parentElement.contains(h1)) col = col.parentElement;
      if (col.parentElement) {
        col.prepend(box);
        return;
      }
    }
    if (h1 && h1.parentElement) {
      h1.parentElement.after(box);
      return;
    }
    box.classList.add("lcsc-owned-floating");
    document.body.append(box);
  }

  function render(code, state, data) {
    const box = el("div", { id: BOX_ID, class: "lcsc-owned" });
    box.dataset.code = code;

    if (state === "loading") {
      box.classList.add("is-loading");
      box.append(el("div", { class: "lcsc-owned-title" }, t("loading", code)));
    } else if (state === "error") {
      box.classList.add("is-error");
      const msg = data.needLogin ? t("needLogin") : t("fetchError", data.message);
      box.append(el("div", { class: "lcsc-owned-title" }, msg));
    } else {
      const valid = data.filter((r) => !r.excluded);
      const total = valid.reduce((s, r) => s + r.qty, 0);
      if (valid.length === 0) {
        box.classList.add("is-none");
        const title = data.length === 0 ? t("noHistory") : t("onlyExcluded");
        box.append(el("div", { class: "lcsc-owned-title" }, title));
      } else {
        box.classList.add("is-owned");
        const title = valid.length === 1
          ? t("ownedOnce", fmt(total))
          : t("owned", fmt(total), valid.length);
        box.append(el("div", { class: "lcsc-owned-title" }, title));
      }
      if (data.length > 0) {
        const tbody = el("tbody");
        for (const r of data) {
          const link = el("a", {
            href: `/personalCenter/order/detail?id=${encodeURIComponent(r.uuid)}`,
            target: "_blank", rel: "noopener",
          }, r.orderCode);
          const price = r.price != null ? `${r.currency}${r.price}` : "-";
          tbody.append(
            el("tr", { class: r.excluded ? `is-${r.excluded}` : "" },
              el("td", {}, r.date),
              el("td", { class: "num" }, t("qty", fmt(r.qty))),
              el("td", { class: "num" }, price),
              el("td", {}, link),
              el("td", {}, statusLabel(r)))
          );
        }
        box.append(
          el("table", { class: "lcsc-owned-table" },
            el("thead", {}, el("tr", {},
              el("th", {}, t("colDate")), el("th", {}, t("colQty")), el("th", {}, t("colPrice")),
              el("th", {}, t("colOrder")), el("th", {}, t("colStatus")))),
            tbody)
        );
        if (data.length > valid.length) {
          box.append(el("div", { class: "lcsc-owned-note" }, t("note")));
        }
      }
    }
    placeBox(box);
  }

  async function run() {
    const code = getProductCode();
    if (!code) {
      currentCode = null;
      document.getElementById(BOX_ID)?.remove();
      return;
    }
    if (code === currentCode) {
      // ページの再描画で消された場合や、仮置き（右上固定）のままの場合は置き直す
      const box = document.getElementById(BOX_ID);
      if ((!box || box.classList.contains("lcsc-owned-floating")) && lastRender) {
        render(...lastRender);
      }
      return;
    }
    currentCode = code;
    const seq = ++runSeq;
    lastRender = [code, "loading"];
    render(code, "loading");
    try {
      const rows = await fetchHistory(code);
      if (seq !== runSeq) return;
      lastRender = [code, "done", rows];
    } catch (e) {
      if (seq !== runSeq) return;
      lastRender = [code, "error", { message: String(e.message || e), needLogin: !!e.needLogin }];
    }
    render(...lastRender);
  }

  let lastRender = null;

  // Next.js のページ内遷移や再描画に追従するため、定期的に URL と表示の有無を確認する
  run();
  setInterval(run, 1000);
})();
