import { BriefcaseBusiness, Code, GraduationCap, Mail, User } from "@lucide/astro";
import { icons as akarIcons } from "@iconify-json/akar-icons";
import { icons as deviconPlainIcons } from "@iconify-json/devicon-plain";
import { icons as devIcons } from "@iconify-json/devicon";
import { siGit, siGithub, siPython, siWhatsapp } from "simple-icons";

/** Inner SVG markup from a trusted icon package, rendered by `SvgIcon.astro`. */
export interface SvgIconData {
  readonly body: string;
  readonly viewBox: string;
}

function iconBody(set: { icons: Record<string, { body: string }> }, name: string): string {
  const icon = set.icons[name];
  if (!icon) throw new Error(`Icon "${name}" is missing from its icon package.`);
  return icon.body;
}
const solid = (body: string) => body.replaceAll(/fill="[^"]+"/g, 'fill="currentColor"');
const simpleIcon = (icon: { path: string }): SvgIconData => ({
  body: `<path fill="currentColor" d="${icon.path}" />`,
  viewBox: "0 0 24 24",
});

/** Icons that config and content name by ID. Unknown names fail the build rather than rendering nothing. */
export const navigationIcons = {
  user: User,
  code: Code,
  briefcase: BriefcaseBusiness,
  "graduation-cap": GraduationCap,
  mail: Mail,
};

/** The hexagon C logo from the legacy site (public/images/skills/c-program-icon.svg), with its CSS classes inlined as fills. */
const cHexagon: SvgIconData = {
  viewBox: "0 0 109.19 122.88",
  body: [
    ["#3949AB", "M107.81,92.16c0.86-1.48,1.39-3.16,1.39-4.66V35.38c0-1.5-0.53-3.17-1.39-4.66L54.6,61.44L107.81,92.16z"],
    ["#283593", "M59.33,121.75l45.14-26.06c1.3-0.75,2.48-2.05,3.34-3.53L54.6,61.44L1.39,92.16c0.86,1.48,2.04,2.78,3.34,3.53l45.14,26.06C52.47,123.25,56.72,123.25,59.33,121.75z"],
    ["#5C6BC0", "M107.81,30.72c-0.86-1.48-2.04-2.78-3.34-3.53L59.33,1.13c-2.6-1.5-6.86-1.5-9.46,0L4.73,27.19C2.13,28.69,0,32.38,0,35.38V87.5c0,1.5,0.53,3.17,1.39,4.66L54.6,61.44L107.81,30.72z"],
    ["#FFFFFF", "M54.6,97.84c-20.07,0-36.4-16.33-36.4-36.4s16.33-36.4,36.4-36.4c12.95,0,25.03,6.97,31.52,18.19l-15.75,9.12c-3.25-5.62-9.29-9.1-15.77-9.1c-10.04,0-18.2,8.16-18.2,18.2c0,10.03,8.16,18.2,18.2,18.2c6.48,0,12.52-3.49,15.77-9.1l15.75,9.12C79.63,90.87,67.55,97.84,54.6,97.84z"],
  ]
    .map(([fill, d]) => `<path fill-rule="evenodd" fill="${fill}" d="${d}"/>`)
    .join(""),
};

const colored = (name: string): SvgIconData => ({ body: iconBody(devIcons, name), viewBox: "0 0 128 128" });

/** Skill logos per theme variant (`theme.variants.skillIcons`); both sets must name the same skills. */
export const skillIcons = {
  monochrome: {
    c: { body: solid(deviconPlainIcons.icons.c.body), viewBox: "0 0 128 128" },
    git: simpleIcon(siGit),
    java: { body: solid(devIcons.icons.java.body), viewBox: "0 0 128 128" },
    oracle: { body: solid(devIcons.icons.oracle.body), viewBox: "0 0 128 128" },
    postgresql: { body: solid(akarIcons.icons["postgresql-fill"].body), viewBox: "0 0 24 24" },
    python: simpleIcon(siPython),
  },
  brand: {
    c: cHexagon,
    git: colored("git"),
    java: colored("java"),
    oracle: colored("sqldeveloper"),
    postgresql: colored("postgresql"),
    python: colored("python"),
  },
} satisfies Record<"brand" | "monochrome", Record<string, SvgIconData>>;

export const brandIcons = {
  github: simpleIcon(siGithub),
  linkedin: { body: akarIcons.icons["linkedin-fill"].body, viewBox: "0 0 24 24" },
  whatsapp: simpleIcon(siWhatsapp),
} satisfies Record<string, SvgIconData>;

export function iconNamed<T>(registry: Readonly<Record<string, T>>, name: string, kind: string): T {
  const icon = registry[name];
  if (icon === undefined) throw new Error(`${kind} icon "${name}" is not available (known: ${Object.keys(registry).join(", ")}).`);
  return icon;
}
