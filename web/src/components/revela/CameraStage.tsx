import { WRAP_INFO, wrapOf, type CameraStyle } from "@/domain/options";

/** Câmera 3D da embalagem sobre o palco escuro. As imagens são WebP responsivos gerados por `npm run gen:revela`. */
export function CameraStage({ wrap, size = 640, priority = false, label, className }: { wrap?: CameraStyle | null; size?: 360 | 640 | 960; priority?: boolean; label?: string; className?: string }) {
  const w = wrapOf(wrap);
  const base = `/revela/3d/cam-${w}`;
  return (
    <div className={`rv-stagebox ${className ?? ""}`} data-wrap={w}>
      <picture>
        <source type="image/avif" srcSet={`${base}-640.avif`} />
        <img
          src={`${base}-${size}.webp`}
          srcSet={`${base}-360.webp 360w, ${base}-640.webp 640w, ${base}-960.webp 960w`}
          sizes="(max-width: 480px) 90vw, 480px"
          width={size}
          height={size}
          alt={label ?? `Câmera ${WRAP_INFO[w].label}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
        />
      </picture>
    </div>
  );
}
