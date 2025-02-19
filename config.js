require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 8080,
  mongoUrl: process.env.MONGOURL || "",
  redisUrl: process.env.REDIS_URL || "",
  NODE_ENV: process.env.NODE_ENV || "development",
};
