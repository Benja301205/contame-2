-- Loop 7: nits de la auditoría del Loop 6 — check constraints de sanidad
-- para los parámetros de pérdida (nunca deberían ser negativos).

alter table organizations
  add constraint organizations_avg_ticket_check check (avg_ticket >= 0),
  add constraint organizations_affected_factor_check check (affected_factor >= 0);
