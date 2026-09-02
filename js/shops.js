/* Точки MIDOV: список, выбранная точка и живой статус «открыто / закроется /
   откроется». Модуль ничего не рисует — только считает и раздаёт подписку.
   Разметку по этим данным строит слой T011; так статус можно проверить без
   единого узла DOM, а стенд shops-test.html — единственный его потребитель,
   которому вёрстка вообще не нужна.

   Данные приходят из window.MIDOV_SHOPS (пишет Кодекс, форма зафиксирована
   в specs/001-midov-demo-site/contracts/data.md). Порядок массива — порядок
   показа, логика не сортирует.

   Подключать строго после shops-data.js. */
(() => {
  'use strict';

  /* Владикавказ — UTC+3. Считаем от него, а не от часов гостя (FR-004):
     владелец откроет ссылку из Владикавказа, но проверять её могут откуда
     угодно, и «открыто» по чужому часовому поясу — ложный факт о кофейне. */
  const TZ_OFFSET_MINUTES = 180;

  /* За сколько минут до закрытия «открыто до 22:00» сменяется на
     «закроется в 22:00». Час — потому что за час гость ещё успевает дойти,
     а раньше предупреждение звучит как «уже поздно» без повода. */
  const CLOSING_SOON_MINUTES = 60;

  const STORAGE_KEY = 'midov.shop';

  const MINUTES_IN_DAY = 1440;

  let shops = [];
  let selectedId = null;
  const listeners = new Set();

  /* ── Хранилище ──────────────────────────────────────────────
     В приватном режиме и при запрете данных сайтов падает само обращение к
     localStorage, а не только чтение значения. Поэтому в try/catch завёрнут
     весь доступ целиком: отказ хранилища означает «выбор живёт в пределах
     сессии», а не сломанную страницу. */
  const readStored = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const writeStored = (id) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
      return true;
    } catch {
      return false;
    }
  };

  /* ── Время ──────────────────────────────────────────────────
     Момент приходит параметром, а не берётся из Date.now() внутри: иначе
     поведение в 23:00 проверяется только ожиданием 23:00, и SC-008
     недоказуем. Все вычисления статуса стекаются сюда. */
  const momentOf = (when) => {
    const at = when instanceof Date ? when
      : (typeof when === 'number' ? new Date(when) : null);
    if (!at || Number.isNaN(at.getTime())) {
      /* Пропущенный момент — ошибка вызывающего кода, и прятать её за
         «нет данных» нельзя: тогда сломанный вызов выглядел бы как
         неподтверждённые часы, и мы бы молчали не о том. */
      throw new TypeError('MidovShops: момент времени обязателен — передайте Date или timestamp');
    }
    return at;
  };

  /* Считаем прямо от UTC, а не сдвигом локальной даты через
     getTimezoneOffset(): это смещение — часы устройства, и у момента по другую
     сторону перехода на летнее время оно уже другое, чем у сдвинутой метки.
     Сдвиг тогда промахивается ровно на час, и в ночь перевода стрелок где-нибудь
     в Нью-Йорке страница написала бы владельцу неверное «закрыто» (FR-004).
     getUTC* от пояса устройства не зависит вовсе, а Владикавказ круглый год
     UTC+3 — перевода стрелок в России нет с 2014 года. */
  const minutesInVladikavkaz = (when) => {
    const at = momentOf(when);
    const utcMinutes = at.getUTCHours() * 60 + at.getUTCMinutes();
    return (utcMinutes + TZ_OFFSET_MINUTES) % MINUTES_IN_DAY;
  };

  const pad = (n) => String(n).padStart(2, '0');

  /* Минуты от полуночи → «08:30». Нет числа — нет строки: null пойдёт
     дальше по коду как «показывать нечего». */
  const formatTime = (minutes) => {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null;
    const m = ((Math.round(minutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  };

  /* ── Часы точки ─────────────────────────────────────────────
     Статус считается, только когда подтверждены обе границы. Одного времени
     открытия мало: «открыто» без известного закрытия — то самое правдоподобное,
     которое хуже пустого места (принцип I). Совпадение границ трактуем как
     отсутствие данных, а не как «круглосуточно»: круглосуточность —
     утверждение о кофейне, и оно требует источника. */
  const isMinute = (v) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MINUTES_IN_DAY;

  const hoursKnown = (shop) =>
    !!shop && isMinute(shop.opens) && isMinute(shop.closes) && shop.opens !== shop.closes;

  /* Интервал полуоткрытый: ровно в момент открытия уже открыто, ровно в
     момент закрытия уже закрыто. Так же считает hero (`now < CLOSE`), и так
     честнее — в 22:00 дверь закрывают, а не открывают. */
  const isWithin = (minute, opens, closes) => (
    closes > opens
      ? minute >= opens && minute < closes
      /* closes < opens — смена переваливает за полночь. В подтверждённых
         данных такого пока нет, но форма контракта это допускает, и молча
         возвращать «закрыто» на всю ночь было бы ошибкой. */
      : minute >= opens || minute < closes
  );

  /* Сколько минут до отметки с учётом перехода через полночь.
     Ровно на отметке считаем сутки, а не ноль: вызывается только когда
     точка открыта, а значит закрытие впереди, а не сейчас. */
  const minutesUntil = (minute, target) => {
    const diff = (target - minute + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return diff === 0 ? MINUTES_IN_DAY : diff;
  };

  /* ── Статус ─────────────────────────────────────────────────
     У неизвестного статуса намеренно нет текста: придумывать формулировку —
     не дело этого слоя, разметка просто не показывает статус. */
  const UNKNOWN = Object.freeze({
    known: false,
    state: 'unknown',
    open: null,
    text: null,
    at: null,
    atText: null
  });

  const make = (state, open, at) => {
    const atText = formatTime(at);
    const text = state === 'open' ? `Открыто до ${atText}`
      : state === 'closing' ? `Закроется в ${atText}`
      : `Откроется в ${atText}`;
    return Object.freeze({ known: true, state, open, text, at, atText });
  };

  const status = (shop, when) => {
    // Момент разбирается первым: битый аргумент должен упасть, а не
    // прикинуться точкой без часов.
    const minute = minutesInVladikavkaz(when);
    if (!hoursKnown(shop)) return UNKNOWN;

    const { opens, closes } = shop;
    if (!isWithin(minute, opens, closes)) return make('closed', false, opens);

    const left = minutesUntil(minute, closes);
    return left <= CLOSING_SOON_MINUTES
      ? make('closing', true, closes)
      : make('open', true, closes);
  };

  /* ── Список и выбор ─────────────────────────────────────────── */
  const list = () => shops.slice();

  const get = (id) => shops.find((s) => s.id === id) || null;

  /* По умолчанию — флагман. Ищем по признаку, а не по строке id: id живёт
     в данных Кодекса и может смениться, «флагман один» — факт из facts.md. */
  const defaultShop = () => shops.find((s) => s.flagship) || shops[0] || null;

  const selected = () => get(selectedId) || defaultShop();

  const notify = () => {
    const shop = selected();
    // Копия набора: подписчик вправе отписаться прямо в обработчике.
    for (const fn of [...listeners]) {
      try {
        fn(shop);
      } catch (e) {
        // Упавший подписчик не должен уносить с собой остальных.
        console.error('MidovShops: подписчик упал', e);
      }
    }
  };

  const select = (id) => {
    const shop = get(id);
    // Неизвестный id выбор не меняет: чужое значение в хранилище или опечатка
    // в разметке не должны обнулять шапку.
    if (!shop) return null;
    const changed = shop.id !== selectedId;
    selectedId = shop.id;
    // Пишем даже при повторном выборе того же — так первый осознанный выбор
    // закрепляется, даже если он совпал с умолчанием.
    writeStored(shop.id);
    if (changed) notify();
    return shop;
  };

  const subscribe = (fn) => {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    /* Подписчик получает текущую точку сразу: иначе шапка стоит пустой до
       первой смены выбора и каждому пришлось бы дублировать первый вызов. */
    try {
      fn(selected());
    } catch (e) {
      console.error('MidovShops: подписчик упал', e);
    }
    return () => listeners.delete(fn);
  };

  /* Перечитывает window.MIDOV_SHOPS. Нужен на двух случаях: данные Кодекса
     подключились после этого файла, и стенд подменяет набор точек. */
  const reload = () => {
    shops = Array.isArray(window.MIDOV_SHOPS) ? window.MIDOV_SHOPS.slice() : [];
    const stored = readStored();
    const restored = stored && shops.some((s) => s.id === stored) ? stored : null;
    const fallback = defaultShop();
    const next = restored || (fallback ? fallback.id : null);
    const changed = next !== selectedId;
    selectedId = next;
    // На старте подписчиков ещё нет, так что первый вызов молчалив сам собой.
    if (changed) notify();
    return shops.length;
  };

  window.MidovShops = {
    TZ_OFFSET_MINUTES,
    CLOSING_SOON_MINUTES,
    STORAGE_KEY,
    list,
    get,
    selected,
    select,
    subscribe,
    status,
    // Статус выбранной точки — то, что нужно шапке; момент по-прежнему её.
    selectedStatus: (when) => status(selected(), when),
    hoursKnown,
    formatTime,
    minutesInVladikavkaz,
    reload
  };

  reload();
})();
