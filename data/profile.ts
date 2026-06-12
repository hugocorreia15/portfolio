export type SectionId =
  | "about"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "contact";

export interface ExperienceEntry {
  role: string;
  org: string;
  period: string;
  points: string[];
}

export interface ProjectEntry {
  name: string;
  description: string;
  tech: string[];
  link?: string;
  repo?: string;
}

export interface EducationEntry {
  degree: string;
  school: string;
  period: string;
  average?: string;
  highlights?: string[];
}

export const profile = {
  name: "Hugo Correia",
  title: "Software Engineer · MSc Student",
  location: "Aveiro, Portugal",
  email: "hf_correya@hotmail.com",
  emailAlt: "hf.correia@ua.pt",
  phone: "+351 911 584 192",
  github: "https://github.com/hugocorreia15",
  linkedin: "https://www.linkedin.com/in/hugo-correia-3634a52a3/",
  orcid: "https://orcid.org/0009-0009-0206-5346",
  about: [
    "I'm a computer engineering student at the University of Aveiro, currently doing my MSc while working as a researcher at IEETA on gaze-aware evaluation and medical imaging tools.",
    "I'm equipped with excellent communication skills in both English and Portuguese, and have experience in team management and problem solving — from leading research integrations with clinicians to organising large university events.",
  ],
  interests: ["Full Stack Development", "Data Engineering", "Software Architectures"],
  softSkills: [
    "Team Management",
    "Leadership",
    "Problem-solving",
    "Creativity",
    "Adaptability",
    "Critical Thinking",
  ],
  experience: [
    {
      role: "Research Grant",
      org: "Institute of Electronics and Informatics Engineering of Aveiro — IEETA",
      period: "Sep 2024 – Present",
      points: [
        "Designing and developing BEHOLD, a plugin-based framework for gaze-aware evaluation of interactive ecosystems: device-agnostic architecture for multiple eye-tracking platforms, real-time multimodal synchronization via Lab Streaming Layer (LSL), and integrated data collection, analysis and visualization for distributed deployments.",
        "Designing and developing a modular framework to support research on advanced medical imaging technologies, integrating a multidisciplinary team of cardiologists, computer science engineers and biomechanical engineers.",
      ],
    },
    {
      role: "Published Author — HCI International 2025",
      org: "Open-Source Tools are Just the Start: A Human-Centred Approach to Supporting Clinical Workflows for Left Ventricular CT Analysis",
      period: "Feb 2025 – Present",
      points: [
        "Authors: Hugo Correia, Bernardo Marques, Samuel Silva (2025).",
        "Human-centred integration of the OHIF Viewer in clinical workflows for left-ventricular CT image analysis — identifying key usability issues and proposing improvements for accessibility and efficiency in medical imaging.",
      ],
    },
    {
      role: "Coordinator · Head of Recreation · Head of Sports",
      org: "Núcleo de Estudantes de Informática — NEI",
      period: "2021 – Present",
      points: [
        "Leading diverse teams and organising leisure and sports events for the informatics student community.",
        "Strengthened leadership, team coordination and logistical planning by delivering high-profile university events.",
      ],
    },
  ] satisfies ExperienceEntry[],
  projects: [
    {
      name: "BEHOLD",
      description:
        "Plugin-based framework for gaze-aware evaluation of interactive ecosystems — device-agnostic eye-tracking support and real-time multimodal sync via LSL. Developed at IEETA.",
      tech: ["Python", "LSL", "Eye Tracking", "Data Viz"],
    },
    {
      name: "Left-Ventricular CT Analysis Workflows",
      description:
        "Human-centred integration of the OHIF Viewer for clinical left-ventricular CT analysis. Published at HCI International 2025.",
      tech: ["OHIF", "Medical Imaging", "UX Research"],
    },
    {
      name: "Sunset d'Engenharias 2026",
      description:
        "Festival microsite for the engineering students' sunset party — fast, playful and mobile-first.",
      tech: ["React", "Vite", "Tailwind v4"],
      link: "https://sunset-eng.vercel.app",
      repo: "https://github.com/hugocorreia15/SunsetEng",
    },
    {
      name: "Count Me In",
      description:
        "Automatic sensor service that controls the number of people inside a room — group project for Introduction to Software Engineering.",
      tech: ["Java", "Spring Boot", "IoT", "Kafka"],
      repo: "https://github.com/hugocorreia15/IES_CountMeIn",
    },
    {
      name: "BrainWave",
      description: "Human-Computer Interaction project focused on usability-first design.",
      tech: ["JavaScript", "HCI"],
      repo: "https://github.com/hugocorreia15/BrainWave",
    },
    {
      name: "This Portfolio",
      description:
        "A moliceiro sailing the Ria de Aveiro, where every pier is a chapter — built with React Three Fiber. Two maps: an imagined island loop and the real Aveiro canal network.",
      tech: ["Next.js", "Three.js", "R3F", "Tailwind"],
      repo: "https://github.com/hugocorreia15/portfolio",
    },
  ] satisfies ProjectEntry[],
  skills: {
    "Programming Languages": [
      "TypeScript / JavaScript",
      "Java",
      "Python",
      "Ruby",
      "C",
      "C++",
      "Kotlin",
    ],
    "Web Development": [
      "React",
      "Next.js",
      "Angular",
      "Astro",
      "Tailwind CSS",
      "shadcn/ui",
      "TanStack (Table, Query, Router)",
      "jQuery",
      "HTML & CSS",
    ],
    Databases: [
      "PostgreSQL",
      "MongoDB",
      "Redis",
      "Cassandra",
      "Neo4j",
      "MariaDB",
      "SQL",
      "MinIO",
    ],
    "Frameworks & Related": [
      "Spring Boot",
      "Flask",
      "FastAPI",
      "TensorFlow",
      "NumPy",
      "OpenCV",
      "Kafka",
      "RabbitMQ",
    ],
    "Cloud Computing": ["AWS", "Azure", "Google Cloud"],
  } as Record<string, string[]>,
  education: [
    {
      degree: "MSc in Computer Science",
      school: "University of Aveiro",
      period: "Sep 2024 – Present",
      average: "17.3 / 20",
      highlights: [
        "Information Visualization — 19/20",
        "Pre-Dissertation — 18/20",
        "Advanced Algorithms — 18/20",
      ],
    },
    {
      degree: "BSc in Computer Science",
      school: "University of Aveiro",
      period: "Oct 2020 – Jun 2024",
      average: "15.3 / 20",
      highlights: [
        "BSc Final Project — 19/20",
        "Computer and Organizational Security — 19/20",
        "Introduction to Software Engineering — 17/20",
      ],
    },
    {
      degree: "Science and Technology",
      school: "Escola Secundária José Estevão, Aveiro",
      period: "Sep 2018 – Jul 2021",
      average: "18.2 / 20",
    },
  ] satisfies EducationEntry[],
  languages: [
    { name: "Portuguese", level: "Native" },
    { name: "English", level: "Fluent" },
  ],
};
