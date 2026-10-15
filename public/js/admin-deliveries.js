// Cravely Admin Delivery Management
// File: public/js/admin-deliveries.js

const ordersContainer = document.querySelector("#deliveryOrders");
const message = document.querySelector("#dashboardMessage");
const statusFilter = document.querySelector("#statusFilter");
const refreshButton = document.querySelector("#refreshOrders");

const stages = [
  { value: "placed", label: "Order placed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready for pickup" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" }
];

let orders = [];

function escapeHTML(value) {
  const text = String(value == null ? "" : value);

  return text.replace(/[&<>"']/g, function (character) {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function formatMoney(value) {
  return "Rs. " + Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(String(value).replace(" ", "T") + "Z");

  if (Number.isNaN(date.getTime())) {
    return escapeHTML(value);
  }

  return date.toLocaleString();
}

function stageLabel(value) {
  const stage = stages.find(function (item) {
    return item.value === value;
  });

  return stage ? stage.label : (value || "Unknown");
}

async function loadOrders() {
  message.textContent = "Loading orders...";
  refreshButton.disabled = true;

  try {
    const response = await fetch("/api/orders/admin/deliveries", {
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (response.status === 401) {
      message.textContent = "Please sign in to access delivery management.";
      ordersContainer.replaceChildren();
      return;
    }

    if (response.status === 403) {
      message.textContent = "Administrator access is required.";
      ordersContainer.replaceChildren();
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Could not load orders.");
    }

    orders = Array.isArray(data.orders) ? data.orders : [];

    renderOrders();

    message.textContent = orders.length + " recent order(s) loaded.";
  } catch (error) {
    message.textContent = error.message || "Could not load orders.";
    ordersContainer.replaceChildren();
  } finally {
    refreshButton.disabled = false;
  }
}

function renderOrders() {
  const selectedStage = statusFilter.value;

  const filteredOrders = orders.filter(function (order) {
    return selectedStage === "all" ||
      order.deliveryStatus === selectedStage;
  });

  if (filteredOrders.length === 0) {
    ordersContainer.innerHTML =
      '<div class="empty-state">' +
        "<h2>No orders found</h2>" +
        "<p>Try another delivery-stage filter or refresh the list.</p>" +
      "</div>";

    return;
  }

  ordersContainer.innerHTML = filteredOrders.map(function (order) {
    const currentIndex = stages.findIndex(function (stage) {
      return stage.value === order.deliveryStatus;
    });

    const safeIndex = Math.max(currentIndex, 0);
    const availableStages = stages.slice(safeIndex);

    const stageOptions = availableStages.map(function (stage) {
      const selected =
        stage.value === order.deliveryStatus ? " selected" : "";

      return '<option value="' + stage.value + '"' + selected + ">" +
        stage.label +
        "</option>";
    }).join("");

    return (
      '<article class="order-card delivery-card">' +

        '<div class="delivery-card-details">' +
          "<h2>Order #" + Number(order.id) + "</h2>" +

          "<p><strong>Customer:</strong> " +
            escapeHTML(order.customerName) + "</p>" +

          "<p><strong>Email:</strong> " +
            escapeHTML(order.customerEmail) + "</p>" +

          "<p><strong>Items:</strong> " +
            escapeHTML(order.itemsSummary || "No item details") + "</p>" +

          "<p><strong>Placed:</strong> " +
            formatDate(order.createdAt) + "</p>" +

          "<p><strong>Payment status:</strong> " +
            escapeHTML(order.status) + "</p>" +

          "<p><strong>Payment method:</strong> " +
            escapeHTML(order.paymentMethod) + "</p>" +

          "<p><strong>Delivery stage:</strong> " +
            escapeHTML(stageLabel(order.deliveryStatus)) + "</p>" +

          '<p class="order-total">Total: ' +
            formatMoney(order.total) + "</p>" +
        "</div>" +

        '<form class="delivery-update-form" data-order-id="' +
          Number(order.id) + '">' +

          '<label for="stage-' + Number(order.id) + '">' +
            "Update delivery stage" +
          "</label>" +

          '<select id="stage-' + Number(order.id) +
            '" name="delivery_status" class="select-input" required>' +
            stageOptions +
          "</select>" +

          '<button class="button button-primary" type="submit">' +
            "Save stage" +
          "</button>" +

          '<p class="form-message" role="status" aria-live="polite"></p>' +
        "</form>" +

      "</article>"
    );
  }).join("");
}

ordersContainer.addEventListener("submit", async function (event) {
  const form = event.target.closest(".delivery-update-form");

  if (!form) {
    return;
  }

  event.preventDefault();

  const orderId = form.dataset.orderId;
  const select = form.querySelector("select");
  const button = form.querySelector("button");
  const formMessage = form.querySelector(".form-message");

  button.disabled = true;
  formMessage.textContent = "Saving...";

  try {
    const response = await fetch(
      "/api/orders/" + encodeURIComponent(orderId) +
      "/delivery-status",
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json"
        },
        body: JSON.stringify({
          delivery_status: select.value
        })
      }
    );

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(
        data.error || "Could not update delivery stage."
      );
    }

    await loadOrders();
  } catch (error) {
    formMessage.textContent =
      error.message || "Delivery-stage update failed.";
  } finally {
    button.disabled = false;
  }
});

statusFilter.addEventListener("change", renderOrders);
refreshButton.addEventListener("click", loadOrders);

loadOrders();