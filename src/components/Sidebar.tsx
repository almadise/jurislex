'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  group?: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Recherche juridique', href: '/', icon: 'MagnifyingGlassIcon', group: 'Recherche' },
  { label: 'Questions & Réponses', href: '/legal-q-a', icon: 'ChatBubbleLeftRightIcon', badge: 2, group: 'Recherche' },
  { label: 'Analyse de situation', href: '/legal-analysis', icon: 'DocumentMagnifyingGlassIcon', group: 'Analyse' },
  { label: 'Génération documentaire', href: '/document-generation', icon: 'DocumentTextIcon', group: 'Analyse' },
  { label: 'Gestion des dossiers', href: '/case-management', icon: 'FolderOpenIcon', badge: 3, group: 'Dossiers' },
  { label: 'Interface Réviseur', href: '/revision', icon: 'ClipboardDocumentCheckIcon', group: 'Révision', roles: ['reviseur', 'reviewer', 'admin'] },
  { label: 'Observatoire MAJ', href: '/observatoire', icon: 'BellAlertIcon', group: 'Révision', roles: ['reviseur', 'reviewer', 'admin'] },
  { label: "Pipeline d'ingestion", href: '/admin/ingestion', icon: 'ServerStackIcon', group: 'Administration', roles: ['admin'] },
];

const bottomItems: NavItem[] = [
  { label: 'Paramètres', href: '/settings', icon: 'Cog6ToothIcon' },
  { label: 'Connexion', href: '/sign-up-login', icon: 'ArrowRightOnRectangleIcon' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<{ full_name?: string; role?: string } | null>(null);

  useEffect(() => {
    if (user) {
      getUserProfile()
        .then((p: any) => setUserProfile(p))
        .catch(() => setUserProfile(null));
    } else {
      setUserProfile(null);
    }
  }, [user, getUserProfile]);

  const userRole = userProfile?.role ?? null;

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return userRole && item.roles.includes(userRole);
  });

  const groups = Array.from(new Set(visibleNavItems.map((i) => i.group)));

  const initials = userProfile?.full_name
    ? userProfile.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const roleLabel =
    userRole === 'reviseur' || userRole === 'reviewer' ? 'Juriste Réviseur'
    : userRole === 'admin'? 'Administrateur' :'Juriste — Standard';

  return (
    <aside
      className="fixed left-0 top-0 h-full bg-primary flex flex-col z-40 sidebar-transition overflow-hidden"
      style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-[60px] border-b border-white/10 flex-shrink-0">
        <AppLogo size={32} className="flex-shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-white text-base tracking-tight whitespace-nowrap overflow-hidden">
            JurisLex
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2">
        {groups.map((group) => (
          <div key={`group-${group}`} className="mb-4">
            {!collapsed && (
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
                {group}
              </p>
            )}
            {visibleNavItems
              .filter((i) => i.group === group)
              .map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={`nav-${item.href}`}
                    href={item.href}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-150 group ${
                      isActive
                        ? 'bg-white/15 text-white' :'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      name={item.icon as Parameters<typeof Icon>[0]['name']}
                      size={18}
                      className="flex-shrink-0"
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1">
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="bg-accent text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    )}
                    {collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute top-1 right-1 bg-accent text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-foreground text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-white/10 flex-shrink-0">
        {bottomItems.map((item) => (
          <Link
            key={`bottom-${item.href}`}
            href={item.href}
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-white/50 hover:bg-white/10 hover:text-white transition-all duration-150 group"
            title={collapsed ? item.label : undefined}
          >
            <Icon
              name={item.icon as Parameters<typeof Icon>[0]['name']}
              size={18}
              className="flex-shrink-0"
            />
            {!collapsed && (
              <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
            )}
            {collapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-foreground text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {item.label}
              </span>
            )}
          </Link>
        ))}

        {/* User */}
        <div className={`flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg bg-white/5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white text-xs font-semibold truncate">
                {userProfile?.full_name ?? user?.email ?? 'Utilisateur'}
              </p>
              <p className="text-white/40 text-[10px] truncate">{roleLabel}</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center mt-2 py-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
        >
          <Icon
            name={collapsed ? 'ChevronRightIcon' : 'ChevronLeftIcon'}
            size={16}
          />
        </button>
      </div>
    </aside>
  );
}