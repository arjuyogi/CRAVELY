
/* Cravely: Order confirmation and delivery tracking */

"use strict";

// ===================== 1. GET HTML ELEMENTS =====================

const panel = document.querySelector("#success-panel");
const errorMessage = document.querySelector("#success-error");
const successMessage = document.querySelector("#success-message");
const itemsList = document.querySelector("#success-items");
const timeline = document.querySelector("#delivery-timeline");
const orderDetails = document.querySelector("#success-order-details");

// Read the order ID from the URL.
// Example: /success.html?order=12
const params = new URLSearchParams(window.location.search);
const orderId =
  params.get("order") ||
  params.get("orderId") ||
  params.get("id");

// ===================== 2. DELIVERY STAGES =====================

const deliverySteps = [
  "placed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered"
];

const stageMessages = {
  placed: "Your order has been received.",
  preparing: "The restaurant is preparing your food.",
  ready: "Your food is ready for pickup.",
  out_for_delivery: "Your courier is on the way!",
  delivered: "Your order has been delivered. Enjoy your meal!"
};

// Keep track of requests and automatic refreshing.
let refreshTimer = null;
let orderLoaded = false;
let requestInProgress = false;

// ===================== 3. HELPER FUNCTIONS =====================

// Stop automatic refreshing.
function stopPolling() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// Display text safely using textContent.
// This helps prevent HTML injection from API data.
function addLine(parent, text, isStrong = false) {
  if (!parent) return;

  const element = document.createElement(isStrong ? "strong" : "p");

  element.className = "summary-line";
  element.textContent = String(text ?? "");

  parent.appendChild(element);
}

// Format a date received from the server.
function formatDate(value) {
  if (!value) return "";

  // SQLite CURRENT_TIMESTAMP commonly returns UTC without a Z.
  // Add Z so JavaScript interprets that format as UTC.
  let dateValue = value;

  if (
    typeof dateValue === "string" &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(dateValue)
  ) {
    dateValue = dateValue.replace(" ", "T") + "Z";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// Convert status values into the format used by the timeline.
function normalizeStatus(status) {
  const value = String(status || "placed")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases = {
    pending: "placed",
    confirmed: "placed",
    processing: "preparing",
    accepted: "preparing",
    ready_for_pickup: "ready",
    picked_up: "out_for_delivery",
    delivering: "out_for_delivery",
    complete: "delivered",
    completed: "delivered"
  };

  const normalized = aliases[value] || value;

  return deliverySteps.includes(normalized)
    ? normalized
    : "placed";
}

// Show an error without exposing server internals.
function showError(message, stopRefresh = false) {
  if (!orderLoaded && panel) {
    panel.hidden = true;
  }

  if (errorMessage) {
    errorMessage.textContent = message;
  }

  if (stopRefresh) {
    stopPolling();
  }
}

// Read JSON from an API response.
async function fetchJson(url) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json"
    }
  });

  if (response.status === 401) {
    stopPolling();
    window.location.assign("/login.html");
    throw new Error("Authentication required");
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      result.error || "Unable to load order information."
    );

    error.status = response.status;
    throw error;
  }

  return result;
}

// ===================== 4. ORDER SUMMARY =====================

function renderOrder(order, items) {
  if (orderDetails) {
    orderDetails.replaceChildren();

    addLine(orderDetails, "Order #" + order.id, true);

    const createdAt =
      order.createdAt ||
      order.created_at ||
      order.orderedAt;

    if (createdAt) {
      addLine(orderDetails, "Ordered: " + formatDate(createdAt));
    }
  }

  if (!itemsList) return;

  itemsList.replaceChildren();

  if (items.length === 0) {
    addLine(itemsList, "No item details are available.");
  } else {
    items.forEach((item) => {
      const name = String(item.name || item.item_name || "Item");
      const quantity = Number(item.quantity ?? 1);

      addLine(
        itemsList,
        `${name} × ${Number.isFinite(quantity) ? quantity : 1}`
      );
    });
  }

  const total = Number(
    order.total ??
    order.totalAmount ??
    order.total_amount ??
    0
  );

  addLine(
    itemsList,
    "Total · रु " +
      (Number.isFinite(total) ? total : 0).toLocaleString(),
    true
  );

  // Show loyalty points redeemed, if supplied by the API.
  const pointsRedeemed = Number(
    order.pointsRedeemed ??
    order.points_redeemed ??
    0
  );

  if (Number.isFinite(pointsRedeemed) && pointsRedeemed > 0) {
    addLine(itemsList, `Loyalty points used: ${pointsRedeemed}`);
  }
}

// ===================== 5. DELIVERY TIMELINE =====================

// Display the current stage and the recorded timestamp for each stage.
function updateDeliveryTimeline(status, history = []) {
  if (!timeline) return;

  const currentIndex = deliverySteps.indexOf(status);
  const steps = timeline.querySelectorAll(".delivery-step");

  // Make a map of delivery stage -> timestamp.
  const historyByStatus = new Map();

  history.forEach((entry) => {
    const stage = normalizeStatus(entry.status);

    const timestamp =
      entry.changedAt ||
      entry.changed_at ||
      entry.timestamp;

    if (timestamp) {
      historyByStatus.set(stage, timestamp);
    }
  });

  steps.forEach((step, index) => {
    const stage = deliverySteps[index];
    const icon = step.querySelector(".delivery-step-icon");
    const heading = step.querySelector("h2");
    const description = step.querySelector("p");

    step.classList.remove("is-complete", "is-current");
    step.removeAttribute("aria-current");

    if (index < currentIndex) {
      step.classList.add("is-complete");

      if (icon) icon.textContent = "✓";

      step.setAttribute(
        "aria-label",
        "Completed: " + (heading?.textContent || "")
      );
    } else if (index === currentIndex) {
      step.classList.add("is-current");

      if (icon) icon.textContent = "●";

      step.setAttribute("aria-current", "step");
      step.removeAttribute("aria-label");
    } else {
      if (icon) icon.textContent = String(index + 1);

      step.removeAttribute("aria-label");
    }

    // Add a timestamp line to each step if one doesn't exist.
    const stepContent = step.querySelector("div");

    if (!stepContent) return;

    let timeElement = stepContent.querySelector(".delivery-step-time");

    if (!timeElement) {
      timeElement = document.createElement("p");
      timeElement.className = "delivery-step-time";
      timeElement.setAttribute("aria-live", "polite");
      stepContent.appendChild(timeElement);
    }

    const timestamp = historyByStatus.get(stage);

    if (timestamp) {
      timeElement.textContent = "Updated: " + formatDate(timestamp);
      timeElement.hidden = false;
    } else {
      timeElement.textContent = "";
      timeElement.hidden = true;
    }

    // Keep the original descriptions but update them when appropriate.
    if (description && stageMessages[stage]) {
      description.textContent = stageMessages[stage];
    }
  });

  if (successMessage) {
    successMessage.textContent =
      stageMessages[status] || stageMessages.placed;
  }
}

// ===================== 6. LOAD ORDER DETAILS =====================

async function loadOrder() {
  // Allow numeric and common alphanumeric order IDs.
  if (!/^[a-zA-Z0-9_-]+$/.test(orderId || "")) {
    showError(
      "Invalid or missing order ID. Please open your order from order history.",
      true
    );
    return;
  }

  if (requestInProgress) return;

  requestInProgress = true;

  try {
    // This endpoint returns the customer's order and its items.
    let details;

    try {
      details = await fetchJson(
        "/api/orders/" + encodeURIComponent(orderId)
      );
    } catch (error) {
      if (error.status === 403 || error.status === 404) {
        showError(
          "We could not find that order for your account. Please check your order history.",
          true
        );
        return;
      }

      throw error;
    }

    const order = details.order;

    if (!order || String(order.id) !== String(orderId)) {
      showError(
        "The server did not return the requested order. Please check your order history.",
        true
      );
      return;
    }

    // Render order information once.
    if (!orderLoaded) {
      const items = Array.isArray(details.items)
        ? details.items
        : Array.isArray(order.items)
          ? order.items
          : [];

      renderOrder(order, items);

      orderLoaded = true;

      if (panel) panel.hidden = false;
      if (errorMessage) errorMessage.textContent = "";
    }

    // Prefer the dedicated tracking endpoint for status and history.
    try {
      const tracking = await fetchJson(
        "/api/orders/" +
          encodeURIComponent(orderId) +
          "/tracking"
      );

      const trackingOrder = tracking.order || {};

      const status = normalizeStatus(
        trackingOrder.deliveryStatus ||
        trackingOrder.delivery_status ||
        order.deliveryStatus ||
        order.delivery_status ||
        order.status
      );

      const history = Array.isArray(tracking.history)
        ? tracking.history
        : Array.isArray(details.deliveryHistory)
          ? details.deliveryHistory
          : Array.isArray(order.deliveryHistory)
            ? order.deliveryHistory
            : [];

      updateDeliveryTimeline(status, history);

      if (status === "delivered") {
        stopPolling();

        if (errorMessage) errorMessage.textContent = "";
      } else if (errorMessage) {
        errorMessage.textContent = "";
      }
    } catch (trackingError) {
      // If tracking is unavailable, keep the order summary visible.
      console.error("Cravely tracking refresh error:", trackingError);

      const fallbackStatus = normalizeStatus(
        order.deliveryStatus ||
        order.delivery_status ||
        order.status
      );

      const fallbackHistory = Array.isArray(details.deliveryHistory)
        ? details.deliveryHistory
        : Array.isArray(order.deliveryHistory)
          ? order.deliveryHistory
          : [];

      updateDeliveryTimeline(fallbackStatus, fallbackHistory);

      if (fallbackStatus === "delivered") {
        stopPolling();
      } else if (errorMessage) {
        errorMessage.textContent =
          "Delivery tracking could not refresh. We'll try again shortly.";
      }
    }
  } catch (error) {
    console.error("Cravely order loading error:", error);

    if (!orderLoaded) {
      showError(
        "We could not load your order. Please check your connection and try again."
      );
    } else if (errorMessage) {
      errorMessage.textContent =
        "Could not refresh order information. Retrying shortly.";
    }
  } finally {
    requestInProgress = false;
  }
}

// ===================== 7. START TRACKING =====================

// Stop the timer if the customer leaves this page.
window.addEventListener("pagehide", stopPolling);

// Only start requests if the URL contains a valid order ID.
if (/^[a-zA-Z0-9_-]+$/.test(orderId || "")) {
  loadOrder();

  // Refresh delivery status every 8 seconds.
  refreshTimer = setInterval(loadOrder, 8000);
} else {
  showError(
    "Invalid or missing order ID. Please open your order from order history.",
    true
  );
}

/* ===================== LOYALTY BALANCE ===================== */

async function loadLoyaltyBalance() {
  const balanceElement = document.querySelector("#loyalty-balance");
  const messageElement = document.querySelector("#loyalty-message");

  if (!balanceElement) return;

  try {
    const result = await fetchJson("/api/orders/loyalty");

    const balance = Number(result.balance ?? 0);

    balanceElement.textContent =
      Number.isFinite(balance) && balance >= 0
        ? `${balance} points`
        : "Unavailable";

    if (messageElement) {
      messageElement.textContent =
        "Redeem your points at checkout. 1 point = रु 1.";
    }
  } catch (error) {
    console.error("Could not load loyalty balance:", error);

    balanceElement.textContent = "Unavailable";

    if (messageElement) {
      messageElement.textContent =
        "Your points balance could not be loaded. Please refresh the page.";
    }
  }
}

/* ===================== LOYALTY REWARDS ===================== */

async function loadLoyaltyBalance() {
  const balanceElement = document.querySelector("#loyalty-balance");
  const messageElement = document.querySelector("#loyalty-message");
  const summaryElement = document.querySelector("#loyalty-summary");

  if (!balanceElement) {
    console.warn("Loyalty balance HTML element was not found.");
    return;
  }

  balanceElement.textContent = "Loading...";

  try {
    const result = await fetchJson("/api/orders/loyalty");

    const balance = Number(result.balance);

    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error("The server returned an invalid loyalty balance.");
    }

    // Display available points.
    balanceElement.textContent = `${balance} points`;

    // Explain the reward rules.
    if (messageElement) {
      messageElement.textContent =
        `Your points are worth रु ${Number(result.rules?.valuePerPoint ?? 1)} each. ` +
        "You earn points when your order is delivered.";
    }

    // Show recent loyalty transactions, if the HTML has a transaction container.
    let transactionsElement = document.querySelector("#loyalty-transactions");

    if (summaryElement && !transactionsElement) {
      transactionsElement = document.createElement("div");
      transactionsElement.id = "loyalty-transactions";
      transactionsElement.className = "loyalty-transactions";
      summaryElement.appendChild(transactionsElement);
    }

    if (transactionsElement) {
      transactionsElement.replaceChildren();

      const heading = document.createElement("h3");
      heading.textContent = "Recent rewards";
      transactionsElement.appendChild(heading);

      const transactions = Array.isArray(result.transactions)
        ? result.transactions
        : [];

      if (transactions.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = "No reward transactions yet.";
        transactionsElement.appendChild(emptyMessage);
      } else {
        transactions.forEach((transaction) => {
          const row = document.createElement("p");
          const points = Number(transaction.points) || 0;
          const sign = transaction.type === "redeem" ? "−" : "+";

          row.textContent =
            `Order #${transaction.orderId ?? "—"}: ` +
            `${sign}${points} points — ` +
            `${transaction.type === "redeem" ? "Redeemed" : "Earned"}`;

          transactionsElement.appendChild(row);
        });
      }
    }
  } catch (error) {
    console.error("Could not load Cravely loyalty rewards:", error);

    balanceElement.textContent = "Unavailable";

    if (messageElement) {
      messageElement.textContent =
        "Rewards could not be loaded. Please refresh the page.";
    }
  }
}

// Load rewards independently of delivery tracking.
loadLoyaltyBalance();
