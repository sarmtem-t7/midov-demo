/* Шесть точек MIDOV. Единственный источник — таблица в
   specs/001-midov-demo-site/facts.md, проверенная 21 августа 2026 по карточкам
   2ГИС, Яндекс Карт и собственного сайта кофейни. Ни одного числа мимо неё:
   владелец знает свою сеть наизусть и первую же выдуманную цифру заметит
   (принцип I конституции).

   Часы — минуты от полуночи по времени Владикавказа (UTC+3), как велит
   contracts/data.md. null — не «ноль» и не «круглосуточно», а «источник не
   подтвердил»; логика по такому значению статус не показывает вовсе.
   Молчание лучше выдумки.

   Порядок массива — порядок показа. Флагман первый. */
window.MIDOV_SHOPS = [
  {
    id: "revolyucii-68",
    address: "Революции, 68",
    flagship: true,
    breakfastAllDay: true,      // пометка с их сайта, только здесь и на Гастелло
    opens: 540,                 // 09:00 — 2ГИС и Яндекс Карты
    closes: 1380,               // 23:00 — Яндекс Карты, подтверждено 21.08.2026
    rating: 5.0,
    ratingCount: 78,
    gis: "https://2gis.ru/vladikavkaz/firm/70000001079906579"
  },
  {
    id: "gappo-baeva-29",
    address: "Гаппо Баева, 29",
    flagship: false,
    breakfastAllDay: false,
    opens: 510,                 // 08:30 — не 09:00: часы у точек разные
    closes: 1320,               // 22:00 — 2ГИС, Яндекс Карты и Афиша
    rating: 5.0,
    ratingCount: 31,
    gis: "https://2gis.ru/vladikavkaz/firm/70000001061595916"
  },
  {
    id: "prospekt-mira-12",
    address: "Пр. Мира, 12",
    flagship: false,
    breakfastAllDay: false,
    opens: 510,                 // 08:30
    closes: 1320,               // 22:00 — 2ГИС и Яндекс Карты
    rating: 4.7,
    ratingCount: 39,
    gis: "https://2gis.ru/vladikavkaz/firm/70000001064723327"
  },
  {
    id: "gastello-71k3",
    address: "Гастелло, 71 к3",
    flagship: false,
    breakfastAllDay: true,      // вторая и последняя точка с завтраками весь день
    opens: 540,                 // 09:00
    closes: 1380,               // 23:00 — 2ГИС и Яндекс Карты
    rating: 4.8,
    ratingCount: 6,
    gis: "https://2gis.ru/vladikavkaz/firm/70000001098567461"
  },
  {
    id: "morskih-pehotintsev-8a",
    address: "Морских Пехотинцев, 8А",   // адрес с сайта MIDOV; карточка 2ГИС на дом 8
    flagship: false,
    breakfastAllDay: false,
    /* Часов нет ни у одной карточки: 2ГИС их не показывает, Яндекс помечает
       неизвестными. Придумать «как у соседней точки» нельзя — это и был бы тот
       самый правдоподобный вымысел, который хуже пустого места. */
    opens: null,
    closes: null,
    rating: 5.0,                // 2ГИС; на странице подписывается как рейтинг 2ГИС
    ratingCount: 1,             // одна оценка — цифру не округляем и не прячем
    gis: "https://2gis.ru/vladikavkaz/firm/70000001114154043"
  },
  {
    id: "kolka-kesaeva-176",
    address: "Колка Кесаева, 176",
    flagship: false,
    breakfastAllDay: false,
    /* Подтверждён только адрес — он есть на сайте MIDOV. Карточки кофейни ни в
       2ГИС, ни в Яндекс Картах по этому адресу нет (в Яндексе там числится
       закрытое чужое заведение), поэтому пусто всё остальное, включая ссылку
       на карты: увести гостя на чужую точку хуже, чем не увести никуда. */
    opens: null,
    closes: null,
    rating: null,
    ratingCount: null,
    gis: null
  }
];
