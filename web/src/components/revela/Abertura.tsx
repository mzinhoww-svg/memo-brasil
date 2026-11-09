/** Fundo da abertura: vídeo em loop (autoplay, mudo, playsinline) com poster. Com "reduzir movimento", só o poster. */
export function Abertura({ children }: { children: React.ReactNode }) {
  return (
    <div className="rv-abertura">
      <div className="rv-abertura__bg" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- poster estático em WebP gerado por gen:revela */}
        <img className="rv-abertura__poster" src="/revela/video/revela-abertura-poster.webp" alt="" width={540} height={1170} fetchPriority="high" />
        <video className="rv-abertura__video" autoPlay muted loop playsInline preload="metadata" poster="/revela/video/revela-abertura-poster.webp" tabIndex={-1}>
          <source src="/revela/video/revela-abertura.mp4" type="video/mp4" />
        </video>
        <div className="rv-abertura__veil" />
      </div>
      <div className="rv-abertura__content">{children}</div>
    </div>
  );
}
