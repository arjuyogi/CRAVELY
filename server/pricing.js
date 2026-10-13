// This file calculates cart totals using prices read from the database.
const DELIVERY_FEE = 80;
const PROMO_CODE = 'CRAVE10';

function calculateTotals(items, promoCode = '') {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.08);
  const discount = promoCode === PROMO_CODE ? Math.round(subtotal * 0.1) : 0;
  return {
    subtotal,
    deliveryFee: DELIVERY_FEE,
    tax,
    discount,
    total: subtotal + DELIVERY_FEE + tax - discount,
  };
}

module.exports = { calculateTotals, PROMO_CODE };
