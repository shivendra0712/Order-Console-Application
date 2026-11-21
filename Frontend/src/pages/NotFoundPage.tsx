import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonClass, Card, EmptyState } from '../components/ui';

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={<Compass className="size-5" />}
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={
          <Link to="/" className={buttonClass()}>
            Go to dashboard
          </Link>
        }
      />
    </Card>
  );
}
