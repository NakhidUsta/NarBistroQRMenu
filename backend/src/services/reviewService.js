const reviewRepository = require('../repositories/reviewRepository');
const orderRepository = require('../repositories/orderRepository');
const { poolPromise } = require('../config/db');
const AppError = require('../utils/AppError');

const DEFAULT_RESTAURANT_ID = 1;
const REVIEWABLE = ['READY', 'DELIVERED', 'COMPLETED'];

// Rəyi yalnız sifarişin sahibi (gizli access_token ilə) və sifariş hazır/təhvil verildikdən sonra yaza bilər.
async function createForOrder(orderId, token, { rating, comment }) {
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new AppError(400, 'Reytinq 1–5 arasında tam ədəd olmalıdır');
  const text = comment ? String(comment).trim().slice(0, 1000) : null;

  const pool = await poolPromise;
  const order = await orderRepository.findById(pool, orderId);
  if (!order || !token || order.access_token !== token) throw new AppError(404, 'Sifariş tapılmadı');
  if (!REVIEWABLE.includes(order.status)) throw new AppError(400, 'Rəy yalnız sifariş hazır olduqdan sonra yazıla bilər');
  if (await reviewRepository.findByOrder(orderId)) throw new AppError(409, 'Bu sifariş üçün artıq rəy yazılıb');

  return reviewRepository.create({
    restaurant_id: DEFAULT_RESTAURANT_ID,
    order_id: orderId,
    customer_name: order.customer_name,
    rating: stars,
    comment: text,
  });
}

async function publicReviews() {
  const [reviews, summary] = await Promise.all([reviewRepository.findPublic(), reviewRepository.summary()]);
  return { reviews, count: summary.count, average: Math.round(summary.average * 10) / 10 };
}

async function status(orderId, token) {
  const pool = await poolPromise;
  const order = await orderRepository.findById(pool, orderId);
  if (!order || !token || order.access_token !== token) throw new AppError(404, 'Sifariş tapılmadı');
  const review = await reviewRepository.findByOrder(orderId);
  return { can_review: REVIEWABLE.includes(order.status) && !review, reviewed: !!review };
}

async function listAll() {
  return reviewRepository.findAll();
}

async function setApproved(id, approved) {
  const review = await reviewRepository.setApproved(id, approved);
  if (!review) throw new AppError(404, 'Rəy tapılmadı');
  return review;
}

async function remove(id) {
  if (!(await reviewRepository.remove(id))) throw new AppError(404, 'Rəy tapılmadı');
}

module.exports = { createForOrder, publicReviews, status, listAll, setApproved, remove };
