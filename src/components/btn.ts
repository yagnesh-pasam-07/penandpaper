/** Button looks, as class strings. A plain module (not client-only), so server components can use them. */
const base = "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed";
export const btn = {
  primary: `${base} h-[52px] px-6 rounded-[14px] bg-red text-on-red text-base hover:brightness-95`,
  primarySm: `${base} h-12 px-[22px] rounded-xl bg-red text-on-red hover:brightness-95`,
  ink: `${base} h-[52px] px-6 rounded-[14px] bg-ink text-bg text-base`,
  ghost: `${base} h-12 px-[18px] rounded-xl text-ink font-medium hover:bg-soft`,
  outline: `${base} h-[52px] px-[22px] rounded-[14px] border border-line bg-sheet text-ink font-medium hover:bg-soft`,
  disabled: `${base} h-12 px-5 rounded-xl border border-line text-mute`,
};

