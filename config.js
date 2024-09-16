// config.js

require('dotenv').config();  // Загружаем переменные окружения из .env

// const config = {
//     botToken: process.env.BOT_TOKEN || 'your-fallback-bot-token',
//     notionToken: process.env.NOTION_TOKEN || 'your-fallback-notion-token',
//     databaseId: process.env.NOTION_DATABASE_ID || 'your-fallback-database-id',
//     timezone: process.env.TIMEZONE || 'Europe/Moscow',  // Добавляем временную зону
// };

// // Проверка на обязательные переменные окружения
// if (!config.botToken || !config.notionToken || !config.databaseId) {
//     throw new Error('Отсутствуют необходимые переменные окружения');
// }

// module.exports = config;



require('dotenv').config();

module.exports = {
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  TIMEZONE: 'Europe/Kyiv', // Укажите ваш часовой пояс
};
