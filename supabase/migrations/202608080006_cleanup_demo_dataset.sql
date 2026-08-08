-- Remove only the seeded demo dataset. The fixed UUID prefixes below belong to
-- 202608070020_demo_dataset.sql; real customers and shared catalog data remain.
do $$
declare
  demo_clients uuid[] := array[
    'd0000000-0000-0000-0000-000000000001'::uuid,
    'd0000000-0000-0000-0000-000000000002'::uuid,
    'd0000000-0000-0000-0000-000000000003'::uuid
  ];
  demo_projects uuid[] := array[
    'd1000000-0000-0000-0000-000000000001'::uuid,
    'd1000000-0000-0000-0000-000000000002'::uuid,
    'd1000000-0000-0000-0000-000000000003'::uuid
  ];
  demo_services uuid[] := array[
    'd2000000-0000-0000-0000-000000000001'::uuid,
    'd2000000-0000-0000-0000-000000000002'::uuid,
    'd2000000-0000-0000-0000-000000000003'::uuid,
    'd2000000-0000-0000-0000-000000000004'::uuid
  ];
  demo_leads uuid[] := array[
    'd5000000-0000-0000-0000-000000000001'::uuid,
    'd5000000-0000-0000-0000-000000000002'::uuid,
    'd5000000-0000-0000-0000-000000000003'::uuid
  ];
begin
  -- Generic logs and stored-file metadata do not cascade from their entities.
  delete from public.activity_logs
  where entity_id = any(
    demo_clients || demo_projects || demo_services || demo_leads || array[
      'd3000000-0000-0000-0000-000000000001'::uuid,
      'd3000000-0000-0000-0000-000000000002'::uuid,
      'd3000000-0000-0000-0000-000000000003'::uuid,
      'd3000000-0000-0000-0000-000000000004'::uuid,
      'd4000000-0000-0000-0000-000000000001'::uuid,
      'd4000000-0000-0000-0000-000000000002'::uuid,
      'd4000000-0000-0000-0000-000000000003'::uuid
    ]
  );
  delete from public.files where project_id = any(demo_projects);

  -- Sales documents referencing demo clients/leads.
  delete from public.proforma_items
  where proforma_id in (select id from public.proformas where client_id = any(demo_clients));
  delete from public.proformas where client_id = any(demo_clients);
  delete from public.offer_revision_items
  where revision_id in (
    select r.id from public.offer_revisions r
    join public.offers o on o.id = r.offer_id
    where o.client_id = any(demo_clients) or o.lead_id = any(demo_leads)
  );
  delete from public.offer_revisions
  where offer_id in (
    select id from public.offers
    where client_id = any(demo_clients) or lead_id = any(demo_leads)
  );
  delete from public.offers
  where client_id = any(demo_clients) or lead_id = any(demo_leads);
  delete from public.leads where id = any(demo_leads);

  -- Vendor costs attached to the demo social-media project.
  delete from public.vendor_payments
  where vendor_accrual_id in (
    select id from public.vendor_accruals
    where project_id = any(demo_projects) or project_service_id = any(demo_services)
  );
  delete from public.finance_transactions
  where client_id = any(demo_clients)
     or project_id = any(demo_projects)
     or vendor_id = 'd6000000-0000-0000-0000-000000000001'::uuid;
  delete from public.vendor_accruals
  where project_id = any(demo_projects) or project_service_id = any(demo_services);
  delete from public.vendor_assignments
  where vendor_id = 'd6000000-0000-0000-0000-000000000001'::uuid
     or project_service_id = any(demo_services);
  delete from public.vendors where id = 'd6000000-0000-0000-0000-000000000001'::uuid;

  -- Operations and monthly finance data attached to demo projects.
  delete from public.collection_activities
  where receivable_id in (select id from public.receivables where project_id = any(demo_projects));
  delete from public.finance_transactions where project_id = any(demo_projects) or client_id = any(demo_clients);
  delete from public.payments
  where receivable_id in (select id from public.receivables where project_id = any(demo_projects));
  delete from public.invoices where project_id = any(demo_projects);
  delete from public.receivables where project_id = any(demo_projects);
  delete from public.service_periods where project_id = any(demo_projects);
  delete from public.reports where project_id = any(demo_projects);
  delete from public.recurring_task_templates where project_id = any(demo_projects);
  delete from public.tasks where project_id = any(demo_projects);

  -- Project hierarchy, then the demo customers themselves.
  delete from public.project_service_members where project_service_id = any(demo_services);
  delete from public.project_service_prices where project_service_id = any(demo_services);
  delete from public.project_services where project_id = any(demo_projects);
  delete from public.project_members where project_id = any(demo_projects);
  delete from public.projects where id = any(demo_projects);
  delete from public.clients where id = any(demo_clients);
end $$;
