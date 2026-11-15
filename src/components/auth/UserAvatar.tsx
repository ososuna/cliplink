import { cn } from '@/lib/utils';

type Props = {
  name: string;
  image: string | null;
  className?: string;
  /** Set when a nearby label already names the User, so screen readers skip the picture. */
  decorative?: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

const UserAvatar = ({ name, image, className, decorative = false }: Props) => {
  const shape = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium',
    className,
  );
  if (image) {
    return (
      <img
        src={image}
        alt={decorative ? '' : name}
        referrerPolicy="no-referrer"
        className={cn(shape, 'object-cover')}
      />
    );
  }
  return (
    <span className={shape} aria-hidden={decorative || undefined}>
      {initials(name)}
    </span>
  );
};

export default UserAvatar;
