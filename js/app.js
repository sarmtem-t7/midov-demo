/* Связывание страницы с модулями: выбор точки, живой статус, счётчик
   корзины. Сами модули (shops.js, cart.js) о разметке не знают ничего —
   вся работа с DOM собрана здесь. */
(() => {
  const S = window.MidovShops;
  if (!S) return;

  const btn   = document.getElementById('shop-btn');
  const list  = document.getElementById('shop-list');
  const addr  = document.getElementById('shop-addr');
  const stext = document.getElementById('status-text');
  const dot   = document.querySelector('.status__dot');
  const status = document.querySelector('.status');
  const hero  = document.querySelector('.hero');

  /* ── Список точек ──────────────────────────────────────
     Часы показываем только у подтверждённых: у двух точек их нет,
     и придумывать нельзя (принцип I). */
  const renderList = () => {
    const cur = S.selected();
    list.innerHTML = '';
    for (const shop of S.list()) {
      const li = document.createElement('span');
      li.style.display = 'block';
      const b  = document.createElement('button');
      b.type = 'button';
      b.className = 'picker__opt';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-current', String(shop.id === (cur && cur.id)));
      b.dataset.id = shop.id;

      const a = document.createElement('span');
      a.className = 'picker__opt-addr';
      a.textContent = shop.address;
      b.append(a);

      if (shop.flagship) {
        const f = document.createElement('span');
        f.className = 'picker__opt-flag';
        f.textContent = 'Флагман';
        b.append(f);
      }
      const h = document.createElement('span');
      h.className = 'picker__opt-hours';
      h.textContent = S.hoursKnown(shop)
        ? `${S.formatTime(shop.opens)}—${S.formatTime(shop.closes)}`
        : '';
      b.append(h);

      b.addEventListener('click', () => { S.select(shop.id); close(); btn.focus(); });
      li.append(b);
      list.append(li);
    }
  };

  /* Список выравнивается по кнопке, а кнопка гуляет по строке вслед за
     длиной адреса. На узком экране это выносит список за край, поэтому
     после раскрытия двигаем его обратно в окно с отступом в 12px. */
  const clampIntoView = () => {
    list.style.left = '50%';
    list.style.translate = '-50% 0';
    const r = list.getBoundingClientRect();
    const pad = 12;
    let shift = 0;
    if (r.right > innerWidth - pad) shift = innerWidth - pad - r.right;
    if (r.left + shift < pad) shift = pad - r.left;
    if (shift) list.style.translate = `calc(-50% + ${Math.round(shift)}px) 0`;
  };

  /* ── Раскрытие ─────────────────────────────────────────
     Класс на .hero поднимает слой заголовка над сценой и зерном:
     без него список уезжает под них (см. комментарий в стилях). */
  const open = () => {
    renderList();
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    hero.classList.add('picker-open');
    clampIntoView();
    const first = list.querySelector('[aria-current="true"]') || list.querySelector('button');
    // preventScroll обязателен: список висит у края, и обычный focus()
    // прокручивал бы страницу вбок, утаскивая за собой всю шапку.
    if (first) first.focus({ preventScroll: true });
  };
  const close = () => {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    hero.classList.remove('picker-open');
  };
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';

  btn.addEventListener('click', () => (isOpen() ? close() : open()));

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { close(); btn.focus(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    // Стрелки водят по списку — иначе с клавиатуры выбор недостижим.
    const opts = [...list.querySelectorAll('button')];
    const i = opts.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
    opts[(next + opts.length) % opts.length].focus();
  });

  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !e.target.closest('.picker')) close();
  });

  /* ── Отрисовка выбранного ──────────────────────────────
     Точка без подтверждённых часов не получает статус вообще: строка
     прячется целиком, а не показывает пустоту или прочерк. */
  const paint = () => {
    const shop = S.selected();
    if (!shop) return;
    addr.textContent = shop.address;

    const st = S.status(shop, new Date());
    if (!st.known) {
      status.hidden = true;
      return;
    }
    status.hidden = false;
    stext.textContent = st.text;
    dot.style.background = st.open ? 'var(--ochre)' : 'var(--ink-soft)';
  };

  /* ── Рейтинг и завтраки под выбранной точкой ───────────
     Здесь стояло «5,0 · 78 отзывов · завтраки весь день» на всю сеть.
     И то и другое неверно: 5,0/78 — это флагман, у Пр. Мира 4,7 при 39;
     а завтраки целый день только на Революции и Гастелло, у остальных
     четырёх их нет. Владелец знает это про каждую свою точку. */
  const score = document.getElementById('proof-score');
  const ptext = document.getElementById('proof-text');
  const proof = document.querySelector('.proof');

  const paintProof = () => {
    const shop = S.selected();
    if (!shop || !score || !ptext) return;

    // Точка без рейтинга не получает придуманного: скрываем цифру целиком.
    const has = typeof shop.rating === 'number' && typeof shop.ratingCount === 'number';
    score.hidden = !has;
    if (has) {
      // toFixed(1), а не String(): 5.0 превращается в строку «5»,
      // и главная цифра экрана теряет десятую долю.
      score.innerHTML = shop.rating.toFixed(1).replace('.', ',') +
        '<span class="proof__star" aria-hidden="true">★</span>';
    }

    const parts = [];
    if (has) parts.push(`${shop.ratingCount} ${plural(shop.ratingCount)} в 2ГИС.`);
    parts.push('Своя обжарка.');
    if (shop.breakfastAllDay) parts.push('Завтраки целый день.');
    ptext.innerHTML = parts.join('<br>');
    if (proof) proof.setAttribute('aria-label',
      has ? `Рейтинг ${shop.rating} по ${shop.ratingCount} оценкам в 2ГИС` : 'Своя обжарка');
  };

  /* Русское склонение: 1 оценка, 2 оценки, 5 оценок. Числа приходят
     из 2ГИС и меняются, поэтому подпись не может быть зашита. */
  function plural(n) {
    const d10 = n % 10, d100 = n % 100;
    if (d10 === 1 && d100 !== 11) return 'оценка';
    if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return 'оценки';
    return 'оценок';
  }

  S.subscribe(() => { paint(); paintProof(); });
  paint();
  paintProof();
  // Раз в минуту: гость может открыть страницу за минуту до закрытия,
  // и статус обязан смениться сам, без перезагрузки.
  setInterval(paint, 60000);

  /* ── Счётчик корзины ───────────────────────────────────
     Корзина подключается позже; пока её нет — счётчик молчит на нуле,
     а не роняет страницу. */
  const C = window.MidovCart;
  const count = document.getElementById('cart-count');
  if (C && count) {
    const paintCount = () => { count.textContent = String(C.count()); };
    if (C.subscribe) C.subscribe(paintCount);
    paintCount();
  }
})();
