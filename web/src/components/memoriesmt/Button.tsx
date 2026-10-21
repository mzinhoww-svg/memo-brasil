import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primario" | "cta" | "cta-xl" | "secundario" | "pequeno" | "texto" | "destrutivo";

type Common = { variant?: ButtonVariant; block?: boolean; icon?: IconName; children: ReactNode; className?: string };
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type AsLink = Common & { href: string; onClick?: () => void };

function classes(variant: ButtonVariant, block?: boolean, extra?: string) {
  return cx("mm-btn", variant === "cta-xl" ? "mm-btn--cta mm-btn--cta-xl" : `mm-btn--${variant}`, block && "mm-btn--bloco", extra);
}

/** `<button>` para ações; passe `href` para navegação (`<a>`). Verbo de ação no rótulo, sem exclamação. */
export function Button(props: AsButton | AsLink) {
  const { variant = "primario", block, icon, children, className } = props;
  const inner = (
    <>
      {icon && <Icon name={icon} decorative />}
      <span>{children}</span>
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link className={classes(variant, block, className)} href={props.href} onClick={props.onClick}>
        {inner}
      </Link>
    );
  }
  const { variant: _v, block: _b, icon: _i, children: _c, className: _cn, href: _h, ...rest } = props;
  void [_v, _b, _i, _c, _cn, _h];
  return (
    <button type="button" {...rest} className={classes(variant, block, className)}>
      {inner}
    </button>
  );
}
