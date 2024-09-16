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
console.log('Добавляем обработчики SIGINT и SIGTERM');
process.once('SIGINT', () => {
  console.log('SIGINT обработан');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('SIGTERM обработан');
  bot.stop('SIGTERM');
});
