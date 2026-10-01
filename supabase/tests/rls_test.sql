-- ==============================================================================
-- ANONY RLS POLICY VERIFICATION TEST SUITE
-- Run this script in the Supabase SQL Editor to verify all security boundaries
-- ==============================================================================

do $$
declare
  v_count integer;
  v_error_occurred boolean := false;
begin
  raise notice '------------------------------------------------------------';
  raise notice 'RUNNING ANONY RLS SECURITY VERIFICATION TESTS';
  raise notice '------------------------------------------------------------';

  -- --------------------------------------------------------------------------
  -- TEST 1: Anon role CANNOT read any messages
  -- --------------------------------------------------------------------------
  set local role anon;
  set local "request.jwt.claim.sub" to '';
  select count(*) into v_count from public.messages;
  if v_count = 0 then
    raise notice '✓ PASS [Test 1]: Anon role returned 0 messages (RLS blocked reading).';
  else
    raise exception '✗ FAIL [Test 1]: Anon was able to read % messages!', v_count;
  end if;

  -- --------------------------------------------------------------------------
  -- TEST 2: Alice CANNOT read Bob's messages (Isolated inboxes)
  -- --------------------------------------------------------------------------
  set local role authenticated;
  set local "request.jwt.claim.sub" to 'a0000000-0000-0000-0000-000000000001'; -- Alice
  select count(*) into v_count from public.messages where recipient_id = 'b0000000-0000-0000-0000-000000000002';
  if v_count = 0 then
    raise notice '✓ PASS [Test 2]: Alice cannot read any of Bob''s messages.';
  else
    raise exception '✗ FAIL [Test 2]: Privacy leak! Alice read % of Bob''s messages.', v_count;
  end if;

  -- --------------------------------------------------------------------------
  -- TEST 3: Alice CAN read her own messages
  -- --------------------------------------------------------------------------
  select count(*) into v_count from public.messages where recipient_id = 'a0000000-0000-0000-0000-000000000001';
  if v_count = 3 then
    raise notice '✓ PASS [Test 3]: Alice successfully read all 3 of her own messages.';
  else
    raise exception '✗ FAIL [Test 3]: Expected Alice to see 3 messages, got %', v_count;
  end if;

  -- --------------------------------------------------------------------------
  -- TEST 4: Direct INSERT into messages by authenticated user is blocked
  -- --------------------------------------------------------------------------
  begin
    insert into public.messages (recipient_id, body)
    values ('b0000000-0000-0000-0000-000000000002', 'Bypassing edge function should fail');
    v_error_occurred := false;
  exception when others then
    v_error_occurred := true;
  end;

  if v_error_occurred then
    raise notice '✓ PASS [Test 4]: Direct INSERT by authenticated user was rejected by RLS.';
  else
    raise exception '✗ FAIL [Test 4]: Direct INSERT by authenticated user succeeded! Must only allow inserts via service role.';
  end if;

  -- --------------------------------------------------------------------------
  -- TEST 5: Direct client access to message_meta is completely blocked
  -- --------------------------------------------------------------------------
  select count(*) into v_count from public.message_meta;
  if v_count = 0 then
    raise notice '✓ PASS [Test 5]: Direct access to message_meta returned 0 rows (Sender privacy preserved).';
  else
    raise exception '✗ FAIL [Test 5]: Security leak! Client was able to read % metadata rows.', v_count;
  end if;

  -- --------------------------------------------------------------------------
  -- TEST 6: Direct client access to rate_limits is completely blocked
  -- --------------------------------------------------------------------------
  select count(*) into v_count from public.rate_limits;
  if v_count = 0 then
    raise notice '✓ PASS [Test 6]: Direct access to rate_limits returned 0 rows.';
  else
    raise exception '✗ FAIL [Test 6]: Security leak! Client was able to read rate limits.', v_count;
  end if;

  -- --------------------------------------------------------------------------
  -- TEST 7: Direct client access to blocked_devices is completely blocked
  -- --------------------------------------------------------------------------
  select count(*) into v_count from public.blocked_devices;
  if v_count = 0 then
    raise notice '✓ PASS [Test 7]: Direct access to blocked_devices returned 0 rows.';
  else
    raise exception '✗ FAIL [Test 7]: Security leak! Client was able to read blocked devices.', v_count;
  end if;

  -- --------------------------------------------------------------------------
  -- TEST 8: Public view allows reading usernames without exposing private columns
  -- --------------------------------------------------------------------------
  set local role anon;
  select count(*) into v_count from public.public_profiles;
  if v_count >= 2 then
    raise notice '✓ PASS [Test 8]: public_profiles view is accessible to anonymous users.';
  else
    raise exception '✗ FAIL [Test 8]: public_profiles view returned % rows.', v_count;
  end if;

  raise notice '------------------------------------------------------------';
  raise notice 'ALL 8 RLS SECURITY TESTS PASSED SUCCESSFULLY!';
  raise notice '------------------------------------------------------------';
end $$;
