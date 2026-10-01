insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '035cb660-c9d0-489e-957f-7784dbee68f7', 'email', 'email',
  jsonb_build_object('sub', '035cb660-c9d0-489e-957f-7784dbee68f7', 'email', 'probe-super-test-9182@example.com', 'email_verified', true),
  now(), now(), now());
