// bot.js
const { Telegraf } = require('telegraf');
const { TELEGRAM_TOKEN } = require('./config');
const setupCommands = require('./commands');

const bot = new Telegraf(TELEGRAM_TOKEN);

// Настройка команд
setupCommands(bot);

// Экспорт экземпляра бота для использования в других модулях
module.exports = bot;

// Запуск бота
bot.launch();

console.log('Бот успешно запущен.');

// Обработка graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
