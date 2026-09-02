/* MIDOV · Два вида одной страницы ──────────────────────────
   Заказчик попросил меню «отдельной вкладкой». Отдельного файла у демо
   быть не может: оно уходит одним артефактом, куда второй html положить
   некуда. Поэтому вкладка — это вид: лендинг и меню сменяют друг друга в
   одном документе, а адрес меняется через history.pushState('#menu').
   Кнопка «назад» в браузере от этого работает сама, и ссылку на меню
   можно переслать — по ней сразу откроется меню.

   Файл подключён в <head>, а не в конце страницы, и это главное в нём.
   Вид ставится атрибутом data-view на <html> до того, как разобран <body>:
   поставь его позже — гость, пришедший сразу по #menu, увидел бы вспышку
   лендинга, потому что тот успел бы отрисоваться. По той же причине здесь
   нет ни одного обращения к DOM: на момент выполнения тела страницы ещё
   нет. Всё, что требует разметки, ждёт DOMContentLoaded.

   Без JavaScript атрибута нет вовсе, и это осмысленное состояние:
   виден лендинг с приманками и ценами, меню на весь экран скрыто. */
(() => {
  'use strict';

  const HASH = '#menu';
  const root = document.documentElement;
  const isMenu = () => location.hash === HASH;

  root.dataset.view = isMenu() ? 'menu' : 'site';

  /* ── Ролик первого экрана ────────────────────────────────
     Всплеск и петля весят 3,5 МБ, и оба <video> стоят с preload="auto" —
     браузер тянет их сразу, ещё до всякого скрипта. Гостю, пришедшему по
     ссылке прямо в меню, первый экран не показывается вообще, и эти
     мегабайты уходят в никуда на сотовой сети (принцип IV).

     Разметку первого экрана и hero.js по границам задачи трогать нельзя,
     поэтому ролик усыпляется снаружи — тремя приёмами, и каждый из них
     появился после замера.

     1) play() на прототипе становится пустышкой, а те элементы, которым
        его всё-таки вызвали, запоминаются: проснувшись, ролик обязан
        поехать ровно там, где его собирался запустить hero.js. Через
        прототип, а не через сами элементы, потому что hero.js выполняется
        во время разбора страницы — ловить каждый <video> по факту
        появления значило бы участвовать в гонке, которую можно проиграть.

     2) источник подменяется на пустой data:-адрес. Сначала здесь стояло
        preload="none" плюс load(), и замер показал 1852 КБ и 1549 КБ —
        оба файла скачались целиком: load() начинает выбор источника
        заново, и preload="none" его не удержал. Пустой data:-адрес
        обрывает закачку и сети не касается вовсе, а <source> остаётся в
        разметке нетронутым — hero.js читает адрес петли именно оттуда.

     3) подмена делается из MutationObserver, а не из события loadstart.
        На loadstart тоже стоит перехват, но одного его мало: с локального
        сервера файл успевал прийти целиком раньше, чем событие дошло до
        обработчика, и замер снова показывал полные 1852 КБ. Наблюдатель
        же получает <video> в тот же микрозадачный проход, в котором тот
        вставлен, — то есть до того, как браузер вообще выберет источник.
        loadstart остался страховкой на случай, когда источник назначают
        позже скриптом: так делает сам hero.js со вторым слоем сцены.

     Ключ ко всему — обратимость: wake() возвращает прототипу настоящий
     play(), ставит на место прежний источник и запускает ровно те ролики,
     которые собирался запустить hero.js. При prefers-reduced-motion он не
     собирался запускать ни одного — тогда и wake() не запустит. */
  let wake = null;
  if (root.dataset.view === 'menu' && window.HTMLMediaElement && window.MutationObserver) {
    const STUB = 'data:video/mp4,';
    const realPlay = HTMLMediaElement.prototype.play;
    const asleep = new Map();   // элемент → адрес, который ему вернут
    const wanted = new Set();   // кому hero.js вызвал play()

    HTMLMediaElement.prototype.play = function () {
      wanted.add(this);
      return Promise.resolve();
    };

    const hush = (v) => {
      const cur = v.getAttribute('src');
      if (cur === STUB) return;
      /* Запоминается последний настоящий адрес: у переднего слоя сцены на
         момент вставки его нет вовсе, а появляется он позже из hero.js. */
      if (cur !== null || !asleep.has(v)) asleep.set(v, cur);
      v.src = STUB;
    };

    const catchAll = (node) => {
      if (node instanceof HTMLMediaElement) hush(node);
      else if (node.querySelectorAll) node.querySelectorAll('video, audio').forEach(hush);
    };

    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') hush(r.target);
        else for (const node of r.addedNodes) catchAll(node);
      }
    });
    /* Атрибуты наблюдаются наравне со вставкой узлов: hero.js назначает
       адрес переднему слою сцены уже готовому элементу, и без этого он
       успевал скачать всплеск целиком. */
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    /* Слушатель на window в фазе перехвата: loadstart не всплывает, но
       перехват проходит сверху вниз через всех предков цели. */
    const onLoadStart = (e) => {
      if (e.target instanceof HTMLMediaElement) hush(e.target);
    };
    addEventListener('loadstart', onLoadStart, true);

    wake = () => {
      mo.disconnect();
      removeEventListener('loadstart', onLoadStart, true);
      HTMLMediaElement.prototype.play = realPlay;
      for (const [v, src] of asleep) {
        if (src === null) v.removeAttribute('src'); else v.setAttribute('src', src);
        v.load();
      }
      for (const v of wanted) realPlay.call(v).catch(() => {});
      asleep.clear();
      wanted.clear();
    };
  }

  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  ready(() => {
    const menuView = document.getElementById('menu-view');
    if (!menuView) return;

    const heading = menuView.querySelector('h1');
    const backTo = document.querySelector('.nav a[href="' + HASH + '"]');

    /* Прокрутка каждого вида своя. Уйти в меню с середины лендинга и
       вернуться в его начало — потеря места, которую гость не просил. */
    let siteY = 0;
    let menuY = 0;

    /* Правда ли, что наш pushState — верхняя запись истории. Если да,
       «Назад» обязан быть настоящим шагом назад, а не новой записью:
       иначе кнопка браузера начнёт водить по кругу. Если гость пришёл
       сразу по #menu, шагать назад некуда — там чужая страница. */
    let pushed = false;

    const apply = (next) => {
      if (root.dataset.view === next) return;
      if (root.dataset.view === 'site') siteY = window.scrollY;
      else menuY = window.scrollY;

      root.dataset.view = next;
      if (next === 'site' && wake) { wake(); wake = null; }

      window.scrollTo(0, next === 'site' ? siteY : menuY);

      /* Фокус переезжает вместе с видом: смена вида — это смена страницы,
         и оставлять курсор клавиатуры на исчезнувшей кнопке нельзя.
         preventScroll обязателен — иначе фокус отменит scrollTo выше. */
      const target = next === 'menu' ? heading : backTo;
      if (target) target.focus({ preventScroll: true });
    };

    const toMenu = () => {
      if (root.dataset.view === 'menu') return;
      /* Положение лендинга уезжает в саму историю: после перезагрузки
         из меню кнопка «назад» вернёт гостя туда, где он читал. */
      history.replaceState({ view: 'site', y: window.scrollY }, '');
      history.pushState({ view: 'menu' }, '', HASH);
      pushed = true;
      apply('menu');
    };

    const toSite = () => {
      if (root.dataset.view === 'site') return;
      if (pushed) { history.back(); return; }   // вид переключит popstate
      history.replaceState({ view: 'site' }, '', location.pathname + location.search);
      apply('site');
    };

    const onPop = () => {
      const next = isMenu() ? 'menu' : 'site';
      if (next === 'site') {
        pushed = false;
        const y = history.state && typeof history.state.y === 'number' ? history.state.y : siteY;
        siteY = y;
      }
      apply(next);
    };

    addEventListener('popstate', onPop);
    /* hashchange — на случай, когда адрес правят руками в строке браузера.
       На pushState он не срабатывает, поэтому двойного вызова нет, а apply
       всё равно ничего не делает, если вид уже нужный. */
    addEventListener('hashchange', onPop);

    /* Один делегат на всю страницу вместо обхода ссылок: «Меню» стоит и в
       шапке, и в подвале, а кнопка «Всё меню» появляется из скрипта позже
       любого обхода. */
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = e.target.closest('a[href="' + HASH + '"], [data-go]');
      if (!el) return;
      const where = el.dataset.go || 'menu';
      if (where !== 'menu' && where !== 'site') return;
      e.preventDefault();
      if (where === 'menu') toMenu(); else toSite();
    });

    /* Корзину открывает та же кнопка первого экрана: панель подписана на
       #cart-btn по id, и второй id на странице был бы недопустим, а второй
       обработчик — второй правдой о том, что значит «открыть корзину». */
    const mvCart = document.getElementById('mv-cart-btn');
    const cartBtn = document.getElementById('cart-btn');
    if (mvCart && cartBtn) mvCart.addEventListener('click', () => cartBtn.click());

    /* Счётчик в шапке меню — обязательный отклик на добавление: карточка
       подсвечивается на месте нажатия, а число растёт наверху. */
    const CART = window.MidovCart;
    const count = document.getElementById('mv-cart-count');
    if (CART && count) {
      const paint = () => { count.textContent = String(CART.count()); };
      if (CART.subscribe) CART.subscribe(paint);
      paint();
    }

    /* Прямой заход по #menu: браузер пытается доскроллить до якоря, а
       якорь #menu — это укороченный раздел лендинга, который сейчас
       скрыт. Ставим начало явно. */
    if (root.dataset.view === 'menu') window.scrollTo(0, 0);
    if (!history.state || !history.state.view) history.replaceState({ view: root.dataset.view }, '');
  });
})();
