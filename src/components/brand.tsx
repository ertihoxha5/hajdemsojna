import Image from "next/image";
import Link from "next/link";

/** The Hajde Msojna mark. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      priority
      className="shrink-0"
    />
  );
}

/** Mark plus wordmark, optionally linked. */
export function Wordmark({
  size = 32,
  href = "/",
  tagline,
}: {
  size?: number;
  href?: string | null;
  tagline?: string;
}) {
  const inner = (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className="block text-[16px] font-semibold tracking-[-0.025em] text-ink">
          Hajde <span className="text-mint-deep">Msojna</span>
        </span>
        {tagline && <span className="block text-[11px] text-faint">{tagline}</span>}
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  );
}
