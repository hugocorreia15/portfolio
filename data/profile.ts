export type SectionId =
  | "about"
  | "experience"
  | "publications"
  | "projects"
  | "skills"
  | "education"
  | "contact";

export interface ExperienceEntry {
  role: string;
  org: string;
  /** project / funding line shown under the organisation */
  context?: string;
  period: string;
  points: string[];
}

export interface LeadershipRole {
  title: string;
  period: string;
  text: string;
}

export interface CommunityEntry {
  name: string;
  when: string;
  text: string;
}

export type PublicationStatus = "published" | "in press" | "under review";

export interface Publication {
  /** "Surname, I." — the owner's name is highlighted wherever it appears */
  authors: string[];
  year: number;
  title: string;
  venue: string;
  kind: "Conference paper" | "Book chapter" | "Short paper" | "Preprint";
  status: PublicationStatus;
  doi?: string;
}

export interface ProjectEntry {
  name: string;
  tagline: string;
  year: number;
  role: string;
  description: string;
  tech: string[];
  link?: string;
  repo?: string;
  /** DOI of the paper the project led to */
  paper?: string;
  /** featured projects lead the panel; the rest go under "More" */
  featured?: boolean;
}

export interface EducationEntry {
  degree: string;
  school: string;
  period: string;
  grade?: string;
  thesis?: { title: string; grade: string; supervisors: string };
  highlights?: string[];
  coursework?: string;
}

export const OWNER_AUTHOR = "Correia, H.";

export const profile = {
  name: "Hugo Correia",
  title: "HCI Researcher · Software Engineer",
  status: "Next stop: a PhD in Human-Computer Interaction",
  location: "Aveiro, Portugal",
  email: "hf_correya@hotmail.com",
  emailAlt: "hf.correia@ua.pt",
  github: "https://github.com/hugocorreia15",
  linkedin: "https://www.linkedin.com/in/hugo-correia-3634a52a3/",
  orcid: "https://orcid.org/0009-0009-0206-5346",
  orcidId: "0009-0009-0206-5346",
  cv: [
    { label: "CV", detail: "2 pages", href: "/cv/Hugo-Correia-CV.pdf" },
    { label: "Scientific CV", detail: "full record", href: "/cv/Hugo-Correia-Scientific-CV.pdf" },
  ],
  about: [
    "I'm a Human-Computer Interaction researcher and software engineer from Aveiro. I hold an MSc in Informatics Engineering from the University of Aveiro (2026), where my dissertation, “In the Eye of the Beholder” (graded 20/20), explored how gaze can support the evaluation of interactive ecosystems.",
    "From 2024 to 2026 I was a research fellow at IEETA. In the SENSINGHOME project I built BEHOLD, a hardware-agnostic eye-tracking infrastructure, and Avalux, a usability-testing platform, and ran user studies of Bosch touch-panel interfaces. In CADFACTS I worked with cardiologists and biomedical engineers on clinical workflows for cardiac CT analysis.",
    "Alongside research I spent five years leading the Computer Science Students' Association (NEI / AAUAv), most recently as its coordinator: hackathons, technical workshops, outreach with secondary schools and some of the largest student events on campus.",
  ],
  researchInterests: [
    "Eye Tracking & Gaze Analysis",
    "Usability Evaluation",
    "Multimodal Interaction",
    "Virtual & Extended Reality",
    "Data Engineering",
    "Machine Learning",
    "Software Engineering",
  ],
  softSkills: [
    "Leadership",
    "Team Management",
    "Problem-solving",
    "Creativity",
    "Adaptability",
    "Critical Thinking",
  ],
  experience: [
    {
      role: "Research Fellow — SENSINGHOME",
      org: "IEETA / DETI, University of Aveiro",
      context: "Agenda ILLIANCE · Recovery and Resilience Plan (PRR) · with Bosch and Maxiplás",
      period: "Sep 2024 – Jun 2026",
      points: [
        "Designed and built BEHOLD, a plugin-based, hardware-agnostic framework for gaze-aware evaluation of interactive ecosystems: several eye-tracking devices, real-time multimodal synchronisation via Lab Streaming Layer (LSL), and integrated collection, analysis and visualisation.",
        "Developed Avalux (avalux.pt), a platform for running usability-testing sessions.",
        "Planned and conducted usability studies of Bosch seamless touch-panel interfaces, from protocol design to analysis and reporting.",
      ],
    },
    {
      role: "Research Fellow — CADFACTS",
      org: "IEETA / DETI, University of Aveiro",
      context: "FCT project PTDC/EMD-EMD/0980/2020 · with FEUP and Centro Hospitalar de Vila Nova de Gaia",
      period: "2024 – 2025",
      points: [
        "Human-centred design and development of support for clinical workflows in left-ventricular CT image analysis, working directly with clinicians to find usability issues and propose improvements.",
        "Published at HCI International 2025.",
      ],
    },
    {
      role: "XR Research Project — SpeakEase",
      org: "IEETA / DETI, University of Aveiro",
      period: "2025 – 2026",
      points: [
        "Co-developed a VR framework for public-speaking training (Unity, Meta Quest 3) with configurable virtual audiences, real-time speech analysis and analytics dashboards for students and therapists.",
        "Ran user studies on learnability and task completion; the work led to two 2026 papers (Eurographics and IHIET-FS).",
      ],
    },
    {
      role: "Research Collaborator — VARLab",
      org: "IEETA / DETI, University of Aveiro",
      context: "Prevent2Protect project",
      period: "2025 – 2026",
      points: [
        "Contributed to the design and development of a platform for collecting cognition-related measures.",
      ],
    },
  ] satisfies ExperienceEntry[],
  leadership: {
    org: "NEI / AAUAv — Computer Science Students' Association",
    place: "University of Aveiro",
    period: "2021 – 2026",
    roles: [
      {
        title: "Coordinator",
        period: "2024 – 2026",
        text: "Overall coordination, representation in department meetings and strategic planning, including structured input on student wellbeing during exams and on AI in education.",
      },
      {
        title: "Head of Recreation",
        period: "2022 – 2024",
        text: "Planning and running the association's events and social activities.",
      },
      {
        title: "Head of Sports",
        period: "2021 – 2022",
        text: "Organising and managing the association's sports section.",
      },
    ] satisfies LeadershipRole[],
    note: "Also compiled a database of 830+ Portuguese tech companies for student–industry outreach.",
  },
  community: [
    {
      name: "DETIHub — DETI Job & Engineering Fair",
      when: "2025, 2026",
      text: "Co-organised with the DETI student associations, the department and Inova-Ria: company fair, workshops, talks and pitch sessions.",
    },
    {
      name: "Feira do DETI",
      when: "founder",
      text: "A marketplace for products made by local artisans and department students.",
    },
    {
      name: "Semana do Enterro",
      when: "2021 – 2026",
      text: "Six editions; most recently coordinated the association's themed venue and about 40 events.",
    },
    {
      name: "Sunset d'Engenharias",
      when: "2025 – 2026",
      text: "Large-scale event run jointly by the engineering student associations of AAUAv.",
    },
    {
      name: "ThinkTwice Hackathon",
      when: "in preparation",
      text: "Co-organised with AETTUA, including sponsor outreach and partner communication.",
    },
    {
      name: "Workshops, tutoring & outreach",
      when: "2021 – 2026",
      text: "Hands-on Docker and Kubernetes workshops, peer tutoring for introductory programming courses, and a cybersecurity-awareness workshop for secondary-school students.",
    },
  ] satisfies CommunityEntry[],
  publications: [
    {
      authors: ["Correia, H.", "Marques, B.", "Vale Costa, L.", "Silva, S."],
      year: 2026,
      title:
        "BEHOLD: An Extensible Eye-Tracking Infrastructure Supporting Multimodal, Multi-Device Interaction Evaluation",
      venue: "Human Interaction and Emerging Technologies (IHIET-FS 2026), AHFE International, Vol. 235",
      kind: "Conference paper",
      status: "published",
      doi: "10.54941/ahfe1007266",
    },
    {
      authors: ["Correia, H.", "Cardoso, L.", "Marques, B.", "Silva, S.", "Dias, P.", "Sousa Santos, B."],
      year: 2026,
      title: "SpeakEase: A Virtual Reality Framework for Public Speaking",
      venue: "Eurographics 2026 — Education Papers",
      kind: "Conference paper",
      status: "published",
      doi: "10.2312/eged.20261005",
    },
    {
      authors: ["Cardoso, L.", "Correia, H.", "Marques, B.", "Dias, P.", "Silva, S.", "Sousa Santos, B."],
      year: 2026,
      title:
        "An Adaptive XR Platform for Multimodal Public Speaking Training and Performance Assessment",
      venue: "Human Interaction and Emerging Technologies (IHIET-FS 2026), AHFE International, Vol. 235",
      kind: "Conference paper",
      status: "published",
      doi: "10.54941/ahfe1007283",
    },
    {
      authors: [
        "Ferreira, D.",
        "Correia, H.",
        "Cruz, D.",
        "Rosa, J.",
        "Oliveira, A.",
        "Cotorobai, A.",
        "Figueiredo, B.",
        "Pacheco, O.",
      ],
      year: 2026,
      title: "Trailblazer: A Machine Learning Augmented Destination Management System",
      venue: "CISTI 2025 — Lecture Notes in Networks and Systems, Springer",
      kind: "Book chapter",
      status: "published",
      doi: "10.1007/978-3-032-10721-3_12",
    },
    {
      authors: ["Correia, H.", "Marques, B.", "Silva, S."],
      year: 2025,
      title:
        "Open-Source Tools Are Just the Start: A Human-Centred Approach to Supporting Clinical Workflows for Left Ventricular CT Analysis",
      venue: "HCI International 2025 Posters — CCIS, Springer",
      kind: "Book chapter",
      status: "published",
      doi: "10.1007/978-3-031-94150-4_23",
    },
    {
      authors: [],
      year: 2026,
      title: "Federated learning framework for healthcare (FedRF / FedXGB)",
      venue: "Submitted to IEEE SaTML",
      kind: "Conference paper",
      status: "under review",
    },
  ] satisfies Publication[],
  projects: [
    {
      name: "BEHOLD",
      tagline: "Eye-tracking analysis platform",
      year: 2026,
      role: "Sole developer · MSc dissertation",
      description:
        "Plugin-based, hardware-agnostic infrastructure for gaze-data ingestion, processing and visualisation, validated in a 29-participant Tobii Pro Glasses study.",
      tech: ["Next.js", "TimescaleDB", "PostgreSQL", "MinIO", "LSL"],
      paper: "10.54941/ahfe1007266",
      featured: true,
    },
    {
      name: "Avalux",
      tagline: "Usability-testing platform",
      year: 2026,
      role: "Sole developer",
      description:
        "Test templates, live sessions, task metrics, error and hesitation logging, interviews and SUS scoring. Used to run the Bosch seamless-panel studies.",
      tech: ["Next.js", "TypeScript", "SUS"],
      link: "https://avalux.pt",
      repo: "https://github.com/hugocorreia15/usertesting",
      featured: true,
    },
    {
      name: "SpeakEase",
      tagline: "VR public-speaking trainer",
      year: 2025,
      role: "Full-stack developer · team of 2",
      description:
        "Configurable virtual audiences, real-time speech analysis and analytics dashboards for trainees and therapists, built with a Human-Centred Design process. Led to two 2026 papers.",
      tech: ["Unity", "Meta Quest 3", "Meta XR SDK", "Python"],
      paper: "10.2312/eged.20261005",
      featured: true,
    },
    {
      name: "DGA Detection System",
      tagline: "ML against botnet domains",
      year: 2025,
      role: "AI lead & browser extension · team of 2",
      description:
        "Detects algorithmically generated (botnet/C2) domains with six ML models, including Random Forest, LSTM, XGBoost, a Transformer and DistilBERT, behind a FastAPI backend, a React dashboard, a Chrome extension and Prometheus/Grafana monitoring.",
      tech: ["Python", "FastAPI", "React", "Docker"],
      repo: "https://github.com/hugocorreia15/mei_aas_pf",
      featured: true,
    },
    {
      name: "Quests@NEI",
      tagline: "Gamification platform",
      year: 2026,
      role: "System design & documentation · team of 4",
      description:
        "Microservices (authentication, gamification, commerce, analytics) to boost student engagement at NEI / AAUAv, with personas, user stories, the service architecture and a stateless JWT-based QR mechanism.",
      tech: ["Microservices", "JWT", "System design"],
      featured: true,
    },
    {
      name: "Relay",
      tagline: "Personalised messaging tool",
      year: 2026,
      role: "Personal project",
      description:
        "Personalised bulk messaging with delivery status, read receipts, scheduling and rate-safety controls.",
      tech: ["Next.js", "TypeScript"],
      link: "https://relay-omega-sage.vercel.app",
      repo: "https://github.com/hugocorreia15/relay",
      featured: true,
    },
    {
      name: "This Portfolio",
      tagline: "A moliceiro on the Ria",
      year: 2026,
      role: "Personal project",
      description:
        "Every pier is a chapter. Two maps: an imagined island loop and the real Aveiro canal network from OpenStreetMap, with a day–night cycle.",
      tech: ["Next.js", "Three.js", "React Three Fiber", "Tailwind"],
      repo: "https://github.com/hugocorreia15/portfolio",
    },
    {
      name: "SensingHome Examples",
      tagline: "Interaction examples",
      year: 2025,
      role: "Developer",
      description: "React + TypeScript component and interaction examples for the SensingHome project.",
      tech: ["React", "Vite", "shadcn/ui"],
      repo: "https://github.com/hugocorreia15/sensing_home_examples",
    },
    {
      name: "Sunset d'Engenharias",
      tagline: "Festival microsite",
      year: 2026,
      role: "Developer",
      description: "Fast, playful, mobile-first microsite for the engineering students' sunset party.",
      tech: ["React", "Vite", "Tailwind v4"],
      link: "https://sunset-eng.vercel.app",
      repo: "https://github.com/hugocorreia15/SunsetEng",
    },
    {
      name: "Count Me In",
      tagline: "Room occupancy service",
      year: 2023,
      role: "Team project",
      description:
        "Sensor service that keeps count of the people inside a room, for Introduction to Software Engineering.",
      tech: ["Java", "Spring Boot", "Kafka", "IoT"],
      repo: "https://github.com/hugocorreia15/IES_CountMeIn",
    },
    {
      name: "BrainWave",
      tagline: "HCI course project",
      year: 2023,
      role: "Team project",
      description: "Human-Computer Interaction project focused on usability-first design.",
      tech: ["JavaScript", "HCI"],
      repo: "https://github.com/hugocorreia15/BrainWave",
    },
  ] satisfies ProjectEntry[],
  skills: {
    "Research & HCI": [
      "User studies",
      "Usability testing & SUS",
      "Eye tracking (Tobii Pro Glasses)",
      "Human-Centred Design",
      "Multimodal sync (LSL)",
      "Information visualisation",
    ],
    Languages: ["TypeScript / JavaScript", "Python", "Java", "C", "C++", "Kotlin", "Ruby"],
    Web: [
      "React",
      "Next.js",
      "TanStack (Table, Query, Router)",
      "Tailwind CSS",
      "shadcn/ui",
      "Astro",
      "AngularJS",
      "jQuery",
    ],
    "Data & Backend": [
      "PostgreSQL",
      "TimescaleDB",
      "MongoDB",
      "Redis",
      "Cassandra",
      "Neo4j",
      "MariaDB",
      "MinIO",
      "Spring Boot",
      "FastAPI",
      "Flask",
      "Kafka",
      "RabbitMQ",
    ],
    "XR & 3D": ["Unity", "Meta Quest 3 / Meta XR SDK", "Three.js / React Three Fiber"],
    "ML & Cloud": [
      "TensorFlow",
      "NumPy",
      "OpenCV",
      "Docker",
      "Prometheus / Grafana",
      "AWS",
      "Azure",
      "Google Cloud",
    ],
  } as Record<string, string[]>,
  education: [
    {
      degree: "MSc in Informatics Engineering",
      school: "University of Aveiro",
      period: "Sep 2024 – Jun 2026",
      grade: "18 / 20",
      thesis: {
        title:
          "In the Eye of the Beholder: Considering gaze to support the evaluation and analysis of interactive ecosystems",
        grade: "20 / 20",
        supervisors: "Prof. Samuel Silva & Prof. Bernardo Marques (IEETA)",
      },
      highlights: ["Information Visualization — 19/20", "Pre-Dissertation — 18/20"],
      coursework:
        "Human-Centered Computing, Virtual & Augmented Reality, Information Visualization, Multimodal Interaction",
    },
    {
      degree: "BSc in Computer Science",
      school: "University of Aveiro",
      period: "Sep 2021 – Jun 2024",
      grade: "15.3 / 20",
      highlights: [
        "Final Project — 19/20",
        "Computer and Organizational Security — 19/20",
        "Introduction to Software Engineering — 17/20",
      ],
    },
    {
      degree: "Secondary School — Science and Technology",
      school: "Escola Secundária José Estevão, Aveiro",
      period: "Sep 2018 – Jul 2021",
      grade: "18.2 / 20",
    },
  ] satisfies EducationEntry[],
  languages: [
    { name: "Portuguese", level: "Native" },
    { name: "English", level: "Fluent" },
    { name: "Spanish", level: "Intermediate" },
  ],
};

export const doiUrl = (doi: string) => `https://doi.org/${doi}`;
