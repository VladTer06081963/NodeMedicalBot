// notion.js
const { Client } = require('@notionhq/client');
const moment = require('moment-timezone');
const { NOTION_TOKEN, NOTION_DATABASE_ID, TIMEZONE } = require('./config');

const notion = new Client({ auth: NOTION_TOKEN });

// Функция для получения данных о лекарствах из Notion
async function getMedicinesFromNotion() {
  const response = await notion.databases.query({
    database_id: NOTION_DATABASE_ID,
  });

  return response.results.map((page) => {
    const timesPerDay = page.properties['Количество приемов в день'].number || 1;
    let doseTimes = [];

    for (let i = 1; i <= timesPerDay; i++) {
      const doseTimeProperty = page.properties[`Приём ${i}`];
      if (doseTimeProperty && doseTimeProperty.date && doseTimeProperty.date.start) {
        const doseTime = moment.tz(doseTimeProperty.date.start, TIMEZONE).toDate();
        doseTimes.push(doseTime);
      } else {
        console.log(`Свойство 'Приём ${i}' отсутствует или некорректно для записи с ID: ${page.id}`);
      }
    }

    return {
      id: page.id,
      medicineName: page.properties['Название лекарства'].title[0]?.text.content || 'Не указано',
      dosage: page.properties['Дозировка'].rich_text[0]?.text.content || 'Дозировка не указана',
      timesPerDay: timesPerDay,
      doseTimes: doseTimes,
    };
  });
}

// Функция для добавления лекарства в Notion
async function addMedicineToNotion(medicineData) {
  const { name, dosage, timesPerDay } = medicineData;

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
        ...doseProperties,
      },
    });
  } catch (error) {
    console.error('Ошибка при добавлении лекарства в Notion:', error);
    throw error;
  }
}

module.exports = {
  getMedicinesFromNotion,
  addMedicineToNotion,
};
