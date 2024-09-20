const { Markup, Scenes, session } = require('telegraf');
const { scheduleReminders } = require('./scheduler');  // Правильный импорт
const { addMedicineToNotion } = require('./notion');
const { getMedicinesFromNotion } = require('./notion');
const { getMedicinesForToday } = require('./scheduler');
const moment = require('moment');

function setupCommands(bot) {
  // Создаём сцену для пошагового ввода данных о лекарстве
  const addMedicineScene = new Scenes.WizardScene(
    'add_medicine',
    (ctx) => {
      ctx.reply('Введите название лекарства:');
      ctx.wizard.state.medicineData = { chatId: ctx.scene.state.chatId };
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.medicineData.name = ctx.message.text;
      ctx.reply('Введите дозировку (например, "500 мг"):');
      return ctx.wizard.next();
    },
    (ctx) => {
      ctx.wizard.state.medicineData.dosage = ctx.message.text;
      ctx.reply('Введите длительность курса в днях:');
      return ctx.wizard.next();
    },
    (ctx) => {
      const duration = parseInt(ctx.message.text);
      if (isNaN(duration) || duration <= 0) {
        ctx.reply('Длительность курса должна быть числом больше 0. Попробуйте снова.');
        return;
      }
      ctx.wizard.state.medicineData.duration = duration;

      // Предлагаем выбрать приемы пищи
      ctx.reply('Выберите время для приема лекарства:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Завтрак', 'breakfast'), Markup.button.callback('Обед', 'lunch'), Markup.button.callback('Ужин', 'dinner')]
        ])
      );
      return ctx.wizard.next();
    },
    (ctx) => {
      // Пользователь нажимает на кнопку "Завтрак", "Обед" или "Ужин"
      const chosenMeal = ctx.callbackQuery.data;

      // Устанавливаем время для каждого приема
      if (!ctx.wizard.state.medicineData.times) {
        ctx.wizard.state.medicineData.times = {};  // Храним выбранные приемы и их время
      }

      switch (chosenMeal) {
        case 'breakfast':
          ctx.wizard.state.medicineData.times.breakfastTime = '09:00';  // Время завтрака
          break;
        case 'lunch':
          ctx.wizard.state.medicineData.times.lunchTime = '13:00';  // Время обеда
          break;
        case 'dinner':
          ctx.wizard.state.medicineData.times.dinnerTime = '19:00';  // Время ужина
          break;
      }

      // Спрашиваем пользователя, хочет ли он выбрать еще один прием пищи
      ctx.reply('Хотите выбрать еще один прием?',
        Markup.inlineKeyboard([
          [Markup.button.callback('Да', 'yes'), Markup.button.callback('Нет', 'no')]
        ])
      );
      return ctx.wizard.next();
    },
    (ctx) => {
      const addMore = ctx.callbackQuery.data;

      if (addMore === 'yes') {
        // Если пользователь хочет добавить еще один прием, снова показываем кнопки выбора
        ctx.reply('Выберите прием:',
          Markup.inlineKeyboard([
            [Markup.button.callback('Завтрак', 'breakfast'), Markup.button.callback('Обед', 'lunch'), Markup.button.callback('Ужин', 'dinner')]
          ])
        );
        return ctx.wizard.back();
      } else {
        // Если пользователь не хочет добавлять больше приемов, добавляем данные в Notion
        const { breakfastTime, lunchTime, dinnerTime } = ctx.wizard.state.medicineData.times;

        addMedicineToNotion({
          ...ctx.wizard.state.medicineData,
          breakfastTime,
          lunchTime,
          dinnerTime
        })
        .then(() => {
          ctx.reply('Лекарство добавлено!');
          return ctx.scene.leave();
        })
        .catch((err) => {
          console.error('Ошибка при добавлении лекарства:', err);
          ctx.reply('Произошла ошибка при добавлении лекарства. Попробуйте снова.');
          return ctx.scene.leave();
        });
      }
    }
  );

  const stage = new Scenes.Stage([addMedicineScene]);

  bot.use(session());
  bot.use(stage.middleware());

  // Команда /start
  bot.start(async (ctx) => {
    console.log('Команда /start вызвана');
    try {
      const userChatId = ctx.chat.id;  // Получаем chatId пользователя
      // Приветственное сообщение при запуске бота
      ctx.reply('Добро пожаловать! Добавить новое лекарство командой - /add. Получить рецепт на текущий день - /today. Ваш chatId:'+ userChatId);

      // Получаем список лекарств на сегодня, как в команде /today
      const todayMedicines = await getMedicinesForToday();
      
      // Текущее время
      const now = moment();

      // Отфильтруем лекарства, которые еще предстоит принять (время больше текущего)
      const upcomingMedicines = todayMedicines.map(medicine => {
        const futureTimes = medicine.timesForToday
          .map(time => moment(`${moment().format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm'))  // Добавляем текущую дату
          .filter(time => time.isAfter(now));

        return {
          ...medicine,
          timesForToday: futureTimes
        };
      }).filter(medicine => medicine.timesForToday.length > 0);  // Оставляем только лекарства с будущими приемами

      if (upcomingMedicines.length === 0) {
        ctx.reply('На сегодня больше нет запланированных приемов лекарств.');
      } else {
        let message = 'Лекарства, которые нужно принять сегодня:\n';
        upcomingMedicines.forEach((medicine) => {
          const formattedTimes = medicine.timesForToday.map(time => time.format('HH:mm')).join(', ');
          message += `${medicine.medicineName} (${medicine.dosage}) в следующие часы: ${formattedTimes}\n`;
        });
        ctx.reply(message);
      }
       scheduleReminders(userChatId);  // Планируем напоминания
    } catch (error) {
      console.error('Ошибка при обработке команды /start:', error);
      ctx.reply('Произошла ошибка при запуске бота.');
    }
  });

  // Команда /myid
  bot.command('myid', (ctx) => {
    ctx.reply(`Ваш ID: ${ctx.from.id}`);
  });

  // Команда /add для добавления лекарства
  bot.command('add', (ctx) => {
    const chatId = ctx.chat.id;  // Получаем chatId пользователя
    ctx.scene.enter('add_medicine', { chatId });  // Передаем chatId в сцену для добавления лекарства
  });

  // Команда /site для открытия минибраузера
  bot.command('site', (ctx) => {
    ctx.reply('Привет! Нажмите на кнопку ниже, чтобы открыть минибраузер.', 
      Markup.inlineKeyboard([
        [Markup.button.webApp('Открыть минибраузер', 'https://carnelian-handbell-bf9.notion.site/Nodemedicalbot-1021a615d4a2807c92a7c76eae359297')]
      ])
    );
  });

  // Команда /today для отображения лекарств на сегодня
  bot.command('today', async (ctx) => {
    console.log('Команда /today вызвана');
    try {
      const todayMedicines = await getMedicinesForToday();
      if (todayMedicines.length === 0) {
        ctx.reply('Сегодня нет запланированных приемов лекарств.');
      } else {
        let message = 'Лекарства, которые нужно принять сегодня:\n';
        todayMedicines.forEach((medicine) => {
          const formattedTimes = medicine.timesForToday
            .map(time => moment(`${moment().format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm').format('HH:mm'));  // Добавляем текущую дату

          message += `${medicine.medicineName} (${medicine.dosage}) в следующие часы: ${formattedTimes.join(', ')}\n`;
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
