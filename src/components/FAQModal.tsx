import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger
} from '@/components/ui/accordion'
import { Copy, Check, ChevronRight, ScrollText } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── FAQ content ──────────────────────────────────────────────────────────────

const WALLET_ADDRESS = 'BMi2W2cLPR4HycBsXgpbMuMcr5PYKseRbJ8wMJyeAdXM'

function FAQContent() {
    const [copied, setCopied] = React.useState(false)

    const copyWallet = async () => {
        try {
            await navigator.clipboard.writeText(WALLET_ADDRESS)
            setCopied(true)
            toast.success('Wallet address copied')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Failed to copy')
        }
    }

    return (
        <Accordion type='single' collapsible className='space-y-2'>
            <AccordionItem
                value='refund'
                className='rounded-lg bg-white/3 ring-1 ring-white/8 border-0 px-3'
            >
                <AccordionTrigger className='text-sm font-medium text-white hover:no-underline py-3'>
                    Refund Policy
                </AccordionTrigger>
                <AccordionContent className='text-xs text-muted pb-3'>
                    All sales are final. We do not offer refunds for license
                    keys once they have been purchased and delivered. Please
                    ensure you understand the product before making a purchase.
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value='stability'
                className='rounded-lg bg-white/3 ring-1 ring-white/8 border-0 px-3'
            >
                <AccordionTrigger className='text-sm font-medium text-white hover:no-underline py-3'>
                    Service Stability & Data Sources
                </AccordionTrigger>
                <AccordionContent className='text-xs text-muted pb-3'>
                    Spark relies on external third-party data sources and APIs.
                    We do not guarantee uninterrupted service, data accuracy, or
                    availability. External services may experience downtime,
                    rate limits, or changes that are beyond our control. Use
                    this software at your own risk.
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value='liability'
                className='rounded-lg bg-white/3 ring-1 ring-white/8 border-0 px-3'
            >
                <AccordionTrigger className='text-sm font-medium text-white hover:no-underline py-3'>
                    Limitation of Liability
                </AccordionTrigger>
                <AccordionContent className='text-xs text-muted pb-3'>
                    We are not responsible for any financial losses, missed
                    opportunities, or damages resulting from the use of this
                    software. Trading and investing in cryptocurrencies carries
                    inherent risks. This software is provided "as is" without
                    warranties of any kind.
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value='usage'
                className='rounded-lg bg-white/3 ring-1 ring-white/8 border-0 px-3'
            >
                <AccordionTrigger className='text-sm font-medium text-white hover:no-underline py-3'>
                    Acceptable Use
                </AccordionTrigger>
                <AccordionContent className='text-xs text-muted pb-3'>
                    This software is for personal use only. You may not share,
                    resell, or redistribute your license key. Violation of these
                    terms may result in immediate license revocation without
                    refund.
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value='payment'
                className='rounded-lg bg-white/3 ring-1 ring-white/8 border-0 px-3'
            >
                <AccordionTrigger className='text-sm font-medium text-white hover:no-underline py-3'>
                    Payment Information
                </AccordionTrigger>
                <AccordionContent className='text-xs text-muted pb-3 space-y-2'>
                    <p>
                        All payments for license keys are processed via Solana
                        blockchain to our official wallet address:
                    </p>
                    <div className='flex items-center gap-2 rounded-md bg-white/5 ring-1 ring-white/8 p-2.5'>
                        <span className='font-mono text-xs text-white flex-1 break-all'>
                            {WALLET_ADDRESS}
                        </span>
                        <button
                            type='button'
                            onClick={() => void copyWallet()}
                            className='shrink-0 text-muted hover:text-white transition-colors'
                            title='Copy wallet address'
                        >
                            {copied ? (
                                <Check className='h-4 w-4 text-emerald-400' />
                            ) : (
                                <Copy className='h-4 w-4' />
                            )}
                        </button>
                    </div>
                    <p className='text-amber-300/80'>
                        ⚠️ Always verify the wallet address before sending
                        payment. We are not responsible for funds sent to
                        incorrect addresses.
                    </p>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                value='support'
                className='rounded-lg bg-white/3 ring-1 ring-white/8 border-0 px-3'
            >
                <AccordionTrigger className='text-sm font-medium text-white hover:no-underline py-3'>
                    Support & Contact
                </AccordionTrigger>
                <AccordionContent className='text-xs text-muted pb-3'>
                    For license purchases, renewals, or technical support,
                    contact us on Telegram:{' '}
                    <a
                        href='https://t.me/neckkero'
                        target='_blank'
                        rel='noreferrer'
                        className='text-sky-400 hover:text-sky-300 transition-colors'
                    >
                        @neckkero
                    </a>
                    . Response times may vary.
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}

// ─── FAQModal ─────────────────────────────────────────────────────────────────

export function FAQModal() {
    const [open, setOpen] = React.useState(false)

    return (
        <>
            {/* ── full-width trigger block ── */}
            <button
                type='button'
                onClick={() => setOpen(true)}
                className='group w-full cursor-pointer rounded-lg bg-white/3 ring-1 ring-white/8 hover:bg-white/5 hover:ring-white/15 transition-all duration-200 p-3'
            >
                <div className='flex items-center gap-3'>
                    {/* icon */}
                    <div className='shrink-0 h-9 w-9 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center group-hover:bg-white/8 transition-colors'>
                        <ScrollText className='h-4 w-4 text-zinc-400 group-hover:text-zinc-200 transition-colors' />
                    </div>

                    {/* text */}
                    <div className='flex-1 min-w-0 text-left'>
                        <p className='text-sm font-medium text-zinc-200'>Terms & FAQ</p>
                        <p className='text-xs text-muted mt-0.5'>
                            Refund policy, liability & payment info
                        </p>
                    </div>

                    {/* arrow */}
                    <ChevronRight className='shrink-0 h-4 w-4 text-zinc-500 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all' />
                </div>
            </button>

            {/* ── modal ── */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className='sm:max-w-md max-h-[80vh] overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>Terms & FAQ</DialogTitle>
                        <DialogDescription>
                            Important information before you get started
                        </DialogDescription>
                    </DialogHeader>

                    <FAQContent />
                </DialogContent>
            </Dialog>
        </>
    )
}
