-- Internal manager notes per partner (not visible to partners)
alter table partners add column if not exists notes text default null;
