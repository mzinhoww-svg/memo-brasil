# Rollback
- **Suspender novas compras sem invalidar direitos pagos:** `payments_env = 'desligado'` (`supabase/ops/payments_sandbox_close.sql` ou §9.1 do runbook). Webhook, conciliação e reembolso continuam tratando dinheiro em trânsito.
- **Front:** promover o deployment anterior: `dpl_Djo8SdeirhXrN71ZaFHBRTYRq7fF` (convite) ou `dpl_FLm1pT6udBUiWmX5ZZr9i6HPC5pu` (`c02ff42`). Procedimento: `docs/supabase/PUBLISH-AND-ROLLBACK.md` §7 e §8.
- **Functions:** `supabase functions deploy` do commit anterior (`git checkout <sha> -- supabase/functions`). A migration `20261023000100` é aditiva e não se reverte.
- **Credenciais de sandbox:** remover `MERCADOPAGO_ACCESS_TOKEN_SANDBOX` (`supabase secrets unset`) desliga o sandbox sem tocar a produção.
