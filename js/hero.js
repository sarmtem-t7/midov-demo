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
  const whenReady = (v, fn) => {
    if (!v) return;
    v.readyState >= 2 ? fn() : v.addEventListener('loadeddata', fn, { once: true });
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

  splash.forEach((v) => whenReady(v, () => tryPlay(v)));
  // Если за две секунды всплеск не сдвинулся — запуск не состоялся.
  setTimeout(() => { if (backSplash && backSplash.paused) giveUp(); }, 2000);

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
     совпадает с последним кадром всплеска до 0,0% пикселей. Подмена
     мгновенная и без наплыва: смешивать одинаковые кадры незачем.

     Петля запускается заранее и ставится на паузу на нулевом кадре —
     к моменту подмены она уже декодирована, и пустого кадра не будет. */
  idle.forEach((v) => {
    if (!v) return;
    whenReady(v, () => { v.pause(); v.currentTime = 0; });
  });

  const swap = () => {
    if (swapped || !idle.length) return;
    swapped = true;
    idle.forEach((v) => { if (v) { v.currentTime = 0; play(v); } });
    scenes.forEach((s) => s.classList.add('is-idle'));
  };
  if (backSplash) {
    backSplash.addEventListener('ended', swap);
    // Страховка на случай, если 'ended' не придёт: перемотка, сбой декодера.
    setTimeout(swap, 9000);
  } else {
    swap();
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
