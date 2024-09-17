const { Telegraf } = require('telegraf');
const { TELEGRAM_TOKEN } = require('./config');
const { scheduleReminders, getMedicinesForToday } = require('./scheduler');
const { getMedicinesFromNotion } = require('./notion');  // Импорт функции для получения данных
const bot = new Telegraf(TELEGRAM_TOKEN);

// Настройка команд бота (если есть)
require('./commands')(bot);

console.log('Команды успешно подключены');

// Функция для повторного планирования всех активных напоминаний
async function planAllReminders() {
  try {
    const medicines = await getMedicinesFromNotion();  // Чтение данных из Notion
    console.log(`Получено ${medicines.length} активных лекарств для планирования.`);

    medicines.forEach((medicine) => {
      const userChatId = medicine.chatId;  // Используем правильный chatId из базы данных
      if (userChatId) {
        scheduleReminders(userChatId);  // Планируем напоминания для конкретного пользователя
      } else {
        console.log(`У лекарства ${medicine.medicineName} отсутствует chatId.`);
      }
    });
  } catch (error) {
    console.error('Ошибка при планировании напоминаний после перезапуска сервера:', error);
  }
}

// Запуск бота и планирование напоминаний
async function startServer() {
  // Запуск Telegram-бота
  bot.launch();
  console.log('Бот успешно запущен.');

  // После запуска бота перепланируем все напоминания
  await planAllReminders();
  
  // Обработка graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// module.exports = bot;  // Экспортируем бот
module.exports = { bot, telegram: bot.telegram };
startServer();
