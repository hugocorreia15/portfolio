"use client";

import { MAPS, type MapDef, type MapId } from "@/lib/maps";
import { profile, type SectionId } from "@/data/profile";

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-ink/15 bg-white/70 px-2.5 py-1 text-xs text-ink/80"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
      {children}
    </h3>
  );
}

function AboutContent() {
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-azulejo font-display text-xl text-salt">
          HC
        </div>
        <div>
          <p className="font-display text-lg leading-tight text-ink">{profile.name}</p>
          <p className="text-sm text-ink/60">{profile.title}</p>
          <p className="font-mono text-[11px] text-ink/45">{profile.location}</p>
        </div>
      </div>
      {profile.about.map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="text-[15px] leading-relaxed text-ink/80">
          {paragraph}
        </p>
      ))}
      <div className="space-y-2">
        <SectionHeading>Areas of interest</SectionHeading>
        <Chips items={profile.interests} />
      </div>
      <div className="space-y-2">
        <SectionHeading>Languages</SectionHeading>
        <div className="flex gap-4">
          {profile.languages.map((l) => (
            <p key={l.name} className="text-sm text-ink/80">
              <span className="font-medium text-ink">{l.name}</span>
              <span className="text-ink/50"> · {l.level}</span>
            </p>
          ))}
        </div>
      </div>
    </>
  );
}

function ExperienceContent() {
  return (
    <ol className="space-y-6">
      {profile.experience.map((entry) => (
        <li key={entry.role} className="relative border-l border-ink/15 pl-5">
          <span className="absolute -left-[5.5px] top-1.5 size-2.5 rounded-full bg-(--accent)" />
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink/50">
            {entry.period}
          </p>
          <h3 className="mt-0.5 font-display text-lg leading-snug text-ink">{entry.role}</h3>
          <p className="mt-0.5 text-[13px] leading-snug text-ink/60">{entry.org}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-ink/75 marker:text-ink/30">
            {entry.points.map((point) => (
              <li key={point.slice(0, 24)}>{point}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function ProjectsContent() {
  return (
    <div className="space-y-3">
      {profile.projects.map((project) => (
        <article
          key={project.name}
          className="rounded-xl border border-ink/10 bg-white/65 p-4 shadow-[0_1px_0_rgba(22,50,74,0.06)]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-base text-ink">{project.name}</h3>
            <span className="flex shrink-0 gap-2 font-mono text-[11px]">
              {project.link && (
                <a
                  className="text-azulejo underline-offset-2 hover:underline"
                  href={project.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  live ↗
                </a>
              )}
              {project.repo && (
                <a
                  className="text-ink/55 underline-offset-2 hover:underline"
                  href={project.repo}
                  target="_blank"
                  rel="noreferrer"
                >
                  code ↗
                </a>
              )}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/75">{project.description}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {project.tech.map((t) => (
              <span
                key={t}
                className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10.5px] text-ink/65"
              >
                {t}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function SkillsContent() {
  return (
    <>
      {Object.entries(profile.skills).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <SectionHeading>{category}</SectionHeading>
          <Chips items={items} />
        </div>
      ))}
      <div className="space-y-2 border-t border-ink/10 pt-4">
        <SectionHeading>Soft skills</SectionHeading>
        <Chips items={profile.softSkills} />
      </div>
    </>
  );
}

function EducationContent() {
  return (
    <div className="space-y-3">
      {profile.education.map((entry) => (
        <article
          key={entry.degree}
          className="rounded-xl border border-ink/10 bg-white/65 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base leading-snug text-ink">{entry.degree}</h3>
              <p className="mt-0.5 text-[13px] text-ink/60">{entry.school}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink/45">{entry.period}</p>
            </div>
            {entry.average && (
              <span className="shrink-0 rounded-lg bg-(--accent)/12 px-2 py-1 font-mono text-[11px] font-medium text-ink/80">
                {entry.average}
              </span>
            )}
          </div>
          {entry.highlights && (
            <ul className="mt-2.5 space-y-1 text-[13px] text-ink/70">
              {entry.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="text-(--accent)">▸</span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

function ContactContent() {
  const rows = [
    { label: "Email", value: profile.email, href: `mailto:${profile.email}` },
    { label: "University", value: profile.emailAlt, href: `mailto:${profile.emailAlt}` },
    { label: "Phone", value: profile.phone, href: `tel:${profile.phone.replace(/\s/g, "")}` },
    { label: "GitHub", value: "@hugocorreia15", href: profile.github },
    { label: "LinkedIn", value: "hugo-correia", href: profile.linkedin },
    { label: "ORCID", value: "0009-0009-0206-5346", href: profile.orcid },
  ];
  return (
    <>
      <p className="text-[15px] leading-relaxed text-ink/80">
        The lighthouse marks the end of the route — but it&apos;s where new journeys
        start. Get in touch:
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <a
            key={row.label}
            href={row.href}
            target={row.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="group flex items-baseline justify-between rounded-lg border border-ink/10 bg-white/65 px-3.5 py-2.5 transition-colors hover:border-(--accent)"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink/45">
              {row.label}
            </span>
            <span className="text-sm text-ink/85 group-hover:text-ink">{row.value}</span>
          </a>
        ))}
      </div>
      <a
        href="/cv/Hugo-Correia-CV.pdf"
        download
        className="block rounded-xl bg-azulejo px-4 py-3 text-center font-display text-[15px] text-salt shadow-lg shadow-azulejo/25 transition-transform hover:-translate-y-0.5"
      >
        Download CV ↓
      </a>
    </>
  );
}

const SECTION_CONTENT: Record<SectionId, () => React.ReactNode> = {
  about: AboutContent,
  experience: ExperienceContent,
  projects: ProjectsContent,
  skills: SkillsContent,
  education: EducationContent,
  contact: ContactContent,
};

export default function Overlay({
  map,
  mapId,
  targetIndex,
  dockedIndex,
  nearPort,
  panelOpen,
  showHint,
  onNavigate,
  onRequestDock,
  onSwitchMap,
  onClose,
}: {
  map: MapDef;
  mapId: MapId;
  targetIndex: number | null;
  dockedIndex: number | null;
  nearPort: number | null;
  panelOpen: boolean;
  showHint: boolean;
  onNavigate: (index: number) => void;
  onRequestDock: (index: number) => void;
  onSwitchMap: (id: MapId) => void;
  onClose: () => void;
}) {
  const sailing = targetIndex !== null && dockedIndex !== targetIndex;
  const freeHelm = targetIndex === null;
  const docked = dockedIndex !== null ? map.ports[dockedIndex] : null;
  const Content = docked ? SECTION_CONTENT[docked.id] : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 text-ink">
      {/* header */}
      <header className="absolute left-5 top-5 max-w-[60vw] md:left-8 md:top-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50 md:text-[11px]">
          Ria de Aveiro · Portfólio
        </p>
        <h1 className="mt-1 font-display text-3xl leading-none text-ink md:text-4xl">
          {profile.name}
        </h1>
        <p className="mt-1.5 text-sm text-ink/65 md:text-[15px]">{profile.title}</p>
      </header>

      {/* map switch — the imagined island or the real Aveiro (coming soon) */}
      <div className="pointer-events-auto absolute left-1/2 top-5 z-40 flex -translate-x-1/2 rounded-full border border-ink/10 bg-salt/85 p-1 font-mono text-[11px] shadow-lg shadow-ink/10 backdrop-blur">
        {(Object.keys(MAPS) as MapId[]).map((id) => {
          const soon = MAPS[id].comingSoon;
          return (
            <button
              key={id}
              disabled={soon}
              title={soon ? "Coming soon" : undefined}
              onClick={(e) => {
                e.currentTarget.blur();
                if (!soon && id !== mapId) onSwitchMap(id);
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 uppercase tracking-[0.15em] transition-colors ${
                id === mapId
                  ? "bg-azulejo text-salt"
                  : soon
                    ? "cursor-not-allowed text-ink/30"
                    : "text-ink/55 hover:text-ink"
              }`}
            >
              {MAPS[id].label}
              {soon && (
                <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[8.5px] tracking-wider text-ink/45">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* social links */}
      <nav className="pointer-events-auto absolute right-5 top-6 hidden gap-2 font-mono text-[11px] md:flex">
        {[
          { label: "github", href: profile.github },
          { label: "linkedin", href: profile.linkedin },
          { label: "orcid", href: profile.orcid },
        ].map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-ink/15 bg-salt/80 px-3 py-1.5 backdrop-blur transition-colors hover:border-azulejo hover:text-azulejo"
          >
            {link.label} ↗
          </a>
        ))}
      </nav>

      {/* coordinates, like a chart plotter */}
      <p className="absolute bottom-5 left-5 hidden font-mono text-[10px] tracking-wider text-ink/40 md:block">
        40.6405° N, 8.6538° W — RIA DE AVEIRO
      </p>

      {/* model credits (CC-BY attribution — full table in the README) */}
      <p className="pointer-events-auto absolute bottom-5 right-5 hidden font-mono text-[10px] text-ink/40 md:block">
        moliceiro:{" "}
        <a
          href="https://skfb.ly/ouOAW"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:text-azulejo hover:underline"
        >
          ricardo.turmas
        </a>{" "}
        ·{" "}
        <a
          href="https://github.com/hugocorreia15/portfolio#optional-scenery-models-3d-credits"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:text-azulejo hover:underline"
        >
          3D credits ↗
        </a>
      </p>

      {/* sailing toast */}
      {sailing && targetIndex !== null && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2 rounded-full border border-ink/10 bg-salt/85 px-4 py-2 font-mono text-[11px] tracking-wide text-ink/70 backdrop-blur md:top-24">
          A navegar para {map.ports[targetIndex].caisName}
          <span className="sailing-dots" aria-hidden />
        </div>
      )}

      {/* free-helm dock prompt — tappable for touch, E for keyboards */}
      {freeHelm && dockedIndex === null && nearPort !== null && (
        <button
          onClick={() => onRequestDock(nearPort)}
          className="pointer-events-auto absolute bottom-44 left-1/2 -translate-x-1/2 rounded-full bg-ink/85 px-4 py-2 text-[13px] text-salt shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-ink md:bottom-28"
        >
          ⚓ Dock at {map.ports[nearPort].caisName}
          <kbd className="ml-1.5 hidden rounded bg-salt/20 px-1.5 font-mono text-[12px] md:inline">
            E
          </kbd>
        </button>
      )}

      {/* first-visit hint */}
      {showHint && !panelOpen && !sailing && (
        <div className="hint-bob absolute bottom-44 left-1/2 -translate-x-1/2 max-w-[88vw] rounded-full bg-ink/85 px-4 py-2 text-center text-[13px] text-salt shadow-lg md:bottom-28">
          ⚓ Sail with{" "}
          <kbd className="rounded bg-salt/20 px-1.5 font-mono text-[12px]">WASD</kbd> or the
          joystick · drag to look around · tap a pier for autopilot
        </div>
      )}

      {/* dock navigation */}
      <nav className="pointer-events-auto absolute inset-x-0 bottom-4 flex justify-center px-3 md:bottom-6">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-ink/10 bg-salt/85 p-1.5 shadow-xl shadow-ink/10 backdrop-blur-md">
          {map.ports.map((port, i) => {
            const isHere = dockedIndex === i;
            const isTarget = targetIndex === i && sailing;
            return (
              <button
                key={port.id}
                onClick={(e) => {
                  e.currentTarget.blur(); // keep Enter free for dock requests
                  onNavigate(i);
                }}
                style={{ "--accent": port.accent } as React.CSSProperties}
                className={`flex shrink-0 flex-col items-start rounded-xl px-3 py-1.5 text-left transition-all ${
                  isHere
                    ? "bg-(--accent)/15 shadow-inner"
                    : "hover:bg-ink/[0.05]"
                } ${isTarget ? "animate-pulse" : ""}`}
              >
                <span
                  className={`font-mono text-[9px] tracking-widest ${
                    isHere ? "text-(--accent)" : "text-ink/35"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[12.5px] font-medium leading-tight text-ink/85 md:text-[13px]">
                  {port.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* section panel */}
      {panelOpen && docked && Content && (
        <aside
          style={{ "--accent": docked.accent } as React.CSSProperties}
          className="panel-enter pointer-events-auto absolute inset-x-3 bottom-20 top-auto max-h-[56vh] overflow-hidden rounded-2xl border border-ink/10 bg-salt/90 shadow-2xl shadow-ink/20 backdrop-blur-xl md:inset-x-auto md:bottom-24 md:right-6 md:top-24 md:max-h-none md:w-[27rem]"
        >
          <header className="relative border-b border-ink/10 px-5 pb-4 pt-5">
            <span className="absolute inset-x-0 top-0 h-1 bg-(--accent)" />
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-(--accent)">
              {docked.caisName}
            </p>
            <h2 className="mt-1 font-display text-2xl text-ink">{docked.label}</h2>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-ink/45 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            >
              ✕
            </button>
          </header>
          <div className="panel-body panel-scroll max-h-[calc(56vh-92px)] space-y-5 overflow-y-auto px-5 py-5 md:max-h-[calc(100vh-12rem-92px)]">
            <Content />
          </div>
        </aside>
      )}
    </div>
  );
}
