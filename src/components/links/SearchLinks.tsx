import { navigate } from 'astro:transitions/client';
import { useState, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { dashboardPath } from '@/paths';

export default function SearchLinks({ search: initial }: { search: string }) {
  const [search, setSearch] = useState(initial);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    const params = new URLSearchParams();
    if (event.target.value) params.set('search', event.target.value);
    const query = params.toString();
    void navigate(query ? `${dashboardPath}?${query}` : dashboardPath);
  };

  return (
    <Input
      type="search"
      aria-label="Search URLs"
      placeholder="Search URLs..."
      autoComplete="off"
      value={search}
      onChange={onChange}
    />
  );
}
