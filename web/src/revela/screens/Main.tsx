"use client";
/* Gerado de design-system/revela/html/Main.html por scripts/html-to-tsx.mjs, depois ligado ao app: o vídeo é o da abertura (com quadro e "reduzir movimento"),
   "Tenho um convite" é link, e os botões de entrada vêm de fora (`actions`). Sem props, mostra os dados do desenho. */
import Link from "next/link";
import type { ReactNode } from "react";
import { Abertura } from "@/components/revela/Abertura";

export interface MainProps {
  /** Destino de "Tenho um convite". */
  inviteHref?: string;
  /** Aviso no topo do conteúdo (ex.: falha ao entrar com o Google). */
  banner?: ReactNode;
  /** Botões de entrada (dentro de `.stack`); sem isso, os dois do desenho. */
  actions?: ReactNode;
  /** Avisos e atalhos do app abaixo dos botões. */
  extra?: ReactNode;
  /** Links dos Termos e da Privacidade. */
  termsHref?: string;
  privacyHref?: string;
}

const DEFAULT_ACTIONS = (
  <>
    <button type="button" className="rv-btn rv-btn--block rv-btn--paper">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.6-1.6 2.6-3.8 2.6-6.5z" />
        <path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.5c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z" />
        <path d="M7 13.7a5.4 5.4 0 0 1 0-3.4V8H4a9 9 0 0 0 0 8z" />
        <path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7z" />
      </svg>
      Continuar com Google
    </button>
    <button type="button" className="rv-btn rv-btn--block rv-btn--line">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
      Receber link por e-mail
    </button>
  </>
);

export function Main({ inviteHref = "/entrar#codigo", banner, actions = DEFAULT_ACTIONS, extra, termsHref = "/termos", privacyHref = "/privacidade" }: MainProps = {}) {
  return (
    <>
    <div className="scr scr--scroll">
      <Abertura />
      <div className="fade-top" />
      <div className="fade-bottom" />
      <div className="safe" style={{ "position": "relative", "zIndex": "2" }}>
        <div className="row between">
          <Link href="/" className="row" style={{ "gap": "10px" }} aria-label="Revela, início">
            <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
              <rect width="64" height="64" rx="16" fill="var(--surface-1)" />
              <path d="M14 34.5a18 18 0 0 0 36 0z" fill="var(--revela)" />
              <path d="M15 29.5a17 17 0 0 1 34 0z" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
            </svg>
            <svg width="84" height="24" viewBox="6 187 2802 804" aria-hidden="true">
              <path fill="var(--ink)" d="M6 975V965H7Q43 965 65.0 943.0Q87 921 87 885V557Q87 519 71.5 498.0Q56 477 6 477V467H105Q158 467 185.0 456.5Q212 446 223 429H228L229 593Q242 563 262.5 530.0Q283 497 314.5 474.5Q346 452 390 452Q405 452 422.0 455.0Q439 458 458 466L419 583Q383 563 356.5 555.0Q330 547 310 547Q276 547 259.5 568.0Q243 589 231 618V885Q231 921 253.0 943.0Q275 965 311 965H312V975Z M712.0 987Q643.0 987 589.5 953.0Q536.0 919 506.0 858.5Q476.0 798 476.0 720Q476.0 640 509.0 580.0Q542.0 520 599.5 486.5Q657.0 453 730.0 453Q791.0 453 838.5 477.0Q886.0 501 914.5 544.5Q943.0 588 947.0 645L948.0 660H612.0V665Q612.0 771 659.0 834.5Q706.0 898 785.0 898Q833.0 898 876.5 874.5Q920.0 851 947.0 811L956.0 814Q939.0 865 903.0 904.0Q867.0 943 818.0 965.0Q769.0 987 712.0 987ZM613.0 645H816.0Q816.0 566 790.5 517.0Q765.0 468 719.0 468Q675.0 468 646.0 516.0Q617.0 564 613.0 645Z M1199.0 991 1000.0 531Q990.0 508 973.5 493.0Q957.0 478 928.0 477V467H1208.0V477Q1173.0 481 1162.5 508.0Q1152.0 535 1169.0 576L1272.0 817L1374.0 582Q1384.0 559 1384.0 537Q1384.0 512 1369.0 496.0Q1354.0 480 1327.0 477V467H1485.0V477Q1459.0 483 1435.0 507.0Q1411.0 531 1392.0 573L1208.0 991Z M1704.0 987Q1635.0 987 1581.5 953.0Q1528.0 919 1498.0 858.5Q1468.0 798 1468.0 720Q1468.0 640 1501.0 580.0Q1534.0 520 1591.5 486.5Q1649.0 453 1722.0 453Q1783.0 453 1830.5 477.0Q1878.0 501 1906.5 544.5Q1935.0 588 1939.0 645L1940.0 660H1604.0V665Q1604.0 771 1651.0 834.5Q1698.0 898 1777.0 898Q1825.0 898 1868.5 874.5Q1912.0 851 1939.0 811L1948.0 814Q1931.0 865 1895.0 904.0Q1859.0 943 1810.0 965.0Q1761.0 987 1704.0 987ZM1605.0 645H1808.0Q1808.0 566 1782.5 517.0Q1757.0 468 1711.0 468Q1667.0 468 1638.0 516.0Q1609.0 564 1605.0 645Z M1962.0 975V965Q1998.0 965 2020.5 943.5Q2043.0 922 2043.0 885V315Q2043.0 279 2020.5 257.0Q1998.0 235 1962.0 235V225H2064.0Q2115.0 225 2142.0 214Q2167.0 203 2177.0 187H2187.0V885Q2187.0 922 2209.5 943.5Q2232.0 965 2268.0 965V975Z M2407.0 989Q2346.0 989 2309.0 956.0Q2272.0 923 2272.0 869Q2272.0 846 2280.0 825.5Q2288.0 805 2310.0 785Q2333.0 765 2373.0 743.5Q2413.0 722 2479.0 698L2572.0 664V589Q2572.0 532 2554.0 498.5Q2536.0 465 2504.0 465Q2466.0 466 2439.5 515.0Q2413.0 564 2404.0 651L2296.0 589Q2313.0 548 2348.0 517.0Q2383.0 486 2428.5 469.0Q2474.0 452 2524.0 452Q2609.0 452 2662.5 499.5Q2716.0 547 2716.0 629V870Q2716.0 928 2755.0 928Q2778.0 928 2800.0 903L2808.0 910Q2782.0 945 2745.0 967.0Q2708.0 989 2673.0 989Q2635.0 989 2607.5 963.0Q2580.0 937 2573.0 894Q2524.0 944 2487.5 966.5Q2451.0 989 2407.0 989ZM2482.0 927Q2504.0 927 2524.5 916.0Q2545.0 905 2571.0 880L2572.0 677L2532.0 692Q2481.0 711 2454.0 730.5Q2427.0 750 2416.5 774.0Q2406.0 798 2406.0 829Q2406.0 872 2427.5 899.5Q2449.0 927 2482.0 927Z" />
            </svg>
          </Link>
          <Link href={inviteHref} className="rv-btn rv-btn--text" style={{ "color": "var(--ink)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4" />
            </svg>
            {" Tenho um convite"}
          </Link>
        </div>
        {banner}
        <div className="grow" />
        <h1 className="rv-display" style={{ "fontSize": "44px", "lineHeight": "46px" }}>
          Cada convidado
          <br />
          é uma câmera.
        </h1>
        <p className="rv-body muted" style={{ "margin": "14px 0 24px", "maxWidth": "320px" }}>
          Monte a câmera do evento, espalhe o QR pela festa e veja tudo revelado no dia seguinte.
        </p>
        <div className="stack">
          {actions}
        </div>
        {extra}
        <p className="rv-caption center" style={{ "marginTop": "14px" }}>
          {"Ao continuar, você aceita os "}
          <Link href={termsHref} className="link">
            Termos
          </Link>
          {" e a "}
          <Link href={privacyHref} className="link">
            Privacidade
          </Link>
          .
        </p>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
