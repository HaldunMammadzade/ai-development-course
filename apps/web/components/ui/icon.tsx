import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Base>
  );
}

export function IconRevision(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 4v4h4" />
    </Base>
  );
}

export function IconLearn(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 6.5V20" />
    </Base>
  );
}

export function IconHomework(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 4h8l4 4v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M16 4v4h4M9 13h6M9 17h4" />
    </Base>
  );
}

export function IconProject(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="18" height="6" rx="1" />
    </Base>
  );
}

export function IconTest(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8.5 12.5 11 15 16 9" />
    </Base>
  );
}

export function IconGit(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 8v8M8 12h8" />
    </Base>
  );
}

export function IconSpeaking(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </Base>
  );
}

export function IconInterview(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 6h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M8 10h6M8 13h3" />
    </Base>
  );
}

export function IconProgress(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
    </Base>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Base>
  );
}

export function IconBilling(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </Base>
  );
}

export function IconMilestone(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 4h10v16l-5-3-5 3z" />
    </Base>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12.5 9.5 17 19 7" />
    </Base>
  );
}

export function IconSend(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12 20 4l-6 16-2.5-6.5z" />
    </Base>
  );
}
