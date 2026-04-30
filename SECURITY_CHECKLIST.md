# Security Checklist

- Confirmar a aplicação da migration `20260429_lead_attachments.sql`.
- Confirmar a aplicação da migration `20260429_audit_logs_actor_scope.sql`.
- Confirmar que a Edge Function `manual-lead-attachment` foi deployada.
- Confirmar os secrets da Edge Function:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Confirmar que o bucket `lead-attachments` está privado.
- Confirmar o upload de conta via N8N.
- Confirmar o upload manual de conta no CRM.
- Confirmar que o GitHub CodeQL está sem alertas críticos ou altos.
- Rodar `npm audit`.
- Rodar `gitleaks`, se disponível.
- Rodar `semgrep`, se disponível.
- Rotacionar a `SUPABASE_SERVICE_ROLE_KEY` se ela tiver sido exposta em ambiente de teste.
