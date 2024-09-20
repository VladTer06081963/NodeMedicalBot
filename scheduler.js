const schedule = require('node-schedule');
const moment = require('moment-timezone');
const { TIMEZONE } = require('./config');
const { getMedicinesFromNotion, archiveOldMedicines } = require('./notion');
const bot = require('./bot');
const { Markup } = require('telegraf');

// Функция для планирования курса лечения с регулярными напоминаниями
function scheduleCourseReminders(userChatId, medicineName, dosage, timesPerDay, duration) {
    // const now = new Date();
    let now = new Date();
// Проходим по каждому дню курса
  for (let day = 0; day < duration; day++) {
      // Для каждого дня планируем количество приемов
        for (let dose = 1; dose <= timesPerDay; dose++) {
          let doseTime;
          

            switch (dose) {
                case 1:
                    doseTime = '09:00'; // Завтрак
                    break;
                case 2:
                    doseTime = '13:00'; // Обед
                    break;
                case 3:
                    doseTime = '19:00'; // Ужин
                    break;
                default:
                    console.log(`Некорректное значение приема: ${dose}`);
                    continue;
            }

            console.log(`Планирование напоминания для ${medicineName}, прием ${dose}, время: ${doseTime}, userChatId: ${userChatId}`);

            if (typeof doseTime !== 'string') {
                console.error(`Ожидалась строка для времени приема, но получено: ${typeof doseTime}`);
                continue;
            }
            // Преобразуем строку в дату
            const [hour, minute] = doseTime.split(':');
            const reminderTime = new Date(now);
            reminderTime.setDate(now.getDate() + day);// Дата через day дней
            reminderTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
            // Проверка на прошедшее время, если напоминание на текущий день, то сдвигаем его на завтра
            if (reminderTime < now && day === 0) {
                console.log(`Время приема (${doseTime}) уже прошло, напоминание не будет запланировано для сегодняшнего дня.`);
                continue;
            }

            schedule.scheduleJob(reminderTime, () => {
    try {
        bot.telegram.sendMessage(
            userChatId,
            `Напоминание: Пора принять ${medicineName} (${dosage}) в ${doseTime}.`,
            {
                reply_markup: Markup.inlineKeyboard([
                    Markup.button.callback('Принял', `accept_medicine_${medicineName}_${dose}`)
                ]),
            }
        );
    } catch (error) {
        console.error(`Ошибка при отправке сообщения: ${error}`);
    }
});
        }
    }
}

// Функция для планирования напоминаний для всех лекарств
async function scheduleReminders(userChatId) {
    console.log(`Планирование напоминаний для chatId: ${userChatId}`);//было console.log
    try {
        const medicines = await getMedicinesFromNotion();

        if (!medicines.length) {
            console.log('Нет активных лекарств для планирования.');
            return;
        }

        medicines.forEach((medicine) => {
            const chatId = medicine.chatId;

            if (!chatId) {
                console.log(`У лекарства ${medicine.medicineName} отсутствует chatId.`);
                return;
            }

            if (medicine.timesPerDay && medicine.duration) {
                scheduleCourseReminders(
                    chatId,
                    medicine.medicineName,
                    medicine.dosage,
                    medicine.timesPerDay,
                    medicine.duration
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
async function getMedicinesForToday(userChatId) {
  if (!userChatId) {
    console.error('userChatId is required');
    return [];
  }
    const medicines = await getMedicinesFromNotion();
    const todayMedicines = [];
    const today = moment().tz(TIMEZONE).startOf('day');
    const tomorrow = today.clone().add(1, 'days').startOf('day');

    console.log(`Проверяем лекарства на сегодня: ${today.format('YYYY-MM-DD')}`);

    medicines.forEach((medicine) => {
        if (!medicine.doseTimes || !Array.isArray(medicine.doseTimes)) {
            console.error(`У лекарства ${medicine.medicineName} отсутствует поле doseTimes или оно не является массивом.`);
            return;
        }

        const timesForToday = medicine.doseTimes.filter(doseTime => {
            const time = moment(doseTime).tz(TIMEZONE);
            console.log(`Проверяем время: ${time.format('YYYY-MM-DD HH:mm')}`);
            return time.isSameOrAfter(today) && time.isBefore(tomorrow);
        });

        if (timesForToday.length > 0) {
            todayMedicines.push({
                medicineName: medicine.medicineName,
                dosage: medicine.dosage,
                timesForToday: timesForToday.map(time => moment(time).format('HH:mm')),
            });
        }
    });

    console.log(`Найдено лекарств на сегодня: ${todayMedicines.length}`);
    return todayMedicines;
}

// Планирование задачи для регулярного архивирования старых записей
schedule.scheduleJob('0 0 * * 0', archiveOldMedicinesJob); 
  function archiveOldMedicinesJob() {
     
   console.log('Архивирование старых записей...');
};

module.exports = { scheduleReminders, getMedicinesForToday };


// const schedule = require('node-schedule');
// const moment = require('moment-timezone');
// const { TIMEZONE } = require('./config');
// const { getMedicinesFromNotion, archiveOldMedicines } = require('./notion');
// const bot = require('./bot');
// const { Markup } = require('telegraf');

// // Функция для планирования курса лечения с регулярными напоминаниями
// function scheduleCourseReminders(userChatId, medicineName, dosage, timesPerDay, duration) {
//   const now = new Date();

//   // Проходим по каждому дню курса
//   for (let day = 0; day < duration; day++) {
//     // Для каждого дня планируем количество приемов
//     for (let dose = 1; dose <= timesPerDay; dose++) {
//       let doseTime;

//       // Используем фиксированные времена для приема (Завтрак, Обед, Ужин)
//       switch (dose) {
//         case 1:
//           doseTime = '09:00';  // Завтрак
//           break;
//         case 2:
//           doseTime = '13:00';  // Обед
//           break;
//         case 3:
//           doseTime = '19:00';  // Ужин
//           break;
//         default:
//           console.log(`Некорректное значение приема: ${dose}`);
//           continue;
//       }

//       console.log(`Планирование напоминания для ${medicineName}, прием ${dose}, время: ${doseTime}, userChatId: ${userChatId},
//         `);

//       if (typeof doseTime !== 'string') {
//         console.error(`Ожидалась строка для времени приема, но получено: ${typeof doseTime}`);
//         continue;
//       }

//       // Преобразуем строку в дату
//       const [hour, minute] = doseTime.split(':');
//       const reminderTime = new Date(now);
//       reminderTime.setDate(now.getDate() + day); // Дата через day дней
//       reminderTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

//       // Проверка на прошедшее время, если напоминание на текущий день, то сдвигаем его на завтра
//       // if (reminderTime < new Date()) {
//       //   reminderTime.setDate(reminderTime.getDate() + 1); // Сдвигаем на следующий день
//       // }


// if (reminderTime < now && day === 0) {
//     console.log(`Время приема (${doseTime}) уже прошло, напоминание не будет запланировано для сегодняшнего дня.`);
//     continue;  // Пропускаем это напоминание
// }

//       // Планируем напоминание для конкретного приема
//       schedule.scheduleJob(reminderTime, () => {
//         bot.telegram.sendMessage(
//           userChatId,
//           // `Напоминание: Пора принять ${medicineName} (${dosage}) в ${moment(reminderTime).format('HH:mm')}.`,
//           `Напоминание: Пора принять ${medicineName} (${dosage}) в ${doseTime}.`,//???
          
//           {
//             reply_markup: Markup.inlineKeyboard([
//               Markup.button.callback('Принял', `accept_medicine_${medicineName}_${dose}`),
//             ]),
//           }
//         );
//       });
//     }
//   }
// }

// // Функция для планирования напоминаний для всех лекарств
// async function scheduleReminders(userChatId) {
//   console.log(`Планирование напоминаний для chatId: ${userChatId}`);
//   try {
//     const medicines = await getMedicinesFromNotion();  // Получаем лекарства из Notion
//     if (!medicines.length) {
//       console.log('Нет активных лекарств для планирования.');
//       return;
//     }

//     medicines.forEach((medicine) => {
//       const chatId = medicine.chatId;  // Должно быть правильное поле chatId
//       if (!chatId) {
//         console.log(`У лекарства ${medicine.medicineName} отсутствует chatId.`);
//         return;
//       }
      
//       // Если у лекарства есть chatId, планируем напоминания
//       if (medicine.timesPerDay && medicine.duration) {
//         scheduleCourseReminders(
//           chatId,              // Идентификатор чата пользователя
//           medicine.medicineName,
//           medicine.dosage,
//           medicine.timesPerDay,
//           medicine.duration
//         );
//       } else {
//         console.log(`Недостаточно данных для планирования напоминаний для лекарства: ${medicine.medicineName}`);
//       }
//     });
//   } catch (error) {
//     console.error('Ошибка при планировании напоминаний:', error);
//   }
// }

// // Функция для получения лекарств на сегодня
// // добавил userChatId
// async function getMedicinesForToday(userChatId) {
//   const medicines = await getMedicinesFromNotion();  // Получаем все лекарства из Notion
//   const todayMedicines = [];

//   const today = moment().tz(TIMEZONE).startOf('day');  // Текущая дата с началом дня
//   const tomorrow = today.clone().add(1, 'days').startOf('day');  // Завтрашний день для ограничения

//   console.log(`Проверяем лекарства на сегодня: ${today.format('YYYY-MM-DD')}`);

//   // Фильтруем лекарства, которые нужно принять сегодня
//   medicines.forEach((medicine) => {
//     if (!medicine.doseTimes || !Array.isArray(medicine.doseTimes)) {
//       console.error(`У лекарства ${medicine.medicineName} отсутствует поле doseTimes или оно не является массивом.`);
//       return;  // Пропускаем лекарство, если нет информации о времени приема
//     }

//     const timesForToday = medicine.doseTimes.filter(doseTime => {
//       const time = moment(doseTime).tz(TIMEZONE);
//       console.log(`Проверяем время: ${time.format('YYYY-MM-DD HH:mm')}`);  // Для отладки
//       return time.isSameOrAfter(today) && time.isBefore(tomorrow);  // Лекарства только на сегодня
//     });

//     if (timesForToday.length > 0) {
//       todayMedicines.push({
//         medicineName: medicine.medicineName,
//         dosage: medicine.dosage,
//         timesForToday: timesForToday.map(time => moment(time).format('HH:mm')),  // Форматируем время
//       });
//     }
//   });

//   console.log(`Найдено лекарств на сегодня!: ${todayMedicines.length}`);
//   return todayMedicines;
// }

// // Планирование задачи для регулярного архивирования старых записей
// schedule.scheduleJob('0 0 * * 0', function() {
//   console.log('Архивирование старых записей...');
//   archiveOldMedicines();  // Выполняем каждую неделю (воскресенье в полночь)
// });

// module.exports = { scheduleReminders, getMedicinesForToday };


