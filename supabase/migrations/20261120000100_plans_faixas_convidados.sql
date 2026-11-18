-- Catálogo por faixa de convidados (design 2026-11-18): Grátis até 10, "Até 150 convidados" R$ 147 e "Até 300 convidados" R$ 297,
-- 36 poses por convidado nos pagos. Acima de 300, o atendimento é pelo WhatsApp (fora do catálogo).
-- Os planos antigos ficam desligados e NUNCA são apagados: eventos que já os compraram continuam reconhecidos pelo código
-- (event_entitlements.plan_code referencia plans).

insert into public.plans (code, name, max_guests, max_shots, price_cents, sort, is_free, sandbox_active, production_active, features)
values
  ('ate150', 'Até 150 convidados', 150, 36, 14700, 1, false, true, true, '[]'),
  ('ate300', 'Até 300 convidados', 300, 36, 29700, 2, false, true, true, '[]')
on conflict (code) do update set
  name = excluded.name, max_guests = excluded.max_guests, max_shots = excluded.max_shots, price_cents = excluded.price_cents,
  sort = excluded.sort, is_free = false, sandbox_active = true, production_active = true;

update public.plans set sandbox_active = false, production_active = false
where code not in ('gratis', 'ate150', 'ate300');

-- destaque único (índice parcial plans_single_highlighted): limpa antes de marcar
update public.plans set highlighted = false where highlighted and code <> 'ate150';
update public.plans set highlighted = true where code = 'ate150';
