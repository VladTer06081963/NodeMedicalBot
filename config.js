// config.js
require('dotenv').config();

module.exports = {
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  TIMEZONE: 'Europe/London', // Укажите ваш часовой пояс
};
