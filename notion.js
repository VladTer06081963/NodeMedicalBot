const { Client } = require('@notionhq/client');
const moment = require('moment-timezone');
const { NOTION_TOKEN, NOTION_DATABASE_ID, TIMEZONE } = require('./config');

const notion = new Client({ auth: NOTION_TOKEN });

// Функция для получения данных о лекарствах из Notion (только активных записей)
async function getMedicinesFromNotion(userChatId) {
  const response = await notion.databases.query({
    database_id: NOTION_DATABASE_ID,
    filter: {
      property: 'Статус',
      select: {
        equals: 'Активно',  // Фильтруем только активные записи
      },
    },
  });

  // Логируем количество найденных записей
  console.log(`Найдено активных лекарств: ${response.results.length}`);

  return response.results.map((page) => {
    const timesPerDay = page.properties['Количество приемов в день'].number || 1;
    const chatId = page.properties['chatId']?.rich_text?.[0]?.text?.content || 'undefined';
    const medicineName = page.properties['Название лекарства'].title?.[0]?.text?.content || 'Не указано';

    // Логируем информацию о текущем лекарстве
    console.log(`Обрабатываем лекарство: ${medicineName}, chatId: ${chatId}`);

    // Собираем информацию о времени приема
    let doseTimes = [];
    
    if (page.properties['Завтрак']?.date?.start) {
      doseTimes.push(moment(page.properties['Завтрак'].date.start).tz(TIMEZONE).toDate());
    }
    if (page.properties['Обед']?.date?.start) {
      doseTimes.push(moment(page.properties['Обед'].date.start).tz(TIMEZONE).toDate());
    }
    if (page.properties['Ужин']?.date?.start) {
      doseTimes.push(moment(page.properties['Ужин'].date.start).tz(TIMEZONE).toDate());
    }

    // Логируем время приема для лекарства
    console.log(`Время приема для лекарства ${medicineName}: ${doseTimes.map(dt => moment(dt).format('HH:mm'))}`);

    return {
      id: page.id,
      medicineName,
      dosage: page.properties['Дозировка'].rich_text?.[0]?.text?.content || 'Дозировка не указана',
      timesPerDay,
      duration: page.properties['Длительность курса'].number || 0,
      chatId,
      doseTimes  // Время приема (завтрак, обед, ужин)
    };
  });
}

// Функция архивирования записи в Notion
async function archiveMedicineInNotion(medicineId) {
  try {
    await notion.pages.update({
      page_id: medicineId,
      properties: {
        Статус: {
          select: {
            name: 'Архив',  // Помечаем запись как архивную
          },
        },
      },
    });
    console.log(`Лекарство с ID ${medicineId} перемещено в архив.`);
  } catch (error) {
    console.error(`Ошибка при архивировании лекарства с ID ${medicineId}:`, error);
  }
}

// Автоматическая проверка и архивирование записей
async function archiveOldMedicines() {
  const response = await notion.databases.query({
    database_id: NOTION_DATABASE_ID,
    filter: {
      property: 'Статус',
      select: {
        equals: 'Активно',  // Проверяем только активные записи
      },
    },
  });

  const medicines = response.results;

  for (const medicine of medicines) {
    // Вычисляем doseTimes так же, как в getMedicinesFromNotion
    const timesPerDay = medicine.properties['Количество приемов в день'].number || 1;
    let doseTimes = [];

    for (let i = 1; i <= timesPerDay; i++) {
      const doseTimeProperty = medicine.properties[`Приём ${i}`];
      if (doseTimeProperty && doseTimeProperty.date && doseTimeProperty.date.start) {
        const doseTime = moment.tz(doseTimeProperty.date.start, TIMEZONE).toDate();
        doseTimes.push(doseTime);
      }
    }

    // Проверяем, закончились ли приемы
    const lastDoseTime = Math.max(...doseTimes.map(dose => new Date(dose).getTime()));
    if (Date.now() > lastDoseTime) {
      // Если последний прием был в прошлом, архивируем лекарство
      await archiveMedicineInNotion(medicine.id);
    }
  }

  console.log(`Архивировано ${medicines.length} устаревших записей.`);
}

// Функция для добавления лекарства в Notion
async function addMedicineToNotion(medicineData) {
  const { name, dosage, duration, chatId, breakfastTime, lunchTime, dinnerTime } = medicineData;

  if (!name || !dosage || !duration || isNaN(duration) || !chatId) {
    throw new Error('Недостаточно данных для добавления лекарства. Проверьте, что все поля заполнены корректно.');
  }

  const TIMEZONE = 'Europe/Kiev';  // Установите ваш часовой пояс
  const now = moment().tz(TIMEZONE);  // Текущая дата и время

  const dateProperties = {};

  // Если текущее время после полуночи, установим время приема на следующий день
  const addTimeForNextDay = (baseTime) => {
    // Добавляем текущую дату к времени приема
    const baseMoment = moment.tz(`${moment().format('YYYY-MM-DD')} ${baseTime}`, 'YYYY-MM-DD HH:mm', TIMEZONE);
    if (now.isAfter(baseMoment)) {
      baseMoment.add(1, 'day');  // Добавляем день, если текущее время уже прошло
    }
    return baseMoment.toISOString();  // Возвращаем ISO строку для сохранения
  };

  // Заполняем время для приема
  if (breakfastTime) {
    dateProperties['Завтрак'] = {
      date: {
        start: addTimeForNextDay(breakfastTime),  // Используем переданное время завтрака
      },
    };
  }

  if (lunchTime) {
    dateProperties['Обед'] = {
      date: {
        start: addTimeForNextDay(lunchTime),  // Используем переданное время обеда
      },
    };
  }

  if (dinnerTime) {
    dateProperties['Ужин'] = {
      date: {
        start: addTimeForNextDay(dinnerTime),  // Используем переданное время ужина
      },
    };
  }

  try {
    await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        'Название лекарства': {
          title: [
            {
              text: {
                content: name,
              },
            },
          ],
        },
        'Дозировка': {
          rich_text: [
            {
              text: {
                content: dosage,
              },
            },
          ],
        },
        'Длительность курса': {
          number: duration,
        },
        'chatId': {
          rich_text: [
            {
              text: {
                content: String(chatId),
              },
            },
          ],
        },
        'Статус': {
          select: {
            name: 'Активно',  // Устанавливаем статус по умолчанию как "Активно"
          },
        },
        ...dateProperties,  // Время приема (завтрак, обед, ужин)
      },
    });
    console.log(`Лекарство ${name} добавлено со статусом "Активно" и времени приема.`);
  } catch (error) {
    console.error('Ошибка при добавлении лекарства в Notion:', error);
    throw error;
  }
}

module.exports = {
  getMedicinesFromNotion,
  addMedicineToNotion,
  archiveOldMedicines,  // Экспортируем функцию архивирования устаревших записей
  archiveMedicineInNotion,  // Экспортируем функцию для архивирования отдельной записи
};
