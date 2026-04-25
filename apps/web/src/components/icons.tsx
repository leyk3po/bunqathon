export function CameraIcon() {
  return (
    <svg aria-hidden fill="none" height="34" viewBox="0 0 24 24" width="34">
      <path d="M8.25 6.75 9.7 5h4.6l1.45 1.75H19A2.25 2.25 0 0 1 21.25 9v7A2.25 2.25 0 0 1 19 18.25H5A2.25 2.25 0 0 1 2.75 16V9A2.25 2.25 0 0 1 5 6.75h3.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function MicIcon({ active = false }: { active?: boolean }) {
  return (
    <svg aria-hidden fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M12 14.25A3.25 3.25 0 0 0 15.25 11V6.5a3.25 3.25 0 0 0-6.5 0V11A3.25 3.25 0 0 0 12 14.25Z" stroke="currentColor" strokeWidth={active ? "2.4" : "1.8"} />
      <path d="M5.75 10.75a6.25 6.25 0 0 0 12.5 0M12 17v3.25M8.75 20.25h6.5" stroke="currentColor" strokeLinecap="round" strokeWidth={active ? "2.4" : "1.8"} />
    </svg>
  );
}

export function SparkIcon() {
  return (
    <svg aria-hidden fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" fill="currentColor" />
      <path d="m18 15 .9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9L18 15Z" fill="currentColor" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg aria-hidden fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function BunqLogo() {
  return (
    <svg aria-label="bunq" fill="none" height="20" viewBox="0 0 60 24" width="60">
      <text x="0" y="19" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="22" fill="currentColor" letterSpacing="-1">bunq</text>
    </svg>
  );
}
