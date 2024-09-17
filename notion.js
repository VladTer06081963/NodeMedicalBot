const { Client } = require('@notionhq/client');
const moment = require('moment-timezone');
const { NOTION_TOKEN, NOTION_DATABASE_ID, TIMEZONE } = require('./config');

const notion = new Client({ auth: NOTION_TOKEN });

// Функция для получения данных о лекарствах из Notion (только активных записей)
async function getMedicinesFromNotion() {
  const response = await notion.databases.query({
    database_id: NOTION_DATABASE_ID,
    filter: {
      property: 'Статус',
      select: {
        equals: 'Активно',
      },
    },
  });

  return response.results.map((page) => {
    const timesPerDay = page.properties['Количество приемов в день'].number || 1;
    const chatId = page.properties['chatId']?.rich_text?.[0]?.text?.content || 'undefined';
    const medicineName = page.properties['Название лекарства'].title?.[0]?.text?.content || 'Не указано';

    return {
      id: page.id,
      medicineName,
      dosage: page.properties['Дозировка'].rich_text?.[0]?.text?.content || 'Дозировка не указана',
      timesPerDay,
      duration: page.properties['Длительность курса'].number || 0,
      chatId,
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
  const { name, dosage, timesPerDay, duration, chatId } = medicineData;

  if (!name || !dosage || !timesPerDay || isNaN(timesPerDay) || !duration || isNaN(duration) || !chatId) {
    throw new Error('Недостаточно данных для добавления лекарства. Проверьте, что все поля заполнены корректно.');
  }
// Преобразуем chatId в строку , если это необходимо
  const chatIdStr = String(chatId);
  // Создаём свойства для полей "Приём 1", "Приём 2", и т.д.
  const doseProperties = {};
  const now = moment().tz(TIMEZONE).startOf('day');

  for (let i = 1; i <= timesPerDay; i++) {
    // Расчёт времени приёма
    const interval = (24 / timesPerDay) * i;
    const doseTime = now.clone().add(interval, 'hours');
    doseProperties[`Приём ${i}`] = {
      date: {
        start: doseTime.toISOString(),
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
        'Количество приемов в день': {
          number: timesPerDay,
        },
        'Длительность курса': {
          number: duration,  // Добавляем длительность курса в базу данных
        },
        'Статус': {
          select: {
            name: 'Активно',  // Устанавливаем статус по умолчанию как "Активно"
          },
        },
        'chatId': {
  rich_text: [
    {
      text: {
        // content: String(chatId),  // Преобразуем chatId в строку
  content: chatIdStr,  // Сохраняем chatId как строку
      },  
    },
  ],
},
        ...doseProperties,
      },
    });
    console.log(`Лекарство ${name} добавлено в базу данных с chatId: ${chatId}`);
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
