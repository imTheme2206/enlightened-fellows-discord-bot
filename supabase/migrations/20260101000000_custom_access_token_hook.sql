-- Supabase Auth "Custom Access Token" hook (docs/adr/0003).
-- Stamps the Discord snowflake into the JWT as app_metadata.discord_id so the API can authenticate
-- from the token alone. Supabase migrations own only auth-hook concerns; app tables belong to drizzle.
--
-- Source of the id, in order:
--   1. the user's Discord identity (auth.identities.provider_id is the Discord snowflake)
--   2. an existing app_metadata.discord_id (lets local test users without Discord OAuth work)

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb := event -> 'claims';
  app_meta jsonb := coalesce(claims -> 'app_metadata', '{}'::jsonb);
  discord_id text;
begin
  select i.provider_id
    into discord_id
    from auth.identities i
   where i.user_id = (event ->> 'user_id')::uuid
     and i.provider = 'discord'
   limit 1;

  discord_id := coalesce(discord_id, app_meta ->> 'discord_id');

  if discord_id is not null then
    app_meta := jsonb_set(app_meta, '{discord_id}', to_jsonb(discord_id));
    claims := jsonb_set(claims, '{app_metadata}', app_meta);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on table auth.identities to supabase_auth_admin;
