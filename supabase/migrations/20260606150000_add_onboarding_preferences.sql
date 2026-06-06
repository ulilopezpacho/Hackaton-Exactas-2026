alter table public.user_preferences
drop constraint if exists user_preferences_budget_check;

update public.user_preferences
set budget = case budget
  when 'low' then 'under_50'
  when 'medium' then '50_100'
  when 'high' then '100_200'
  else budget
end
where budget in ('low', 'medium', 'high');

alter table public.user_preferences
add constraint user_preferences_budget_check check (
  budget is null or budget in ('under_50', '50_100', '100_200', 'over_200')
);

alter table public.user_preferences
add column if not exists onboarding_step text not null default 'interests';

alter table public.user_preferences
add column if not exists onboarding_completed_at timestamptz;

alter table public.user_preferences
drop constraint if exists user_preferences_onboarding_step_check;

alter table public.user_preferences
add constraint user_preferences_onboarding_step_check check (
  onboarding_step in ('interests', 'pace', 'prompt', 'budget', 'complete')
);
