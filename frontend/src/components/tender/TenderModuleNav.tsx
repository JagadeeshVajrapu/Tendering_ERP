'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Award,
  ClipboardCheck,
  FileText,
  FolderOpen,
  IndianRupee,
  LayoutDashboard,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  match?: 'exact' | 'prefix';
}

interface Props {
  tenderId: string;
  userRole?: UserRole;
  tenderStatus?: string;
  analysisComplete?: boolean;
  hasReport?: boolean;
  className?: string;
}

export function TenderModuleNav({
  tenderId,
  userRole,
  tenderStatus,
  analysisComplete,
  hasReport,
  className,
}: Props) {
  const pathname = usePathname();
  const base = `/tenders/${tenderId}`;

  const items: NavItem[] = [
    {
      href: base,
      label: 'Overview',
      desc: 'Upload & workflow',
      icon: LayoutDashboard,
      match: 'exact',
    },
  ];

  if (analysisComplete) {
    items.push({
      href: `${base}/nit-analysis`,
      label: 'NIT Analysis',
      desc: 'Extracted parameters',
      icon: FileText,
    });
    items.push({
      href: `${base}/checklist`,
      label: 'Checklist',
      desc: 'Compliance requirements',
      icon: ListChecks,
    });
  }

  items.push({
    href: `${base}/document-preparation`,
    label: 'Documents',
    desc: 'Prepare bid documents',
    icon: FolderOpen,
  });

  if (userRole === 'executive' || userRole === 'manager' || userRole === 'admin') {
    items.push({
      href: `${base}/submission-tracking`,
      label: 'Submission',
      desc: 'Track bid submission',
      icon: ClipboardCheck,
    });
  }

  if (userRole === 'executive' || userRole === 'manager' || userRole === 'finance' || userRole === 'admin') {
    items.push({
      href: `${base}/finance-tracking`,
      label: 'Finance',
      desc: 'EMD, BG & deposits',
      icon: IndianRupee,
    });
  }

  const showPostAward =
    tenderStatus === 'AWARDED' ||
    tenderStatus === 'SUBMITTED' ||
    tenderStatus === 'READY_FOR_BID';

  if (
    (userRole === 'executive' || userRole === 'manager' || userRole === 'md' || userRole === 'admin') &&
    showPostAward
  ) {
    items.push({
      href: `${base}/post-award`,
      label: 'Post-Award',
      desc: 'Contract lifecycle',
      icon: Award,
    });
  }

  if (hasReport) {
    items.push({
      href: `${base}/report`,
      label: 'Reports',
      desc: 'Feasibility report',
      icon: FileText,
    });
  }

  const isActive = (item: NavItem) => {
    if (item.match === 'exact') return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const activeItem = items.find(isActive);

  return (
    <div className={cn('space-y-2', className)}>
      <nav
        className="flex items-stretch gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Tender modules"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              title={item.desc}
              className={cn(
                'flex min-w-[7.5rem] shrink-0 flex-col rounded-lg border px-3 py-2 transition-all duration-150 sm:min-w-[8.5rem]',
                active
                  ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-white hover:shadow-sm'
              )}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-white' : 'text-blue-600'
                  )}
                />
                <span className="whitespace-nowrap text-sm font-semibold">{item.label}</span>
              </span>
              <span
                className={cn(
                  'mt-0.5 hidden truncate pl-6 text-[11px] leading-tight sm:block',
                  active ? 'text-blue-100' : 'text-muted-foreground'
                )}
              >
                {item.desc}
              </span>
            </Link>
          );
        })}
      </nav>

      {activeItem && (
        <p className="text-xs text-muted-foreground sm:hidden">{activeItem.desc}</p>
      )}
    </div>
  );
}
