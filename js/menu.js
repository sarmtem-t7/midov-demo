/* Порядок разделов и позиций повторяет меню MIDOV. Фотографии намеренно
   оставлены null: гостевую съёмку нельзя выдавать за предметную съёмку
   конкретного напитка (решение T005). */
window.MIDOV_MENU = [
  {
    id: "black",
    title: "BLACK",
    note: null,
    items: [
      {
        id: "espresso",
        title: "Эспрессо",
        prices: [280],
        volumes: null,
        photo: "espresso",
        alt: "Эспрессо в белой чашке на блюдце"
      },
      {
        id: "americano",
        title: "Американо",
        prices: [280, 320],
        volumes: ["Меньший объём", "Больший объём"],
        photo: "americano",
        alt: "Американо в белой чашке на блюдце"
      },
      {
        id: "filter",
        title: "Фильтр",
        prices: [300, 350],
        volumes: ["Меньший объём", "Больший объём"],
        photo: "filter",
        alt: "Фильтр в стеклянном стакане"
      }
    ]
  },
  {
    id: "milky",
    title: "MILKY",
    note: "250/350 мл",
    items: [
      {
        id: "cappuccino",
        title: "Капучино",
        prices: [300, 350],
        volumes: ["250 мл", "350 мл"],
        photo: "cappuccino",
        alt: "Капучино в белой чашке, с рисунком на пене"
      },
      {
        id: "latte",
        title: "Латте",
        prices: [350],
        volumes: null,
        photo: "latte",
        alt: "Латте в высоком стакане, слоями"
      },
      {
        id: "flat-white",
        title: "Флэт уайт",
        prices: [350],
        volumes: null,
        photo: "flat-white",
        alt: "Флэт уайт в белой чашке, с рисунком на пене"
      },
      {
        id: "raf-cocoa",
        title: "Раф какао",
        prices: [390, 420],
        volumes: ["250 мл", "350 мл"],
        photo: "raf-cocoa",
        alt: "Раф какао в высоком стакане, с какао на пене"
      }
    ]
  },
  {
    id: "fresh",
    title: "FRESH",
    note: "300 мл",
    items: [
      {
        id: "apple",
        title: "Яблоко",
        prices: [450],
        volumes: null,
        photo: "apple",
        alt: "Яблоко в высоком стакане"
      },
      {
        id: "grapefruit",
        title: "Грейпфрут",
        prices: [490],
        volumes: null,
        photo: "grapefruit",
        alt: "Грейпфрут в высоком стакане"
      },
      {
        id: "carrot",
        title: "Морковь",
        prices: [390],
        volumes: null,
        photo: "carrot",
        alt: "Морковь в высоком стакане"
      },
      {
        id: "orange",
        title: "Апельсин",
        prices: [450],
        volumes: null,
        photo: "orange",
        alt: "Апельсин в высоком стакане"
      }
    ]
  },
  {
    id: "kids",
    title: "KIDS",
    note: "250 мл",
    items: [
      {
        id: "cocoa-marshmallow",
        title: "Какао с маршмеллоу",
        prices: [350],
        volumes: null,
        photo: "cocoa-marshmallow",
        alt: "Какао с маршмеллоу в стеклянной кружке, с маршмеллоу"
      },
      {
        id: "babyccino",
        title: "Бейбичино",
        prices: [270],
        volumes: null,
        photo: "babyccino",
        alt: "Бейбичино в маленькой чашке, только молочная пена"
      }
    ]
  },
  {
    id: "cold-drinks",
    title: "COLD DRINKS",
    note: "300/400 мл",
    items: [
      {
        id: "hani",
        title: "Хани",
        prices: [350],
        volumes: null,
        photo: "hani",
        alt: "Хани в высоком стакане со льдом"
      },
      {
        id: "watermelon-raspberry",
        title: "Арбуз-малина",
        prices: [420],
        volumes: null,
        photo: "watermelon-raspberry",
        alt: "Арбуз-малина в высоком стакане со льдом"
      },
      {
        id: "espresso-tonic",
        title: "Эспрессо-тоник",
        prices: [450],
        volumes: null,
        photo: "espresso-tonic",
        alt: "Эспрессо-тоник в высоком стакане со льдом и пузырьками"
      },
      {
        id: "apple-lime",
        title: "Яблоко-лайм",
        prices: [390],
        volumes: null,
        photo: "apple-lime",
        alt: "Яблоко-лайм в высоком стакане со льдом"
      },
      {
        id: "cold-brew",
        title: "Cold brew",
        prices: [380],
        volumes: null,
        photo: "cold-brew",
        alt: "Cold brew в высоком стакане со льдом"
      },
      {
        id: "iced-latte",
        title: "Айс латте",
        prices: [390],
        volumes: null,
        photo: "iced-latte",
        alt: "Айс латте в высоком стакане со льдом, слоями"
      },
      {
        id: "yug-vostok",
        title: "Юг-Восток",
        prices: [380],
        volumes: null,
        photo: "yug-vostok",
        alt: "Юг-Восток в высоком стакане со льдом и долькой апельсина"
      },
      {
        id: "double-m",
        title: "Дабл М",
        prices: [380],
        volumes: null,
        photo: "double-m",
        alt: "Дабл М в высоком стакане со льдом"
      },
      {
        id: "japanese-story",
        title: "Японская история",
        prices: [390],
        volumes: null,
        photo: "japanese-story",
        alt: "Японская история в высоком стакане со льдом, зелёный слой поверх молока"
      }
    ]
  },
  {
    id: "midov-special",
    title: "MIDOV SPECIAL",
    note: "350/600 мл",
    items: [
      {
        id: "raf-haznidon",
        title: "Раф Хазнидон",
        prices: [390],
        volumes: null,
        photo: "raf-haznidon",
        alt: "Раф Хазнидон в высоком стакане, розовый, с молочной пеной"
      },
      {
        id: "latte-canada",
        title: "Латте Канада",
        prices: [390],
        volumes: null,
        photo: "latte-canada",
        alt: "Латте Канада в высоком стакане, слоями"
      },
      {
        id: "latte-halva",
        title: "Латте Халва",
        prices: [390],
        volumes: null,
        photo: "latte-halva",
        alt: "Латте Халва в высоком стакане, слоями"
      },
      {
        id: "matcha-cappuccino",
        title: "Матча капучино",
        prices: [390],
        volumes: null,
        photo: "matcha-cappuccino",
        alt: "Матча капучино в белой чашке, зелёный, с молочной пеной"
      },
      {
        id: "peanut-raf",
        title: "Арахисовый раф",
        prices: [390],
        volumes: null,
        photo: "peanut-raf",
        alt: "Арахисовый раф в высоком стакане, с молочной пеной"
      }
    ]
  },
  {
    id: "tea",
    title: "TEA",
    note: null,
    items: [
      {
        id: "sbiten",
        title: "Сбитень",
        prices: [590, 650],
        volumes: ["Меньший объём", "Больший объём"],
        photo: "sbiten",
        alt: "Сбитень в стеклянной кружке, с палочкой корицы"
      },
      {
        id: "buckwheat-puer-cranberry-honey",
        title: "Гречишный пуэр клюква-мёд",
        prices: [590, 650],
        volumes: ["Меньший объём", "Больший объём"],
        photo: "buckwheat-puer-cranberry-honey",
        alt: "Гречишный пуэр клюква-мёд в стеклянной кружке, с клюквой"
      },
      {
        id: "pineapple-lime",
        title: "Ананас-лайм",
        prices: [620],
        volumes: null,
        photo: "pineapple-lime",
        alt: "Ананас-лайм в стеклянной кружке, с долькой лайма"
      },
      {
        id: "sea-buckthorn",
        title: "Облепиха",
        prices: [590],
        volumes: null,
        photo: "sea-buckthorn",
        alt: "Облепиха в стеклянной кружке, с ягодами облепихи"
      },
      {
        id: "raspberry-ginger",
        title: "Малина-имбирь",
        prices: [490],
        volumes: null,
        photo: "raspberry-ginger",
        alt: "Малина-имбирь в стеклянной кружке, с малиной и имбирём"
      },
      {
        id: "nanayi-chai",
        title: "Нанайы-цай",
        prices: [490],
        volumes: null,
        photo: "nanayi-chai",
        alt: "Нанайы-цай в стеклянной кружке, с листьями"
      },
      {
        id: "loose-leaf-classic",
        title: "Листовая классика",
        description: "сенча, бергамот, ассам, жасмин, мята",
        prices: [490],
        volumes: null,
        photo: "loose-leaf-classic",
        alt: "Листовая классика в стеклянном чайнике, с листьями на дне"
      }
    ]
  }
];
