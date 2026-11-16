/** Fundo da abertura (01): vídeo em loop (autoplay, mudo, playsinline) sobre o quadro de apresentação. Com "reduzir movimento", só o quadro. */
export function Abertura() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- quadro estático em WebP gerado por gen:revela */}
      <img className="bgvideo" src="/revela/video/revela-abertura-poster.webp" alt="" width={540} height={1170} fetchPriority="high" />
      <video className="bgvideo bgvideo--play" autoPlay muted loop playsInline preload="metadata" poster="/revela/video/revela-abertura-poster.webp" tabIndex={-1} aria-hidden="true">
        <source src="/revela/video/revela-abertura.mp4" type="video/mp4" />
      </video>
    </>
  );
}
