-- ─────────────────────────────────────────────────────────────────────────────
-- POLICIES DE ROW LEVEL SECURITY — UTN TRACKER
-- ─────────────────────────────────────────────────────────────────────────────
-- Aplicado y verificado el 2026-06-11.
-- Este archivo documenta las policies que aíslan los datos por usuario en
-- Supabase. La RLS vive en el panel de Supabase; esto es la fuente de verdad
-- versionada. Es idempotente: se puede re-ejecutar sin romper nada.
--
-- Modelo:
--   * materias / eventos / tareas  -> 100% privadas: el dueño hace todo, nadie más ve nada.
--   * archivos / carpetas          -> el dueño hace todo; los marcados es_publico=true
--                                     los puede LEER cualquier usuario logueado (feature de
--                                     archivos compartidos), pero solo el dueño los escribe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tablas 100% personales ───────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['materias','eventos','tareas']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "dueno_todo" on public.%I;', t);
    execute format(
      'create policy "dueno_todo" on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ── archivos y carpetas: lectura propio-o-público, escritura solo del dueño ───
do $$
declare t text;
begin
  foreach t in array array['archivos','carpetas']
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "leer_propio_o_publico" on public.%I;', t);
    execute format(
      'create policy "leer_propio_o_publico" on public.%I
         for select
         using (auth.uid() = user_id or es_publico = true);', t);

    execute format('drop policy if exists "dueno_insert" on public.%I;', t);
    execute format(
      'create policy "dueno_insert" on public.%I
         for insert with check (auth.uid() = user_id);', t);

    execute format('drop policy if exists "dueno_update" on public.%I;', t);
    execute format(
      'create policy "dueno_update" on public.%I
         for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);

    execute format('drop policy if exists "dueno_delete" on public.%I;', t);
    execute format(
      'create policy "dueno_delete" on public.%I
         for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ── Verificación (debe devolver las 5 tablas con rls_activada = true) ─────────
-- select tablename, rowsecurity as rls_activada
-- from pg_tables
-- where schemaname = 'public'
--   and tablename in ('materias','eventos','tareas','archivos','carpetas');
