/* MIDOV · Оформление и подтверждение ──────────────────────────
   Два вида той же панели, что и заказ: «Оформление» и «Заказ собран».
   Оба встраиваются в неё через MidovCartPanel.addView — гость не уходит
   со страницы и всё время видит одно окно, а не три разных экрана.

   Ни одного сетевого вызова здесь нет и быть не может (FR-011, граница
   демо из конституции): ни fetch, ни XHR, ни атрибута action. Форма есть —
   ради Enter в поле и правильного озвучивания, — но её отправку снимает
   первая же строка обработчика. Вся «серверная часть» этого заказа —
   сама страница.

   Числа снова не считаются здесь: состав и сумма берутся снимком из
   window.MidovCart в момент подтверждения. Урок T021 — вторая копия
   расходится с первой молча, и обе проверяют сами себя.

   Точки берутся из window.MidovShops, а не переписываются рядом: часы двух
   точек не подтверждены источником, и решение «показывать или молчать»
   должно приниматься в одном месте (принцип I).

   Подключать строго после cart-panel.js. */
(() => {
  'use strict';

  const CART = window.MidovCart;
  const PANEL = window.MidovCartPanel;
  const SHOPS = window.MidovShops;
  /* Без панели видам некуда встраиваться, без корзины — нечего оформлять.
     Молча ничего не делаем: кнопка «Оформить» в панели сама прячется,
     если этот файл не выполнился. */
  if (!CART || !PANEL) return;

  const { head, arrow, money, plural, nameOf, show } = PANEL;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  /* ── Поле ввода ───────────────────────────────────────────
     Ошибка живёт у поля, а не общим списком наверху: общий список гость
     читает один раз и потом ищет, к чему он относился. Связь держится
     через aria-describedby, поэтому голосом ошибка читается вместе с
     подписью поля — в тот момент, когда фокус на него и встал. */
  let seq = 0;
  const field = (opts) => {
    const id = `midov-f${++seq}`;
    const box = el('div', 'field');

    const label = el('label', 'field__label', opts.label);
    label.htmlFor = id;

    const input = el('input', 'field__input');
    input.id = id;
    input.type = opts.type || 'text';
    if (opts.inputmode) input.inputMode = opts.inputmode;
    if (opts.autocomplete) input.autocomplete = opts.autocomplete;
    if (opts.placeholder) input.placeholder = opts.placeholder;

    const err = el('p', 'field__error');
    err.id = `${id}-err`;
    err.hidden = true;

    box.append(label, input);
    if (opts.hint) box.append(el('p', 'field__hint', opts.hint));
    box.append(err);

    const f = { box, input, err };
    /* Ошибка снимается на первом же нажатии клавиши: подпись, которая
       держится, пока гость не нажмёт кнопку ещё раз, читается как
       поломка, а не как подсказка. */
    input.addEventListener('input', () => setError(f, ''));
    return f;
  };

  const setError = (f, text) => {
    const has = !!text;
    f.err.textContent = text || '';
    f.err.hidden = !has;
    f.box.classList.toggle('field--bad', has);
    if (has) {
      f.input.setAttribute('aria-invalid', 'true');
      f.input.setAttribute('aria-describedby', f.err.id);
    } else {
      f.input.removeAttribute('aria-invalid');
      f.input.removeAttribute('aria-describedby');
    }
  };

  /* ── Вид «Оформление» ─────────────────────────────────────── */

  const view = el('section');
  const viewHead = head({
    eyebrow: '',
    title: 'Оформление',
    back: { label: 'Заказ', to: 'cart' }
  });
  const brow = viewHead.querySelector('[data-brow]');

  /* Форма без action намеренно: форма без него отправляется на адрес самой
     страницы, то есть уходит настоящий запрос. Отправку снимаем ниже
     первой строкой обработчика, novalidate — чтобы ошибки показывал этот
     файл у поля, а не браузер всплывающим пузырём поверх панели. */
  const form = el('form', 'sheet__form');
  form.noValidate = true;

  const body = el('div', 'sheet__body');

  /* ── Точка ─────────────────────────────────────────────────
     Список настоящих radio, а не кнопок с aria-checked: группа сама
     получает стрелки, один Tab на всю группу и правильное озвучивание.
     Тот же приём, что у выбора объёма в меню. */
  const shopBox = el('div', 'field');
  shopBox.append(el('span', 'field__label', 'Куда прийти'));

  const shopGroup = el('div', 'choice');
  shopGroup.setAttribute('role', 'radiogroup');
  shopGroup.setAttribute('aria-label', 'Кофейня');

  const shopList = SHOPS ? SHOPS.list() : [];
  const shopInputs = [];

  shopList.forEach((shop) => {
    const opt = el('label', 'choice__opt');

    const input = el('input', 'choice__input');
    input.type = 'radio';
    input.name = 'midov-shop';
    input.value = shop.id;

    const face = el('span', 'choice__face');
    face.append(el('span', 'choice__name', shop.address));
    /* Часы двух точек источником не подтверждены. Прочерк или выдуманное
       «09:00—22:00» одинаково плохи, поэтому вместо часов честная просьба
       (принцип I). */
    face.append(el('span', 'choice__meta', SHOPS.hoursKnown(shop)
      ? `${SHOPS.formatTime(shop.opens)}—${SHOPS.formatTime(shop.closes)}`
      : 'часы уточняйте'));

    opt.append(input, face);
    shopGroup.append(opt);
    shopInputs.push(input);

    /* Выбор точки здесь двигает и выбор точки в шапке: адрес, часы и
       живой статус наверху обязаны говорить о той же кофейне, куда гость
       собрался прийти, иначе страница спорит сама с собой. */
    input.addEventListener('change', () => {
      if (input.checked && SHOPS) SHOPS.select(shop.id);
    });
  });

  /* ── Список сворачивается ───────────────────────────────────
     Шесть точек занимали почти весь экран телефона, и поля имени
     с телефоном — то, ради чего экран и открыт, — уезжали под сгиб.
     А список тут вдвойне лишний: точка уже выбрана в шапке.

     Поэтому по умолчанию видна одна строка с выбранной кофейней и
     кнопкой «сменить». Разворот — обычный details, он работает без
     скрипта и озвучивается как раскрывающийся список. */
  const fold = el('details', 'choice-fold');
  const sum = el('summary', 'choice-fold__head');
  const sumName = el('span', 'choice-fold__name');
  const sumHint = el('span', 'choice-fold__hint', 'сменить');
  sum.append(sumName, sumHint);
  fold.append(sum, shopGroup);
  shopBox.append(fold);

  const paintFold = () => {
    const at = shopInputs.findIndex((i) => i.checked);
    const shop = at === -1 ? null : shopList[at];
    sumName.textContent = shop ? shop.address : 'Выберите кофейню';
  };
  shopInputs.forEach((i) => i.addEventListener('change', () => {
    paintFold();
    // Выбрал — список сворачивается сам: держать его открытым незачем.
    fold.open = false;
  }));

  const shopErr = el('p', 'field__error');
  shopErr.hidden = true;
  shopBox.append(shopErr);

  const chosenShop = () => {
    const at = shopInputs.findIndex((i) => i.checked);
    return at === -1 ? null : shopList[at];
  };

  const syncShop = () => {
    const cur = SHOPS && SHOPS.selected();
    if (!cur) return;
    shopInputs.forEach((i) => { i.checked = i.value === cur.id; });
    // Свёрнутая строка обязана следовать за выбором: иначе она показывает
    // «Выберите кофейню» при уже выбранной точке.
    paintFold();
  };
  if (SHOPS) SHOPS.subscribe(syncShop); // подписчик получает текущую точку сразу

  /* ── Время ─────────────────────────────────────────────────
     Две кнопки, а не сразу поле времени: «как можно скорее» — то, что
     выбирают почти всегда, и заставлять ради этого назначать час значит
     ставить препятствие на главном пути. */
  const whenBox = el('div', 'field');
  whenBox.append(el('span', 'field__label', 'Когда забрать'));

  const whenGroup = el('div', 'choice choice--row');
  whenGroup.setAttribute('role', 'radiogroup');
  whenGroup.setAttribute('aria-label', 'Когда забрать');

  const whenInputs = [];
  [['asap', 'Как можно скорее'], ['at', 'Ко времени']].forEach(([value, caption], i) => {
    const opt = el('label', 'choice__opt');
    const input = el('input', 'choice__input');
    input.type = 'radio';
    input.name = 'midov-when';
    input.value = value;
    input.checked = i === 0;
    const face = el('span', 'choice__face');
    face.append(el('span', 'choice__name', caption));
    opt.append(input, face);
    whenGroup.append(opt);
    whenInputs.push(input);
  });

  whenBox.append(whenGroup);

  const timeF = field({ label: 'Время', type: 'time' });
  timeF.box.classList.add('field--sub');
  timeF.box.hidden = true;
  whenBox.append(timeF.box);

  const whenMode = () => (whenInputs[1].checked ? 'at' : 'asap');

  whenInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const at = whenMode() === 'at';
      timeF.box.hidden = !at;
      if (!at) setError(timeF, '');
      // Поле появилось по нажатию — фокус переезжает в него, иначе гость
      // нажал «ко времени» и не понял, что делать дальше.
      if (at) timeF.input.focus({ preventScroll: true });
    });
  });

  /* ── Имя и телефон ─────────────────────────────────────────
     Обязателен только телефон (сценарий 4). Имя — вежливость, и требовать
     его значило бы придумать правило, которого у кофейни нет. */
  const nameF = field({
    label: 'Имя',
    autocomplete: 'given-name',
    hint: 'Необязательно — как к вам обратиться'
  });

  const phoneF = field({
    label: 'Телефон',
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel',
    placeholder: '+7'
  });

  body.append(shopBox, whenBox, nameF.box, phoneF.box);

  /* ── Подвал вида ───────────────────────────────────────── */

  const foot = el('footer', 'sheet__foot');
  const sumRow = el('div', 'sheet__sum');
  const sumValue = el('strong', 'sheet__sum-value', money(0));
  sumRow.append(el('span', 'sheet__sum-label', 'К оплате на месте'), sumValue);

  const submitBtn = el('button', 'cta sheet__go');
  submitBtn.type = 'submit';
  submitBtn.append(el('span', null, 'Подтвердить заказ'), arrow());

  foot.append(sumRow, submitBtn);

  form.append(body, foot);
  view.append(viewHead, form);
  PANEL.addView('checkout', view);

  /* Сумма и счётчик в шапке вида обновляются при каждом показе, а не по
     подписке: заказ при открытом оформлении не меняется, а лишний
     подписчик — лишний способ разойтись. */
  PANEL.onShow('checkout', () => {
    const s = CART.snapshot();
    sumValue.textContent = money(s.total);
    brow.textContent = `${s.count} ${plural(s.count, 'напиток', 'напитка', 'напитков')} · ${money(s.total)}`;
    syncShop();
  });

  /* ── Проверка полей ─────────────────────────────────────── */

  const digitsIn = (s) => (s.match(/\d/g) || []).length;

  const minutesOf = (value) => {
    const m = /^(\d{2}):(\d{2})$/.exec(value || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };

  const validate = () => {
    setError(timeF, '');
    setError(nameF, '');
    setError(phoneF, '');
    shopErr.hidden = true;

    let first = null;
    const fail = (node) => { if (!first) first = node; };

    const shop = chosenShop();
    if (!shop) {
      shopErr.textContent = 'Выберите кофейню, в которую прийти.';
      shopErr.hidden = false;
      fail(shopInputs[0] || null);
    }

    if (whenMode() === 'at') {
      const minutes = minutesOf(timeF.input.value);
      if (minutes === null) {
        setError(timeF, 'Укажите время или выберите «как можно скорее».');
        fail(timeF.input);
      } else if (shop && SHOPS && SHOPS.hoursKnown(shop) &&
                 (minutes < shop.opens || minutes > shop.closes)) {
        /* Сравнение простое, без перехода через полночь: ни одна из шести
           точек ночью не работает, и все закрываются в тот же день. */
        setError(timeF, `В это время точка закрыта — она работает ${SHOPS.formatTime(shop.opens)}—${SHOPS.formatTime(shop.closes)}.`);
        fail(timeF.input);
      }
    }

    /* Телефон — единственное обязательное поле. Десять цифр, а не маска:
       гость пишет номер как привык (+7, 8, через скобки), и маска здесь
       спорила бы с ним ради красоты. */
    const phone = phoneF.input.value.trim();
    if (!phone) {
      setError(phoneF, 'Без телефона заказ не оформить.');
      fail(phoneF.input);
    } else if (digitsIn(phone) < 10) {
      setError(phoneF, 'В номере не хватает цифр — нужно не меньше десяти.');
      fail(phoneF.input);
    }

    return first;
  };

  /* ── Вид «Заказ собран» ─────────────────────────────────── */

  const doneView = el('section');
  const doneHead = head({ eyebrow: '', title: 'Заказ собран', focusTitle: true });
  const doneBrow = doneHead.querySelector('[data-brow]');
  const doneBody = el('div', 'sheet__body');

  const doneFoot = el('footer', 'sheet__foot');
  const doneBtn = el('button', 'cta sheet__go');
  doneBtn.type = 'button';
  doneBtn.append(el('span', null, 'Готово'), arrow());
  doneBtn.addEventListener('click', () => PANEL.close());
  doneFoot.append(doneBtn);

  doneView.append(doneHead, doneBody, doneFoot);
  PANEL.addView('done', doneView);

  const row = (label, value) => {
    const node = el('div', 'ticket__row');
    node.append(el('span', null, label), el('strong', null, value));
    return node;
  };

  const renderDone = (order) => {
    doneBody.textContent = '';
    doneBrow.textContent = `Заказ ${order.no}`;

    /* Честно и без извинений: это витрина возможностей, и она не притворяется
       рабочей кассой. Строка стоит первой, чтобы не выглядеть сноской, которую
       спрятали под чек. */
    doneBody.append(el('p', 'sheet__note',
      'Это витрина: заказ никуда не отправлен и нигде не сохранён. Всё, что вы сейчас прошли, работает прямо на этой странице.'));

    /* ── Чек ── */
    const ticket = el('div', 'ticket');
    const noRow = el('div', 'ticket__row');
    noRow.append(el('span', null, 'Номер'), el('strong', 'ticket__no', order.no));
    ticket.append(noRow, el('div', 'hairline'));

    const lines = el('ul', 'ticket__lines');
    order.state.lines.forEach((line) => {
      const li = el('li', 'ticket__line');
      const label = nameOf(line);
      li.append(el('span', 'ticket__line-name', line.qty > 1 ? `${label} × ${line.qty}` : label));
      li.append(el('span', 'ticket__line-sum', money(line.sum)));
      lines.append(li);
    });
    ticket.append(lines, el('div', 'hairline'));

    const total = el('div', 'ticket__row');
    total.append(el('span', null, 'Итого'), el('strong', 'ticket__total', money(order.state.total)));
    ticket.append(total);
    doneBody.append(ticket);

    /* ── Куда прийти ── */
    const place = el('div', 'ticket');
    place.append(el('p', 'eyebrow', 'Куда прийти'));
    if (order.shop) {
      place.append(el('h3', 'ticket__addr', order.shop.address));
      if (SHOPS && SHOPS.hoursKnown(order.shop)) {
        place.append(el('p', 'ticket__meta',
          `Работает ${SHOPS.formatTime(order.shop.opens)}—${SHOPS.formatTime(order.shop.closes)}`));
      }
      place.append(el('p', 'ticket__meta', order.when));
      if (order.shop.gis) {
        const link = el('a', 'cta ticket__map');
        link.href = order.shop.gis;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.append(el('span', null, 'Открыть в 2ГИС'), arrow());
        place.append(link);
      }
    }
    doneBody.append(place);

    /* ── Кто ── */
    const who = el('div', 'ticket');
    who.append(el('p', 'eyebrow', 'Заказ на имя'));
    if (order.name) who.append(row('Имя', order.name));
    who.append(row('Телефон', order.phone));
    doneBody.append(who);
  };

  /* Номер заказа собирается из дня месяца и трёх цифр: он должен выглядеть
     как настоящий номер и не повторяться в пределах вечера, а больше от
     него здесь ничего не требуется — очереди, которую он занимал бы, нет. */
  const orderNo = () => {
    const day = String(new Date().getDate()).padStart(2, '0');
    const tail = String(Math.floor(Math.random() * 900) + 100);
    return `MD-${day}${tail}`;
  };

  /* ── Подтверждение ──────────────────────────────────────── */

  form.addEventListener('submit', (e) => {
    /* Первая строка и есть весь запрет отправки (FR-011). Всё остальное —
       ниже, чтобы никакая ошибка в проверке полей не успела пропустить
       форму в браузер. */
    e.preventDefault();

    const bad = validate();
    if (bad) {
      /* Фокус переезжает на первое неверное поле, а не просто подсвечивает
         его: вместе с фокусом голосом читается и подпись, и ошибка. */
      bad.focus({ preventScroll: false });
      return;
    }

    const state = CART.snapshot();
    if (state.isEmpty) { show('cart'); return; } // оформлять нечего — назад к заказу

    const order = {
      no: orderNo(),
      state,
      shop: chosenShop(),
      when: whenMode() === 'at' ? `Ко времени: ${timeF.input.value}` : 'Как можно скорее',
      name: nameF.input.value.trim(),
      phone: phoneF.input.value.trim()
    };

    renderDone(order);
    show('done');
    /* Заказ очищается после показа, а не до: на экране уже стоит снимок,
       снятый до очистки, а счётчик в шапке возвращается к нулю — так
       завершённый заказ и выглядит. */
    CART.clear();
  });
})();
