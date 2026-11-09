import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primario" | "cta" | "cta-xl" | "secundario" | "papel" | "pequeno" | "texto" | "destrutivo";

type Common = { variant?: ButtonVariant; small?: boolean; block?: boolean; icon?: IconName; children: ReactNode; className?: string };
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type AsLink = Common & { href: string; onClick?: () => void };

/** No kit, "pequeno" é um modificador de tamanho: `variant="pequeno"` = primário de 44px; `small` serve a secundário e destrutivo. */
function classes(variant: ButtonVariant, small: boolean | undefined, block?: boolean, extra?: string) {
  const base = variant === "cta-xl" ? "rv-btn--cta rv-btn--cta-xl" : variant === "pequeno" ? "rv-btn--primario rv-btn--pequeno" : `rv-btn--${variant}`;
  return cx("rv-btn", base, small && variant !== "pequeno" && "rv-btn--pequeno", block && "rv-btn--bloco", extra);
}

/** `<button>` para ações; passe `href` para navegação (`<a>`). Verbo de ação no rótulo, sem exclamação. */
export function Button(props: AsButton | AsLink) {
  const { variant = "primario", small, block, icon, children, className } = props;
  const inner = (
    <>
      {icon && <Icon name={icon} decorative />}
      <span>{children}</span>
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link className={classes(variant, small, block, className)} href={props.href} onClick={props.onClick}>
        {inner}
      </Link>
    );
  }
  const { variant: _v, small: _s, block: _b, icon: _i, children: _c, className: _cn, href: _h, ...rest } = props;
  void [_v, _s, _b, _i, _c, _cn, _h];
  return (
    <button type="button" {...rest} className={classes(variant, small, block, className)}>
      {inner}
    </button>
  );
}
