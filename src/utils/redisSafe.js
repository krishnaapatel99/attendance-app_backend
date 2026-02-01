import redisClient from "../config/redis.js"; // adjust path if needed


export const checkRedisHealth = async () => {
  try {
    const res = await redisClient.ping();
    return res === "PONG";
  } catch (err) {
    return false;
  }
};


export const redisGetSafe = async (key) => {
  try {
    return await redisClient.get(key);
  } catch (err) {
    console.warn("⚠️ Redis GET failed:", key);
    return null;
  }
};

export const redisSetSafe = async (key, value, options = {}) => {
  try {
    await redisClient.set(key, value, options);
  } catch (err) {
    console.warn("⚠️ Redis SET failed:", key);
  }
};
export const redisDelSafe = async (key) => {
  try {
    await redisClient.del(key);
  } catch {}
};