'use client';

import { cn } from '@/lib/utils';

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-lg bg-zinc-800/60',
                className
            )}
            {...props}
        />
    );
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-2 w-16" />
                    </div>
                ))}
            </div>
            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                    <Skeleton className="h-4 w-40 mb-4" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                    <Skeleton className="h-4 w-40 mb-4" />
                    <Skeleton className="h-48 w-full rounded-xl" />
                </div>
            </div>
            {/* Mini cards */}
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
                        <Skeleton className="h-6 w-8" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            {/* Filters */}
            <div className="flex gap-4">
                <Skeleton className="h-10 w-64 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            {/* Table header */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="flex gap-4 p-4 border-b border-zinc-800">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-3 w-20" />
                    ))}
                </div>
                {/* Table rows */}
                {[...Array(rows)].map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 border-b border-zinc-800/50">
                        {[...Array(6)].map((_, j) => (
                            <Skeleton key={j} className="h-4 w-20" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(count)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DetailSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            {/* Info cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-3">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                ))}
            </div>
            {/* Component cards */}
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export { Skeleton };
