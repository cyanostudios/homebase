import {
    Home,
    FileText,
    BookOpen,
    Calculator,
    FolderOpen,
    Settings,
    User,
    UserCheck,
    Trophy,
    Calendar,
    Package,
  } from 'lucide-react';
  import { LucideIcon } from 'lucide-react';
  
  export interface StaticNavItem {
    label: string;
    icon: LucideIcon;
    category: string;
    order: number;
    page: null;
  }
  
  export const staticNavItems: StaticNavItem[] = [
    // Main category
    {
      label: 'Dashboard',
      icon: Home,
      category: 'Main',
      order: 0,
      page: null,
    },
    {
      label: 'Calendar',
      icon: Calendar,
      category: 'Main',
      order: 4,
      page: null,
    },
    {
      label: 'Planner',
      icon: Calendar,
      category: 'Main',
      order: 5,
      page: null,
    },
    
    // Business category
    {
      label: 'Journal',
      icon: BookOpen,
      category: 'Business',
      order: 2,
      page: null,
    },
    {
      label: 'Bookkeeping',
      icon: Calculator,
      category: 'Business',
      order: 3,
      page: null,
    },
    {
      label: 'Projects',
      icon: FolderOpen,
      category: 'Business',
      order: 4,
      page: null,
    },
    {
      label: 'Equipment',
      icon: Package,
      category: 'Business',
      order: 5,
      page: null,
    },
    
    // Sports category
    {
      label: 'Referee',
      icon: UserCheck,
      category: 'Sports',
      order: 0,
      page: null,
    },
    {
      label: 'Matches',
      icon: Trophy,
      category: 'Sports',
      order: 1,
      page: null,
    },
    
    // Account category
    {
      label: 'Settings',
      icon: Settings,
      category: 'Account',
      order: 0,
      page: null,
    },
    {
      label: 'Profile',
      icon: User,
      category: 'Account',
      order: 1,
      page: null,
    },
  ];
  
  export const categoryOrder = ['Main', 'Business', 'E-Commerce', 'Tools', 'Sports', 'Account'];