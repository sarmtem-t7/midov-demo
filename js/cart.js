/* MIDOV · Корзина ─────────────────────────────────────────────
   Модуль ничего не знает про разметку: только состояние, счёт и
   подписка. Причина: сумму читают трое — счётчик в шапке, панель
   корзины и экран оформления. Если каждый считает сам, они рано
   или поздно разойдутся, и разойдутся молча. Здесь один источник
   правды, остальные на него подписываются.

   Зависимостей нет: ванильный JS, как во всех прототипах hero/. */

(function (global) {
  'use strict';

  const DEFAULT_KEY = 'midov.cart.v1';

  /* Обращение к самому localStorage бросает исключение в приватном
     режиме и при запрете данных сайтов: падает не getItem, а чтение
     свойства. Поэтому в try/catch завёрнуто обращение целиком,
     а не только вызовы методов. */
  const defaultStorage = () => global.localStorage;

  /* Строка корзины опознаётся парой «позиция + объём»: Американо 250
     и Американо 350 — два разных заказа с разной ценой, а не одна
     строка с количеством два. */
  const lineIdFor = (itemId, volumeIndex) => `${itemId}::${volumeIndex}`;

  /* Потолок количества в одной строке. Не косметика: у чисел больше
     2^53 обычное сложение перестаёт быть точным, и сумма молча
     разойдётся с ручным подсчётом — а совпадение с ручным подсчётом
     и есть критерий SC-007. Настоящая граница гораздо ближе: сто
     стаканов одного напитка в одном заказе — это опечатка, а не заказ. */
  const MAX_QTY = 99;

  /* Разбор целого числа, приходящего снаружи. Строгий намеренно:
     Number() принимает и [], и true, и 1.9, и тогда add(item, 1.9)
     тихо продаёт первый объём вместо запрошенного — ровно то, что
     ниже запрещено. Отказ виден, подмена — нет.

     Строка из цифр разрешена, потому что из разметки индекс иначе
     и не приходит: dataset отдаёт только строки. */
  const toWhole = (value) => {
    if (typeof value === 'number') return Number.isInteger(value) ? value : null;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
    return null;
  };

  const createCart = (options = {}) => {
    const key = options.key || DEFAULT_KEY;

    /* Хранилище можно подменить: функцией (в том числе бросающей —
       так стенд проверяет приватный режим) или готовым объектом.
       Явный null означает «жить только в памяти». */
    const resolveStorage =
      typeof options.storage === 'function' ? options.storage
      : options.storage !== undefined ? () => options.storage
      : defaultStorage;

    let lines = [];
    let listeners = [];
    let storageOk = false;

    /* ── Хранилище ─────────────────────────────────────────── */

    const readRaw = () => {
      try {
        const store = resolveStorage();
        return store ? store.getItem(key) : null;
      } catch (e) {
        return null; // недоступно — корзина просто живёт в памяти
      }
    };

    const writeRaw = (value) => {
      try {
        const store = resolveStorage();
        if (!store) return false;
        store.setItem(key, value);
        return true;
      } catch (e) {
        /* Кончилась квота или запрещены данные сайтов. Заказ в памяти
           уже собран, терять его из-за хранилища нельзя, а ронять
           страницу — тем более: это пограничный случай из спеки. */
        return false;
      }
    };

    /* ── Строки ────────────────────────────────────────────── */

    /* Одна воронка и для добавления, и для чтения из хранилища:
       после перезагрузки в ключе может лежать что угодно, включая
       чужое и старое, и доверять этому нельзя. */
    const toLine = (raw) => {
      if (!raw || typeof raw !== 'object') return null;
      if (typeof raw.itemId !== 'string' || !raw.itemId) return null;

      /* Цена обязана быть целым числом рублей: копеек в меню нет
         (см. счёт ниже). Дробная цена означает, что в ключе лежит
         не наш заказ, — такую строку лучше выбросить, чем сложить
         во float и разойтись с ручным подсчётом. */
      const price = toWhole(raw.price);
      if (price === null || price < 0) return null;

      const qty = toWhole(raw.qty);
      if (qty === null || qty < 1) return null;

      /* В отличие от add(), здесь непонятный индекс не отменяет строку,
         а сводится к нулевому: цена в хранилище записана явно и от
         индекса не зависит — он только опознаёт строку. */
      const parsedIndex = toWhole(raw.volumeIndex);
      const volumeIndex = parsedIndex === null || parsedIndex < 0 ? 0 : parsedIndex;

      return {
        lineId: lineIdFor(raw.itemId, volumeIndex),
        itemId: raw.itemId,
        title: typeof raw.title === 'string' ? raw.title : raw.itemId,
        volume: raw.volume == null ? null : String(raw.volume),
        volumeIndex,
        price,
        qty: qty > MAX_QTY ? MAX_QTY : qty,
        photo: raw.photo == null ? null : String(raw.photo),
        alt: raw.alt == null ? null : String(raw.alt)
      };
    };

    /* Наружу уходит копия: панель не должна уметь менять заказ
       мимо add/setQty, иначе сохранение и подписчики о правке
       не узнают. */
    const copy = (line) => ({ ...line, sum: line.price * line.qty });

    const indexOfLine = (lineId) => lines.findIndex((l) => l.lineId === lineId);

    /* ── Счёт ──────────────────────────────────────────────── */

    /* Цены целые, в рублях: копеек в меню нет, значит дробной
       погрешности взяться неоткуда и обычного сложения хватает.
       Появятся копейки — считать в копейках, а не во float. */
    const total = () => lines.reduce((sum, l) => sum + l.price * l.qty, 0);

    /* Счётчик в шапке (FR-009) показывает число напитков, а не число
       строк: три капучино — это три, а не один. */
    const count = () => lines.reduce((n, l) => n + l.qty, 0);

    const snapshot = () => Object.freeze({
      lines: Object.freeze(lines.map((l) => Object.freeze(copy(l)))),
      total: total(),
      count: count(),
      lineCount: lines.length,
      isEmpty: lines.length === 0
    });

    /* ── Подписка ──────────────────────────────────────────── */

    const call = (fn, state) => {
      try {
        fn(state);
      } catch (e) {
        /* Один упавший слушатель не имеет права утащить за собой
           остальных и остановить сохранение заказа. */
        if (global.console && console.error) console.error('MidovCart: слушатель упал', e);
      }
    };

    // Слушатель может отписаться прямо изнутри — обходим копию списка.
    const notify = () => {
      const state = snapshot();
      listeners.slice().forEach((fn) => call(fn, state));
    };

    const persist = () => {
      const plain = lines.map(({ itemId, title, volume, volumeIndex, price, qty, photo, alt }) =>
        ({ itemId, title, volume, volumeIndex, price, qty, photo, alt }));
      storageOk = writeRaw(JSON.stringify({ v: 1, lines: plain }));
      return storageOk;
    };

    const commit = () => {
      persist();
      notify();
    };

    /* ── Восстановление ────────────────────────────────────── */

    const restore = () => {
      const raw = readRaw();
      if (!raw) return;

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return; // мусор в ключе: начинаем с пустой корзины, но не падаем
      }
      if (!parsed || !Array.isArray(parsed.lines)) return;

      for (const stored of parsed.lines) {
        const line = toLine(stored);
        if (!line) continue; // битую строку выбрасываем, остальной заказ живёт
        const at = indexOfLine(line.lineId);
        if (at === -1) lines.push(line);
        else lines[at].qty += line.qty;
      }
    };

    /* Проба записи нужна до первого изменения: панель корзины должна
       знать заранее, переживёт ли заказ перезагрузку. */
    const probe = () => {
      try {
        const store = resolveStorage();
        if (!store) return false;
        store.setItem(`${key}.probe`, '1');
        store.removeItem(`${key}.probe`);
        return true;
      } catch (e) {
        return false;
      }
    };

    restore();
    storageOk = probe();

    /* ── Наружу ────────────────────────────────────────────── */

    const api = {
      key,

      /* item — позиция из MIDOV_MENU по контракту data.md.
         volumeIndex — индекс выбранного объёма; цена берётся именно
         из него, а не первая из массива (FR-006). Неверный индекс не
         съезжает на нулевой: тихо продать не тот объём хуже, чем не
         продать ничего. */
      add(item, volumeIndex, qty) {
        if (!item || typeof item !== 'object') return null;
        if (!Array.isArray(item.prices) || item.prices.length === 0) return null;

        const index = volumeIndex == null ? 0 : toWhole(volumeIndex);
        if (index === null || index < 0 || index >= item.prices.length) return null;

        const amount = qty == null ? 1 : toWhole(qty);
        if (amount === null || amount < 1) return null;

        const volumes = Array.isArray(item.volumes) ? item.volumes : null;
        const line = toLine({
          itemId: item.id,
          title: item.title,
          volume: volumes && volumes[index] != null ? volumes[index] : null,
          volumeIndex: index,
          price: item.prices[index],
          qty: amount,
          photo: item.photo,
          alt: item.alt
        });
        if (!line) return null;

        const at = indexOfLine(line.lineId);
        if (at === -1) lines.push(line);
        else lines[at].qty = Math.min(lines[at].qty + amount, MAX_QTY);

        commit();
        return copy(lines[indexOfLine(line.lineId)]);
      },

      /* Количество упирается в потолок, а не отвергается: кнопка «+»
         на потолке просто перестаёт двигать число — это видно гостю.
         Отказ выглядел бы поломкой кнопки. */
      setQty(lineId, qty) {
        const at = indexOfLine(lineId);
        if (at === -1) return false;

        const next = toWhole(qty);
        if (next === null) return false;

        if (next < 1) lines.splice(at, 1); // ноль — это удаление, отдельной кнопки не нужно
        else lines[at].qty = Math.min(next, MAX_QTY);

        commit();
        return true;
      },

      changeQty(lineId, delta) {
        const at = indexOfLine(lineId);
        if (at === -1) return false;
        const step = toWhole(delta);
        if (step === null || step === 0) return false;
        return api.setQty(lineId, lines[at].qty + step);
      },

      remove(lineId) {
        const at = indexOfLine(lineId);
        if (at === -1) return false;
        lines.splice(at, 1);
        commit();
        return true;
      },

      clear() {
        if (lines.length === 0) return false;
        lines = [];
        commit();
        return true;
      },

      lines: () => lines.map(copy),

      line(lineId) {
        const at = indexOfLine(lineId);
        return at === -1 ? null : copy(lines[at]);
      },

      /* Карточке меню нужно знать, сколько такого объёма уже заказано,
         чтобы показать это на кнопке. */
      qtyOf(itemId, volumeIndex) {
        const index = volumeIndex == null ? 0 : toWhole(volumeIndex);
        if (index === null) return 0;
        const at = indexOfLine(lineIdFor(itemId, index));
        return at === -1 ? 0 : lines[at].qty;
      },

      total,
      count,
      lineCount: () => lines.length,
      isEmpty: () => lines.length === 0,
      snapshot,

      /* Слушатель вызывается сразу текущим состоянием: иначе каждый,
         кто подписался, обязан ещё и отрисоваться вручную первый раз
         — и однажды забудет. Возвращается отписка. */
      subscribe(fn) {
        if (typeof fn !== 'function') return () => {};
        listeners.push(fn);
        call(fn, snapshot());
        return () => {
          const at = listeners.indexOf(fn);
          if (at !== -1) listeners.splice(at, 1);
        };
      },

      /* false означает «заказ не переживёт перезагрузку»: приватный
         режим, запрет данных сайтов или кончившаяся квота. */
      storageWorks: () => storageOk,

      /* Панели корзины нужно знать потолок, чтобы гасить «+» на нём,
         а не молча упирать число в стену. */
      maxQty: MAX_QTY,

      lineIdFor
    };

    return api;
  };

  /* Экземпляр по умолчанию — тот, которым пользуется страница.
     Фабрика оставлена наружу ради стенда: он гоняет независимые
     корзины с чужими ключами и с нарочно сломанным хранилищем,
     не задевая настоящий заказ гостя. */
  const cart = createCart();
  cart.create = createCart;
  global.MidovCart = cart;
})(window);
