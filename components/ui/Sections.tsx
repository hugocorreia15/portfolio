import Image from "next/image";
import {
  doiUrl,
  OWNER_AUTHOR,
  profile,
  type ProjectEntry,
  type Publication,
  type SectionId,
} from "@/data/profile";

// ── shared bits (also used by the /cv page) ─────────────────────────────────

export function Chips({ items }: { items: string[] }) {
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

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
      {children}
    </h3>
  );
}

/** Author list with the owner's name set in bold. */
export function Authors({ authors }: { authors: string[] }) {
  return (
    <>
      {authors.map((a, i) => (
        <span key={a}>
          {a === OWNER_AUTHOR ? <strong className="font-semibold text-ink">{a}</strong> : a}
          {i < authors.length - 1 ? ", " : ""}
        </span>
      ))}
    </>
  );
}

function ExtLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`underline-offset-2 hover:underline ${className}`}
    >
      {children}
    </a>
  );
}

const STATUS_STYLE: Record<Publication["status"], string> = {
  published: "bg-emerald-600/10 text-emerald-800",
  "in press": "bg-sky-600/10 text-sky-800",
  "under review": "bg-amber-500/15 text-amber-800",
};

export function PublicationItem({ pub }: { pub: Publication }) {
  return (
    <article className="rounded-xl border border-ink/10 bg-white/65 p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] uppercase tracking-wider text-ink/50">
        <span>{pub.year}</span>
        <span aria-hidden>·</span>
        <span>{pub.kind}</span>
        <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${STATUS_STYLE[pub.status]}`}>
          {pub.status}
        </span>
      </div>
      <h3 className="mt-1.5 font-display text-[15.5px] leading-snug text-ink">
        {pub.doi ? (
          <ExtLink href={doiUrl(pub.doi)} className="decoration-(--accent)">
            {pub.title} <span className="text-(--accent)">↗</span>
          </ExtLink>
        ) : (
          pub.title
        )}
      </h3>
      {pub.authors.length > 0 && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/65">
          <Authors authors={pub.authors} />
        </p>
      )}
      <p className="mt-0.5 text-[12.5px] italic leading-relaxed text-ink/55">{pub.venue}</p>
    </article>
  );
}

function ProjectLinks({ project }: { project: ProjectEntry }) {
  return (
    <span className="flex shrink-0 gap-2 font-mono text-[11px]">
      {project.link && (
        <ExtLink href={project.link} className="text-azulejo">
          live ↗
        </ExtLink>
      )}
      {project.paper && (
        <ExtLink href={doiUrl(project.paper)} className="text-(--accent)">
          paper ↗
        </ExtLink>
      )}
      {project.repo && (
        <ExtLink href={project.repo} className="text-ink/55">
          code ↗
        </ExtLink>
      )}
    </span>
  );
}

// ── panel sections ──────────────────────────────────────────────────────────

function AboutContent() {
  return (
    <>
      <div className="flex items-center gap-4">
        <Image
          src="/images/hugo-portrait.webp"
          alt="Portrait of Hugo Correia"
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-full object-cover ring-2 ring-(--accent)/40"
        />
        <div>
          <p className="font-display text-lg leading-tight text-ink">{profile.name}</p>
          <p className="text-sm text-ink/60">{profile.title}</p>
          <p className="font-mono text-[11px] text-ink/45">{profile.location}</p>
        </div>
      </div>
      <p className="rounded-lg border border-(--accent)/30 bg-(--accent)/10 px-3 py-2 text-[13px] text-ink/80">
        <span className="mr-1.5" aria-hidden>
          ⚓
        </span>
        {profile.status}
      </p>
      {profile.about.map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="text-[15px] leading-relaxed text-ink/80">
          {paragraph}
        </p>
      ))}
      <div className="space-y-2">
        <SectionHeading>Research interests</SectionHeading>
        <Chips items={profile.researchInterests} />
      </div>
      <div className="space-y-2">
        <SectionHeading>Languages</SectionHeading>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
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
  const { leadership, community } = profile;
  return (
    <>
      <SectionHeading>Research</SectionHeading>
      <ol className="space-y-6">
        {profile.experience.map((entry) => (
          <li key={entry.role} className="relative border-l border-ink/15 pl-5">
            <span className="absolute -left-[5.5px] top-1.5 size-2.5 rounded-full bg-(--accent)" />
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink/50">
              {entry.period}
            </p>
            <h3 className="mt-0.5 font-display text-lg leading-snug text-ink">{entry.role}</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-ink/60">{entry.org}</p>
            {entry.context && (
              <p className="mt-0.5 text-[12px] leading-snug text-ink/45">{entry.context}</p>
            )}
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-ink/75 marker:text-ink/30">
              {entry.points.map((point) => (
                <li key={point.slice(0, 24)}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="space-y-3 border-t border-ink/10 pt-5">
        <SectionHeading>Leadership</SectionHeading>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink/50">
            {leadership.period}
          </p>
          <h3 className="mt-0.5 font-display text-lg leading-snug text-ink">{leadership.org}</h3>
          <p className="text-[13px] text-ink/60">{leadership.place}</p>
        </div>
        <ul className="space-y-2.5">
          {leadership.roles.map((r) => (
            <li key={r.title} className="rounded-lg bg-white/55 px-3 py-2">
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">{r.title}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-ink/45">{r.period}</span>
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink/70">{r.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-[13px] leading-relaxed text-ink/65">{leadership.note}</p>
      </div>

      <div className="space-y-2.5 border-t border-ink/10 pt-5">
        <SectionHeading>Community & events</SectionHeading>
        <ul className="space-y-2">
          {community.map((c) => (
            <li key={c.name} className="text-[13px] leading-relaxed text-ink/70">
              <span className="font-medium text-ink">{c.name}</span>
              <span className="font-mono text-[10.5px] text-ink/45"> · {c.when}</span>
              <br />
              {c.text}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function PublicationsContent() {
  const peer = profile.publications.filter((p) => p.status !== "under review").length;
  const review = profile.publications.length - peer;
  return (
    <>
      <p className="text-[14px] leading-relaxed text-ink/75">
        {peer} peer-reviewed papers and book chapters in HCI, XR and intelligent systems
        {review > 0 ? `, plus ${review} under review` : ""}. The full record is on{" "}
        <ExtLink href={profile.orcid} className="text-azulejo">
          ORCID ↗
        </ExtLink>
        .
      </p>
      <div className="space-y-3">
        {profile.publications.map((pub) => (
          <PublicationItem key={pub.title} pub={pub} />
        ))}
      </div>
    </>
  );
}

function ProjectsContent() {
  const featured = profile.projects.filter((p) => p.featured);
  const more = profile.projects.filter((p) => !p.featured);
  return (
    <>
      <div className="space-y-3">
        {featured.map((project) => (
          <article
            key={project.name}
            className="rounded-xl border border-ink/10 bg-white/65 p-4 shadow-[0_1px_0_rgba(22,50,74,0.06)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-base text-ink">
                {project.name}
                <span className="ml-2 font-sans text-[12px] text-ink/50">{project.tagline}</span>
              </h3>
              <ProjectLinks project={project} />
            </div>
            <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-wider text-ink/45">
              {project.year} · {project.role}
            </p>
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
      <div className="space-y-2 border-t border-ink/10 pt-4">
        <SectionHeading>More</SectionHeading>
        <ul className="divide-y divide-ink/10">
          {more.map((project) => (
            <li key={project.name} className="py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-ink">
                  <span className="font-medium">{project.name}</span>
                  <span className="text-ink/50"> · {project.tagline}</span>
                </p>
                <ProjectLinks project={project} />
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink/60">{project.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
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
        <article key={entry.degree} className="rounded-xl border border-ink/10 bg-white/65 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base leading-snug text-ink">{entry.degree}</h3>
              <p className="mt-0.5 text-[13px] text-ink/60">{entry.school}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink/45">{entry.period}</p>
            </div>
            {entry.grade && (
              <span className="shrink-0 rounded-lg bg-(--accent)/12 px-2 py-1 font-mono text-[11px] font-medium text-ink/80">
                {entry.grade}
              </span>
            )}
          </div>
          {entry.thesis && (
            <div className="mt-3 rounded-lg border-l-2 border-(--accent) bg-(--accent)/[0.07] px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">
                Dissertation · {entry.thesis.grade}
              </p>
              <p className="mt-0.5 font-display text-[14px] italic leading-snug text-ink">
                “{entry.thesis.title}”
              </p>
              <p className="mt-1 text-[12px] text-ink/60">{entry.thesis.supervisors}</p>
            </div>
          )}
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
          {entry.coursework && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink/55">
              Coursework: {entry.coursework}
            </p>
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
    { label: "GitHub", value: "@hugocorreia15", href: profile.github },
    { label: "LinkedIn", value: "hugo-correia", href: profile.linkedin },
    { label: "ORCID", value: profile.orcidId, href: profile.orcid },
  ];
  return (
    <>
      <p className="text-[15px] leading-relaxed text-ink/80">
        The lighthouse marks the end of the route, but it&apos;s where new journeys start. I&apos;m
        happy to talk about research, collaborations and anything HCI.
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <a
            key={row.label}
            href={row.href}
            target={row.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="group flex items-baseline justify-between gap-3 rounded-lg border border-ink/10 bg-white/65 px-3.5 py-2.5 transition-colors hover:border-(--accent)"
          >
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink/45">
              {row.label}
            </span>
            <span className="truncate text-sm text-ink/85 group-hover:text-ink">{row.value}</span>
          </a>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {profile.cv.map((doc) => (
          <a
            key={doc.href}
            href={doc.href}
            download
            className="rounded-xl bg-azulejo px-3 py-2.5 text-center text-salt shadow-lg shadow-azulejo/25 transition-transform hover:-translate-y-0.5"
          >
            <span className="block font-display text-[15px]">{doc.label} ↓</span>
            <span className="block font-mono text-[10px] uppercase tracking-wider text-salt/70">
              {doc.detail} · PDF
            </span>
          </a>
        ))}
      </div>
      <a
        href="/cv"
        className="block text-center font-mono text-[11px] text-ink/55 underline-offset-2 hover:text-azulejo hover:underline"
      >
        or read everything as a plain page →
      </a>
    </>
  );
}

export const SECTION_CONTENT: Record<SectionId, () => React.ReactNode> = {
  about: AboutContent,
  experience: ExperienceContent,
  publications: PublicationsContent,
  projects: ProjectsContent,
  skills: SkillsContent,
  education: EducationContent,
  contact: ContactContent,
};
