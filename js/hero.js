/* Сцена первого экрана: всплеск отыгрывает один раз, затем его подхватывает
   петля с еле заметным покачиванием.

   Слоёв два: задний и передний с окном по стакану — за счёт этого текст
   уходит за предмет. Оба слоя обязаны показывать один и тот же кадр, иначе
   в окне проглядывает чужая картинка. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const scenes = [...document.querySelectorAll('.scene')];
  const splash = scenes.map((s) => s.querySelector('.scene__video--splash'));
  const idle   = scenes.map((s) => s.querySelector('.scene__video--idle'));

  /* Передний слой берёт источник у заднего: так гарантировано, что оба
     слоя проигрывают ровно один файл и совмещаются точка в точку. */
  const backSplash = splash[0];
  const backIdle = idle[0];
  const srcOf = (v) => {
    const s = v && v.querySelector('source');
    return s ? s.src : (v ? v.src : '');
  };
  for (let i = 1; i < splash.length; i++) {
    if (splash[i] && backSplash) {
      splash[i].poster = backSplash.poster;
      splash[i].src = srcOf(backSplash);
    }
    // Петлю подставляем так же: два <source> на один файл удваивают вес.
    if (idle[i] && backIdle) idle[i].src = srcOf(backIdle);
  }

  /* ── Вертикальные ролики для телефона ───────────────────────
     Кадр 16:9 на портретном экране либо режется до гигантского стакана,
     либо оставляет пустые поля. Поэтому для узких экранов снят отдельный
     вертикальный ролик — та же сцена, но скомпонованная под вертикаль.
     Подменяем источник ДО загрузки, иначе браузер успеет скачать
     горизонтальный, и мы заплатим трафиком дважды. */
  const narrow = matchMedia('(max-width: 680px)').matches;
  if (narrow) {
    /* На телефоне один ролик вместо двух. Он снят так, что движение не
       затухает, поэтому делить сцену на «всплеск» и «анимацию» незачем:
       ролик идёт вперёд-назад и замыкается сам на себе (стык 0,2%).
       Второй файл при этом не грузится вовсе — экономия трафика там,
       где он дороже всего. */
    for (const v of splash) {
      if (!v) continue;
      const src = v.querySelector('source');
      if (src && src.dataset.srcV) src.src = src.dataset.srcV;
      if (v.dataset.posterV) v.poster = v.dataset.posterV;
      v.loop = true;
      v.load();
    }
    for (const v of idle) if (v) v.remove();
    idle.length = 0;
  }

  const start = () => hero.classList.add('anim');
  if (reduced) start();
  else if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
    setTimeout(start, 1200);
  } else start();

  if (reduced) return;

  const play = (v) => { if (v) v.play().catch(() => {}); };

  /* Ролик скачан целиком — или браузер сам перестал его качать, и ждать
     больше нечего. canplaythrough для этого не годится: это прогноз
     браузера по скорости сети, и на неровной сети он ошибается — всплеск
     вставал и после него. */
  const loaded = (v) => {
    const b = v.buffered;
    if (b.length && b.end(b.length - 1) >= v.duration - 0.15) return true;
    return v.networkState === v.NETWORK_IDLE && v.readyState >= 3;
  };
  const whenLoaded = (v, fn) => {
    if (!v) return;
    const EVENTS = ['loadeddata', 'progress', 'canplaythrough', 'suspend'];
    let done = false;
    const check = () => {
      if (done || !loaded(v)) return;
      done = true;
      EVENTS.forEach((e) => v.removeEventListener(e, check));
      fn();
    };
    EVENTS.forEach((e) => v.addEventListener(e, check));
    check();
  };

  /* Пустить ролик, пока он ещё качается, можно, если сеть явно обгоняет
     воспроизведение: тогда докачка придёт раньше, чем до неё дойдёт кадр.
     Скорость меряем сами — в секундах ролика за секунду времени — и берём
     запас в полтора раза на неровную сеть. Не обгоняет — ждём, пока ролик
     скачается целиком. */
  const whenPlayable = (v, fn) => {
    if (!v) return;
    let first = null;
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      fn();
    };
    const timer = setInterval(() => {
      const b = v.buffered;
      const end = b.length ? b.end(b.length - 1) : 0;
      if (!end) return;
      const now = performance.now();
      if (!first) { first = { now, end }; return; }
      const dt = (now - first.now) / 1000;
      const rate = (end - first.end) / dt;
      if (dt >= 0.4 && end >= 0.75 && rate >= 1.5) go();
    }, 100);
    whenLoaded(v, go);
  };

  /* ── Если автозапуск запрещён ───────────────────────────────
     iOS блокирует автозапуск в режиме энергосбережения и при экономии
     трафика — беззвучное видео тоже. Раньше страница в этом случае
     застывала на постере всплеска, то есть на кадре ДО того, как стакан
     собрался: выглядело сломанным.

     Теперь при отказе сразу показываем конечное состояние — тот же кадр,
     которым сцена и должна закончиться. Гость видит собранную композицию,
     просто без движения. А если он коснётся экрана, движение запустится:
     касание снимает запрет. */
  let swapped = false;
  let blocked = false;
  const giveUp = () => {
    if (blocked || swapped) return;
    blocked = true;
    scenes.forEach((s) => s.classList.add('is-idle', 'is-static'));
  };

  const tryPlay = (v) => {
    if (!v) return;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(giveUp);
  };

  /* Первое касание снимает запрет: пробуем ещё раз, уже с жестом. */
  const onFirstTouch = () => {
    if (!blocked) return;
    blocked = false;
    scenes.forEach((s) => s.classList.remove('is-static'));
    idle.forEach((v) => { if (v) { v.currentTime = 0; tryPlay(v); } });
  };
  addEventListener('pointerdown', onFirstTouch, { once: true, passive: true });

  /* ── Переход на петлю ───────────────────────────────────────
     Петля собрана из хвоста самого всплеска, поэтому её первый кадр
     совпадает с последним кадром всплеска. Подмена мгновенная и без
     наплыва: смешивать одинаковые кадры незачем.

     Петля поедет, только когда скачана целиком, — иначе на медленной сети
     первый виток идёт рывками. До тех пор на её месте стоит постер, то есть
     тот же кадр, на котором остановился всплеск: гость видит собранную
     композицию без движения, а не застрявшее видео. */
  const swap = () => {
    if (swapped || !idle.length) return;
    swapped = true;
    idle.forEach((v) => { if (v) { v.preload = 'auto'; v.currentTime = 0; } });
    whenLoaded(backIdle, () => idle.forEach(play));
    // Если браузер не докачивает ролик, пока тот не запущен, — пускаем как есть.
    setTimeout(() => { if (backIdle && backIdle.paused && !blocked) idle.forEach(play); }, 15000);
    scenes.forEach((s) => s.classList.add('is-idle'));
  };

  if (!idle.length) {
    /* ── Один ролик — телефон ──────────────────────────────────
       Он лёгкий (0,8 Мбит/с) и замкнут сам на себя, поэтому идёт сразу,
       по мере загрузки. play() — тоже сразу, не дожидаясь первого кадра:
       разрешённый запуск снимает паузу немедленно, запрещённый её
       оставляет. Поэтому проверка через две секунды отличает запрет от
       медленной сети. */
    splash.forEach((v) => tryPlay(v));
    setTimeout(() => { if (backSplash && backSplash.paused) giveUp(); }, 2000);
  } else if (!backSplash) {
    swap();
  } else {
    /* ── Всплеск и петля — широкий экран ───────────────────────
       Всплеск запускается, когда сеть заведомо успевает за ним, а если не
       успевает — когда он скачан целиком. Пустив его по мере загрузки без
       оглядки на скорость, мы показывали гостю застревающее видео: с
       публичного адреса файл шёл медленнее, чем играл, и всплеск в 3,9 с
       вставал по 4–7 раз, на 5–9 секунд в сумме. До старта стоит постер —
       первый кадр всплеска, — а затем ролик идёт без остановок.

       Петля начинает качаться только после всплеска, а не наперегонки
       с ним: два файла сразу делили канал пополам, и вставали оба.

       autoplay снимаем здесь, а не в разметке: без скрипта всплеск
       по-прежнему отыграет сам. Со скриптом браузер не должен запустить
       его раньше, чем тот скачается. */
    splash.forEach((v) => { if (v) v.autoplay = false; });
    whenLoaded(backSplash, () => {
      idle.forEach((v) => { if (v) v.preload = 'auto'; });
    });
    whenPlayable(backSplash, () => {
      if (swapped) return;
      splash.forEach((v) => tryPlay(v));
      /* Данные есть, а всплеск стоит — значит, запуск запрещён. Но не на
         скрытой вкладке: там беззвучное видео останавливает сам браузер и
         сам же пускает дальше, когда вкладку откроют. Отказ на этом месте
         оставил бы вернувшемуся гостю застывший кадр. */
      setTimeout(() => {
        if (backSplash.paused && !swapped && !document.hidden) giveUp();
      }, 1500);
    });

    backSplash.addEventListener('ended', swap);
    // Страховка на случай, если 'ended' не придёт: перемотка, сбой декодера.
    backSplash.addEventListener('playing', () => {
      setTimeout(swap, (backSplash.duration + 1.5) * 1000);
    }, { once: true });
    /* Если всплеск не скачался и за 12 с — сеть совсем плохая. Сразу
       к собранной композиции: она важнее вступления. При заходе прямо
       в меню ролики спят до возвращения на лендинг, и отсчёт был бы
       ложным, поэтому там его нет. */
    if (document.documentElement.dataset.view !== 'menu') {
      setTimeout(() => {
        // Петлю могло уже запустить касание — тогда не перематываем её.
        if (backSplash.paused && (!backIdle || backIdle.paused)) swap();
      }, 12000);
    }
  }

  /* ── Слои держатся друг за друга ────────────────────────────
     Слоёв два, и каждый крутит петлю сам по себе. Разойдясь, они дают
     в окне маски чужой кадр — это читается рывком. Ведёт задний слой,
     передний подтягивается, если отстал больше чем на полтора кадра. */
  const lead = idle[0];
  const followers = idle.slice(1).filter(Boolean);
  if (lead && followers.length) {
    const LIMIT = 0.06;
    const sync = () => {
      if (!swapped) return;
      for (const v of followers) {
        if (Math.abs(v.currentTime - lead.currentTime) > LIMIT) v.currentTime = lead.currentTime;
      }
    };
    setInterval(sync, 500);
    lead.addEventListener('seeked', sync);
    lead.addEventListener('timeupdate', () => { if (lead.currentTime < 0.12) sync(); });
  }
})();
