/**
 * Revela · Movimento
 * Coreografias que o CSS sozinho não resolve. Tudo usa a Web Animations API,
 * respeita "reduzir movimento" e devolve Promise para encadear.
 */
export const EASE = {
  out: "cubic-bezier(.2,.8,.2,1)",
  in: "cubic-bezier(.5,0,.9,.4)",
  inout: "cubic-bezier(.65,0,.35,1)",
  spring: "cubic-bezier(.3,1.45,.5,1)",
}         ;

export function reduced()          {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function done(a                       )                {
  return a ? a.finished.then(() => undefined, () => undefined) : Promise.resolve();
}
function haptic(pattern                   )       {
  try { navigator.vibrate?.(pattern); } catch { /* sem vibração neste aparelho */ }
}

/* ------------------------------------------------------------------ dígitos que rolam */
/** Mostra `value` em `el` com cada dígito rolando até o novo valor. Use no contador de poses e nos visores. */
export function odometer(el             , value                 , minDigits = 2)       {
  const text = String(value).padStart(minDigits, "0");
  if (!el.classList.contains("rv-odo") || el.children.length !== text.length) {
    el.classList.add("rv-odo");
    el.replaceChildren(...[...text].map(() => {
      const col = document.createElement("span"), strip = document.createElement("span");
      for (let d = 0; d <= 9; d++) { const i = document.createElement("i"); i.textContent = String(d); strip.append(i); }
      col.setAttribute("aria-hidden", "true");
      col.append(strip);
      return col;
    }));
  }
  el.setAttribute("role", "text");
  el.setAttribute("aria-label", text);
  [...text].forEach((ch, k) => { (el.children[k].firstElementChild               ).style.transform = `translateY(-${Number(ch)}em)`; });
}

/* ------------------------------------------------------------------ disparo */
                          
                                                       
                     
                                                        
                       
                          
                       
                                 
                      
                                           
                        
                                              
                     
  
/**
 * Disparo completo: botão afunda, obturador fecha, flash estoura e apaga devagar,
 * o contador roda uma pose e a roda avança o filme em três estalos.
 * Chame no momento em que a foto é capturada; resolve em ~0,9 s.
 */
export async function shoot(p            )                {
  haptic(12);
  if (p.counter && p.remaining !== undefined) odometer(p.counter, p.remaining);
  if (reduced()) return;
  p.button?.animate([{ transform: "scale(1)" }, { transform: "scale(.88)", offset: 0.3 }, { transform: "scale(1)" }], { duration: 260, easing: EASE.out });
  p.shutter.animate([{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 170, easing: "linear" });
  const flash = p.flash.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 0.92, offset: 0.14 }, { opacity: 0.35, offset: 0.4 }, { opacity: 0.1, offset: 0.7 }, { opacity: 0 }],
    { duration: 620, delay: 40, easing: "linear" },
  );
  const wheel = p.wheel?.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(42deg)", offset: 0.3 }, { transform: "rotate(40deg)", offset: 0.36 }, { transform: "rotate(82deg)", offset: 0.64 }, { transform: "rotate(80deg)", offset: 0.7 }, { transform: "rotate(120deg)" }],
    { duration: 520, delay: 360, easing: EASE.out },
  );
  if (p.wheel) setTimeout(() => haptic([6, 90, 6, 90, 6]), 360);
  await Promise.all([done(flash), done(wheel)]);
}

/** A pose recém-tirada encolhe e voa para o destino (a aba "Minhas", por exemplo). */
export function flyTo(el             , target             )                {
  if (reduced()) return Promise.resolve();
  const a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  return done(el.animate(
    [{ transform: "none", opacity: 1 }, { transform: `translate(${dx * 0.3}px, ${dy * 0.1 - 30}px) scale(.7) rotate(-6deg)`, opacity: 1, offset: 0.35 }, { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(8deg)`, opacity: 0.2 }],
    { duration: 620, easing: EASE.inout, fill: "forwards" },
  ));
}

/* ------------------------------------------------------------------ fotos impressas */
/** Fotos caem na mesa uma a uma, cada uma com o giro final que já tem no CSS (--rv-rot). */
export function dealPrints(prints                       , gap = 130)                {
  const list = [...prints];
  if (reduced()) return Promise.resolve();
  return Promise.all(list.map((el, i) => {
    const rot = getComputedStyle(el).getPropertyValue("--rv-rot").trim() || "0deg";
    const side = i % 2 ? 1 : -1;
    return done(el.animate(
      [
        { opacity: 0, transform: `translate(${side * 60}px, -140px) rotate(calc(${rot} + ${side * 22}deg)) scale(1.25)` },
        { opacity: 1, offset: 0.25 },
        { opacity: 1, transform: `rotate(${rot}) scale(1)` },
      ],
      { duration: 640, delay: i * gap, easing: EASE.spring, fill: "backwards" },
    ));
  })).then(() => undefined);
}

/**
 * Revelação do feed: cada foto borrada perde o borrão em sequência e o cadeado some.
 * `swap` é chamado no meio, para você trocar a miniatura borrada pela foto real.
 */
export async function revealFeed(items                                                      , swap                          )                {
  const list = [...items];
  if (reduced()) { list.forEach((_, i) => swap?.(i)); list.forEach((it) => { if (it.lock) it.lock.style.display = "none"; }); return; }
  await Promise.all(list.map(async (it, i) => {
    const delay = i * 180;
    const lock = it.lock?.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(1.3)" }], { duration: 260, delay, easing: EASE.in, fill: "forwards" });
    const flashUp = it.photo.animate([{ filter: "blur(18px) saturate(1.2) brightness(1)" }, { filter: "blur(10px) saturate(1.4) brightness(1.9)" }], { duration: 300, delay, easing: EASE.in, fill: "forwards" });
    await done(flashUp);
    swap?.(i);
    it.photo.classList.remove("rv-blurred");
    await done(it.photo.animate(
      [{ filter: "blur(10px) sepia(.6) saturate(1.5) brightness(1.9)", transform: "scale(1.08)" }, { filter: "blur(2px) sepia(.2) brightness(1.1)", transform: "scale(1.02)", offset: 0.55 }, { filter: "none", transform: "none" }],
      { duration: 900, easing: EASE.out, fill: "forwards" },
    ));
    await done(lock);
  }));
}

/** Troca a embalagem da câmera 3D com um giro: vira de lado, troca a imagem, volta. */
export async function flipWrap(img                  , nextSrc        )                {
  if (reduced()) { img.src = nextSrc; return; }
  await done(img.animate([{ transform: "perspective(700px) rotateY(0) scale(1)" }, { transform: "perspective(700px) rotateY(88deg) scale(.94)" }], { duration: 200, easing: EASE.in }));
  img.src = nextSrc;
  try { await img.decode(); } catch { /* segue com a imagem que tiver */ }
  await done(img.animate([{ transform: "perspective(700px) rotateY(-88deg) scale(.94)" }, { transform: "perspective(700px) rotateY(0) scale(1)" }], { duration: 460, easing: EASE.spring }));
}

/** Inclinação 3D seguindo o dedo ou o mouse. Devolve a função que desliga. */
export function tilt(el             , max = 10)             {
  if (reduced()) return () => undefined;
  el.classList.add("rv-tilt");
  const move = (e              ) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rv-tilt-y", `${(x * max * 2).toFixed(2)}deg`);
    el.style.setProperty("--rv-tilt-x", `${(-y * max * 2).toFixed(2)}deg`);
  };
  const leave = () => { el.style.setProperty("--rv-tilt-x", "0deg"); el.style.setProperty("--rv-tilt-y", "0deg"); };
  el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
  return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); leave(); };
}

/* ------------------------------------------------------------------ curtir e carimbar */
/** Coração da curtida: estoura, solta um anel e volta. */
export function heartPop(btn             )                {
  haptic(8);
  if (reduced()) return Promise.resolve();
  const ring = document.createElement("span");
  ring.style.cssText = "position:absolute;inset:0;border-radius:50%;border:2px solid currentColor;pointer-events:none";
  if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
  btn.append(ring);
  ring.animate([{ transform: "scale(.4)", opacity: 0.9 }, { transform: "scale(1.5)", opacity: 0 }], { duration: 480, easing: EASE.out }).finished.then(() => ring.remove(), () => ring.remove());
  const icon = (btn.querySelector("svg")                      ) ?? btn;
  return done(icon.animate([{ transform: "scale(1)" }, { transform: "scale(.7)", offset: 0.2 }, { transform: "scale(1.35)", offset: 0.55 }, { transform: "scale(1)" }], { duration: 460, easing: EASE.out }));
}

/** Carimbo batendo ("PAGO", "EXPIROU", "REVELADO"): cai grande, assenta e treme o papel em volta. */
export async function stampSlam(stamp             , paper              )                {
  stamp.style.visibility = "visible";
  if (reduced()) return;
  stamp.classList.remove("rv-stamp-slam"); void stamp.offsetWidth; stamp.classList.add("rv-stamp-slam");
  setTimeout(() => { haptic(18); if (paper) { paper.classList.remove("rv-shake"); void paper.offsetWidth; paper.classList.add("rv-shake"); } }, 200);
  await new Promise((r) => setTimeout(r, 420));
}

/** Escreve o carimbo de data acendendo um caractere por vez. */
export function typeStamp(el             , text        )       {
  el.classList.add("rv-stamp-type");
  el.setAttribute("aria-label", text);
  el.replaceChildren(...[...text].map((ch, i) => { const s = document.createElement("span"); s.textContent = ch; s.style.setProperty("--i", String(i)); return s; }));
}

/* ------------------------------------------------------------------ confete */
                               
                                                                       
                          
                 
                                                       
                                    
                    
                              
                    
  
const PAPER = ["#FF4D1F", "#FFA23A", "#E8CF9E", "#F7F2EA", "#5BA4E6", "#FF7FA8"];
                                                                                                                                                                                      
/**
 * Confete de papel em canvas: gravidade, arrasto, giro e o papel virando de lado.
 * Devolve Promise que resolve quando a última peça sai da tela. Não desenha nada com "reduzir movimento".
 */
export function confetti(canvas                   , o                  = {})                {
  if (reduced()) return Promise.resolve();
  const mode = o.mode ?? "burst", count = o.count ?? (mode === "burst" ? 110 : 80), colors = o.colors ?? PAPER, maxT = o.duration ?? 4200;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve();
  const ox = (o.origin?.x ?? 0.5) * W, oy = (o.origin?.y ?? 0.55) * H;
  const rnd = (a        , b        ) => a + Math.random() * (b - a);
  const pieces          = Array.from({ length: count }, () => {
    const burst = mode === "burst";
    const ang = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(420, 1050);
    return {
      x: burst ? ox : rnd(0, W), y: burst ? oy : rnd(-H * 0.6, -10),
      vx: burst ? Math.cos(ang) * sp : rnd(-40, 40), vy: burst ? Math.sin(ang) * sp : rnd(60, 220),
      w: rnd(6, 11), h: rnd(9, 16), rot: rnd(0, 6.28), vr: rnd(-7, 7), flip: rnd(0, 6.28), vf: rnd(4, 11),
      color: colors[Math.floor(Math.random() * colors.length)], shape: (Math.random() < 0.62 ? 0 : Math.random() < 0.6 ? 1 : 2)             , life: 0,
    };
  });
  return new Promise((resolve) => {
    let last = performance.now(), t0 = last;
    const frame = (now        ) => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      let alive = 0;
      const fade = Math.max(0, Math.min(1, (maxT - (now - t0)) / 600));
      for (const p of pieces) {
        p.vy += 1150 * dt;
        const drag = Math.exp(-(1.6 + 0.9 * Math.abs(Math.cos(p.flip))) * dt);
        p.vx *= drag; p.vy *= drag;
        p.vx += Math.sin(p.flip * 0.7) * 26 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.flip += p.vf * dt; p.life += dt;
        if (p.y > H + 30) continue;
        alive++;
        const sy = Math.cos(p.flip);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, sy);
        ctx.globalAlpha = fade * (sy < 0 ? 0.72 : 1); ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.w * 0.55, 0, 6.2832); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(-p.w, -p.h * 0.2); ctx.quadraticCurveTo(0, -p.h, p.w, -p.h * 0.2); ctx.lineTo(p.w, p.h * 0.1); ctx.quadraticCurveTo(0, -p.h * 0.6, -p.w, p.h * 0.1); ctx.fill(); }
        ctx.restore();
      }
      if (alive > 0 && now - t0 < maxT) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, W, H); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

/* ------------------------------------------------------------------ o momento "Revelou." */
                                                                                                                                      
/** A cena inteira da revelação: clarão, título sobe, fotos caem na mesa, confete. */
export async function revealMoment(p                   )                {
  haptic([20, 60, 30]);
  if (reduced()) return;
  p.flash?.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.1 }, { opacity: 0 }], { duration: 700, easing: "linear" });
  p.title.animate([{ opacity: 0, transform: "translateY(24px) scale(.92)", letterSpacing: "-0.04em" }, { opacity: 1, transform: "none", letterSpacing: "normal" }], { duration: 700, delay: 120, easing: EASE.spring, fill: "backwards" });
  void confetti(p.canvas, { mode: "burst", origin: { x: 0.5, y: 0.42 } });
  await dealPrints(p.prints);
}
