import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/**
 * 404 fallback route.
 */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 p-4 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="text-sm text-muted-foreground">A página que você procura não foi encontrada.</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}
