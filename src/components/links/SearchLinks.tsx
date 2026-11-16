import { navigate } from 'astro:transitions/client';
import { useState, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { listingHref } from '@/links/listing';

export default function SearchLinks(props: { search: string; limit: number }) {
  const { search: initial, limit } = props;
  const [search, setSearch] = useState(initial);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    void navigate(listingHref({ search: event.target.value, limit }));
  };

  return (
    <Input
      type="search"
      aria-label="Search Links"
      placeholder="Search Links..."
      autoComplete="off"
      value={search}
      onChange={onChange}
    />
  );
}
