'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

interface TopbarProps {
  sidebarCollapsed: boolean;
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export default function Topbar({ sidebarCollapsed, title, breadcrumbs }: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const sidebarWidth = sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  return (
    <header
      className="fixed top-0 right-0 h-[60px] bg-card border-b border-border flex items-center px-6 gap-4 z-30 sidebar-transition"
      style={{ left: sidebarWidth }}
    >
      {/* Breadcrumbs / Title */}
      <div className="flex-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={`crumb-${i}`}>
                {i > 0 && (
                  <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground flex-shrink-0" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-foreground">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        )}
      </div>

      {/* Global Search */}
      <button
        onClick={() => setSearchOpen(!searchOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors border border-border"
        aria-label="Recherche globale"
      >
        <Icon name="MagnifyingGlassIcon" size={14} />
        <span className="hidden sm:inline">Recherche globale</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Notifications">
        <Icon name="BellIcon" size={18} className="text-muted-foreground" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border-2 border-card" />
      </button>

      {/* Corpus status */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs font-medium text-green-700">Corpus actif</span>
      </div>

      {/* Last updated */}
      <span className="hidden lg:block text-xs text-muted-foreground font-mono-ref">
        MàJ: 17/07/2026
      </span>
    </header>
  );
}