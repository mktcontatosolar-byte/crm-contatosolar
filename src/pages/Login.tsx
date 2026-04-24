import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/useAuth"
import { toast } from "sonner"

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")

    try {
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        setError("Email ou senha incorretos.")
        toast.error("Não foi possível entrar com essas credenciais.")
      }
    } catch (err) {
      console.error("Erro inesperado ao tentar entrar:", err)
      setError("Erro inesperado ao tentar entrar. Veja o console.")
      toast.error("Erro inesperado ao tentar entrar.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[10%] h-64 w-64 rounded-full bg-[color:color-mix(in_oklab,var(--primary)_18%,transparent)] blur-3xl" />
        <div className="absolute bottom-[12%] right-[8%] h-80 w-80 rounded-full bg-[color:color-mix(in_oklab,var(--chart-1)_20%,transparent)] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--chart-1)_16%,transparent),transparent)]" />
      </div>

      <Card className="relative w-full max-w-md rounded-3xl border border-border/60 bg-card/94 shadow-xl backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_22%,transparent),color-mix(in_oklab,var(--chart-1)_22%,transparent))] text-foreground">
            <span className="text-lg font-semibold">GS</span>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-balance text-3xl font-semibold tracking-tight">
              CRM Lancamento
            </CardTitle>
            <CardDescription>
              Entre para continuar a operação comercial com visão clara, distribuição rápida e acompanhamento do funil.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                autoComplete="email"
                disabled={loading}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                autoComplete="current-password"
                disabled={loading}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Use o email corporativo vinculado ao seu perfil no Supabase.
            </p>

            {error ? (
              <p
                role="alert"
                className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
