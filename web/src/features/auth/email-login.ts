/** Login do anfitrião por link no e-mail: só aparece quando o provedor Email estiver ligado no Supabase (NEXT_PUBLIC_EMAIL_LOGIN=1). */
export const emailLoginEnabled = () => process.env.NEXT_PUBLIC_EMAIL_LOGIN === "1";
