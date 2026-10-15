// Cravely: Display orders belonging to the signed-in customer.
"use strict";

const orderList = document.querySelector("#order-list");
const noOrders = document.querySelector("#no-orders");
const errorMessage = document.querySelector("#orders-error");

function makeOrderCard(order) {
  const card = document.createElement("article");
  card.className = "order-card";

  const details = document.createElement("div");

  const heading = document.createElement("h2");
  heading.className = "food-name";
  heading.textContent = `Order #${order.id}`;

  const date = document.createElement("p");
  const rawDate = order.createdAt ?? order.created_at;

  if (rawDate) {
    // Add Z only when the SQLite timestamp has no timezone.
    const dateString = String(rawDate);
    const normalizedDate =
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(dateString)
        ? dateString.replace(" ", "T") + "Z"
        : dateString;

    const parsedDate = new Date(normalizedDate);

    date.textContent = Number.isNaN(parsedDate.getTime())
      ? "Date unavailable"
      : parsedDate.toLocaleString();
  } else {
    date.textContent = "Date unavailable";
  }

  const status = document.createElement("p");
  status.textContent = String(
    order.deliveryStatus ?? order.delivery_status ?? order.status ?? "Unknown"
  );

  const link = document.createElement("a");
  link.className = "order-link";
  link.href = `/success.html?order=${encodeURIComponent(order.id)}`;
  link.textContent = "View order";

  details.append(heading, date, status, link);

  const total = document.createElement("strong");
  total.className = "order-total";

  const amount = Number(order.total ?? order.total_amount ?? 0);
  total.textContent = `रु ${
    Number.isFinite(amount) ? amount.toLocaleString() : "0"
  }`;

  card.append(details, total);

  return card;
}

async function loadOrders() {
  if (!orderList || !noOrders || !errorMessage) {
    console.error("Cravely order history HTML elements are missing.");
    return;
  }

  errorMessage.textContent = "";

  try {
    const response = await fetch("/api/orders", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 401) {
      window.location.assign("/login.html");
      return;
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Could not load your orders.");
    }

    if (!Array.isArray(result.orders)) {
      throw new Error("The server returned an invalid orders response.");
    }

    orderList.replaceChildren(...result.orders.map(makeOrderCard));
    noOrders.hidden = result.orders.length > 0;
  } catch (error) {
    console.error("Cravely order history error:", error);
    errorMessage.textContent =
      "We could not load your orders. Please try again.";
  }
}

loadOrders();