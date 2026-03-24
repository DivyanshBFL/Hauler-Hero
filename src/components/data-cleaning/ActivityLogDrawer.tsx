import { Bot, Download, FileClock, FileText, Loader2, Sparkles, Type, UserCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ActivityLogItem } from './types';

type Props = {
    open: boolean;
    loading: boolean;
    error: string | null;
    items: ActivityLogItem[];
    onClose: () => void;
};

export default function ActivityLogDrawer({ open, loading, error, items, onClose }: Props) {
    const [mounted, setMounted] = useState(open);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (open) {
            setVisible(false);
            setMounted(true);
            const timeoutId = window.setTimeout(() => setVisible(true), 10);
            return () => window.clearTimeout(timeoutId);
        }

        setVisible(false);
        const timeoutId = window.setTimeout(() => setMounted(false), 300);
        return () => window.clearTimeout(timeoutId);
    }, [open]);

    if (!mounted) return null;

    return (
        <div className={`fixed inset-0 z-[80] bg-black/20 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}>
            <div
                className={`absolute right-0 top-0 h-full w-full max-w-[560px] bg-white border-l border-border shadow-2xl transition-transform duration-300 ease-in-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-12 px-6 border-b border-border bg-white flex items-center justify-between">
                    <h2 className="flex items-center text-md leading-none font-light text-foreground">
                        <FileClock className="mr-2 h-4 w-4" />
                        <span>Activity Log</span>
                    </h2>
                    <button onClick={onClose} className="text-foreground/80 hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto h-[calc(100%-64px)]">
                    {loading && (
                        <div className="rounded-xl bg-white border border-[#d7dbe1] p-6 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Loading activity log...
                        </div>
                    )}

                    {error && !loading && (
                        <div className="rounded-xl bg-white border border-red-200 p-6 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {items.map((item) => {
                        const leadingIcon =
                            item.kind === 'source' ? <FileText className="h-5 w-5 text-slate-600" /> :
                                item.kind === 'import' ? <Download className="h-5 w-5 text-white" /> :
                                    item.actor === 'ai' ? <Sparkles className="h-5 w-5 text-white" /> :
                                        <Type className="h-5 w-5 text-white" />;

                        const leadingBg =
                            item.kind === 'source' ? 'bg-slate-100 border border-slate-300' :
                                'bg-emerald-500';

                        return (
                            <div key={item.id} className="rounded-md bg-white border border-[#d7dbe1] shadow-sm px-3 py-2">
                                <div className="flex items-center gap-4">
                                    <div className={'h-10 w-10 rounded-full flex items-center justify-center ' + leadingBg}>
                                        {leadingIcon}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-normal leading-6 text-foreground">{item.title}</p>
                                        {!!item.description && <p className="text-xs text-muted-foreground leading-5">{item.description}</p>}
                                        {/* <p className="text-xs text-muted-foreground mt-1">{item.timestamp}</p> */}
                                    </div>

                                    {item.actor === 'user' && <UserCircle2 className="h-5 w-5 text-muted-foreground" />}
                                    {item.actor === 'ai' && <Bot className="h-5 w-5 text-muted-foreground" />}
                                </div>
                            </div>
                        );
                    })}

                    {!items.length && !loading && !error && (
                        <div className="rounded-md bg-white border border-[#d7dbe1] p-6 text-sm text-muted-foreground">
                            No activity yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
