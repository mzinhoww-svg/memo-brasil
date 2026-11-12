-- DESCONGELAR (rollback da janela): devolve exatamente as permissões guardadas por congelar.sql.
begin;
do $$ declare x record; begin
  for x in select * from mm_ops.freeze_acl loop
    if x.kind = 'table' then
      execute format('grant %s on %s to %s', x.priv, x.obj, x.grantee);
    elsif x.kind = 'column' then
      execute format('grant %s %s to %s', x.priv, x.obj, x.grantee);
    else
      execute format('grant execute on function %s to %s', x.obj, x.grantee);
    end if;
  end loop;
end $$;
drop table mm_ops.freeze_acl;
drop schema if exists mm_ops;
notify pgrst, 'reload schema';
commit;
select 'descongelado' as estado;
