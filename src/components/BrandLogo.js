import Image from "next/image";

// Logo artwork is 448×220. Both variants render; CSS shows the one that
// matches the active theme (dark ink on light, white ink on dark).
const RATIO = 448 / 220;

export default function BrandLogo({ height = 36, inverse = false, priority = false }) {
  const width = Math.round(height * RATIO);

  if (inverse) {
    return (
      <Image alt="Moonkalp" className="brand-logo" height={height} priority={priority} src="/brand/moonkalp-logo-white.png" width={width} />
    );
  }

  return (
    <span className="brand-logo-pair">
      <Image alt="Moonkalp" className="brand-logo brand-logo-on-light" height={height} priority={priority} src="/brand/moonkalp-logo.png" width={width} />
      <Image alt="" aria-hidden="true" className="brand-logo brand-logo-on-dark" height={height} priority={priority} src="/brand/moonkalp-logo-white.png" width={width} />
    </span>
  );
}
