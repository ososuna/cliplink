import { navigate } from 'astro:transitions/client';
import { useState, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';

export default function SearchLinks({ search: initial }: { search: string }) {
  const [search, setSearch] = useState(initial);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    const params = new URLSearchParams();
    if (event.target.value) params.set('search', event.target.value);
    const query = params.toString();
    void navigate(query ? `/dashboard?${query}` : '/dashboard');
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
