// commands.js
const { Markup, Scenes, session } = require('telegraf');
const scheduleReminders = require('./scheduler');
const { addMedicineToNotion } = require('./notion');

function setupCommands(bot) {
  // Создаём сцену для пошагового ввода данных о лекарстве
  const addMedicineScene = new Scenes.WizardScene(
    'add_medicine',
    (ctx) => {
      ctx.reply('Введите название лекарства:');
      ctx.wizard.state.medicineData = {};
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
      const timesPerDay = parseInt(ctx.message.text);
      if (isNaN(timesPerDay) || timesPerDay <= 0) {
        ctx.reply('Количество приёмов должно быть числом больше 0. Попробуйте снова.');
        return;
      }
      ctx.wizard.state.medicineData.timesPerDay = timesPerDay;

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
    ctx.reply('Бот запущен. Вы можете добавить новое лекарство командой /add.');
    scheduleReminders(ctx.chat.id);
  });

  // Команда /add
  bot.command('add', (ctx) => {
    ctx.scene.enter('add_medicine');
  });

  // Обработка нажатия кнопки "Принял"
  bot.action(/accept_medicine_(.*)_(.*)/, (ctx) => {
    const medicineId = ctx.match[1];
    const doseIndex = ctx.match[2];
    ctx.reply('Спасибо! Ваш приём лекарства зарегистрирован.');

    // Здесь можно добавить логику для обновления записи в Notion
  });
}

module.exports = setupCommands;
