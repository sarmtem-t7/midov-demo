/* MIDOV · Панель заказа ───────────────────────────────────────
   Оболочка (затемнение, панель, открытие, ловушка фокуса, Escape) и первый
   её вид — сам заказ. Экран оформления и подтверждение живут в checkout.js
   и встраиваются сюда же через addView: панель одна, видов три, и гость
   всё время остаётся в одном окне, а не прыгает между тремя.

   Разметка строится здесь, а не в index.html, сознательно. Панель без
   скрипта — мёртвый прямоугольник: открыть её нечем, наполнить нечем.
   Значит и в разметке ей делать нечего (в отличие от меню и фотографий,
   которые обязаны читаться без JS).

   Ни одной цены и ни одной суммы этот файл не считает сам: всё приходит
   из window.MidovCart. Урок T021 — вторая копия чисел расходится с первой
   молча, и обе проверяют сами себя.

   Зависимостей нет: ванильный JS, как во всех прототипах hero/.
   Подключать строго после cart.js. */
(() => {
  'use strict';

  const CART = window.MidovCart;
  /* Без корзины панель бессмысленна: открывать нечего, а мёртвая кнопка
     в шапке хуже, чем кнопка, которая просто ничего не делает. */
  if (!CART) return;

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ANIM_MS = 340; // должно совпадать с длительностью в style.css

  /* Неразрывный пробел перед рублём — тот же, что в карточках меню:
     «280 ₽» читается как одно число со знаком и переноситься не имеет права. */
  const NBSP = ' ';
  const money = (rub) => `${rub}${NBSP}₽`;

  /* Русское склонение по числу. Без него в шапке панели стоит «3 напиток»,
     и это первое, за что цепляется глаз владельца. */
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* Иконки — единственное место с innerHTML, и это безопасно: строка
     постоянная, данных в неё не подставляется. Названия и адреса, наоборот,
     идут только через textContent — однажды в них окажется символ, который
     innerHTML истолкует как разметку. */
  const ICON_ARROW = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3.5 11.5 11.5 3.5M11.5 3.5H5.2M11.5 3.5v6.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CLOSE = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3.5 3.5 11.5 11.5M11.5 3.5 3.5 11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const ICON_BACK = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 7.5H3.5M3.5 7.5 7 4M3.5 7.5 7 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const arrow = () => {
    const span = el('span', 'cta__arrow');
    span.innerHTML = ICON_ARROW;
    return span;
  };

  /* ── Оболочка ───────────────────────────────────────────── */

  const root = el('div', 'sheet');
  root.id = 'cart-sheet';
  root.hidden = true;

  const scrim = el('div', 'sheet__scrim');
  scrim.setAttribute('aria-hidden', 'true');

  const panel = el('div', 'sheet__panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Ваш заказ');

  root.append(scrim, panel);
  document.body.append(root);

  /* ── Виды ───────────────────────────────────────────────── */

  const views = new Map();
  const hooks = new Map();
  let current = null;

  const addView = (name, node) => {
    node.classList.add('sheet__view');
    node.dataset.view = name;
    node.hidden = true;
    panel.append(node);
    views.set(name, node);
    return node;
  };

  const onShow = (name, fn) => { hooks.set(name, fn); };

  const show = (name) => {
    const node = views.get(name);
    if (!node) return false;

    for (const [key, view] of views) view.hidden = key !== name;
    current = name;

    /* Заголовок диалога меняется вместе с видом: иначе экран подтверждения
       продолжает называться «Ваш заказ» для всех, кто читает его голосом. */
    const title = node.querySelector('[data-sheet-title]');
    if (title) {
      if (!title.id) title.id = `sheet-title-${name}`;
      panel.setAttribute('aria-labelledby', title.id);
      panel.removeAttribute('aria-label');
    }

    /* Каждый вид открывается сверху: чужая прокрутка предыдущего вида
       выглядит как обрезанный экран. */
    const body = node.querySelector('.sheet__body');
    if (body) body.scrollTop = 0;

    const hook = hooks.get(name);
    if (hook) hook(node);

    // Фокус переезжает вместе с видом — но только если он и был в панели.
    if (isOpen() && panel.contains(document.activeElement)) focusInto(node);
    return true;
  };

  /* ── Фокус ──────────────────────────────────────────────── */

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* getClientRects, а не offsetParent: скрытые виды выключены display:none,
     и их кнопки не должны попадать в обход клавиатурой. */
  const focusables = (node) =>
    [...node.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);

  const focusInto = (node) => {
    const preferred = node.querySelector('[data-autofocus]');
    const target = preferred || focusables(node)[0];
    // preventScroll: панель уже на экране, а прокрутка страницы под ней
    // утащила бы фон в сторону.
    if (target) target.focus({ preventScroll: true });
  };

  /* ── Прокрутка страницы под панелью ─────────────────────
     Замок ставится на <html>, а не на body: у body уже стоит overflow-x,
     и добавлять к нему второе значение — способ однажды не вернуть первое.
     Ширина полосы прокрутки возвращается отступом, иначе страница под
     затемнением прыгает вбок ровно на её толщину в момент открытия. */
  let padWas = '';
  const lockScroll = () => {
    const html = document.documentElement;
    const bar = window.innerWidth - html.clientWidth;
    padWas = html.style.paddingRight;
    if (bar > 0) html.style.paddingRight = `${bar}px`;
    html.style.overflow = 'hidden';
  };
  const unlockScroll = () => {
    const html = document.documentElement;
    html.style.overflow = '';
    html.style.paddingRight = padWas;
  };

  /* ── Открытие и закрытие ────────────────────────────────── */

  const isOpen = () => !root.hidden;

  let lastFocus = null;
  let closeTimer = 0;

  const open = (view) => {
    if (isOpen()) { if (view) show(view); return; }
    lastFocus = document.activeElement;
    clearTimeout(closeTimer);
    lockScroll();
    root.hidden = false;
    show(view || current || 'cart');
    /* Класс ставится следующим кадром: пока элемент был display:none,
       браузер не видел начального состояния, и без паузы панель просто
       возникает на месте вместо выезда. */
    requestAnimationFrame(() => root.classList.add('sheet--open'));
    focusInto(views.get(current));
    // Панель уже на экране — плавающая кнопка под ней лишняя.
    syncBar();
  };

  const close = () => {
    if (!isOpen()) return;
    root.classList.remove('sheet--open');
    unlockScroll();
    /* hidden ставится по таймеру, а не по transitionend: при
       prefers-reduced-motion перехода нет вовсе, и событие не придёт
       никогда — панель осталась бы висеть поверх страницы. */
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { root.hidden = true; }, REDUCED.matches ? 0 : ANIM_MS);
    // Фокус возвращается туда, откуда пришёл: иначе он падает на <body>,
    // и следующий Tab начинает обход страницы заново.
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
    syncBar();
  };

  // Нажатие мимо панели — закрытие. Проверяем именно попадание в панель:
  // затемнение растянуто под ней, и координатами тут не обойтись.
  root.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.sheet__panel')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (isOpen() && e.key === 'Escape') close();
  });

  /* Ловушка фокуса. Без неё Tab из последнего поля уходит на страницу
     под затемнением, и с клавиатуры из панели уже не выбраться. */
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const list = focusables(panel);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    const outside = !panel.contains(active);
    if (e.shiftKey && (outside || active === first)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (outside || active === last)) { e.preventDefault(); first.focus(); }
  });

  /* ── Общая шапка вида ───────────────────────────────────── */

  const head = (opts) => {
    const node = el('header', 'sheet__head');
    const box = el('div', 'sheet__headline');

    if (opts.back) {
      const back = el('button', 'sheet__back');
      back.type = 'button';
      back.innerHTML = ICON_BACK;
      back.append(el('span', null, opts.back.label));
      back.addEventListener('click', () => show(opts.back.to));
      box.append(back);
    }

    const brow = el('p', 'eyebrow');
    const browText = el('span', null, opts.eyebrow || '');
    browText.dataset.brow = '';
    brow.append(browText);
    box.append(brow);

    const title = el('h2', 'sheet__title', opts.title);
    title.dataset.sheetTitle = '';
    if (opts.focusTitle) {
      // Экран подтверждения обязан представиться сам: фокус на номер заказа
      // читается голосом целиком, фокус на «Закрыть» — нет.
      title.tabIndex = -1;
      title.dataset.autofocus = '';
    }
    box.append(title);

    const closeBtn = el('button', 'sheet__close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Закрыть заказ');
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.addEventListener('click', close);

    node.append(box, closeBtn);
    return node;
  };

  /* ── Вид «Заказ» ────────────────────────────────────────── */

  const view = el('section');
  const cartHead = head({ eyebrow: 'Пока пусто', title: 'Ваш заказ' });
  const brow = cartHead.querySelector('[data-brow]');

  const body = el('div', 'sheet__body');

  /* Честное предупреждение вместо тихой потери заказа: в приватном режиме
     и при запрете данных сайтов корзина живёт только до перезагрузки. */
  const note = el('p', 'sheet__note',
    'Браузер не разрешил сохранять данные сайта — заказ пропадёт при перезагрузке страницы.');
  note.hidden = true;

  const list = el('ul', 'order');

  const empty = el('div', 'sheet__empty');
  {
    const t = el('h3', 'sheet__empty-title', 'Заказ ещё не собран');
    const p = el('p', 'sheet__empty-text',
      'Выберите напиток в меню — он появится здесь вместе с суммой. Забрать заказ можно навынос в любой из шести кофеен MIDOV.');
    const go = el('button', 'cta sheet__empty-go');
    go.type = 'button';
    go.append(el('span', null, 'Открыть меню'), arrow());
    go.addEventListener('click', () => {
      close();
      const menu = document.getElementById('menu');
      if (menu) menu.scrollIntoView({ behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'start' });
    });
    empty.append(t, p, go);
  }

  body.append(note, list, empty);

  const foot = el('footer', 'sheet__foot');
  const sumRow = el('div', 'sheet__sum');
  sumRow.setAttribute('role', 'status');
  const sumValue = el('strong', 'sheet__sum-value', money(0));
  sumRow.append(el('span', 'sheet__sum-label', 'Итого'), sumValue);

  const goCheckout = el('button', 'cta sheet__go');
  goCheckout.type = 'button';
  goCheckout.append(el('span', null, 'Оформить'), arrow());
  goCheckout.addEventListener('click', () => show('checkout'));

  const clearBtn = el('button', 'sheet__clear', 'Очистить заказ');
  clearBtn.type = 'button';
  clearBtn.addEventListener('click', () => { CART.clear(); });

  foot.append(sumRow, goCheckout, clearBtn);
  view.append(cartHead, body, foot);
  addView('cart', view);

  /* ── Строка заказа ──────────────────────────────────────── */

  const nameOf = (line) => (line.volume ? `${line.title}, ${line.volume.toLowerCase()}` : line.title);

  const buildLine = (line) => {
    const li = el('li', 'order-line');
    li.dataset.line = line.lineId;

    const text = el('div', 'order-line__text');
    const title = el('h3', 'order-line__title', line.title);
    const meta = el('p', 'order-line__meta');
    meta.dataset.meta = '';
    text.append(title, meta);

    const drop = el('button', 'order-line__drop');
    drop.type = 'button';
    drop.innerHTML = ICON_CLOSE;
    drop.addEventListener('click', () => CART.remove(line.lineId));

    const controls = el('div', 'order-line__controls');
    const stepper = el('div', 'stepper');

    const dec = el('button', 'stepper__btn');
    dec.type = 'button';
    dec.append(el('span', null, '−')); // настоящий минус, а не дефис
    dec.addEventListener('click', () => CART.changeQty(line.lineId, -1));

    const num = el('span', 'stepper__num');
    num.dataset.qty = '';

    const inc = el('button', 'stepper__btn');
    inc.type = 'button';
    inc.append(el('span', null, '+'));
    inc.addEventListener('click', () => CART.changeQty(line.lineId, 1));

    stepper.append(dec, num, inc);

    const sum = el('span', 'order-line__sum');
    sum.dataset.sum = '';

    controls.append(stepper, sum);
    li.append(text, drop, controls);

    li._parts = { title, meta, drop, dec, num, inc, sum };
    return li;
  };

  const paintLine = (li, line) => {
    const p = li._parts;
    const label = nameOf(line);

    p.title.textContent = line.title;
    /* Цена за штуку стоит рядом с объёмом не для красоты: без неё сумма
       строки при количестве больше одного выглядит как выдуманное число. */
    p.meta.textContent = line.volume
      ? `${line.volume} · ${money(line.price)} за штуку`
      : `${money(line.price)} за штуку`;

    p.num.textContent = String(line.qty);
    p.sum.textContent = money(line.sum);

    p.drop.setAttribute('aria-label', `Убрать из заказа: ${label}`);
    /* При количестве 1 «минус» удаляет строку — так и подписан. Отключать
       его было бы враньём: уменьшение до нуля и есть удаление (сценарий 3). */
    p.dec.setAttribute('aria-label', line.qty > 1
      ? `Меньше: ${label}`
      : `Убрать из заказа: ${label}`);
    p.inc.setAttribute('aria-label', `Больше: ${label}`);

    // На потолке «плюс» гаснет, а не упирается молча в стену.
    p.inc.disabled = line.qty >= CART.maxQty;
    p.inc.title = p.inc.disabled ? `Больше ${CART.maxQty} в одной строке не заказать` : '';
  };

  /* ── Плавающая кнопка заказа ────────────────────────────
     Кнопка корзины стоит в шапке первого экрана, а первый экран уезжает
     вверх, как только гость дошёл до меню. Дальше добавлять напитки есть
     куда, а открыть заказ — нечем: обратно к шапке прокрутка через семь
     разделов и семь перебивок. Кнопка появляется ровно тогда, когда обе
     причины сошлись: в заказе что-то есть и шапки на экране уже нет. */

  const bar = el('button', 'orderbar');
  bar.type = 'button';
  const barCount = el('span', 'orderbar__count', '0');
  const barSum = el('span', 'orderbar__sum', money(0));
  bar.append(el('span', null, 'Заказ'), barCount, barSum);
  bar.hidden = true;
  bar.addEventListener('click', () => open('cart'));
  document.body.append(bar);

  let navOnScreen = true;
  let lastState = null;

  const syncBar = () => {
    if (!lastState) return;
    bar.hidden = lastState.isEmpty || navOnScreen || isOpen();
    if (bar.hidden) return;
    barCount.textContent = String(lastState.count);
    barSum.textContent = money(lastState.total);
    bar.setAttribute('aria-label',
      `Открыть заказ: ${lastState.count} ${plural(lastState.count, 'напиток', 'напитка', 'напитков')} на ${money(lastState.total)}`);
  };

  const nav = document.querySelector('.nav');
  if (nav && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      navOnScreen = entry.isIntersecting;
      syncBar();
    }).observe(nav);
  } else {
    /* Без наблюдателя кнопка не появится вовсе — это хуже лишней кнопки,
       поэтому считаем шапку уехавшей и полагаемся на пустоту заказа. */
    navOnScreen = false;
  }

  /* ── Отрисовка ──────────────────────────────────────────
     Узлы строк переиспользуются, а не пересобираются каждый раз: полная
     пересборка списка уносит фокус с кнопки «+», и заказ становится
     недоступен с клавиатуры после первого же нажатия. */
  const nodes = new Map();

  const paint = (state) => {
    lastState = state;
    const seen = new Set();
    state.lines.forEach((line, i) => {
      seen.add(line.lineId);
      let li = nodes.get(line.lineId);
      if (!li) { li = buildLine(line); nodes.set(line.lineId, li); }
      paintLine(li, line);
      // Вставляем только если порядок и правда изменился: перестановка
      // узла — это удаление и вставка, а вместе с ними потеря фокуса.
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
    });
    for (const [id, li] of nodes) {
      if (seen.has(id)) continue;
      li.remove();
      nodes.delete(id);
    }

    sumValue.textContent = money(state.total);
    brow.textContent = state.isEmpty
      ? 'Пока пусто'
      : `${state.count} ${plural(state.count, 'напиток', 'напитка', 'напитков')}`;

    list.hidden = state.isEmpty;
    empty.hidden = !state.isEmpty;
    foot.hidden = state.isEmpty;
    // Кнопка оформления не должна вести в никуда, если checkout.js не загрузился.
    goCheckout.hidden = !views.has('checkout');
    clearBtn.hidden = state.isEmpty;

    // storageWorks() может испортиться и после старта — кончилась квота.
    note.hidden = CART.storageWorks();

    syncBar();

    /* Удалённая строка уносит фокус на <body>, а оттуда Tab уходит на
       страницу под затемнением. Возвращаем фокус в панель поимённо. */
    if (isOpen() && !panel.contains(document.activeElement)) {
      focusInto(views.get(current) || view);
    }
  };

  CART.subscribe(paint);

  /* Второй проход после разбора страницы: на момент подписки checkout.js
     ещё не выполнился, и кнопка оформления скрылась бы навсегда. */
  const settle = () => paint(CART.snapshot());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle);
  else settle();

  /* ── Связи со страницей ─────────────────────────────────── */

  const trigger = document.getElementById('cart-btn');
  if (trigger) trigger.addEventListener('click', () => open('cart'));

  /* «Собрать заказ» в первом экране вела на «#» — то есть в начало той же
     страницы. Это тупик ровно на главном пути (SC-003). Обработчик стоит
     здесь, а не в разметке хиро: первый экран по границам задачи не
     правится, а отменяется эта строка удалением четырёх строк. */
  const heroCta = document.querySelector('.footline .cta[href="#"]');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = document.getElementById('menu');
      if (menu) menu.scrollIntoView({ behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /* ── Наружу ─────────────────────────────────────────────
     Ровно то, что нужно checkout.js: встроить свои виды, переключить вид,
     закрыть панель — и общие мелочи (шапка, деньги, склонение), чтобы
     второй файл не заводил их копию. */
  window.MidovCartPanel = {
    open,
    close,
    toggle: () => (isOpen() ? close() : open('cart')),
    isOpen,
    addView,
    show,
    onShow,
    has: (name) => views.has(name),
    current: () => current,
    head,
    arrow,
    money,
    plural,
    nameOf,
    focusInto
  };
})();
