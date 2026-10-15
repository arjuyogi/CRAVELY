
const DELIVERY_FEE = 80;
const PROMO_CODE = 'CRAVE10';
const POINTS_PER_RUPEE = 1;

function calculateTotals(items, promoCode = '', pointsToRedeem = 0) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const tax = Math.round(subtotal * 0.08);

  const promoDiscount =
    promoCode === PROMO_CODE
      ? Math.round(subtotal * 0.1)
      : 0;

  // Keep the existing delivery fee and tax rules.
  const deliveryFee = DELIVERY_FEE;

  const totalBeforePoints = Math.max(
    0,
    subtotal + deliveryFee + tax - promoDiscount,
  );

  // Never allow a points discount larger than the order total.
  const maxRedeemablePoints = Math.floor(
    totalBeforePoints * POINTS_PER_RUPEE,
  );

  const pointsRedeemed = Math.min(
    Math.max(0, Math.floor(Number(pointsToRedeem) || 0)),
    maxRedeemablePoints,
  );

  const loyaltyDiscount = Math.floor(
    pointsRedeemed / POINTS_PER_RUPEE,
  );

  return {
    subtotal,
    deliveryFee,
    tax,
    discount: promoDiscount + loyaltyDiscount,
    promoDiscount,
    loyaltyDiscount,
    pointsRedeemed,
    total: Math.max(0, totalBeforePoints - loyaltyDiscount),
  };
}

module.exports = {
  calculateTotals,
  PROMO_CODE,
  POINTS_PER_RUPEE,
};
