import { CategorySubcategory } from '../types';

export const jakartaTime = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

/** Categories arrive in running order; consecutive ones of a session share a group. */
export function groupCategoriesBySession(categories: CategorySubcategory[]) {
  const groups: { label: string; items: CategorySubcategory[] }[] = [];
  for (const c of categories) {
    const label = c.sessionNumber ? `Session ${c.sessionNumber}` : c.startsAt ? 'Scheduled' : 'Not scheduled';
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(c);
    else groups.push({ label, items: [c] });
  }
  return groups;
}
