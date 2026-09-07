CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  website TEXT,
  relationship_status TEXT NOT NULL CHECK (relationship_status IN ('lead', 'customer', 'former_customer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  full_name TEXT NOT NULL,
  job_title TEXT,
  email TEXT NOT NULL
);

CREATE TABLE deals (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'won', 'lost')),
  expected_close_date DATE
);

CREATE TABLE interactions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('email', 'call', 'meeting', 'note', 'support')),
  subject TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL
);

INSERT INTO companies (name, industry, website, relationship_status) VALUES
  ('Acme Fabrication', 'Manufacturing', 'https://acme-fabrication.example', 'customer'),
  ('Northstar Logistics', 'Logistics', 'https://northstar-logistics.example', 'lead'),
  ('Harbor & Pine', 'Retail', 'https://harbor-pine.example', 'customer');

INSERT INTO contacts (company_id, full_name, job_title, email) VALUES
  (1, 'Maya Chen', 'Operations Director', 'maya.chen@acme-fabrication.example'),
  (1, 'Ravi Patel', 'Procurement Manager', 'ravi.patel@acme-fabrication.example'),
  (2, 'Jordan Brooks', 'Head of Customer Success', 'jordan.brooks@northstar-logistics.example'),
  (3, 'Elena Torres', 'Owner', 'elena.torres@harbor-pine.example');

INSERT INTO deals (company_id, name, amount, status, expected_close_date) VALUES
  (1, 'Premium Operations Plan renewal', 48000.00, 'open', '2026-10-15'),
  (2, 'Fleet Visibility rollout', 72000.00, 'open', '2026-11-01'),
  (3, 'Retail support package', 12000.00, 'won', '2026-07-12');

INSERT INTO interactions (company_id, interaction_type, subject, occurred_at, summary) VALUES
  (1, 'call', 'Renewal planning call', '2026-08-28T10:00:00Z', 'Maya asked about premium-plan pricing and implementation support.'),
  (1, 'email', 'Volume discount request', '2026-08-30T14:30:00Z', 'Ravi requested a pricing breakdown for adding two factory locations.'),
  (1, 'support', 'Dashboard export timeout', '2026-09-02T09:15:00Z', 'Support shared a workaround and scheduled a follow-up.'),
  (2, 'meeting', 'Discovery session', '2026-08-20T16:00:00Z', 'Jordan described a need for delivery-status visibility for their team.'),
  (3, 'note', 'Quarterly check-in', '2026-08-18T11:00:00Z', 'Elena is happy with response times and plans to renew.' );

