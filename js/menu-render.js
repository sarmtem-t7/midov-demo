/* MIDOV · Меню карточками ──────────────────────────────────
   Заказчик попросил фотографию у каждого напитка. Список цен для этого
   не годится: кадр в строке высотой 56px — это иконка, а не фотография.
   Поэтому позиции снова карточки, но не те, что были.

   Что убило первую версию карточек: скруглённая коробка с подложкой,
   полноширинные таблетки объёма и чёрная кнопка «В ЗАКАЗ» внизу давали
   250px на позицию и 8456px на всё меню. Отсюда правила этой версии:
   коробки нет вовсе, у карточки нет ни фона, ни рамки, ни тени; кадр
   квадратный и он же главный вес; под ним ровно одна строка — имя и
   цена; отдельной кнопки «в заказ» нет — нажимается вся карточка.
   Тяжелее фотографии на карточке нет ничего.

   Цены и названия читаются из window.MIDOV_MENU в момент отрисовки.
   Второй копии на экране нет — это урок T021: стоило ценам появиться в
   двух местах, как они молча разошлись, и каждая копия проверяла сама
   себя.

   А вот кадры стоят в разметке index.html, и это не противоречие.
   srcset, sizes и размеры кадра браузер обязан увидеть до запуска
   скрипта — иначе он не выберет файл под ширину экрана и уронит вёрстку
   при догрузке (принцип IV). Так же собран артефакт: он вшивает файлы,
   найденные в разметке, и кадр, рождённый скриптом, в него бы не попал.
   Отсюда разделение труда: разметка держит кадр, этот файл — всё
   остальное. Разойтись им не дают две проверки ниже: пропавшая
   заготовка и кадр не от той позиции пишутся в консоль. */
(() => {
  'use strict';

  const DATA = window.MIDOV_MENU;
  const CART = window.MidovCart;
  if (!Array.isArray(DATA)) return;

  const live = document.getElementById('menu-live');

  /* Неразрывный пробел перед рублём: «280 ₽» не имеет права переноситься
     на две строки — цена читается как одно число со знаком. */
  const money = (rub) => `${rub} ₽`;

  const src400 = (item) => `assets/drinks/${item.photo}-400.webp`;

  /* Подпись объёма ставится только там, где в данных стоят миллилитры.
     У BLACK и TEA в volumes лежат заглушки «Меньший объём» / «Больший
     объём»: миллилитры этих разделов источником не подтверждены (принцип I).
     Признак — цифра в подписи: он читается из данных и не требует списка
     исключений, который однажды разойдётся с menu.js. */
  const isMl = (text) => typeof text === 'string' && /\d/.test(text);
  const volLabel = (item, i) => {
    const raw = item.volumes && item.volumes[i];
    return isMl(raw) ? raw : null;
  };

  /* Русское склонение: 1 напиток, 2 напитка, 5 напитков. Число считается
     по данным, а не вписано в разметку — иначе однажды в меню станет 35
     позиций, а на кнопке останется 34 (принцип I). */
  const plural = (n, one, few, many) => {
    const d10 = n % 10, d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return one;
    if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return few;
    return many;
  };

  /* Таймер подсветки живёт в WeakMap, а не в свойстве элемента: элемент —
     чужая территория, а карта умирает вместе с карточкой. */
  const flashTimers = new WeakMap();

  /* Подсветка карточки — отклик на месте нажатия: счётчик в шапке далеко,
     и из середины сетки его не видно. Класс снимается и ставится заново
     через принудительный пересчёт, иначе второе нажатие подряд не
     перезапустит переход и выглядит как промах.

     Отклик задан классом, а не анимацией, поэтому остаётся видимым и при
     prefers-reduced-motion: без движения он просто включается и гаснет
     без плавности. */
  const flash = (card) => {
    card.classList.remove('card--added');
    void card.offsetWidth;
    card.classList.add('card--added');
    clearTimeout(flashTimers.get(card));
    flashTimers.set(card, setTimeout(() => card.classList.remove('card--added'), 560));
  };

  const announce = (item, line) => {
    if (!live || !line) return;
    live.textContent = line.volume
      ? `${item.title}, ${line.volume.toLowerCase()} — в заказе ${line.qty}`
      : `${item.title} — в заказе ${line.qty}`;
  };

  const addTo = (item, index, card) => {
    /* Цена берётся модулем из item.prices[index] — именно выбранного
       объёма, а не первого (FR-006). Здесь передаётся только индекс. */
    const line = CART.add(item, index);
    if (!line) return;
    flash(card);
    announce(item, line);
  };

  const registry = [];

  /* ── Кадр ────────────────────────────────────────────────
     Заготовка кадра приходит из разметки. Если её нет — позиция всё равно
     обязана появиться на экране с фотографией, поэтому кадр собирается
     здесь, но в консоль уходит ошибка: молча потерять кадр из сетки
     нельзя, а молча потерять позицию — тем более. */
  const shotFor = (item, card) => {
    const found = card.querySelector('.card__shot');
    if (found) {
      const img = found.querySelector('img');
      const want = src400(item);
      /* Во вшитой версии сборщик заменяет путь на data-URI, и прямое
         сравнение строк даёт ложную тревогу на каждой из 34 позиций.
         Проверка нужна ради расхождения данных и разметки, а не ради
         способа доставки файла, — поэтому вшитые кадры пропускаем. */
      const inlined = img && img.getAttribute('src').startsWith('data:');
      if (img && !inlined && img.getAttribute('src') !== want) {
        console.error(`menu-render: у позиции «${item.id}» в разметке кадр ${img.getAttribute('src')}, а в данных ${want}`);
      }
      return found;
    }

    console.error(`menu-render: в разметке нет заготовки позиции «${item.id}» — кадр собран скриптом`);
    const shot = document.createElement('span');
    shot.className = 'card__shot';
    if (item.photo) {
      const img = document.createElement('img');
      img.className = 'card__img';
      img.src = src400(item);
      img.srcset = `${src400(item)} 400w, assets/drinks/${item.photo}-800.webp 800w`;
      img.sizes = '(min-width: 1200px) 210px, (min-width: 900px) 23vw, (min-width: 620px) 30vw, 45vw';
      img.width = 400;
      img.height = 400;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = item.alt || item.title;
      shot.append(img);
    }
    return shot;
  };

  /* Название. Описание есть ровно у одной позиции («Листовая классика»),
     поэтому оно живёт внутри имени отдельной строкой, а не колонкой:
     колонка ради одной позиции перекосила бы всю сетку.

     Всё строится через createElement, а не innerHTML: названия приходят
     из данных, и однажды в них окажется символ, который innerHTML
     истолкует как разметку. */
  const buildName = (item) => {
    const name = document.createElement('span');
    name.className = 'card__name';
    name.append(document.createTextNode(item.title));

    if (item.description) {
      const desc = document.createElement('span');
      desc.className = 'card__desc';
      desc.textContent = item.description;
      name.append(desc);
    }
    return name;
  };

  /* ── Карточка с одной ценой ──────────────────────────────
     Нажимается вся карточка целиком — кадр и есть кнопка, и это самая
     крупная цель нажатия на странице. Знак «+» рядом с ценой — единственный
     намёк на то, что карточка живая: на мыши он проявляется при наведении,
     на телефоне виден всегда приглушённым (правило в style.css). Когда
     позиция уже в заказе, на месте «+» стоит её количество. */
  const fillSingle = (item, card, shot) => {
    /* Корзины может не быть — файл не догрузился, модуль упал. Тогда меню
       остаётся читаемой витриной с ценами, а мёртвой кнопки на экране нет:
       кнопка, которая ничего не делает, хуже её отсутствия. */
    const hit = document.createElement(CART ? 'button' : 'span');
    hit.className = 'card__hit';
    if (CART) hit.type = 'button';

    const body = document.createElement('span');
    body.className = 'card__body';

    const price = document.createElement('span');
    price.className = 'card__price';
    price.textContent = money(item.prices[0]);

    body.append(buildName(item), price);

    let mark = null;
    if (CART) {
      mark = document.createElement('span');
      mark.className = 'card__mark';
      /* Знак нарисован для глаза, а смысл кнопки несёт aria-label: без
         aria-hidden скринридер прочёл бы «Эспрессо 280 ₽ плюс». */
      mark.setAttribute('aria-hidden', 'true');
      body.append(mark);
      hit.addEventListener('click', () => addTo(item, 0, card));
    }

    hit.append(shot, body);
    card.append(hit);

    if (!CART) return;

    const paint = () => {
      const qty = CART.qtyOf(item.id, 0);
      mark.textContent = qty > 0 ? String(qty) : '+';
      mark.classList.toggle('card__mark--qty', qty > 0);
      hit.setAttribute('aria-label', qty > 0
        ? `Добавить в заказ: ${item.title}, ${money(item.prices[0])}. В заказе ${qty}`
        : `Добавить в заказ: ${item.title}, ${money(item.prices[0])}`);
    };
    registry.push({ paint });
    paint();
  };

  /* ── Карточка с двумя ценами ─────────────────────────────
     Две цены в данных означают два объёма, а не диапазон (contracts/data.md),
     поэтому цена и есть кнопка: нажатие сразу кладёт свой объём, и «280/320»
     физически не может прочитаться как «от и до».

     Обе кнопки лежат на кадре, а не под ним. Причина арифметическая: полоса
     цен под именем добавила бы 50px шести карточкам, а в сетке высота ряда
     равна самой высокой карточке — эти 50px умножились бы на пять рядов
     из девятнадцати. На кадре они не стоят ничего, а кадру внизу мешать
     нечему: напиток стоит в середине квадрата. */
  const fillPair = (item, card, shot) => {
    card.classList.add('card--pair');

    const strip = document.createElement('span');
    strip.className = 'card__prices';

    item.prices.forEach((rub, i) => {
      const vol = volLabel(item, i);

      /* Без корзины цена остаётся ценой: тот же прямоугольник, но span,
         а не button — нажимать нечего. */
      const cell = document.createElement(CART ? 'button' : 'span');
      cell.className = 'pricebtn';
      if (CART) cell.type = 'button';

      if (vol) {
        const cap = document.createElement('span');
        cap.className = 'pricebtn__vol';
        cap.textContent = vol;
        cell.append(cap);
      }

      const rubEl = document.createElement('span');
      rubEl.className = 'pricebtn__rub';
      rubEl.textContent = money(rub);
      cell.append(rubEl);

      if (CART) {
        const qtyEl = document.createElement('span');
        qtyEl.className = 'pricebtn__qty';
        qtyEl.hidden = true;
        cell.append(qtyEl);

        cell.addEventListener('click', () => addTo(item, i, card));

        registry.push({
          paint() {
            const qty = CART.qtyOf(item.id, i);
            qtyEl.hidden = qty === 0;
            qtyEl.textContent = String(qty);
            cell.classList.toggle('pricebtn--in', qty > 0);
            /* Объём в подписи есть не всегда, поэтому голосом он называется
               только там, где подтверждён; в остальных случаях позицию
               различает сама цена. */
            const what = vol
              ? `${item.title}, ${vol}, ${money(rub)}`
              : `${item.title}, ${money(rub)}`;
            cell.setAttribute('aria-label', qty > 0
              ? `Добавить в заказ: ${what}. В заказе ${qty}`
              : `Добавить в заказ: ${what}`);
          }
        });
      }

      strip.append(cell);
    });

    /* Полоса цен стоит ПОД именем, а не на кадре. На кадре она читалась
       наклейкой, шлёпнутой на снимок: у американо закрывала блюдце, у
       фильтра — угол. Прежний довод был арифметический — полоса под именем
       добавляет высоту шести карточкам, а ряд равен самой высокой. Довод
       снят тем, что полосу теперь получают ВСЕ карточки, и одиночные тоже:
       высота у всех одинаковая, множить нечего. */
    const body = document.createElement('span');
    body.className = 'card__body';
    body.append(buildName(item), strip);

    card.append(shot, body);
  };

  const fillCard = (item, card) => {
    const shot = shotFor(item, card);
    if (item.prices.length > 1) fillPair(item, card, shot);
    else fillSingle(item, card, shot);
  };

  /* Карточка ищется по data-item в своей сетке. Порядок задают данные:
     найденная заготовка переносится в конец сетки, поэтому перепутать
     позиции местами разметка не может. */
  const cardFor = (item, grid) => {
    let card = grid.querySelector(`.card[data-item="${item.id}"]`);
    if (!card) {
      console.error(`menu-render: в разметке нет карточки позиции «${item.id}» — собрана скриптом`);
      card = document.createElement('li');
      card.className = 'card';
      card.dataset.item = item.id;
    }
    grid.append(card);
    fillCard(item, card);
    return card;
  };

  /* ── Раздел ──────────────────────────────────────────────
     Название раздела пишется латиницей ровно так, как называет его кофейня
     (BLACK, MILKY, FRESH, KIDS, COLD DRINKS, MIDOV SPECIAL, TEA). Перевод
     здесь был бы подменой их голоса — принцип II. */
  const buildHead = (section) => {
    const head = document.createElement('div');
    head.className = 'menu__head';

    const h2 = document.createElement('h2');
    h2.className = 'menu__section';
    h2.id = `menu-${section.id}`;
    h2.textContent = section.title;
    head.append(h2);

    if (section.note) {
      const note = document.createElement('span');
      note.className = 'menu__note';
      note.textContent = section.note;
      head.append(note);
    }
    return head;
  };

  /* Контейнеры разделов стоят в разметке, потому что в них же лежат кадры.
     Если данные и разметка разойдутся, раздел не должен исчезнуть молча:
     недостающему находится место в конце и остаётся запись в консоли. */
  const groupFor = (id, host) => {
    const found = host.querySelector(`.menu__group[data-section="${id}"]`);
    if (found) return found;

    console.error(`menu-render: в разметке нет контейнера раздела «${id}» — раздел добавлен в конец`);
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    const group = document.createElement('div');
    group.className = 'menu__group';
    group.dataset.section = id;
    wrap.append(group);
    host.append(wrap);
    return group;
  };

  const menuView = document.getElementById('menu-view');
  if (menuView) {
    for (const section of DATA) {
      const group = groupFor(section.id, menuView);
      let grid = group.querySelector('.cards');
      if (!grid) {
        grid = document.createElement('ul');
        grid.className = 'cards';
        group.append(grid);
      }
      const head = buildHead(section);
      group.prepend(head);
      grid.setAttribute('aria-labelledby', head.querySelector('h2').id);
      for (const item of section.items) cardFor(item, grid);
    }
  }

  /* ── Приманки на лендинге ────────────────────────────────
     На лендинге раздел меню укорочен до нескольких позиций и кнопки
     «Всё меню»: иначе одно и то же меню стояло бы на странице дважды.
     Позиции выбраны по одной из разных разделов, чтобы по четырём
     карточкам было видно, что меню шире кофе. Цены у них те же самые —
     они читаются из тех же данных, а не переписаны в разметку. */
  const byId = new Map();
  for (const section of DATA) for (const item of section.items) byId.set(item.id, item);

  const teaser = document.querySelector('[data-teaser]');
  if (teaser) {
    for (const card of [...teaser.querySelectorAll('.card[data-item]')]) {
      const item = byId.get(card.dataset.item);
      if (!item) {
        console.error(`menu-render: приманка «${card.dataset.item}» не найдена в данных — карточка убрана`);
        card.remove();
        continue;
      }
      fillCard(item, card);
    }
  }

  /* Сколько всего позиций — считается по данным и подставляется всюду,
     где об этом сказано словами. */
  const total = DATA.reduce((n, section) => n + section.items.length, 0);
  for (const el of document.querySelectorAll('[data-menu-count]')) {
    el.textContent = `${total} ${plural(total, 'напиток', 'напитка', 'напитков')}`;
  }

  /* Один общий слушатель на все карточки: заказ меняют ещё панель корзины
     и оформление, и карточка обязана узнавать об этом от корзины, а не от
     собственной кнопки. Иначе удаление позиции из панели оставит на
     карточке старое число. */
  if (CART && CART.subscribe) CART.subscribe(() => registry.forEach((e) => e.paint()));

  /* Кадр, который не загрузился, прячется целиком: глобальное правило
     [hidden] { display: none !important } уберёт и сломанную иконку, и
     альтернативный текст, а на месте кадра останется тон бумаги, заданный
     рамке в style.css. Высота рамки задана соотношением сторон, поэтому
     сетка не схлопывается. */
  for (const img of document.querySelectorAll('.card__img, .shot__img')) {
    img.addEventListener('error', () => { img.hidden = true; });
  }
})();
