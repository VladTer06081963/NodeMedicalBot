const schedule = require('node-schedule');
const moment = require('moment-timezone');
const { TIMEZONE } = require('./config');
const { getMedicinesFromNotion, archiveOldMedicines } = require('./notion');
const bot = require('./bot');
const { Markup } = require('telegraf');

// Планирование регулярных напоминаний
async function scheduleReminders(userChatId) {
  const medicines = await getMedicinesFromNotion();
  console.log('Active medicines from Notion:', medicines);

  medicines.forEach((medicine) => {
    if (medicine.doseTimes && medicine.doseTimes.length > 0) {
      medicine.doseTimes.forEach((doseTime, index) => {
        const jobTime = moment(doseTime).tz(TIMEZONE).toDate();

        const rule = new schedule.RecurrenceRule();
        rule.hour = jobTime.getHours();
        rule.minute = jobTime.getMinutes();
        rule.tz = TIMEZONE;

        schedule.scheduleJob(rule, () => {
          bot.telegram.sendMessage(
            userChatId,
            `Напоминание: Пора принять ${medicine.medicineName} (${medicine.dosage}) в ${moment(jobTime).format('HH:mm')}.`,
            {
              reply_markup: Markup.inlineKeyboard([
                Markup.button.callback('Принял', `accept_medicine_${medicine.id}_${index}`),
              ]),
            }
          );
        });
      });
    }
  });
}

// Планирование задачи для регулярного архивирования старых записей
schedule.scheduleJob('0 0 * * 0', function() {
  archiveOldMedicines();
});

module.exports = scheduleReminders;


// // scheduler.js
// const schedule = require('node-schedule');
// const moment = require('moment-timezone');
// const { TIMEZONE } = require('./config');
// const { getMedicinesFromNotion } = require('./notion');
// const bot = require('./bot');
// const { Markup } = require('telegraf');

// async function scheduleReminders(userChatId) {
//   const medicines = await getMedicinesFromNotion();
//   console.log('Medicines from Notion:', medicines);

//   medicines.forEach((medicine) => {
//     if (medicine.doseTimes && medicine.doseTimes.length > 0) {
//       medicine.doseTimes.forEach((doseTime, index) => {
//         const jobTime = moment(doseTime).tz(TIMEZONE).toDate();

//         // Создаём правило для ежедневного повторения
//         const rule = new schedule.RecurrenceRule();
//         rule.hour = jobTime.getHours();
//         rule.minute = jobTime.getMinutes();
//         rule.tz = TIMEZONE;

//         schedule.scheduleJob(rule, () => {
//           bot.telegram.sendMessage(
//             userChatId,
//             `Напоминание: Пора принять ${medicine.medicineName} (${medicine.dosage}) в ${moment(jobTime).format('HH:mm')}.`,
//             {
//               reply_markup: Markup.inlineKeyboard([
//                 Markup.button.callback('Принял', `accept_medicine_${medicine.id}_${index}`),
//               ]),
//             }
//           );
//         });
//       });
//     } else {
//       console.log(`Для лекарства "${medicine.medicineName}" время приёмов не установлено или некорректно.`);
//     }
//   });
// }

// module.exports = scheduleReminders;
