'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { toast } from 'sonner';

type AuthTab = 'login' | 'signup';
type UserRole = 'standard' | 'reviewer' | 'admin';

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
  role: UserRole;
  barreauNumber: string;
  acceptTerms: boolean;
}

const demoCredentials = [
  {
    role: 'Utilisateur standard',
    email: 'fotso.mbarga@juriscm.cm',
    password: 'JurisLex2026!',
    description: 'Recherche, Q&A, génération documentaire, dossiers',
  },
  {
    role: 'Juriste réviseur',
    email: 'nkeng.reviseur@juriscm.cm',
    password: 'Reviseur2026!',
    description: 'Annotation, validation, correction des réponses IA',
  },
  {
    role: 'Administrateur',
    email: 'admin.jurislex@juriscm.cm',
    password: 'Admin2026!',
    description: 'Corpus, pipeline d\'ingestion, observatoire',
  },
];

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
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '', role: 'standard', barreauNumber: '', acceptTerms: false },
  });

  const watchedRole = signupForm.watch('role');

  // Backend integration point: POST /api/auth/login with { email, password }
  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 900));

    const valid = demoCredentials.find(
      (c) => c.email === data.email && c.password === data.password
    );

    if (!valid) {
      setIsLoading(false);
      loginForm.setError('email', {
        message: 'Identifiants invalides — utilisez les comptes de démonstration ci-dessous pour vous connecter.',
      });
      return;
    }

    setIsLoading(false);
    toast.success(`Connexion réussie — Bienvenue sur JurisLex`, {
      description: `Rôle : ${valid.role}`,
    });
    router.push('/');
  };

  // Backend integration point: POST /api/auth/signup with { fullName, email, password, role, barreauNumber }
  const handleSignup = async (data: SignupForm) => {
    if (data.password !== data.confirmPassword) {
      signupForm.setError('confirmPassword', { message: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsLoading(false);
    toast.success('Compte créé avec succès', {
      description: 'Vérifiez votre adresse e-mail pour activer votre compte.',
    });
    setTab('login');
  };

  const fillCredentials = (cred: typeof demoCredentials[0]) => {
    loginForm.setValue('email', cred.email);
    loginForm.setValue('password', cred.password);
    setTab('login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] xl:w-[560px] flex-shrink-0 bg-primary p-10 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-64 h-64 border-2 border-white rounded-full" />
          <div className="absolute top-40 left-32 w-96 h-96 border border-white rounded-full" />
          <div className="absolute bottom-20 right-10 w-48 h-48 border-2 border-white rounded-full" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <AppLogo size={40} />
            <span className="text-white text-2xl font-semibold tracking-tight">JurisLex</span>
          </div>

          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white leading-snug mb-4">
              Recherche juridique sourcée pour le droit camerounais et OHADA
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              Chaque affirmation est fondée sur un texte de loi vérifiable. Aucune réponse sans fondement textuel.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: 'MagnifyingGlassIcon', label: 'Recherche exacte, lexicale et sémantique', sub: '4 872 provisions indexées — 3 domaines prioritaires' },
              { icon: 'ShieldCheckIcon', label: 'Citations vérifiées sur identifiants internes', sub: 'Zéro citation fictive — statut juridique explicite' },
              { icon: 'DocumentTextIcon', label: '5 modèles documentaires', sub: 'Mise en demeure, recours, requête et plus' },
              { icon: 'FolderOpenIcon', label: 'Gestion de dossiers sécurisée', sub: 'Isolation stricte — traçabilité complète' },
            ].map((feat, i) => (
              <div key={`feat-${i}`} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name={feat.icon as Parameters<typeof Icon>[0]['name']} size={16} className="text-accent" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{feat.label}</p>
                  <p className="text-white/50 text-xs">{feat.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 p-3 bg-white/10 rounded-lg">
            <Icon name="ShieldCheckIcon" size={16} className="text-accent flex-shrink-0" />
            <p className="text-white/70 text-xs leading-relaxed">
              Données confidentielles — isolation stricte par utilisateur — aucune utilisation pour l'entraînement sans consentement.
            </p>
          </div>
          <p className="text-white/30 text-xs mt-4">
            JurisLex MVP v1.0 — Corpus Cameroun & OHADA — Juillet 2026
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-background overflow-y-auto scrollbar-thin">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <AppLogo size={32} />
            <span className="text-foreground text-xl font-semibold">JurisLex</span>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
                tab === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {/* Login form */}
          {tab === 'login' && (
            <div className="fade-in">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-1">Connexion à JurisLex</h2>
                <p className="text-sm text-muted-foreground">Accédez à votre espace juridique sécurisé.</p>
              </div>

              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="flex flex-col gap-4">
                <div>
                  <label className="label" htmlFor="login-email">
                    Adresse e-mail
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    className={`input-field ${loginForm.formState.errors.email ? 'border-red-400' : ''}`}
                    placeholder="votre@email.cm"
                    {...loginForm.register('email', {
                      required: 'L\'adresse e-mail est obligatoire.',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Adresse e-mail invalide.' },
                    })}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="error-text" role="alert">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0" htmlFor="login-password">
                      Mot de passe
                    </label>
                    <button type="button" className="text-xs text-primary hover:underline">
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className={`input-field pr-10 ${loginForm.formState.errors.password ? 'border-red-400' : ''}`}
                      placeholder="••••••••"
                      {...loginForm.register('password', {
                        required: 'Le mot de passe est obligatoire.',
                        minLength: { value: 8, message: 'Minimum 8 caractères.' },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="error-text" role="alert">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                      loginForm.watch('remember') ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => loginForm.setValue('remember', !loginForm.watch('remember'))}
                    role="checkbox"
                    aria-checked={loginForm.watch('remember')}
                    aria-label="Se souvenir de moi"
                  >
                    {loginForm.watch('remember') && <Icon name="CheckIcon" size={10} className="text-white" />}
                  </div>
                  <label className="text-sm text-foreground cursor-pointer" onClick={() => loginForm.setValue('remember', !loginForm.watch('remember'))}>
                    Se souvenir de moi
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full justify-center py-3 mt-2"
                >
                  {isLoading ? (
                    <>
                      <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <Icon name="ArrowRightOnRectangleIcon" size={16} />
                      Se connecter
                    </>
                  )}
                </button>
              </form>

              {/* Demo credentials */}
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="KeyIcon" size={14} className="text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Comptes de démonstration
                  </p>
                </div>
                <div className="space-y-2">
                  {demoCredentials.map((cred) => (
                    <div
                      key={`demo-${cred.role}`}
                      className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg hover:border-primary/30 hover:bg-muted transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{cred.role}</p>
                        <p className="text-[11px] text-muted-foreground font-mono-ref truncate">{cred.email}</p>
                        <p className="text-[11px] text-muted-foreground">{cred.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fillCredentials(cred)}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium rounded-lg transition-colors"
                        aria-label={`Utiliser le compte ${cred.role}`}
                      >
                        <Icon name="ArrowRightIcon" size={12} />
                        Utiliser
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Signup form */}
          {tab === 'signup' && (
            <div className="fade-in">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-1">Créer votre compte JurisLex</h2>
                <p className="text-sm text-muted-foreground">Accès sécurisé aux textes juridiques camerounais et OHADA.</p>
              </div>

              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="flex flex-col gap-4">
                <div>
                  <label className="label" htmlFor="signup-name">
                    Nom complet <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    className={`input-field ${signupForm.formState.errors.fullName ? 'border-red-400' : ''}`}
                    placeholder="Maître Jean-Paul Mbarga"
                    {...signupForm.register('fullName', { required: 'Le nom complet est obligatoire.' })}
                  />
                  {signupForm.formState.errors.fullName && (
                    <p className="error-text" role="alert">{signupForm.formState.errors.fullName.message}</p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="signup-email">
                    Adresse e-mail professionnelle <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    className={`input-field ${signupForm.formState.errors.email ? 'border-red-400' : ''}`}
                    placeholder="votre@cabinet.cm"
                    {...signupForm.register('email', {
                      required: 'L\'adresse e-mail est obligatoire.',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Adresse e-mail invalide.' },
                    })}
                  />
                  {signupForm.formState.errors.email && (
                    <p className="error-text" role="alert">{signupForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="signup-role">
                    Rôle <span className="text-red-500">*</span>
                  </label>
                  <p className="helper-text mb-2">Votre rôle détermine vos permissions sur la plateforme.</p>
                  <select
                    id="signup-role"
                    className="input-field"
                    {...signupForm.register('role')}
                  >
                    <option value="standard">Utilisateur standard — Recherche, Q&A, dossiers, documents</option>
                    <option value="reviewer">Juriste réviseur — Annotation, validation, correction</option>
                    <option value="admin">Administrateur — Corpus, ingestion, observatoire</option>
                  </select>
                </div>

                {(watchedRole === 'standard' || watchedRole === 'reviewer') && (
                  <div className="fade-in">
                    <label className="label" htmlFor="signup-barreau">
                      Numéro d'inscription au Barreau du Cameroun
                    </label>
                    <p className="helper-text mb-2">Facultatif — permet la vérification de votre qualité de juriste.</p>
                    <input
                      id="signup-barreau"
                      type="text"
                      className="input-field"
                      placeholder="Ex: BCM-2019-0847"
                      {...signupForm.register('barreauNumber')}
                    />
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="signup-password">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`input-field pr-10 ${signupForm.formState.errors.password ? 'border-red-400' : ''}`}
                      placeholder="Minimum 8 caractères"
                      {...signupForm.register('password', {
                        required: 'Le mot de passe est obligatoire.',
                        minLength: { value: 8, message: 'Minimum 8 caractères.' },
                        pattern: {
                          value: /^(?=.*[A-Z])(?=.*[0-9])/,
                          message: 'Le mot de passe doit contenir au moins une majuscule et un chiffre.',
                        },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Masquer' : 'Afficher'}
                    >
                      <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                    </button>
                  </div>
                  {signupForm.formState.errors.password && (
                    <p className="error-text" role="alert">{signupForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="signup-confirm-password">
                    Confirmer le mot de passe <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`input-field pr-10 ${signupForm.formState.errors.confirmPassword ? 'border-red-400' : ''}`}
                      placeholder="Répétez votre mot de passe"
                      {...signupForm.register('confirmPassword', { required: 'Confirmez votre mot de passe.' })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirmPassword ? 'Masquer' : 'Afficher'}
                    >
                      <Icon name={showConfirmPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                    </button>
                  </div>
                  {signupForm.formState.errors.confirmPassword && (
                    <p className="error-text" role="alert">{signupForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer flex-shrink-0 mt-0.5 transition-colors ${
                      signupForm.watch('acceptTerms') ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => signupForm.setValue('acceptTerms', !signupForm.watch('acceptTerms'))}
                    role="checkbox"
                    aria-checked={signupForm.watch('acceptTerms')}
                    aria-label="Accepter les conditions"
                  >
                    {signupForm.watch('acceptTerms') && <Icon name="CheckIcon" size={10} className="text-white" />}
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">
                    J'accepte les{' '}
                    <span className="text-primary hover:underline cursor-pointer">conditions d'utilisation</span>
                    {' '}et la{' '}
                    <span className="text-primary hover:underline cursor-pointer">politique de confidentialité</span>.
                    Je comprends que JurisLex fournit une assistance juridique documentaire, non une garantie de résultat.
                  </p>
                </div>
                {signupForm.formState.errors.acceptTerms && (
                  <p className="error-text" role="alert">Vous devez accepter les conditions d'utilisation.</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !signupForm.watch('acceptTerms')}
                  className="btn-primary w-full justify-center py-3 mt-2"
                >
                  {isLoading ? (
                    <>
                      <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                      Création du compte...
                    </>
                  ) : (
                    <>
                      <Icon name="UserPlusIcon" size={16} />
                      Créer mon compte
                    </>
                  )}
                </button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Déjà inscrit ?{' '}
                <button onClick={() => setTab('login')} className="text-primary hover:underline font-medium">
                  Se connecter
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}