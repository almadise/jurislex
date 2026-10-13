'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { toast } from 'sonner';
import { apiLogin, apiSignup } from '@/lib/auth/client';

type AuthTab = 'login' | 'signup';

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

interface SignupForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  barreauNumber: string;
  acceptTerms: boolean;
}

export default function AuthContent() {
  const [tab, setTab] = useState<AuthTab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const loginForm = useForm<LoginForm>({
    defaultValues: { email: '', password: '', remember: false },
  });

  const signupForm = useForm<SignupForm>({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      barreauNumber: '',
      acceptTerms: false,
    },
  });

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const user = await apiLogin(data.email, data.password);
      toast.success('Connexion réussie', {
        description: `${user.fullName} · rôle ${user.role}`,
      });
      router.push('/case-management');
      router.refresh();
    } catch (e) {
      loginForm.setError('email', {
        message: (e as Error).message || 'Identifiants invalides.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    if (data.password !== data.confirmPassword) {
      signupForm.setError('confirmPassword', {
        message: 'Les mots de passe ne correspondent pas.',
      });
      return;
    }
    if (!data.acceptTerms) {
      signupForm.setError('acceptTerms', {
        message: 'Vous devez accepter les conditions.',
      });
      return;
    }
    setIsLoading(true);
    try {
      const user = await apiSignup({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        barreauNumber: data.barreauNumber || undefined,
      });
      toast.success('Compte créé', {
        description: `Bienvenue ${user.fullName} · rôle ${user.role} (non choisi à l’inscription).`,
      });
      router.push('/case-management');
      router.refresh();
    } catch (e) {
      signupForm.setError('email', { message: (e as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-col justify-between w-[480px] xl:w-[560px] flex-shrink-0 bg-primary p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-64 h-64 border-2 border-white rounded-full" />
          <div className="absolute top-40 left-32 w-96 h-96 border border-white rounded-full" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <AppLogo size={40} />
            <span className="text-white text-xl font-semibold">JurisLex</span>
          </div>
          <h1 className="text-3xl font-semibold text-white leading-tight mb-4">
            Assistance juridique traçable
          </h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-sm">
            Les dossiers sont isolés par utilisateur. Les données de dossier sont traitées comme
            sensibles — audit des accès et pas de partage croisé.
          </p>
        </div>
        <p className="relative z-10 text-white/40 text-xs">
          Assistance documentaire — pas un avis d&apos;avocat.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <AppLogo size={32} />
            <span className="font-semibold text-lg">JurisLex</span>
          </div>

          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'login' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === 'signup' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
              }`}
            >
              Inscription
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div>
                <label className="label" htmlFor="login-email">
                  E-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="input-field"
                  placeholder="vous@cabinet.cm"
                  autoComplete="email"
                  {...loginForm.register('email', { required: 'E-mail requis' })}
                />
                {loginForm.formState.errors.email && (
                  <p className="error-text">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="login-password">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    autoComplete="current-password"
                    {...loginForm.register('password', { required: 'Mot de passe requis' })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Afficher le mot de passe"
                  >
                    <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center">
                {isLoading ? (
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                ) : (
                  'Se connecter'
                )}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                Pas de comptes démo en clair — créez un compte via l&apos;onglet Inscription.
              </p>
            </form>
          ) : (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <div>
                <label className="label" htmlFor="signup-name">
                  Nom complet
                </label>
                <input
                  id="signup-name"
                  className="input-field"
                  placeholder="Maître Jean-Paul Mbarga"
                  {...signupForm.register('fullName', { required: 'Nom requis' })}
                />
                {signupForm.formState.errors.fullName && (
                  <p className="error-text">{signupForm.formState.errors.fullName.message}</p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="signup-email">
                  E-mail
                </label>
                <input
                  id="signup-email"
                  type="email"
                  className="input-field"
                  {...signupForm.register('email', { required: 'E-mail requis' })}
                />
                {signupForm.formState.errors.email && (
                  <p className="error-text">{signupForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="signup-barreau">
                  N° de barreau (facultatif)
                </label>
                <input
                  id="signup-barreau"
                  className="input-field"
                  placeholder="Pour les professionnels du droit"
                  {...signupForm.register('barreauNumber')}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Le rôle (standard / reviewer / admin) n’est pas choisi à l’inscription — promotion
                  réservée à un administrateur.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="signup-password">
                  Mot de passe (min. 8)
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    autoComplete="new-password"
                    {...signupForm.register('password', {
                      required: 'Requis',
                      minLength: { value: 8, message: '8 caractères minimum' },
                    })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    <Icon name={showConfirmPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="signup-confirm">
                  Confirmer le mot de passe
                </label>
                <input
                  id="signup-confirm"
                  type="password"
                  className="input-field"
                  autoComplete="new-password"
                  {...signupForm.register('confirmPassword', { required: 'Requis' })}
                />
                {signupForm.formState.errors.confirmPassword && (
                  <p className="error-text">
                    {signupForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" className="mt-0.5" {...signupForm.register('acceptTerms')} />
                J&apos;accepte que JurisLex traite mon compte et mes dossiers comme données
                sensibles, sans utilisation pour l&apos;entraînement sans consentement.
              </label>
              {signupForm.formState.errors.acceptTerms && (
                <p className="error-text">{signupForm.formState.errors.acceptTerms.message}</p>
              )}
              <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center">
                {isLoading ? (
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
