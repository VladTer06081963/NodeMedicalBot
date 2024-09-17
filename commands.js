const { Markup, Scenes, session } = require('telegraf');
const { scheduleReminders } = require('./scheduler');  // Правильный импорт
const { addMedicineToNotion } = require('./notion');
const { getMedicinesForToday } = require('./scheduler');

function setupCommands(bot) {
  // Создаём сцену для пошагового ввода данных о лекарстве
  const addMedicineScene = new Scenes.WizardScene(
    'add_medicine',
    (ctx) => {
      ctx.reply('Введите название лекарства:');
      // ctx.wizard.state.medicineData = {};
      ctx.wizard.state.medicineData = { chatId: ctx.scene.state.chatId };  // Сохраняем chatId в данные лекарства
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.medicineData.name = ctx.message.text;
      ctx.reply('Введите дозировку (например, "500 мг"):');
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.medicineData.dosage = ctx.message.text;
      ctx.reply('Введите количество приёмов в день (число):');
      return ctx.wizard.next();
    },
    (ctx) => {
    //   const timesPerDay = parseInt(ctx.message.text);
    //   if (isNaN(timesPerDay) || timesPerDay <= 0) {
    //     ctx.reply('Количество приёмов должно быть числом больше 0. Попробуйте снова.');
    //     return;
    //   }

const timesPerDay = parseInt(ctx.message.text);

if (isNaN(timesPerDay) || timesPerDay <= 0 || timesPerDay >= 4) {
  ctx.reply('Количество приёмов должно быть числом больше 0 и меньше 4. Попробуйте снова.');
  return;
}


      ctx.wizard.state.medicineData.timesPerDay = timesPerDay;

      ctx.reply('Введите длительность курса в днях:');
      return ctx.wizard.next();
    },
    (ctx) => {
      const duration = parseInt(ctx.message.text);
      if (isNaN(duration) || duration <= 0) {
        ctx.reply('Длительность курса должна быть числом больше 0. Попробуйте снова.');
        return;
      }
      ctx.wizard.state.medicineData.duration = duration;  // Сохраняем длительность курса
      // Добавляем лекарство в Notion
      addMedicineToNotion(ctx.wizard.state.medicineData)
        .then(() => {
          ctx.reply('Лекарство добавлено!');
          // Планируем напоминания
          scheduleReminders(ctx.chat.id);
          return ctx.scene.leave();
        })
        .catch((err) => {
          console.error('Ошибка при добавлении лекарства:', err);
          ctx.reply('Произошла ошибка при добавлении лекарства. Попробуйте снова.');
          return ctx.scene.leave();
        });
    }
  );

  const stage = new Scenes.Stage([addMedicineScene]);

  bot.use(session());
  bot.use(stage.middleware());

  // Команда /start
  bot.start((ctx) => {
    const userChatId = ctx.chat.id;  // Получаем chatId пользователя
    ctx.reply('Бот запущен. Добавить новое лекарство командой - /add. Получить рецепт на текущий день - /today. Ваш chatId: ' + userChatId);
    scheduleReminders(userChatId);  // Планируем напоминания
  });

  // Команда /myid
  bot.command('myid', (ctx) => {
    ctx.reply(`Ваш ID: ${ctx.from.id}`);
  });

  // Команда /add
  // bot.command('add', (ctx) => {
  //   ctx.scene.enter('add_medicine');
  // });

  bot.command('add', (ctx) => {
  const chatId = ctx.chat.id;  // Получаем chatId пользователя
  ctx.scene.enter('add_medicine', { chatId });  // Передаем chatId в сцену для добавления лекарства
});

  // Команда /site
  bot.command('site', (ctx) => {
    ctx.reply('Привет! Нажмите на кнопку ниже, чтобы открыть минибраузер.', 
      Markup.inlineKeyboard([
        [Markup.button.webApp('Открыть минибраузер', 'https://carnelian-handbell-bf9.notion.site/Nodemedicalbot-1021a615d4a2807c92a7c76eae359297')]
      ])
    );
  });

  // Команда /today
  bot.command('today', async (ctx) => {
    console.log('Команда /today вызвана');
    try {
      const todayMedicines = await getMedicinesForToday();
      if (todayMedicines.length === 0) {
        ctx.reply('Сегодня нет запланированных приемов лекарств.');
      } else {
        let message = 'Лекарства, которые нужно принять сегодня:\n';
        todayMedicines.forEach((medicine) => {
          message += `${medicine.medicineName} (${medicine.dosage}) в следующие часы: ${medicine.timesForToday.join(', ')}\n`;
        });
        ctx.reply(message);
      }
    } catch (error) {
      console.error('Ошибка при получении лекарств на сегодня:', error);
      ctx.reply('Произошла ошибка при получении списка лекарств.');
    }
  });

  // Обработка нажатия кнопки "Принял"
  bot.action(/accept_medicine_(.*)_(.*)/, (ctx) => {
    const medicineId = ctx.match[1];
    const doseIndex = ctx.match[2];
    ctx.reply('Спасибо! Ваш приём лекарства зарегистрирован.');
    // Можно добавить логику для обновления записи в Notion
  });
}

module.exports = setupCommands;
