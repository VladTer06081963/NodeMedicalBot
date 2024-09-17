const schedule = require('node-schedule');
const moment = require('moment-timezone');
const { TIMEZONE } = require('./config');
const { getMedicinesFromNotion, archiveOldMedicines } = require('./notion');
const bot = require('./bot');
// const { bot, telegram } = require('./bot')
const { Markup } = require('telegraf');

// Функция для планирования курса лечения с регулярными напоминаниями
function scheduleCourseReminders(userChatId, medicineName, dosage, timesPerDay, duration) {
  const now = new Date();

  // Проходим по каждому дню курса
  for (let day = 0; day < duration; day++) {
    // Для каждого дня планируем количество приемов
    for (let dose = 1; dose <= timesPerDay; dose++) {
      const doseTime = new Date(now);  // Копируем текущую дату
      doseTime.setDate(now.getDate() + day);  // Переходим на нужный день
      doseTime.setHours(8 + (dose - 1) * (24 / timesPerDay));  // Распределяем приемы на день

      // Логирование для отладки
      console.log(`Планирование напоминания для ${medicineName}, прием ${dose}, на ${doseTime}`);

      // Планируем напоминание для конкретного приема
      schedule.scheduleJob(doseTime, () => {
        console.log(bot);
        bot.telegram.sendMessage(
          userChatId,
          `Напоминание: Пора принять ${medicineName} (${dosage}) в ${moment(doseTime).format('HH:mm')}.`,
          {
            reply_markup: Markup.inlineKeyboard([
              Markup.button.callback('Принял', `accept_medicine_${medicineName}_${dose}`),
            ]),
          }
        );
      });
    }
  }
}

// Функция для планирования напоминаний для всех лекарств
async function scheduleReminders(userChatId) {
  console.log(`Планирование напоминаний для chatId: ${userChatId}`);
  try {
    const medicines = await getMedicinesFromNotion();  // Получаем лекарства из Notion
    if (!medicines.length) {
      console.log('Нет активных лекарств для планирования.');
      return;
    }

    medicines.forEach((medicine) => {
      // Используем обновленную структуру данных
      const chatId = medicine.chatId;
      if (!chatId) {
        console.log(`У лекарства ${medicine.medicineName} отсутствует chatId.`);
        return;
      }

      // Если у лекарства есть chatId, планируем напоминания
      if (medicine.timesPerDay && medicine.duration) {
        scheduleCourseReminders(
          chatId,              // Идентификатор чата пользователя
          medicine.medicineName,    // Название лекарства
          medicine.dosage,          // Дозировка
          medicine.timesPerDay,     // Количество приемов в день
          medicine.duration         // Длительность курса (в днях)
        );
      } else {
        console.log(`Недостаточно данных для планирования напоминаний для лекарства: ${medicine.medicineName}`);
      }
    });
  } catch (error) {
    console.error('Ошибка при планировании напоминаний:', error);
  }
}


// Функция для получения лекарств на сегодня
async function getMedicinesForToday() {
  const medicines = await getMedicinesFromNotion();  // Получаем все лекарства из Notion
  const todayMedicines = [];

  const today = moment().tz(TIMEZONE).startOf('day');  // Сегодняшний день
  const tomorrow = today.clone().add(1, 'days');  // Завтра для ограничения времени

  // Фильтруем лекарства, которые нужно принять сегодня
  medicines.forEach((medicine) => {
    // Проверяем, что у лекарства есть поле doseTimes и оно является массивом
    if (Array.isArray(medicine.doseTimes)) {
      const timesForToday = medicine.doseTimes.filter(doseTime => {
        const time = moment(doseTime).tz(TIMEZONE);
        return time.isSameOrAfter(today) && time.isBefore(tomorrow);  // Лекарства только на сегодня
      });

      if (timesForToday.length > 0) {
        todayMedicines.push({
          medicineName: medicine.medicineName,
          dosage: medicine.dosage,
          timesForToday: timesForToday.map(time => moment(time).format('HH:mm')),  // Форматируем время
        });
      }
    } else {
      console.log(`Поле doseTimes отсутствует или не является массивом для лекарства: ${medicine.medicineName}`);
    }
  });


  return todayMedicines;
}

// Планирование задачи для регулярного архивирования старых записей
schedule.scheduleJob('0 0 * * 0', function() {
  console.log('Архивирование старых записей...');
  archiveOldMedicines();  // Выполняем каждую неделю (воскресенье в полночь)
});

module.exports = { scheduleReminders, getMedicinesForToday };
