"use client";

import { useEffect, useState } from "react";
import { getPublicSettings } from "@/features/billing/api";
import { CONTACT_EMAIL } from "@/lib/contact";

/** E-mail de contato: `get_public_settings()`; `CONTACT_EMAIL` quando vazio ou indisponível. */
export function ContactEmail() {
  const [mail, setMail] = useState(CONTACT_EMAIL);
  useEffect(() => {
    let alive = true;
    void getPublicSettings().then((s) => { if (alive && s.supportEmail) setMail(s.supportEmail); }, () => undefined);
    return () => { alive = false; };
  }, []);
  return <a href={`mailto:${mail}`} style={{ textDecoration: "underline" }}>{mail}</a>;
}
