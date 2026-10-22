-- Categorias do wizard (casamento, festa, empresa, viagem, outro) eram recusadas pelo CHECK original em 3 de 5 casos.
-- Aditiva: amplia a lista e mantém as categorias do esquema original, então nenhuma linha existente é invalidada.
alter table public.events drop constraint events_category_check;
alter table public.events add constraint events_category_check
  check (category in ('casamento', 'festa', 'empresa', 'viagem', 'outro', 'aniversario', 'formatura', 'corporativo'));
