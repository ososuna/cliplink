import { useState, type ComponentType } from 'react';
import { authClient } from '@/auth/client';
import { Button } from '@/components/ui/button';
import GitHubIcon from '@/icons/GitHubIcon';
import GoogleIcon from '@/icons/GoogleIcon';
import { dashboardPath, signInPath } from '@/paths';

type ProviderId = 'github' | 'google';

const providers: {
  id: ProviderId;
  name: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { id: 'github', name: 'GitHub', Icon: GitHubIcon },
  { id: 'google', name: 'Google', Icon: GoogleIcon },
];

const SignInButtons = () => {
  const [pending, setPending] = useState<ProviderId | null>(null);

  const signInWith = async (provider: ProviderId) => {
    setPending(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: dashboardPath,
      errorCallbackURL: signInPath,
    });
    if (error) {
      window.location.assign(`${signInPath}?error=sign_in_failed`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {providers.map(({ id, name, Icon }) => (
        <Button
          key={id}
          className="w-full"
          variant="outline"
          disabled={pending !== null}
          onClick={() => signInWith(id)}
        >
          <Icon className="h-4 w-4" />
          {pending === id ? 'Loading...' : `Continue with ${name}`}
        </Button>
      ))}
    </div>
  );
};

export default SignInButtons;
